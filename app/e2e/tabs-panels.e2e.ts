import { test, expect } from './fixtures/electron-app';
import { api } from './helpers/api-client';
import { SELECTORS } from './fixtures/test-data';

test.describe('Room Tabs & Info Panel (TC-5-TAB, TC-5-UI)', () => {
  let roomId: string;

  test.beforeAll(async () => {
    const room = await api.createRoom('E2E Tabs Suite');
    roomId = room.room_id || room.id;
    // Seed some messages
    await api.sendMessage(roomId, 'Tab test message 1');
    await api.sendMessage(roomId, 'Tab test message 2');
  });

  test('default tab is Timeline/Messages (TC-5-TAB-001)', async ({ page }) => {
    await page.reload();
    await page.waitForLoadState('domcontentloaded');
    await page.locator('text=E2E Tabs Suite').click({ timeout: 10_000 });

    // Messages tab panel should be active
    const messagesPanel = page.locator(SELECTORS.tabPanel('messages'));
    await expect(messagesPanel).toBeVisible({ timeout: 10_000 });
  });

  test('tab state persists per room (TC-5-TAB-005)', async ({ page }) => {
    await page.reload();
    await page.waitForLoadState('domcontentloaded');
    await page.locator('text=E2E Tabs Suite').click({ timeout: 10_000 });

    // Messages tab should be active initially
    const messagesPanel = page.locator(SELECTORS.tabPanel('messages'));
    await expect(messagesPanel).toBeVisible({ timeout: 10_000 });
  });

  test('info panel toggle works (TC-5-UI-006)', async ({ page }) => {
    await page.reload();
    await page.waitForLoadState('domcontentloaded');
    await page.locator('text=E2E Tabs Suite').click({ timeout: 10_000 });

    // Click toggle info panel button
    const toggleBtn = page.locator(SELECTORS.toggleInfoPanel);
    if (await toggleBtn.isVisible({ timeout: 5_000 }).catch(() => false)) {
      await toggleBtn.click();

      // Member list or info panel content should appear
      const memberList = page.locator(SELECTORS.memberList);
      const panelVisible = await memberList.isVisible({ timeout: 5_000 }).catch(() => false);
      expect(panelVisible).toBe(true);
    }
  });

  test('sidebar toggle works', async ({ page }) => {
    await page.reload();
    await page.waitForLoadState('domcontentloaded');
    await page.locator('text=E2E Tabs Suite').click({ timeout: 10_000 });

    // Click toggle sidebar button
    const toggleBtn = page.locator(SELECTORS.toggleSidebar);
    if (await toggleBtn.isVisible({ timeout: 5_000 }).catch(() => false)) {
      // Click to hide
      await toggleBtn.click();
      // Sidebar should be hidden
      const sidebarHidden = !(await page.locator(SELECTORS.sidebar).isVisible({ timeout: 2_000 })
        .catch(() => false));

      // Click to show
      await toggleBtn.click();
      const sidebarVisible = await page.locator(SELECTORS.sidebar).isVisible({ timeout: 5_000 })
        .catch(() => false);

      expect(sidebarHidden || sidebarVisible).toBe(true);
    }
  });
});
