import { _electron as electron } from '@playwright/test';
import { test, expect } from '@playwright/test';
import { waitForDaemon } from './helpers/wait-helpers';
import { api } from './helpers/api-client';

const APP_PATH = '/Applications/EZAgent.app/Contents/MacOS/EZAgent';

test.describe('Tray & Window (TC-5-PKG)', () => {
  test('close window hides to tray, app stays running (TC-5-PKG-003)', async () => {
    const app = await electron.launch({
      executablePath: APP_PATH,
      env: { ...process.env, EZAGENT_E2E: '1' },
    });
    const page = await app.firstWindow();
    await waitForDaemon(30_000);

    // Close the window (should hide, not quit)
    await app.evaluate(async ({ BrowserWindow }) => {
      const win = BrowserWindow.getAllWindows()[0];
      if (win) win.close();
    });

    // Wait a moment
    await page.waitForTimeout(1_000);

    // App should still be running (daemon still healthy)
    const status = await api.getStatus().catch(() => null);
    expect(status).toBeTruthy();
    expect(status!.status).toBe('ok');

    await app.close();
  });

  test('window can be restored after hiding', async () => {
    const app = await electron.launch({
      executablePath: APP_PATH,
      env: { ...process.env, EZAGENT_E2E: '1' },
    });
    await app.firstWindow();
    await waitForDaemon(30_000);

    // Hide the window
    await app.evaluate(async ({ BrowserWindow }) => {
      const win = BrowserWindow.getAllWindows()[0];
      if (win) win.hide();
    });

    // Verify hidden
    const isHidden = await app.evaluate(async ({ BrowserWindow }) => {
      const win = BrowserWindow.getAllWindows()[0];
      return win ? !win.isVisible() : true;
    });
    expect(isHidden).toBe(true);

    // Show it again
    await app.evaluate(async ({ BrowserWindow }) => {
      const win = BrowserWindow.getAllWindows()[0];
      if (win) {
        win.show();
        win.focus();
      }
    });

    // Verify shown
    const isVisible = await app.evaluate(async ({ BrowserWindow }) => {
      const win = BrowserWindow.getAllWindows()[0];
      return win ? win.isVisible() : false;
    });
    expect(isVisible).toBe(true);

    await app.close();
  });

  test('multiple hide/show cycles work', async () => {
    const app = await electron.launch({
      executablePath: APP_PATH,
      env: { ...process.env, EZAGENT_E2E: '1' },
    });
    await app.firstWindow();
    await waitForDaemon(30_000);

    for (let i = 0; i < 3; i++) {
      await app.evaluate(async ({ BrowserWindow }) => {
        const win = BrowserWindow.getAllWindows()[0];
        if (win) win.hide();
      });

      await app.evaluate(async ({ BrowserWindow }) => {
        const win = BrowserWindow.getAllWindows()[0];
        if (win) { win.show(); win.focus(); }
      });
    }

    // Daemon should still be running
    const status = await api.getStatus();
    expect(status.status).toBe('ok');

    await app.close();
  });
});
