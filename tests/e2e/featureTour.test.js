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

    for (let i = 0; i < 10; i += 1) {
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

// Issue #293 — the second, onboarding-page-specific tour (Daily Todos,
// favoriting a roadmap, "Create your own roadmap") flagged as an open
// follow-up when the dashboard tour above was expanded. Auto-starts on a
// *return* visit to /onboarding, only after the dashboard tour has already
// been seen (skipped or finished — both set tourDone, see featureTour.js's
// onEnd comment) — every test here skips the dashboard tour first via its
// welcome card's "Skip", then navigates back to /onboarding to trigger this
// one specifically.
test.describe('onboarding-page tour (issue #293)', () => {
  test.use({ skipTourAutoDismiss: true });

  test('dashboard tour seen → return to My Roadmaps → onboarding tour auto-runs → reload → does not reappear', async ({ page }) => {
    test.skip(!FIREBASE_CONFIGURED, 'Requires FIREBASE_CONFIGURED env var — see issue #37');
    await page.goto('/#/signin');
    await page.click('text=Continue as guest');
    await expect(page).toHaveURL(/#\/onboarding/, { timeout: 10_000 });
    await page.locator('.template-card', { hasText: 'Java Backend Engineer' }).click();
    await expect(page.locator('.dashboard')).toBeVisible({ timeout: 10_000 });

    await expect(page.locator('.tour-welcome-card')).toBeVisible({ timeout: 10_000 });
    await page.click('.tour-welcome-card [data-action="skip"]');
    await expect(page.locator('.tour-welcome-card')).toBeHidden();

    await page.click('.app-sidebar-nav a[href="#/onboarding"]');
    await expect(page).toHaveURL(/#\/onboarding/, { timeout: 10_000 });

    await expect(page.locator('.tour-welcome-card')).toBeVisible({ timeout: 10_000 });
    await page.click('.tour-welcome-card [data-action="start"]');

    for (let i = 0; i < 3; i += 1) {
      await expect(page.locator('.tour-popover')).toBeVisible();
      await page.click('.tour-popover [data-action="next"], .tour-popover [data-action="finish"]');
    }

    await expect(page.locator('.tour-popover')).toBeHidden();
    await expect(page.locator('.tour-welcome-card')).toBeHidden();

    await page.reload();
    await expect(page.locator('.onboarding-page')).toBeVisible({ timeout: 10_000 });
    await expect(page.locator('.tour-welcome-card')).toBeHidden();
  });

  test('never auto-runs during first-time template picking', async ({ page }) => {
    test.skip(!FIREBASE_CONFIGURED, 'Requires FIREBASE_CONFIGURED env var — see issue #37');
    await page.goto('/#/signin');
    await page.click('text=Continue as guest');
    await expect(page).toHaveURL(/#\/onboarding/, { timeout: 10_000 });

    // The very first /onboarding visit (picking a template for the first
    // time) must never show this tour — only the dashboard tour, which
    // hasn't even happened yet at this point.
    await expect(page.locator('.tour-welcome-card')).toBeHidden();
  });

  test('"Take a tour" manual replay from onboarding.js\'s own account menu', async ({ page }) => {
    test.skip(!FIREBASE_CONFIGURED, 'Requires FIREBASE_CONFIGURED env var — see issue #37');
    await page.goto('/#/signin');
    await page.click('text=Continue as guest');
    await expect(page).toHaveURL(/#\/onboarding/, { timeout: 10_000 });
    await page.locator('.template-card', { hasText: 'Java Backend Engineer' }).click();
    await expect(page.locator('.dashboard')).toBeVisible({ timeout: 10_000 });

    await page.click('.tour-welcome-card [data-action="skip"]');
    await page.click('.app-sidebar-nav a[href="#/onboarding"]');
    await expect(page).toHaveURL(/#\/onboarding/, { timeout: 10_000 });

    // Skip the auto-run so the manual replay below is exercising a
    // deliberate re-trigger, not just the auto-start from the test above.
    await expect(page.locator('.tour-welcome-card')).toBeVisible({ timeout: 10_000 });
    await page.click('.tour-welcome-card [data-action="skip"]');
    await expect(page.locator('.tour-welcome-card')).toBeHidden();

    await page.click('.onboarding-account-trigger');
    await page.click('.dropdown-item:has-text("Take a tour")');

    await expect(page.locator('.tour-welcome-card')).toBeVisible({ timeout: 5_000 });
  });
});
