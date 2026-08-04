import { test, expect } from './fixtures.js';

// Issue #414 — the app-wide developer/creator profile page. Same
// FIREBASE_CONFIGURED skip precedent as every other emulator-backed E2E
// spec in this repo for the signed-in half of this suite.
const FIREBASE_CONFIGURED = !!process.env.FIREBASE_CONFIGURED;

test('signed-out visitor can reach /creator with no redirect to sign-in', async ({ page }) => {
  await page.goto('/#/creator');
  await expect(page.locator('.developer-profile-page')).toBeVisible({ timeout: 10_000 });
  await expect(page).toHaveURL(/#\/creator/);
});

test('/creator renders the profile name and every link as a real, safe anchor', async ({ page }) => {
  await page.goto('/#/creator');
  await expect(page.locator('.developer-profile-name')).toBeVisible({ timeout: 10_000 });
  const cards = page.locator('.developer-profile-link-card');
  await expect(cards).toHaveCount(6);
  for (const card of await cards.all()) {
    await expect(card).toHaveAttribute('target', '_blank');
    await expect(card).toHaveAttribute('rel', 'noopener noreferrer');
  }
});

test('landing page footer links to /creator', async ({ page }) => {
  await page.goto('/');
  await page.locator('.landing-footer-link', { hasText: 'About the developer' }).click();
  await expect(page).toHaveURL(/#\/creator/, { timeout: 10_000 });
  await expect(page.locator('.developer-profile-page')).toBeVisible();
});

test('signed-in guest can reach /creator with no redirect, and from the sidebar account menu', async ({ page }) => {
  test.skip(!FIREBASE_CONFIGURED, 'Requires FIREBASE_CONFIGURED env var — see issue #37');

  await page.goto('/#/signin');
  await page.click('text=Continue as guest');
  await expect(page).toHaveURL(/#\/onboarding/, { timeout: 10_000 });

  // Direct navigation while signed in — must render the profile, not bounce to /app.
  await page.goto('/#/creator');
  await expect(page.locator('.developer-profile-page')).toBeVisible({ timeout: 10_000 });
  await expect(page).toHaveURL(/#\/creator/);

  // Reached from the sidebar account menu on a real app page — navigate back
  // to the onboarding picker first, since /#/creator has no .template-card of
  // its own (this step used to click straight through from the /creator page
  // with no navigation in between, which never found the picker's card).
  await page.goto('/#/onboarding');
  await expect(page).toHaveURL(/#\/onboarding/, { timeout: 10_000 });
  await page.locator('.template-card', { hasText: 'Java Backend Engineer' }).click();
  await expect(page.locator('.dashboard')).toBeVisible({ timeout: 10_000 });
  await page.locator('.app-sidebar-identity').click();
  await page.locator('.dropdown-item', { hasText: 'About the developer' }).click();
  await expect(page).toHaveURL(/#\/creator/, { timeout: 10_000 });
  await expect(page.locator('.developer-profile-page')).toBeVisible();
});
