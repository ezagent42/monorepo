import { app, BrowserWindow, ipcMain } from 'electron';
import path from 'path';
import { startGitHubOAuth, getStoredCredentials, clearCredentials } from './auth';

const PROTOCOL = 'ezagent';

let mainWindow: BrowserWindow | null = null;

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
  mainWindow.on('closed', () => { mainWindow = null; });
}

app.whenReady().then(createWindow);

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

app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit(); });
app.on('activate', () => { if (!mainWindow) createWindow(); });
