import { test, expect } from './fixtures.js';

// Issue #6 Phase 6 — marketing landing page at '#/' for signed-out visitors.
// Every other e2e spec's `goto('/')` was updated to `goto('/#/signin')` to
// keep targeting the sign-in screen directly now that '/' resolves to this
// page instead of auto-redirecting.

test('signed-out visitor hitting "/" sees the landing page, not sign-in', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('.landing-page')).toBeVisible({ timeout: 10_000 });
  await expect(page.locator('.landing-hero-title')).toContainText('Engineer your next move.');
});

test('landing page "Start for free" navigates to sign-up', async ({ page }) => {
  await page.goto('/');
  await page.locator('.landing-hero-actions').getByText('Start for free').click();
  await expect(page).toHaveURL(/#\/signup/, { timeout: 10_000 });
});

test('landing page "Sign in" navigates to sign-in', async ({ page }) => {
  await page.goto('/');
  await page.locator('.landing-nav-actions').getByText('Sign in').click();
  await expect(page).toHaveURL(/#\/signin/, { timeout: 10_000 });
});

test('landing page nav link smooth-scrolls to a section without changing the route', async ({ page }) => {
  await page.goto('/');
  await page.locator('.landing-nav-link', { hasText: 'How it works' }).click();
  await page.waitForTimeout(600);
  await expect(page.locator('#landing-steps')).toBeInViewport();
  expect(page.url()).not.toContain('#/how-it-works');
  expect(page.url()).not.toMatch(/#\/(signin|signup|onboarding|app)/);
});

test('landing page renders both feature cards', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('.feature-card')).toHaveCount(2);
});
