import type { ElectronApplication } from '@playwright/test';
import { api } from './api-client';

/**
 * Initialise E2E test session by calling the test-init endpoint.
 * Requires the daemon to be running with EZAGENT_E2E=1.
 *
 * After calling this, the daemon has an active session and the app
 * renderer should see an authenticated state.
 */
export async function initTestAuth(): Promise<{ entity_id: string; display_name: string }> {
  const result = await api.testInit();
  return result;
}

/**
 * Inject stored credentials into the Electron main process so the app
 * recognises the user as authenticated on next credential check.
 */
export async function injectCredentials(app: ElectronApplication): Promise<void> {
  await app.evaluate(async () => {
    const fs = require('fs');
    const path = require('path');
    const os = require('os');
    const credPath = path.join(os.homedir(), '.ezagent', 'app-credentials.json');
    const dir = path.dirname(credPath);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    const creds = {
      entity_id: '@e2e-tester:relay.ezagent.dev',
      display_name: 'E2E Tester',
      avatar_url: '',
      is_new_user: false,
    };
    fs.writeFileSync(credPath, JSON.stringify(creds), { mode: 0o600 });
  });
}

/**
 * Clear stored credentials and logout from the daemon session.
 */
export async function clearTestAuth(app?: ElectronApplication): Promise<void> {
  try {
    await api.logout();
  } catch {
    // Daemon may not be running
  }
  if (app) {
    await app.evaluate(async () => {
      const fs = require('fs');
      const path = require('path');
      const os = require('os');
      const credPath = path.join(os.homedir(), '.ezagent', 'app-credentials.json');
      if (fs.existsSync(credPath)) fs.unlinkSync(credPath);
    });
  }
}
