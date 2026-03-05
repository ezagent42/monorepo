import fs from 'fs';
import path from 'path';
import os from 'os';
import { api } from './api-client';

const CRED_PATH = path.join(os.homedir(), '.ezagent', 'app-credentials.json');

/**
 * Initialise E2E test session by calling the test-init endpoint.
 * Requires the daemon to be running with EZAGENT_E2E=1.
 */
export async function initTestAuth(): Promise<{ entity_id: string; display_name: string }> {
  return api.testInit();
}

/**
 * Write credentials file so the Electron app recognises the user
 * as authenticated on next credential check.
 */
export function injectCredentials(): void {
  const dir = path.dirname(CRED_PATH);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  const creds = {
    entity_id: '@e2e-tester:relay.ezagent.dev',
    display_name: 'E2E Tester',
    avatar_url: '',
    is_new_user: false,
  };
  fs.writeFileSync(CRED_PATH, JSON.stringify(creds), { mode: 0o600 });
}

/**
 * Clear stored credentials and logout from the daemon session.
 */
export async function clearTestAuth(): Promise<void> {
  try {
    await api.logout();
  } catch {
    // Daemon may not be running
  }
  if (fs.existsSync(CRED_PATH)) fs.unlinkSync(CRED_PATH);
}
