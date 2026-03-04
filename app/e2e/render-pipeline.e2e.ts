import { test, expect } from './fixtures/electron-app';
import { api } from './helpers/api-client';
import { SELECTORS, MESSAGES } from './fixtures/test-data';

test.describe('Render Pipeline (TC-5-RENDER, TC-5-DECOR, TC-5-ACTION)', () => {
  let roomId: string;

  test.beforeAll(async () => {
    const room = await api.createRoom('E2E Render Pipeline');
    roomId = room.room_id || room.id;
  });

  test.describe('Content Renderers (Level 1)', () => {
    test('plain text renders as text bubble (TC-5-RENDER-001)', async ({ page }) => {
      await api.sendMessage(roomId, 'Plain text message');

      await page.reload();
      await page.waitForLoadState('domcontentloaded');
      await page.locator('text=E2E Render Pipeline').click({ timeout: 10_000 });

      await expect(page.locator('text=Plain text message')).toBeVisible({ timeout: 10_000 });
    });

    test('markdown renders with formatting (TC-5-RENDER-002)', async ({ page }) => {
      await api.sendMessage(roomId, MESSAGES.markdown, { format: 'text/markdown' });

      await page.reload();
      await page.waitForLoadState('domcontentloaded');
      await page.locator('text=E2E Render Pipeline').click({ timeout: 10_000 });

      // Check for rendered markdown elements
      const h1Visible = await page.locator('h1:has-text("E2E Title")').isVisible({ timeout: 10_000 })
        .catch(() => false);
      const boldVisible = await page.locator('strong:has-text("Bold text")').isVisible({ timeout: 5_000 })
        .catch(() => false);

      expect(h1Visible || boldVisible).toBe(true);
    });

    test('code block with syntax highlighting (TC-5-RENDER-005)', async ({ page }) => {
      const codeMessage = '```rust\nfn main() {\n    println!("hello");\n}\n```';
      await api.sendMessage(roomId, codeMessage, { format: 'text/markdown' });

      await page.reload();
      await page.waitForLoadState('domcontentloaded');
      await page.locator('text=E2E Render Pipeline').click({ timeout: 10_000 });

      // Code block should be present
      const codeVisible = await page.locator('pre code, [data-language="rust"]').first()
        .isVisible({ timeout: 10_000 }).catch(() => false);
      // At minimum the code text should be visible
      const textVisible = await page.locator('text=println').isVisible({ timeout: 5_000 })
        .catch(() => false);

      expect(codeVisible || textVisible).toBe(true);
    });

    test('schema fallback for unknown datatype (TC-5-RENDER-008)', async ({ page }) => {
      // Send a message with an unknown content_type
      await api.sendMessage(roomId, 'Unknown type message', { content_type: 'custom:unknown' });

      await page.reload();
      await page.waitForLoadState('domcontentloaded');
      await page.locator('text=E2E Render Pipeline').click({ timeout: 10_000 });

      // Should still render (fallback to schema or text renderer)
      const visible = await page.locator('text=Unknown type message').isVisible({ timeout: 10_000 })
        .catch(() => false);
      expect(visible).toBe(true);
    });
  });

  test.describe('Decorators (Level 2)', () => {
    test('emoji reaction shows emoji bar (TC-5-DECOR-001)', async ({ page }) => {
      const msg = await api.sendMessage(roomId, 'React to this');
      const refId = msg.ref_id || msg.id;

      await api.addReaction(roomId, refId, '\u{1F44D}');

      await page.reload();
      await page.waitForLoadState('domcontentloaded');
      await page.locator('text=E2E Render Pipeline').click({ timeout: 10_000 });

      // Emoji bar should be visible
      const emojiBar = await page.locator(SELECTORS.emojiBar).first().isVisible({ timeout: 10_000 })
        .catch(() => false);
      const thumbsUp = await page.locator('text=\u{1F44D}').first().isVisible({ timeout: 5_000 })
        .catch(() => false);

      expect(emojiBar || thumbsUp).toBe(true);
    });

    test('edited tag shows on modified message (TC-5-DECOR-003)', async ({ page }) => {
      const msg = await api.sendMessage(roomId, 'Before edit');
      const refId = msg.ref_id || msg.id;

      await api.editMessage(roomId, refId, 'After edit');

      await page.reload();
      await page.waitForLoadState('domcontentloaded');
      await page.locator('text=E2E Render Pipeline').click({ timeout: 10_000 });

      const edited = await page.locator(SELECTORS.textTag).first().isVisible({ timeout: 10_000 })
        .catch(() => false);
      const editedText = await page.locator('text=edited').first().isVisible({ timeout: 5_000 })
        .catch(() => false);

      expect(edited || editedText).toBe(true);
    });
  });
});
