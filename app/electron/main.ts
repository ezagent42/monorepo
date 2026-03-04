import { app, BrowserWindow, ipcMain } from 'electron';
import path from 'path';
import { startGitHubOAuth, getStoredCredentials, clearCredentials } from './auth';

let mainWindow: BrowserWindow | null = null;

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
