// Typed wrapper around window.electronAPI (injected by preload.ts)
// This provides type safety and handles the case where we're not in Electron (e.g., browser dev)

interface ElectronAPI {
  auth: {
    startGitHubOAuth: () => Promise<AuthResult>;
    getStoredCredentials: () => Promise<AuthResult | null>;
    clearCredentials: () => Promise<void>;
  };
  app: {
    getVersion: () => Promise<string>;
    onDeepLink: (callback: (url: string) => void) => void;
  };
}

export interface AuthResult {
  entity_id: string;
  display_name: string;
  avatar_url?: string;
  is_new_user: boolean;
}

declare global {
  interface Window {
    electronAPI?: ElectronAPI;
  }
}

function getElectronAPI(): ElectronAPI | null {
  if (typeof window !== 'undefined' && window.electronAPI) {
    return window.electronAPI;
  }
  return null;
}

export const electronAuth = {
  startGitHubOAuth: async (): Promise<AuthResult> => {
    const api = getElectronAPI();
    if (!api) throw new Error('Not running in Electron');
    return api.auth.startGitHubOAuth();
  },
  getStoredCredentials: async (): Promise<AuthResult | null> => {
    const api = getElectronAPI();
    if (!api) return null;
    return api.auth.getStoredCredentials();
  },
  clearCredentials: async (): Promise<void> => {
    const api = getElectronAPI();
    if (!api) return;
    return api.auth.clearCredentials();
  },
};

export const electronApp = {
  getVersion: async (): Promise<string> => {
    const api = getElectronAPI();
    if (!api) return '0.0.0-dev';
    return api.app.getVersion();
  },
  onDeepLink: (callback: (url: string) => void): void => {
    const api = getElectronAPI();
    if (api) api.app.onDeepLink(callback);
  },
};
