/**
 * DaemonManager — manages the `ezagent serve` subprocess lifecycle.
 *
 * Responsibilities:
 * - Spawn / stop / restart the ezagent daemon process
 * - Monitor process health via the HTTP /api/status endpoint
 * - Automatically restart on crash with exponential backoff
 *
 * NOTE: This file uses Node child_process APIs and runs in the Electron
 * main process. It is NOT unit-testable in Vitest (jsdom).
 *
 * The pure helper functions (getDaemonCommand, getHealthCheckUrl,
 * calculateBackoff) are duplicated in src/lib/electron/daemon-config.ts
 * where they are independently tested via Vitest. Any changes to the
 * constants or formulas below MUST be mirrored there.
 */

import { ChildProcess, spawn } from 'child_process';
import http from 'http';
import path from 'path';

// --- Constants (mirrored in src/lib/electron/daemon-config.ts for testing) ---

const DAEMON_PORT = 6142;
const MAX_BACKOFF_MS = 30_000;
const BASE_BACKOFF_MS = 1_000;

export type DaemonStatus = 'stopped' | 'starting' | 'running' | 'error';

// --- Pure helpers (mirrored in src/lib/electron/daemon-config.ts) ---

/**
 * Returns the command to start the daemon using the bundled Python runtime.
 * In production: uses `{resourcesPath}/runtime/bin/python3.12`
 * In development: uses `python3.12` on PATH
 */
function getDaemonCommand(): { command: string; args: string[] } {
  let pythonBin = 'python3.12';
  try {
    // In packaged app, process.resourcesPath points to the app's Resources dir
    const resourcesPath = process.resourcesPath;
    const bundledPython = path.join(resourcesPath, 'runtime', 'bin', 'python3.12');
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const fs = require('fs');
    if (fs.existsSync(bundledPython)) {
      pythonBin = bundledPython;
    }
  } catch {
    // process.resourcesPath may not exist in dev; fall through to PATH
  }
  return {
    command: pythonBin,
    args: ['-m', 'uvicorn', 'ezagent.server:app', '--host', '127.0.0.1', '--port', String(DAEMON_PORT)],
  };
}

function getHealthCheckUrl(): string {
  return `http://localhost:${DAEMON_PORT}/api/status`;
}

function calculateBackoff(attempt: number): number {
  return Math.min(BASE_BACKOFF_MS * Math.pow(2, attempt), MAX_BACKOFF_MS);
}

// --- DaemonManager ---

export class DaemonManager {
  private process: ChildProcess | null = null;
  private _status: DaemonStatus = 'stopped';
  private restartAttempt = 0;
  private restartTimer: ReturnType<typeof setTimeout> | null = null;
  private autoRestart = true;

  /** Current daemon status. */
  get status(): DaemonStatus {
    return this._status;
  }

  /**
   * Starts the ezagent daemon subprocess.
   * If the daemon is already running, this is a no-op.
   */
  start(): void {
    if (this.process && this._status !== 'stopped' && this._status !== 'error') {
      return; // already running or starting
    }

    this.autoRestart = true;
    this._status = 'starting';

    const { command, args } = getDaemonCommand();

    this.process = spawn(command, args, {
      stdio: 'pipe',
      detached: false,
      env: {
        ...process.env,
      },
    });

    this.process.on('error', (err: Error) => {
      console.error('[DaemonManager] Failed to start daemon:', err.message);
      this._status = 'error';
      this.process = null;
      this.scheduleRestart();
    });

    this.process.on('exit', (code, signal) => {
      console.log(`[DaemonManager] Daemon exited: code=${code} signal=${signal}`);
      this.process = null;

      if (this.autoRestart) {
        this._status = 'error';
        this.scheduleRestart();
      } else {
        this._status = 'stopped';
      }
    });

    // Once spawned, poll for health to confirm it's running.
    setTimeout(() => {
      if (this._status === 'starting') {
        this.healthCheck().then((ok) => {
          if (ok) {
            this._status = 'running';
            this.restartAttempt = 0; // reset backoff on successful start
          }
        });
      }
    }, 500);
  }

  /**
   * Stops the daemon subprocess gracefully.
   * Sends SIGTERM first; if the process doesn't exit within 5 seconds,
   * sends SIGKILL.
   */
  stop(): Promise<void> {
    this.autoRestart = false;
    this.clearRestartTimer();

    if (!this.process) {
      this._status = 'stopped';
      return Promise.resolve();
    }

    return new Promise<void>((resolve) => {
      const killTimeout = setTimeout(() => {
        if (this.process) {
          console.warn('[DaemonManager] Force-killing daemon (SIGKILL)');
          this.process.kill('SIGKILL');
        }
      }, 5_000);

      this.process!.once('exit', () => {
        clearTimeout(killTimeout);
        this.process = null;
        this._status = 'stopped';
        resolve();
      });

      this.process!.kill('SIGTERM');
    });
  }

  /**
   * Restarts the daemon (stop then start).
   */
  async restart(): Promise<void> {
    await this.stop();
    this.restartAttempt = 0;
    this.start();
  }

  /**
   * Returns true if the daemon subprocess is alive.
   */
  isRunning(): boolean {
    return this.process !== null && !this.process.killed;
  }

  /**
   * Performs an HTTP health check against the daemon API.
   * Returns true if the daemon responds with a 2xx status.
   */
  healthCheck(): Promise<boolean> {
    const url = getHealthCheckUrl();
    return new Promise<boolean>((resolve) => {
      const req = http.get(url, (res) => {
        resolve(res.statusCode !== undefined && res.statusCode >= 200 && res.statusCode < 300);
        res.resume(); // consume response data to free memory
      });
      req.on('error', () => resolve(false));
      req.setTimeout(3_000, () => {
        req.destroy();
        resolve(false);
      });
    });
  }

  // --- Private helpers ---

  private scheduleRestart(): void {
    if (!this.autoRestart) return;
    this.clearRestartTimer();

    const delay = calculateBackoff(this.restartAttempt);
    console.log(
      `[DaemonManager] Scheduling restart attempt ${this.restartAttempt + 1} in ${delay}ms`
    );

    this.restartTimer = setTimeout(() => {
      this.restartAttempt++;
      this.start();
    }, delay);
  }

  private clearRestartTimer(): void {
    if (this.restartTimer) {
      clearTimeout(this.restartTimer);
      this.restartTimer = null;
    }
  }
}
