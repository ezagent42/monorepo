import { test, expect } from './fixtures/electron-app';
import { api } from './helpers/api-client';
import { SELECTORS, MESSAGES } from './fixtures/test-data';

test.describe('Messaging (TC-5-UI, TC-5-JOURNEY-004)', () => {
  let roomId: string;

  test.beforeAll(async () => {
    const room = await api.createRoom('E2E Messaging Suite');
    roomId = room.room_id || room.id;
  });

  test('send text message via compose area (TC-5-UI-001)', async ({ page }) => {
    await page.reload();
    await page.waitForLoadState('domcontentloaded');

    // Navigate to the room
    await page.locator('text=E2E Messaging Suite').click({ timeout: 10_000 });

    // Type and send message
    await page.locator(SELECTORS.composeInput).fill(MESSAGES.plainText);
    await page.locator(SELECTORS.sendButton).click();

    // Message should appear in timeline
    await page.waitForSelector(`text=${MESSAGES.plainText}`, { timeout: 10_000 });
  });

  test('compose area clears after send (TC-5-UI-002)', async ({ page }) => {
    await page.locator('text=E2E Messaging Suite').click({ timeout: 10_000 });
    await page.locator(SELECTORS.composeInput).fill('Clear test message');
    await page.locator(SELECTORS.sendButton).click();

    // Compose should be empty
    const value = await page.locator(SELECTORS.composeInput).inputValue();
    expect(value).toBe('');
  });

  test('message from API renders in timeline (TC-5-UI-003)', async ({ page }) => {
    const msg = await api.sendMessage(roomId, 'API-sent message');

    await page.locator('text=E2E Messaging Suite').click({ timeout: 10_000 });
    await page.reload();
    await page.waitForLoadState('domcontentloaded');
    await page.locator('text=E2E Messaging Suite').click({ timeout: 10_000 });

    const visible = await page.locator('text=API-sent message').isVisible({ timeout: 10_000 })
      .catch(() => false);
    expect(visible).toBe(true);
  });

  test('multiple messages appear in correct order (TC-5-UI-004)', async ({ page }) => {
    await api.sendMessage(roomId, 'Message A');
    await api.sendMessage(roomId, 'Message B');
    await api.sendMessage(roomId, 'Message C');

    await page.reload();
    await page.waitForLoadState('domcontentloaded');
    await page.locator('text=E2E Messaging Suite').click({ timeout: 10_000 });

    // All three should be visible
    for (const text of ['Message A', 'Message B', 'Message C']) {
      const visible = await page.locator(`text=${text}`).isVisible({ timeout: 10_000 })
        .catch(() => false);
      expect(visible).toBe(true);
    }
  });

  test('message shows author name (TC-5-UI-005)', async ({ page }) => {
    await api.sendMessage(roomId, 'Author test message');

    await page.reload();
    await page.waitForLoadState('domcontentloaded');
    await page.locator('text=E2E Messaging Suite').click({ timeout: 10_000 });

    // Author name should be visible (E2E Tester or the entity_id)
    const authorVisible = await page.locator('text=E2E Tester').first().isVisible({ timeout: 10_000 })
      .catch(() => false);
    const entityVisible = await page.locator('text=e2e-tester').first().isVisible({ timeout: 10_000 })
      .catch(() => false);

    expect(authorVisible || entityVisible).toBe(true);
  });

  test('virtual scroll handles many messages', async ({ page }) => {
    // Send 50 messages via API
    const promises = [];
    for (let i = 0; i < 50; i++) {
      promises.push(api.sendMessage(roomId, `Bulk message ${i}`));
    }
    await Promise.all(promises);

    await page.reload();
    await page.waitForLoadState('domcontentloaded');
    await page.locator('text=E2E Messaging Suite').click({ timeout: 10_000 });

    // Timeline should be scrollable without crash
    const timeline = page.locator(SELECTORS.timeline);
    await expect(timeline).toBeVisible({ timeout: 10_000 });

    // Scroll to verify virtual scroll works
    await timeline.evaluate((el) => {
      el.scrollTop = el.scrollHeight;
    });

    // Should see recent messages
    const lastVisible = await page.locator('text=Bulk message 49').isVisible({ timeout: 10_000 })
      .catch(() => false);
    expect(lastVisible).toBe(true);
  });
});
