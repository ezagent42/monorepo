/**
 * Pure utility functions for the daemon manager.
 *
 * These are extracted from electron/daemon.ts so they can be unit-tested
 * in Vitest (which runs in jsdom and cannot import Electron APIs).
 */

/** Default port for the ezagent HTTP API. */
export const DAEMON_PORT = 6142;

/** Maximum backoff delay in milliseconds (30 seconds). */
export const MAX_BACKOFF_MS = 30_000;

/** Base backoff delay in milliseconds. */
export const BASE_BACKOFF_MS = 1_000;

/** Status of the daemon process. */
export type DaemonStatus = 'stopped' | 'starting' | 'running' | 'error';

/**
 * Returns the command and arguments used to start the ezagent daemon.
 *
 * Uses the bundled Python runtime to launch the FastAPI server via uvicorn.
 * In production, the Python runtime is at `{resourcesPath}/runtime/bin/python3.12`.
 * In development, falls back to `python3.12` on PATH.
 *
 * @param resourcesPath - Electron's `process.resourcesPath` (or null in dev)
 */
export function getDaemonCommand(resourcesPath?: string): { command: string; args: string[] } {
  const pythonBin = resourcesPath
    ? `${resourcesPath}/runtime/bin/python3.12`
    : 'python3.12';
  return {
    command: pythonBin,
    args: ['-m', 'uvicorn', 'ezagent.server:app', '--host', '127.0.0.1', '--port', String(DAEMON_PORT)],
  };
}

/**
 * Returns the URL for the daemon health-check endpoint.
 *
 * The daemon exposes `GET /api/status` on localhost at the configured port.
 */
export function getHealthCheckUrl(): string {
  return `http://localhost:${DAEMON_PORT}/api/status`;
}

/**
 * Calculates exponential backoff delay for daemon restart attempts.
 *
 * Formula: min(BASE_BACKOFF_MS * 2^attempt, MAX_BACKOFF_MS)
 *
 * @param attempt - Zero-based attempt number (0 = first retry)
 * @returns Delay in milliseconds before the next restart attempt
 */
export function calculateBackoff(attempt: number): number {
  const delay = BASE_BACKOFF_MS * Math.pow(2, attempt);
  return Math.min(delay, MAX_BACKOFF_MS);
}
