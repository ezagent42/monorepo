import { test, expect } from './fixtures/electron-app';
import { api } from './helpers/api-client';
import { SELECTORS, ROOMS } from './fixtures/test-data';

test.describe('Room CRUD (TC-5-JOURNEY-001/002)', () => {
  test('empty state shows create room prompt', async ({ page }) => {
    // Navigate to fresh chat page - sidebar should show "No rooms" when empty
    await page.reload();
    await page.waitForLoadState('domcontentloaded');

    const rooms = await api.listRooms();
    if (rooms.length === 0) {
      // Sidebar shows "No rooms" text for empty state
      await expect(page.locator('text=No rooms')).toBeVisible({ timeout: 10_000 });
    }
  });

  test('create room via API and verify in sidebar', async ({ page }) => {
    // Create room via API (UI dialog not yet implemented)
    await api.createRoom(ROOMS.general.name);

    await page.reload();
    await page.waitForLoadState('domcontentloaded');

    // Room should appear in sidebar
    await expect(page.locator(`text=${ROOMS.general.name}`)).toBeVisible({ timeout: 10_000 });
  });

  test('room appears in sidebar list', async ({ page }) => {
    await api.createRoom('E2E Sidebar Test');

    await page.reload();
    await page.waitForLoadState('domcontentloaded');

    // Use proper wait assertion instead of isVisible snapshot
    await expect(page.locator('text=E2E Sidebar Test')).toBeVisible({ timeout: 10_000 });
  });

  test('click room navigates to timeline', async ({ page }) => {
    await api.createRoom('E2E Timeline Nav');

    await page.reload();
    await page.waitForLoadState('domcontentloaded');

    await page.locator('text=E2E Timeline Nav').click({ timeout: 10_000 });

    // Timeline or compose area should be visible
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
    await expect(page.locator('h2').filter({ hasText: roomName })).toBeVisible({ timeout: 10_000 });
  });

  test('create multiple rooms all show in sidebar', async ({ page }) => {
    await api.createRoom('E2E Multi 1');
    await api.createRoom('E2E Multi 2');
    await api.createRoom('E2E Multi 3');

    await page.reload();
    await page.waitForLoadState('domcontentloaded');

    // Use proper wait assertions
    for (const name of ['E2E Multi 1', 'E2E Multi 2', 'E2E Multi 3']) {
      await expect(page.locator(`text=${name}`)).toBeVisible({ timeout: 10_000 });
    }
  });
});
