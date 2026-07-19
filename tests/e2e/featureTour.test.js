import { test, expect } from './fixtures.js';

// Requires the Firebase Auth/Database emulator (issue #37) — needs a real
// (anonymous) sign-in so roadmapStore's setUser()/tourDone Firebase path
// actually runs, same precedent as reviewReminders.test.js.
const FIREBASE_CONFIGURED = !!process.env.FIREBASE_CONFIGURED;

test.describe('feature tour (issue #17)', () => {
  test.use({ skipTourAutoDismiss: true });

  test('guest sign-up → template pick → tour auto-runs → reload → does not reappear', async ({ page }) => {
    test.skip(!FIREBASE_CONFIGURED, 'Requires FIREBASE_CONFIGURED env var — see issue #37');
    await page.goto('/#/signin');
    await page.click('text=Continue as guest');
    await expect(page).toHaveURL(/#\/onboarding/, { timeout: 10_000 });
    await page.locator('.template-card', { hasText: 'Java Backend Engineer' }).click();
    await expect(page.locator('.dashboard')).toBeVisible({ timeout: 10_000 });

    await expect(page.locator('.tour-welcome-card')).toBeVisible({ timeout: 10_000 });
    await page.click('.tour-welcome-card [data-action="start"]');

    for (let i = 0; i < 6; i += 1) {
      await expect(page.locator('.tour-popover')).toBeVisible();
      await page.click('.tour-popover [data-action="next"], .tour-popover [data-action="finish"]');
    }

    await expect(page.locator('.tour-popover')).toBeHidden();
    await expect(page.locator('.tour-welcome-card')).toBeHidden();

    await page.reload();
    await expect(page.locator('.dashboard')).toBeVisible({ timeout: 10_000 });
    await expect(page.locator('.tour-welcome-card')).toBeHidden();
  });

  test('Skip at the welcome screen ends the tour and it does not reappear on reload', async ({ page }) => {
    test.skip(!FIREBASE_CONFIGURED, 'Requires FIREBASE_CONFIGURED env var — see issue #37');
    await page.goto('/#/signin');
    await page.click('text=Continue as guest');
    await expect(page).toHaveURL(/#\/onboarding/, { timeout: 10_000 });
    await page.locator('.template-card', { hasText: 'Java Backend Engineer' }).click();
    await expect(page.locator('.dashboard')).toBeVisible({ timeout: 10_000 });

    await expect(page.locator('.tour-welcome-card')).toBeVisible({ timeout: 10_000 });
    await page.click('.tour-welcome-card [data-action="skip"]');
    await expect(page.locator('.tour-welcome-card')).toBeHidden();

    await page.reload();
    await expect(page.locator('.dashboard')).toBeVisible({ timeout: 10_000 });
    await expect(page.locator('.tour-welcome-card')).toBeHidden();
  });

  test('"Take a tour" manual replay works after the tour is already done', async ({ page }) => {
    test.skip(!FIREBASE_CONFIGURED, 'Requires FIREBASE_CONFIGURED env var — see issue #37');
    await page.goto('/#/signin');
    await page.click('text=Continue as guest');
    await expect(page).toHaveURL(/#\/onboarding/, { timeout: 10_000 });
    await page.locator('.template-card', { hasText: 'Java Backend Engineer' }).click();
    await expect(page.locator('.dashboard')).toBeVisible({ timeout: 10_000 });

    await page.click('.tour-welcome-card [data-action="skip"]');
    await expect(page.locator('.tour-welcome-card')).toBeHidden();

    await page.click('.app-sidebar-identity');
    await page.click('.dropdown-item:has-text("Take a tour")');

    await expect(page.locator('.tour-welcome-card')).toBeVisible({ timeout: 5_000 });
  });

  test('keyboard-only: Escape at a spotlight step skips the tour', async ({ page }) => {
    test.skip(!FIREBASE_CONFIGURED, 'Requires FIREBASE_CONFIGURED env var — see issue #37');
    await page.goto('/#/signin');
    await page.click('text=Continue as guest');
    await expect(page).toHaveURL(/#\/onboarding/, { timeout: 10_000 });
    await page.locator('.template-card', { hasText: 'Java Backend Engineer' }).click();
    await expect(page.locator('.dashboard')).toBeVisible({ timeout: 10_000 });

    await expect(page.locator('.tour-welcome-card')).toBeVisible({ timeout: 10_000 });
    await page.click('.tour-welcome-card [data-action="start"]');
    await expect(page.locator('.tour-popover')).toBeVisible();

    await page.keyboard.press('Escape');
    await expect(page.locator('.tour-popover')).toBeHidden();
    await expect(page.locator('.tour-scrim')).toBeHidden();
  });
});
