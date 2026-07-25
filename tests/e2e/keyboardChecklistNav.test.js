import { test, expect } from './fixtures.js';

// Requires the Firebase Auth/Database emulator (issue #37), same as every
// other spec that needs a real guest sign-in to reach the dashboard.
const FIREBASE_CONFIGURED = !!process.env.FIREBASE_CONFIGURED;

async function goToDashboard(page) {
  await page.goto('/#/signin');
  await page.click('text=Continue as guest');
  await expect(page).toHaveURL(/#\/onboarding/, { timeout: 10_000 });
  await page.locator('.template-card', { hasText: 'Java Backend Engineer' }).click();
  await expect(page.locator('.dashboard')).toBeVisible({ timeout: 10_000 });
}

test.describe('keyboard-only checklist navigation (issue #379)', () => {
  test('"?" opens the shortcuts overlay and it can be closed', async ({ page }) => {
    test.skip(!FIREBASE_CONFIGURED, 'Requires FIREBASE_CONFIGURED env var — see issue #37');
    await goToDashboard(page);

    await page.keyboard.press('?');
    await expect(page.locator('.shortcuts-modal-card')).toBeVisible();
    await expect(page.locator('.shortcuts-modal-card')).toContainText('Keyboard shortcuts');

    await page.keyboard.press('Escape');
    await expect(page.locator('.shortcuts-modal-card')).toHaveCount(0);
  });

  test('j/k move a visible focus ring between rows, clamped at the ends', async ({ page }) => {
    test.skip(!FIREBASE_CONFIGURED, 'Requires FIREBASE_CONFIGURED env var — see issue #37');
    await goToDashboard(page);

    const rows = page.locator('.phase-card.open .check-item');
    await expect(rows.first()).toBeVisible();

    await page.keyboard.press('j');
    await expect(rows.nth(0)).toHaveClass(/check-item-focused/);

    await page.keyboard.press('j');
    await expect(rows.nth(1)).toHaveClass(/check-item-focused/);
    await expect(rows.nth(0)).not.toHaveClass(/check-item-focused/);

    await page.keyboard.press('k');
    await expect(rows.nth(0)).toHaveClass(/check-item-focused/);

    // Clamp at the start — one more 'k' stays on the first row instead of
    // wrapping to the last.
    await page.keyboard.press('k');
    await expect(rows.nth(0)).toHaveClass(/check-item-focused/);
  });

  test('Enter toggles the focused row through the real checkbox click path', async ({ page }) => {
    test.skip(!FIREBASE_CONFIGURED, 'Requires FIREBASE_CONFIGURED env var — see issue #37');
    await goToDashboard(page);

    const firstRow = page.locator('.phase-card.open .check-item').first();
    await expect(firstRow).not.toHaveClass(/done/);

    await page.keyboard.press('j');
    await expect(firstRow).toHaveClass(/check-item-focused/);
    await page.keyboard.press('Enter');
    await expect(firstRow).toHaveClass(/done/);

    // Same save-badge wiring a real click already exercises — Enter goes
    // through .check-box's own click handler, not a parallel toggle path.
    await expect(page.locator('#saveBadge')).toContainText(/Sav|Local only/, { timeout: 10_000 });

    await page.keyboard.press(' ');
    await expect(firstRow).not.toHaveClass(/done/);
  });

  test('j/k/?/Enter do nothing while typing in the search field', async ({ page }) => {
    test.skip(!FIREBASE_CONFIGURED, 'Requires FIREBASE_CONFIGURED env var — see issue #37');
    await goToDashboard(page);

    await page.locator('.search-input').click();
    await page.keyboard.type('jk?');
    await expect(page.locator('.search-input')).toHaveValue('jk?');
    await expect(page.locator('.shortcuts-modal-card')).toHaveCount(0);
    await expect(page.locator('.check-item-focused')).toHaveCount(0);
  });
});
