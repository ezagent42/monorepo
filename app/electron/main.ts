import { app, BrowserWindow, ipcMain } from 'electron';
import path from 'path';
import { startGitHubOAuth, getStoredCredentials, clearCredentials } from './auth';
import { DaemonManager } from './daemon';
import { TrayManager } from './tray';

const PROTOCOL = 'ezagent';

let mainWindow: BrowserWindow | null = null;
let isQuitting = false;

// --- Daemon & Tray managers ---
const daemonManager = new DaemonManager();
const trayManager = new TrayManager(() => mainWindow);

// --- Deep Link: register as default protocol client ---
if (process.defaultApp) {
  // In development, register with the path to electron + script
  if (process.argv.length >= 2) {
    app.setAsDefaultProtocolClient(PROTOCOL, process.execPath, [
      path.resolve(process.argv[1]),
    ]);
  }
} else {
  app.setAsDefaultProtocolClient(PROTOCOL);
}

// --- Single instance lock (Windows/Linux deep link handling) ---
const gotTheLock = app.requestSingleInstanceLock();

if (!gotTheLock) {
  app.quit();
} else {
  // Windows/Linux: second-instance event fires when another instance is launched
  app.on('second-instance', (_event, commandLine) => {
    // The deep link URL is the last argument
    const url = commandLine.find((arg) => arg.startsWith(`${PROTOCOL}://`));
    if (url && mainWindow) {
      sendDeepLink(url);
    }
    // Focus the existing window
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.focus();
    }
  });
}

// --- macOS: open-url event ---
app.on('open-url', (event, url) => {
  event.preventDefault();
  if (mainWindow) {
    sendDeepLink(url);
  }
});

function sendDeepLink(url: string) {
  if (mainWindow) {
    mainWindow.webContents.send('deep-link', url);
  }
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 800,
    minHeight: 600,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
    titleBarStyle: 'hiddenInset',
    show: false,
  });

  const isDev = process.env.NODE_ENV === 'development';
  if (isDev) {
    mainWindow.loadURL('http://localhost:3000');
  } else {
    mainWindow.loadFile(path.join(__dirname, '../out/index.html'));
  }

  mainWindow.once('ready-to-show', () => mainWindow?.show());

  // --- Window close behavior ---
  // On all platforms: closing the window hides it instead of quitting.
  // macOS: Cmd+Q or tray "Quit" sets isQuitting=true, then close actually closes.
  // Windows/Linux: closing hides to tray; tray "Quit" triggers app.quit().
  mainWindow.on('close', (event) => {
    if (!isQuitting) {
      event.preventDefault();
      mainWindow?.hide();
    }
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

// --- App lifecycle ---

app.whenReady().then(() => {
  // 1. Start the daemon subprocess
  daemonManager.start();

  // Update tray status based on daemon status changes
  // Poll briefly to pick up the 'running' status after health check
  const statusPoll = setInterval(() => {
    const status = daemonManager.status;
    const label = status.charAt(0).toUpperCase() + status.slice(1);
    trayManager.updateStatus(label);

    // Once running, we can slow down or stop polling
    if (status === 'running') {
      clearInterval(statusPoll);
    }
  }, 1_000);

  // Safety: stop polling after 60s regardless
  setTimeout(() => clearInterval(statusPoll), 60_000);

  // 2. Create the system tray
  trayManager.create();
  trayManager.updateStatus('Starting');

  // 3. Create the main window
  createWindow();
});

// --- before-quit: stop daemon, then quit ---
app.on('before-quit', async (event) => {
  if (!isQuitting) {
    isQuitting = true;
    event.preventDefault();

    try {
      await daemonManager.stop();
    } catch (err) {
      console.error('[main] Error stopping daemon:', err);
    }

    trayManager.destroy();
    app.quit();
  }
});

// --- IPC Handlers ---
ipcMain.handle('auth:github-oauth', async () => {
  return startGitHubOAuth();
});

ipcMain.handle('auth:get-credentials', async () => {
  return getStoredCredentials();
});

ipcMain.handle('auth:clear-credentials', async () => {
  return clearCredentials();
});

ipcMain.handle('app:version', () => {
  return app.getVersion();
});

ipcMain.handle('daemon:status', () => {
  return daemonManager.status;
});

ipcMain.handle('daemon:health-check', async () => {
  return daemonManager.healthCheck();
});

// --- Platform-specific behavior ---

// macOS: don't quit when all windows are closed (app lives in tray/dock)
// Windows/Linux: also don't quit (app lives in tray)
app.on('window-all-closed', () => {
  // No-op: the app stays alive in the system tray on all platforms.
  // Quitting is handled by the tray "Quit" action or Cmd+Q on macOS.
});

// macOS: re-create window when dock icon is clicked and no windows exist
app.on('activate', () => {
  if (!mainWindow) {
    createWindow();
  } else {
    mainWindow.show();
    mainWindow.focus();
  }
});
