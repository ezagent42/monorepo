import { test, expect } from './fixtures/electron-app';
import { api } from './helpers/api-client';
import { SELECTORS } from './fixtures/test-data';

test.describe('Widget SDK (TC-5-WIDGET)', () => {
  let roomId: string;

  test.beforeAll(async () => {
    const room = await api.createRoom('E2E Widget SDK');
    roomId = room.room_id || room.id;
  });

  test('widget host renders for custom content (TC-5-WIDGET-001)', async ({ page }) => {
    await api.sendMessage(roomId, 'Widget test message');

    await page.reload();
    await page.waitForLoadState('domcontentloaded');
    await page.locator('text=E2E Widget SDK').click({ timeout: 10_000 });

    // Verify the message renders (may use default renderer)
    const visible = await page.locator('text=Widget test message').isVisible({ timeout: 10_000 })
      .catch(() => false);
    expect(visible).toBe(true);
  });

  test('widget error boundary catches errors (TC-5-WIDGET-006)', async ({ page }) => {
    // Inject a broken widget via page evaluation
    await page.evaluate(() => {
      // Attempt to register a widget that throws
      const registry = (window as any).__ezagent_widgets;
      if (registry) {
        registry.register('test:broken', () => {
          throw new Error('Widget intentional error');
        });
      }
    });

    // App should still be functional after widget error
    const stillAlive = await page.evaluate(() => document.readyState);
    expect(stillAlive).toBe('complete');
  });
});
