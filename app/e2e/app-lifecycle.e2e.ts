import { _electron as electron } from '@playwright/test';
import { test, expect } from '@playwright/test';
import { waitForDaemon, waitForPortClosed } from './helpers/wait-helpers';
import { api } from './helpers/api-client';

const APP_PATH = '/Applications/EZAgent.app/Contents/MacOS/EZAgent';

test.describe('App Lifecycle (TC-5-PKG)', () => {
  test('app launches and shows main window', async () => {
    const app = await electron.launch({
      executablePath: APP_PATH,
      env: { ...process.env, EZAGENT_E2E: '1' },
    });
    const page = await app.firstWindow();
    await page.waitForLoadState('domcontentloaded');

    // Window should be visible
    const isVisible = await app.evaluate(async ({ BrowserWindow }) => {
      const windows = BrowserWindow.getAllWindows();
      return windows.length > 0 && windows[0].isVisible();
    });
    expect(isVisible).toBe(true);

    await app.close();
  });

  test('window has correct minimum dimensions', async () => {
    const app = await electron.launch({
      executablePath: APP_PATH,
      env: { ...process.env, EZAGENT_E2E: '1' },
    });
    const page = await app.firstWindow();
    const size = page.viewportSize();
    expect(size).toBeTruthy();
    expect(size!.width).toBeGreaterThanOrEqual(800);
    expect(size!.height).toBeGreaterThanOrEqual(600);

    await app.close();
  });

  test('daemon starts automatically and becomes healthy (TC-5-PKG-003)', async () => {
    const app = await electron.launch({
      executablePath: APP_PATH,
      env: { ...process.env, EZAGENT_E2E: '1' },
    });

    // Wait for daemon
    await waitForDaemon(30_000);

    const status = await api.getStatus();
    expect(status.status).toBe('ok');

    await app.close();
  });

  test('daemon registers expected datatypes (TC-5-PKG-004)', async () => {
    const app = await electron.launch({
      executablePath: APP_PATH,
      env: { ...process.env, EZAGENT_E2E: '1' },
    });
    await waitForDaemon(30_000);

    const status = await api.getStatus();
    expect(status.registered_datatypes).toContain('message');
    expect(status.registered_datatypes).toContain('room');
    expect(status.registered_datatypes).toContain('identity');
    expect(status.registered_datatypes).toContain('timeline');

    await app.close();
  });

  test('app:// protocol serves static assets (TC-5-PKG-005)', async () => {
    const app = await electron.launch({
      executablePath: APP_PATH,
      env: { ...process.env, EZAGENT_E2E: '1' },
    });
    const page = await app.firstWindow();
    await page.waitForLoadState('domcontentloaded');

    // React should hydrate — the page should NOT be stuck on "Loading..."
    // Wait for either the login button or the chat UI to appear
    const hydrated = await page.waitForSelector(
      'button:has-text("Sign in with GitHub"), [data-testid="empty-state"], aside',
      { timeout: 15_000 }
    ).then(() => true).catch(() => false);

    expect(hydrated).toBe(true);

    await app.close();
  });

  test('app quits gracefully and daemon stops (TC-5-PKG-006)', async () => {
    const app = await electron.launch({
      executablePath: APP_PATH,
      env: { ...process.env, EZAGENT_E2E: '1' },
    });
    await waitForDaemon(30_000);

    // Verify daemon is running
    const statusBefore = await api.getStatus();
    expect(statusBefore.status).toBe('ok');

    // Close the app
    await app.close();

    // Daemon should stop — port 6142 should become unavailable
    const portClosed = await waitForPortClosed(6142, 10_000);
    expect(portClosed).toBe(true);
  });
});
