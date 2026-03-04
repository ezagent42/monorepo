import { shell } from 'electron';
import fs from 'fs';
import path from 'path';
import os from 'os';

const GITHUB_CLIENT_ID = 'Iv23likJpbvAY27c18tA';
const GITHUB_DEVICE_CODE_URL = 'https://github.com/login/device/code';
const GITHUB_TOKEN_URL = 'https://github.com/login/oauth/access_token';
const BACKEND_URL = process.env.EZAGENT_BACKEND_URL || 'http://localhost:6142';
const CREDENTIALS_PATH = path.join(os.homedir(), '.ezagent', 'app-credentials.json');

export interface DeviceCodeResponse {
  device_code: string;
  user_code: string;
  verification_uri: string;
  expires_in: number;
  interval: number;
}

export interface AuthResult {
  entity_id: string;
  display_name: string;
  avatar_url?: string;
  is_new_user: boolean;
}

/**
 * Initiates GitHub Device Flow authentication.
 *
 * 1. Requests a device code from GitHub
 * 2. Returns the user_code for the renderer to display
 * 3. Opens the browser to the verification URI
 * 4. Polls for the access token
 * 5. Exchanges the token with the backend
 *
 * No client_secret needed — Device Flow is designed for public clients.
 */
export async function startGitHubOAuth(): Promise<AuthResult> {
  // 1. Request device code
  const deviceRes = await fetch(GITHUB_DEVICE_CODE_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: JSON.stringify({
      client_id: GITHUB_CLIENT_ID,
      scope: 'read:user',
    }),
  });

  if (!deviceRes.ok) {
    throw new Error(`Device code request failed: ${deviceRes.status}`);
  }

  const deviceData = (await deviceRes.json()) as DeviceCodeResponse;
  const { device_code, user_code, verification_uri, interval, expires_in } = deviceData;

  // 2. Open browser for user to enter the code
  shell.openExternal(verification_uri);

  // 3. Poll for access token
  const accessToken = await pollForToken(device_code, interval, expires_in);

  // 4. Exchange with backend
  const backendRes = await fetch(`${BACKEND_URL}/api/auth/github`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ github_token: accessToken }),
  });

  if (!backendRes.ok) {
    const errorText = await backendRes.text().catch(() => 'Unknown error');
    throw new Error(`Backend auth failed (${backendRes.status}): ${errorText}`);
  }

  const result = (await backendRes.json()) as AuthResult;

  // 5. Store credentials
  await storeCredentials(result);

  return result;
}

/**
 * Returns the device code response for the renderer to display the user_code.
 * Call this separately if you want to show the code in UI before polling starts.
 */
export async function requestDeviceCode(): Promise<DeviceCodeResponse> {
  const res = await fetch(GITHUB_DEVICE_CODE_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: JSON.stringify({
      client_id: GITHUB_CLIENT_ID,
      scope: 'read:user',
    }),
  });

  if (!res.ok) {
    throw new Error(`Device code request failed: ${res.status}`);
  }

  return res.json();
}

/**
 * Polls GitHub for the access token after the user has entered the device code.
 */
async function pollForToken(deviceCode: string, interval: number, expiresIn: number): Promise<string> {
  const deadline = Date.now() + expiresIn * 1000;
  let pollInterval = interval * 1000;

  while (Date.now() < deadline) {
    await new Promise((r) => setTimeout(r, pollInterval));

    const res = await fetch(GITHUB_TOKEN_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify({
        client_id: GITHUB_CLIENT_ID,
        device_code: deviceCode,
        grant_type: 'urn:ietf:params:oauth:grant-type:device_code',
      }),
    });

    const data = (await res.json()) as {
      access_token?: string;
      error?: string;
      interval?: number;
    };

    if (data.access_token) {
      return data.access_token;
    }

    if (data.error === 'authorization_pending') {
      continue;
    }

    if (data.error === 'slow_down') {
      pollInterval += 5_000;
      continue;
    }

    if (data.error === 'expired_token') {
      throw new Error('Device code expired. Please try again.');
    }

    if (data.error === 'access_denied') {
      throw new Error('User denied authorization.');
    }

    throw new Error(`Unexpected error: ${data.error}`);
  }

  throw new Error('Device code expired (timeout). Please try again.');
}

/**
 * Stores auth credentials to ~/.ezagent/app-credentials.json.
 * Uses plain JSON (Electron safeStorage can be added later for encryption).
 */
async function storeCredentials(data: AuthResult): Promise<void> {
  const dir = path.dirname(CREDENTIALS_PATH);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  fs.writeFileSync(CREDENTIALS_PATH, JSON.stringify(data), { mode: 0o600 });
}

/**
 * Reads stored credentials. Returns null if none exist.
 */
export async function getStoredCredentials(): Promise<AuthResult | null> {
  if (!fs.existsSync(CREDENTIALS_PATH)) {
    return null;
  }
  try {
    const raw = fs.readFileSync(CREDENTIALS_PATH, 'utf-8');
    return JSON.parse(raw) as AuthResult;
  } catch {
    return null;
  }
}

/**
 * Deletes stored credentials.
 */
export async function clearCredentials(): Promise<void> {
  if (fs.existsSync(CREDENTIALS_PATH)) {
    fs.unlinkSync(CREDENTIALS_PATH);
  }
}
