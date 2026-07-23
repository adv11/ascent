import { test, expect } from './fixtures.js';

// Requires the Firebase Auth/Database emulator (issue #37) — same reasoning
// as tests/e2e/onboarding.test.js's multi-roadmap tests.
const FIREBASE_CONFIGURED = !!process.env.FIREBASE_CONFIGURED;

test.describe('roadmap comparison view (issue #285)', () => {
  test('compares the active roadmap against its own starter template', async ({ page }) => {
    test.skip(!FIREBASE_CONFIGURED, 'Requires FIREBASE_CONFIGURED env var — see issue #37');
    await page.goto('/#/signin');
    await page.click('text=Continue as guest');
    await expect(page).toHaveURL(/#\/onboarding/, { timeout: 10_000 });
    await page.locator('.template-card', { hasText: 'Java Backend Engineer' }).click();
    await expect(page.locator('.dashboard')).toBeVisible({ timeout: 10_000 });

    // Check off one topic so the comparison has a real "done in this roadmap
    // but not in the fresh template" row to show.
    await page.locator('.check-item').first().locator('.check-box').click();
    await expect(page.locator('.save-badge')).toBeVisible();

    await page.goto('/#/progress');
    await expect(page.locator('.progress-header')).toBeVisible({ timeout: 10_000 });

    await page.locator('button', { hasText: 'Compare roadmaps' }).click();
    await expect(page.locator('.modal-overlay[aria-label="Compare roadmaps"]')).toBeVisible();
    // "Starter template" is the default mode for a built-in-template roadmap.
    await expect(page.locator('.comparison-mode-toggle .filter-chip.active')).toContainText('Starter template');
    await expect(page.locator('.comparison-summary')).toBeVisible({ timeout: 10_000 });
    // At least one row must show as "Done here only" — matched against the
    // freshly-seeded (all-incomplete) template.
    await expect(page.locator('.comparison-row-status-a-only-done').first()).toBeVisible();
  });

  test('compares two of the user\'s own started roadmaps side by side', async ({ page }) => {
    test.skip(!FIREBASE_CONFIGURED, 'Requires FIREBASE_CONFIGURED env var — see issue #37');
    await page.goto('/#/signin');
    await page.click('text=Continue as guest');
    await expect(page).toHaveURL(/#\/onboarding/, { timeout: 10_000 });
    await page.locator('.template-card', { hasText: 'Frontend Developer' }).click();
    await expect(page).toHaveURL(/#\/app/, { timeout: 10_000 });
    await page.locator('.check-item').first().locator('.check-box').click();
    await expect(page.locator('.save-badge')).toBeVisible();

    await page.locator('.nav-item', { hasText: 'My Roadmaps' }).click();
    await expect(page).toHaveURL(/#\/onboarding/, { timeout: 10_000 });
    await page.locator('.template-card', { hasText: 'Data Scientist' }).click();
    await expect(page).toHaveURL(/#\/app/, { timeout: 10_000 });

    await page.goto('/#/progress');
    await expect(page.locator('.progress-header')).toBeVisible({ timeout: 10_000 });

    await page.locator('button', { hasText: 'Compare roadmaps' }).click();
    await expect(page.locator('.modal-overlay[aria-label="Compare roadmaps"]')).toBeVisible();
    await page.locator('.comparison-mode-toggle .filter-chip', { hasText: 'Another roadmap' }).click();
    await expect(page.locator('.comparison-other-select')).toBeVisible();
    await expect(page.locator('.comparison-summary')).toBeVisible({ timeout: 10_000 });
    // Two unrelated roadmaps share essentially no identical (phase, title)
    // topics, so every topic should land in one of the two "only in" buckets.
    await expect(page.locator('.comparison-row').first()).toBeVisible();
  });
});
