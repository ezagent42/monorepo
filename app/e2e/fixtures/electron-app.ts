import { test as base, expect, ElectronApplication, Page } from '@playwright/test';
import { _electron as electron } from 'playwright';
import { waitForDaemon } from '../helpers/wait-helpers';
import { initTestAuth, injectCredentials } from '../helpers/auth-helpers';

const APP_PATH = '/Applications/EZAgent.app/Contents/MacOS/EZAgent';

type ElectronFixtures = {
  electronApp: ElectronApplication;
  page: Page;
};

/**
 * Shared fixture that launches the packaged EZAgent app.
 *
 * The app is launched once per worker (shared across all tests in a suite).
 * The fixture:
 * 1. Launches /Applications/EZAgent.app with EZAGENT_E2E=1
 * 2. Waits for the daemon to become healthy
 * 3. Initialises a test session via /api/auth/test-init
 * 4. Injects credentials into the Electron main process
 * 5. Provides `electronApp` and `page` to each test
 */
export const test = base.extend<{}, ElectronFixtures>({
  electronApp: [async ({}, use) => {
    const app = await electron.launch({
      executablePath: APP_PATH,
      env: {
        ...process.env,
        EZAGENT_E2E: '1',
      },
    });

    // Wait for daemon
    await waitForDaemon(30_000);

    // Init test auth
    await initTestAuth();
    await injectCredentials(app);

    await use(app);

    await app.close();
  }, { scope: 'worker' }],

  page: [async ({ electronApp }, use) => {
    const page = await electronApp.firstWindow();
    // Wait for the renderer to finish loading (React hydration)
    await page.waitForLoadState('domcontentloaded');
    await use(page);
  }, { scope: 'worker' }],
});

export { expect };
