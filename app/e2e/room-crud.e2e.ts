import { test, expect } from './fixtures/electron-app';
import { api } from './helpers/api-client';
import { SELECTORS, ROOMS } from './fixtures/test-data';

test.describe('Room CRUD (TC-5-JOURNEY-001/002)', () => {
  test('empty state shows create room prompt', async ({ page }) => {
    await page.reload();
    await page.waitForLoadState('domcontentloaded');

    // If no rooms, should see empty state
    const rooms = await api.listRooms();
    if (rooms.length === 0) {
      const emptyState = await page.locator(SELECTORS.emptyState).isVisible({ timeout: 10_000 })
        .catch(() => false);
      expect(emptyState).toBe(true);
    }
  });

  test('create room via UI dialog', async ({ page }) => {
    await page.reload();
    await page.waitForLoadState('domcontentloaded');

    // Click create room button
    await page.locator(SELECTORS.createRoomButton).click({ timeout: 10_000 });

    // Fill dialog
    await page.locator(SELECTORS.roomNameInput).fill(ROOMS.general.name);
    await page.locator(SELECTORS.roomDescInput).fill(ROOMS.general.description);

    // Submit
    await page.locator(SELECTORS.dialogCreateButton).click();

    // Room should appear in sidebar
    await page.waitForSelector(`text=${ROOMS.general.name}`, { timeout: 10_000 });
  });

  test('room appears in sidebar list', async ({ page }) => {
    // Create room via API
    await api.createRoom('E2E Sidebar Test');

    await page.reload();
    await page.waitForLoadState('domcontentloaded');

    const roomVisible = await page.locator('text=E2E Sidebar Test').isVisible({ timeout: 10_000 })
      .catch(() => false);
    expect(roomVisible).toBe(true);
  });

  test('click room navigates to timeline', async ({ page }) => {
    await api.createRoom('E2E Timeline Nav');

    await page.reload();
    await page.waitForLoadState('domcontentloaded');

    // Click the room in sidebar
    await page.locator(`text=E2E Timeline Nav`).click({ timeout: 10_000 });

    // Timeline and compose area should be visible
    const timelineVisible = await page.locator(SELECTORS.timeline).isVisible({ timeout: 10_000 })
      .catch(() => false);
    const composeVisible = await page.locator(SELECTORS.composeInput).isVisible({ timeout: 5_000 })
      .catch(() => false);

    expect(timelineVisible || composeVisible).toBe(true);
  });

  test('room header shows correct name', async ({ page }) => {
    const roomName = 'E2E Header Test';
    await api.createRoom(roomName);

    await page.reload();
    await page.waitForLoadState('domcontentloaded');

    await page.locator(`text=${roomName}`).first().click({ timeout: 10_000 });

    // Room header should show the name
    const header = await page.locator('h2').filter({ hasText: roomName }).isVisible({ timeout: 5_000 })
      .catch(() => false);
    expect(header).toBe(true);
  });

  test('create multiple rooms all show in sidebar', async ({ page }) => {
    await api.createRoom('E2E Multi 1');
    await api.createRoom('E2E Multi 2');
    await api.createRoom('E2E Multi 3');

    await page.reload();
    await page.waitForLoadState('domcontentloaded');

    for (const name of ['E2E Multi 1', 'E2E Multi 2', 'E2E Multi 3']) {
      const visible = await page.locator(`text=${name}`).isVisible({ timeout: 10_000 })
        .catch(() => false);
      expect(visible).toBe(true);
    }
  });
});
