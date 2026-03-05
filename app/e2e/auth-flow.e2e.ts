import { test, expect } from './fixtures/electron-app';
import { api } from './helpers/api-client';
import { clearTestAuth, initTestAuth, injectCredentials } from './helpers/auth-helpers';
import { SELECTORS } from './fixtures/test-data';

test.describe('Auth Flow (TC-5-AUTH)', () => {
  test('unauthenticated state shows login screen (TC-5-AUTH-001)', async ({ page }) => {
    // Clear any existing auth
    await clearTestAuth();
    // Navigate to root page to check unauthenticated state
    await page.goto('app://./index.html');
    await page.waitForLoadState('domcontentloaded');

    // Should see the login/welcome page
    const loginVisible = await page.locator(SELECTORS.loginButton).isVisible({ timeout: 10_000 })
      .catch(() => false);
    // Or welcome title
    const welcomeVisible = await page.locator('text=Welcome to ezagent').isVisible({ timeout: 5_000 })
      .catch(() => false);

    expect(loginVisible || welcomeVisible).toBe(true);
  });

  test('test-init creates valid session (TC-5-AUTH-002)', async ({ electronApp }) => {
    const result = await initTestAuth();
    expect(result.entity_id).toBe('@e2e-tester:relay.ezagent.dev');
    expect(result.display_name).toBe('E2E Tester');

    const session = await api.getSession();
    expect(session).toBeTruthy();
    expect(session.entity_id).toBe('@e2e-tester:relay.ezagent.dev');
  });

  test('authenticated state shows main UI (TC-5-AUTH-003)', async ({ electronApp, page }) => {
    await initTestAuth();
    injectCredentials();
    await page.reload();
    await page.waitForLoadState('domcontentloaded');

    // Should see sidebar or empty state (not login screen)
    const mainUI = await page.waitForSelector(
      `${SELECTORS.sidebar}, ${SELECTORS.emptyState}`,
      { timeout: 15_000 }
    ).then(() => true).catch(() => false);

    expect(mainUI).toBe(true);
  });

  test('logout clears session (TC-5-AUTH-004)', async ({ electronApp }) => {
    await initTestAuth();
    const sessionBefore = await api.getSession();
    expect(sessionBefore).toBeTruthy();

    await api.logout();

    const sessionAfter = await api.getSession();
    expect(sessionAfter).toBeNull();
  });

  test('re-authentication after logout works (TC-5-AUTH-005)', async ({ electronApp }) => {
    await initTestAuth();
    await api.logout();

    const sessionAfterLogout = await api.getSession();
    expect(sessionAfterLogout).toBeNull();

    // Re-authenticate
    const result = await initTestAuth();
    expect(result.entity_id).toBe('@e2e-tester:relay.ezagent.dev');

    const session = await api.getSession();
    expect(session).toBeTruthy();
  });
});
