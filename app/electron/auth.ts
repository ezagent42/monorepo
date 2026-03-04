import { BrowserWindow, safeStorage } from 'electron';
import path from 'path';
import fs from 'fs';
import os from 'os';

const GITHUB_CLIENT_ID = process.env.GITHUB_CLIENT_ID || 'PLACEHOLDER_CLIENT_ID';
const GITHUB_CLIENT_SECRET = process.env.GITHUB_CLIENT_SECRET || 'PLACEHOLDER_CLIENT_SECRET';
const GITHUB_AUTH_URL = 'https://github.com/login/oauth/authorize';
const GITHUB_TOKEN_URL = 'https://github.com/login/oauth/access_token';
const BACKEND_URL = process.env.EZAGENT_BACKEND_URL || 'http://localhost:8847';
const CREDENTIALS_PATH = path.join(os.homedir(), '.ezagent', 'app-credentials.json');

export interface AuthResult {
  entity_id: string;
  display_name: string;
  avatar_url?: string;
  is_new_user: boolean;
}

/**
 * Opens a BrowserWindow for GitHub OAuth authorization.
 * Intercepts the redirect to extract the authorization code,
 * exchanges it for an access token, and sends it to the backend.
 */
export async function startGitHubOAuth(): Promise<AuthResult> {
  // 1. Open BrowserWindow to GitHub OAuth
  const authWindow = new BrowserWindow({
    width: 600,
    height: 700,
    show: true,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
    },
  });

  const authUrl = `${GITHUB_AUTH_URL}?client_id=${encodeURIComponent(GITHUB_CLIENT_ID)}&scope=read:user`;
  authWindow.loadURL(authUrl);

  // 2. Listen for redirect with code
  const code = await new Promise<string>((resolve, reject) => {
    authWindow.webContents.on('will-redirect', (_event, url) => {
      try {
        const urlObj = new URL(url);
        const authCode = urlObj.searchParams.get('code');
        if (authCode) {
          resolve(authCode);
          authWindow.close();
        }
      } catch {
        // Ignore malformed URLs
      }
    });

    // Also handle will-navigate for some OAuth flows where the redirect
    // is a navigation rather than a redirect
    authWindow.webContents.on('will-navigate', (_event, url) => {
      try {
        const urlObj = new URL(url);
        const authCode = urlObj.searchParams.get('code');
        if (authCode) {
          resolve(authCode);
          authWindow.close();
        }
      } catch {
        // Ignore malformed URLs
      }
    });

    authWindow.on('closed', () => {
      reject(new Error('Auth window closed by user'));
    });
  });

  // 3. Exchange code for access token
  const tokenResponse = await fetch(GITHUB_TOKEN_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: JSON.stringify({
      client_id: GITHUB_CLIENT_ID,
      client_secret: GITHUB_CLIENT_SECRET,
      code,
    }),
  });

  const tokenData = (await tokenResponse.json()) as {
    access_token?: string;
    error?: string;
    error_description?: string;
  };

  if (tokenData.error) {
    throw new Error(tokenData.error_description || tokenData.error);
  }

  const accessToken = tokenData.access_token;
  if (!accessToken) {
    throw new Error('No access token received from GitHub');
  }

  // 4. Send token to backend
  const backendResponse = await fetch(`${BACKEND_URL}/api/auth/github`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ github_token: accessToken }),
  });

  if (!backendResponse.ok) {
    const errorText = await backendResponse.text().catch(() => 'Unknown error');
    throw new Error(`Backend auth failed (${backendResponse.status}): ${errorText}`);
  }

  const result = (await backendResponse.json()) as AuthResult;

  // 5. Store credentials
  await storeCredentials(result);

  return result;
}

/**
 * Encrypts and stores auth credentials using Electron's safeStorage API.
 * Credentials are written to ~/.ezagent/app-credentials.json.
 */
async function storeCredentials(data: AuthResult): Promise<void> {
  const dir = path.dirname(CREDENTIALS_PATH);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  if (!safeStorage.isEncryptionAvailable()) {
    // Fallback: store unencrypted if safeStorage is not available
    // (e.g., on some Linux systems without a keyring)
    fs.writeFileSync(CREDENTIALS_PATH, JSON.stringify(data), { mode: 0o600 });
    return;
  }

  const encrypted = safeStorage.encryptString(JSON.stringify(data));
  fs.writeFileSync(CREDENTIALS_PATH, encrypted, { mode: 0o600 });
}

/**
 * Reads and decrypts stored credentials.
 * Returns null if no credentials exist or decryption is unavailable.
 */
export async function getStoredCredentials(): Promise<AuthResult | null> {
  if (!fs.existsSync(CREDENTIALS_PATH)) {
    return null;
  }

  try {
    if (!safeStorage.isEncryptionAvailable()) {
      // Fallback: try reading as plain JSON
      const raw = fs.readFileSync(CREDENTIALS_PATH, 'utf-8');
      return JSON.parse(raw) as AuthResult;
    }

    const encrypted = fs.readFileSync(CREDENTIALS_PATH);
    const decrypted = safeStorage.decryptString(encrypted);
    return JSON.parse(decrypted) as AuthResult;
  } catch {
    // Corrupted or unreadable credentials
    return null;
  }
}

/**
 * Deletes stored credentials file.
 */
export async function clearCredentials(): Promise<void> {
  if (fs.existsSync(CREDENTIALS_PATH)) {
    fs.unlinkSync(CREDENTIALS_PATH);
  }
}
