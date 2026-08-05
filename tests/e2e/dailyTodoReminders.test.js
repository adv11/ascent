import { test, expect } from './fixtures.js';

// Local reminder opt-in toggle (issue #132). Real OS notification delivery
// can't be asserted on reliably by Playwright across platforms — this only
// covers the mockable browser-API surface: clicking the toggle calls
// Notification.requestPermission(), and declining leaves todos working
// normally with no error (per the issue's testing requirements).
const FIREBASE_CONFIGURED = !!process.env.FIREBASE_CONFIGURED;

test.describe('Daily Todo reminders — opt-in toggle', () => {
  test('clicking the reminder toggle calls Notification.requestPermission(); declining leaves todos working', async ({ page }) => {
    test.skip(!FIREBASE_CONFIGURED, 'Requires FIREBASE_CONFIGURED env var — see issue #37');

    await page.addInitScript(() => {
      window.__requestPermissionCalls = 0;
      window.Notification = window.Notification || function () {};
      window.Notification.requestPermission = () => {
        window.__requestPermissionCalls += 1;
        return Promise.resolve('denied');
      };
    });

    await page.goto('/#/signin');
    await page.click('text=Continue as guest');
    await expect(page).toHaveURL(/#\/onboarding/, { timeout: 10_000 });
    // Issue #490 — the Daily Todos panel moved from onboarding.js to
    // dashboard.js, so this test needs a started roadmap to reach it now.
    await page.locator('.template-card', { hasText: 'Java Backend Engineer' }).click();
    await expect(page.locator('.dashboard')).toBeVisible({ timeout: 10_000 });

    await page.locator('.daily-todo-reminder-btn').click();
    await expect.poll(() => page.evaluate(() => window.__requestPermissionCalls)).toBe(1);
    await expect(page.locator('.daily-todo-reminder-btn')).not.toHaveClass(/active/);

    await page.locator('.daily-todo-add-row input[aria-label="New todo title"]').fill('Reminder toggle sanity check');
    await page.locator('.daily-todo-add-row button', { hasText: 'Add' }).click();
    await expect(page.locator('.daily-todo-item', { hasText: 'Reminder toggle sanity check' })).toBeVisible();
  });
});
