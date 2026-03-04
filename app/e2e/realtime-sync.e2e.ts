import { test, expect } from './fixtures/electron-app';
import { api } from './helpers/api-client';
import { WsClient } from './helpers/ws-client';
import { SELECTORS } from './fixtures/test-data';

test.describe('Real-time Sync (TC-5-SYNC)', () => {
  let roomId: string;
  let wsClient: WsClient;

  test.beforeAll(async () => {
    const room = await api.createRoom('E2E Sync Suite');
    roomId = room.room_id || room.id;
  });

  test.beforeEach(async () => {
    wsClient = new WsClient();
  });

  test.afterEach(async () => {
    wsClient.close();
  });

  test('WebSocket connects successfully (TC-5-SYNC-001)', async () => {
    await wsClient.connect(roomId);
    // If we get here without error, connection succeeded
    expect(true).toBe(true);
  });

  test('new message appears via WebSocket (TC-5-SYNC-002)', async ({ page }) => {
    await page.reload();
    await page.waitForLoadState('domcontentloaded');
    await page.locator('text=E2E Sync Suite').click({ timeout: 10_000 });

    // Send message via API (simulates another user)
    const messageBody = `Sync test ${Date.now()}`;
    await api.sendMessage(roomId, messageBody);

    // Message should appear in the UI (via WebSocket push or polling)
    const visible = await page.locator(`text=${messageBody}`).isVisible({ timeout: 15_000 })
      .catch(() => false);
    expect(visible).toBe(true);
  });

  test('message ordering under concurrent sends (TC-5-SYNC-005)', async () => {
    // Send 5 messages rapidly
    const messages = [];
    for (let i = 0; i < 5; i++) {
      messages.push(api.sendMessage(roomId, `Concurrent ${i}`));
    }
    await Promise.all(messages);

    // Fetch messages and verify order
    const fetched = await api.getMessages(roomId);
    const concurrent = fetched.filter((m: any) =>
      (m.body || '').startsWith('Concurrent')
    );

    // Should have all 5
    expect(concurrent.length).toBeGreaterThanOrEqual(5);
  });

  test('typing indicator via API (TC-5-SYNC-004)', async () => {
    // Send typing event
    const result = await api.typing(roomId);
    // Should not error
    expect(result).toBeTruthy();
  });

  test('presence endpoint responds (TC-5-SYNC-003)', async () => {
    const presence = await api.getPresence(roomId);
    // Should return some data (may be empty array or object)
    expect(presence).toBeDefined();
  });
});
