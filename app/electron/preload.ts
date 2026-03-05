import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('electronAPI', {
  auth: {
    startGitHubOAuth: () => ipcRenderer.invoke('auth:github-oauth'),
    getStoredCredentials: () => ipcRenderer.invoke('auth:get-credentials'),
    clearCredentials: () => ipcRenderer.invoke('auth:clear-credentials'),
  },
  app: {
    getVersion: () => ipcRenderer.invoke('app:version'),
    onDeepLink: (callback: (url: string) => void) => {
      ipcRenderer.on('deep-link', (_event: Electron.IpcRendererEvent, url: string) => callback(url));
    },
  },
});
