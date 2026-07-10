import { test, expect } from './fixtures.js';

// Requires the Firebase Auth/Database emulator (issue #37) for anything past sign-in —
// dashboard-only checks (`.check-actions`, `.check-item`) are skipped without it.
const FIREBASE_CONFIGURED = !!process.env.FIREBASE_CONFIGURED;

test.describe('cross-device / responsive consistency (issue #36)', () => {
  test('viewport meta enables safe-area insets via viewport-fit=cover', async ({ page }) => {
    await page.goto('/#/signin');
    const viewportMeta = page.locator('meta[name="viewport"]');
    await expect(viewportMeta).toHaveAttribute('content', /viewport-fit=cover/);
  });

  test.describe('touch targets meet the ~44px minimum on touch-capable viewports', () => {
    test.use({ viewport: { width: 390, height: 844 }, hasTouch: true });

    test('the theme toggle (.btn-icon) is at least 44x44px', async ({ page }) => {
      await page.goto('/#/signin');
      const box = await page.locator('.theme-toggle').boundingBox();
      expect(box.width).toBeGreaterThanOrEqual(44);
      expect(box.height).toBeGreaterThanOrEqual(44);
    });
  });

  test.describe('touch targets are unchanged on non-touch desktop viewports', () => {
    test.use({ viewport: { width: 1440, height: 900 }, hasTouch: false });

    test('the theme toggle (.btn-icon) keeps its compact 36x36px size', async ({ page }) => {
      await page.goto('/#/signin');
      const box = await page.locator('.theme-toggle').boundingBox();
      expect(box.width).toBeLessThan(44);
      expect(box.height).toBeLessThan(44);
    });
  });

  test.describe('dashboard: hover/touch reveal and touch target sizing', () => {
    test.use({ viewport: { width: 390, height: 844 }, hasTouch: true });

    test('.check-actions is visible without hovering on a touch-capable device, and checklist rows meet the 44px minimum', async ({ page }) => {
      test.skip(!FIREBASE_CONFIGURED, 'Requires FIREBASE_CONFIGURED env var — see issue #37');
      await page.goto('/#/signin');
      await page.click('text=Continue as guest');
      await expect(page).toHaveURL(/#\/onboarding/, { timeout: 10_000 });
      await page.locator('.template-card', { hasText: 'Java Backend Engineer' }).click();
      await expect(page.locator('.dashboard')).toBeVisible({ timeout: 10_000 });

      const firstRow = page.locator('.check-item').nth(0);
      const opacity = await firstRow.locator('.check-actions').evaluate((el) => getComputedStyle(el).opacity);
      expect(opacity).toBe('1');

      const rowBox = await firstRow.boundingBox();
      expect(rowBox.height).toBeGreaterThanOrEqual(44);
    });
  });
});
