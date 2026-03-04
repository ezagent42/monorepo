import { test, expect } from './fixtures/electron-app';
import { api } from './helpers/api-client';

test.describe('Deep Links & URI (TC-5-URI)', () => {
  let roomId: string;

  test.beforeAll(async () => {
    const room = await api.createRoom('E2E Deep Links');
    roomId = room.room_id || room.id;
    await api.sendMessage(roomId, 'Deep link target message');
  });

  test('deep link to room navigates correctly (TC-5-URI-001)', async ({ electronApp, page }) => {
    // Simulate sending a deep link event to the renderer
    await page.evaluate((rId: string) => {
      window.dispatchEvent(new CustomEvent('deep-link-navigate', {
        detail: `ezagent://open/room/${rId}`,
      }));
    }, roomId);

    // Or use the IPC channel directly
    await electronApp.evaluate(async ({ BrowserWindow }, rId) => {
      const win = BrowserWindow.getAllWindows()[0];
      if (win) {
        win.webContents.send('deep-link', `ezagent://open/room/${rId}`);
      }
    }, roomId);

    // Wait for room to be active
    const roomVisible = await page.locator('text=E2E Deep Links').isVisible({ timeout: 10_000 })
      .catch(() => false);
    expect(roomVisible).toBe(true);
  });

  test('invalid deep link does not crash (TC-5-URI-003)', async ({ electronApp, page }) => {
    // Send a malformed deep link
    await electronApp.evaluate(async ({ BrowserWindow }) => {
      const win = BrowserWindow.getAllWindows()[0];
      if (win) {
        win.webContents.send('deep-link', 'ezagent://invalid/path/here');
      }
    });

    // App should still be functional
    await page.waitForTimeout(2_000);
    const stillAlive = await page.evaluate(() => document.readyState);
    expect(stillAlive).toBe('complete');
  });
});
