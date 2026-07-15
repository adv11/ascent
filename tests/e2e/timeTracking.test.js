import { test, expect } from './fixtures.js';

// Requires the Firebase Auth/Database emulator (issue #37) — every scenario here
// needs a real (anonymous) sign-in so roadmapStore's Firebase paths actually run.
const FIREBASE_CONFIGURED = !!process.env.FIREBASE_CONFIGURED;

async function openFirstItemPanel(page) {
  await page.locator('[data-action="edit"]').nth(0).click();
  await expect(page.locator('.item-panel')).toBeVisible({ timeout: 5_000 });
}

test.describe('lightweight time tracking per topic (issue #180)', () => {
  test('starting a timer on a topic, stopping it, shows updated total time and it survives a reload', async ({ page }) => {
    test.skip(!FIREBASE_CONFIGURED, 'Requires FIREBASE_CONFIGURED env var — see issue #37');
    await page.goto('/#/signin');
    await page.click('text=Continue as guest');
    await expect(page).toHaveURL(/#\/onboarding/, { timeout: 10_000 });
    await page.locator('.template-card', { hasText: 'Java Backend Engineer' }).click();
    await expect(page.locator('.dashboard')).toBeVisible({ timeout: 10_000 });

    await openFirstItemPanel(page);
    await expect(page.locator('.timer-display')).toHaveText('0s');

    await page.locator('.timer-toggle-btn').click();
    await expect(page.locator('.timer-toggle-btn')).toHaveClass(/active/);
    await page.waitForTimeout(1500);
    await page.locator('.timer-toggle-btn').click();
    await expect(page.locator('.timer-toggle-btn')).not.toHaveClass(/active/);
    await expect(page.locator('.timer-display')).not.toHaveText('0s');

    await page.locator('button', { hasText: 'Cancel' }).click();
    await expect(page.locator('.item-panel')).toHaveCount(0);

    await page.reload();
    await expect(page.locator('.dashboard')).toBeVisible({ timeout: 10_000 });
    await openFirstItemPanel(page);
    await expect(page.locator('.timer-display')).not.toHaveText('0s');
  });

  test('closing the panel while a timer is running still persists the elapsed time', async ({ page }) => {
    test.skip(!FIREBASE_CONFIGURED, 'Requires FIREBASE_CONFIGURED env var — see issue #37');
    await page.goto('/#/signin');
    await page.click('text=Continue as guest');
    await expect(page).toHaveURL(/#\/onboarding/, { timeout: 10_000 });
    await page.locator('.template-card', { hasText: 'Java Backend Engineer' }).click();
    await expect(page.locator('.dashboard')).toBeVisible({ timeout: 10_000 });

    await openFirstItemPanel(page);
    await page.locator('.timer-toggle-btn').click();
    await page.waitForTimeout(1500);
    // Close without pausing first — the panel's close() must flush the
    // still-running session rather than dropping it.
    await page.locator('button', { hasText: 'Cancel' }).click();
    await expect(page.locator('.item-panel')).toHaveCount(0);

    await openFirstItemPanel(page);
    await expect(page.locator('.timer-display')).not.toHaveText('0s');
    await expect(page.locator('.timer-toggle-btn')).not.toHaveClass(/active/);
  });
});
