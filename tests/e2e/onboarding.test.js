import { test, expect } from './fixtures.js';

// Requires the Firebase Auth/Database emulator (issue #37) — every scenario here
// needs a real (anonymous) sign-in so Firebase meta detection actually runs.
const FIREBASE_CONFIGURED = !!process.env.FIREBASE_CONFIGURED;

test.describe('onboarding — starter template picker (issue #51)', () => {
  test('new guest sign-up lands on /onboarding, title stays Ascent, one card per template', async ({ page }) => {
    test.skip(!FIREBASE_CONFIGURED, 'Requires FIREBASE_CONFIGURED env var — see issue #37');
    await page.goto('/');
    await page.click('text=Continue as guest');
    await expect(page).toHaveURL(/#\/onboarding/, { timeout: 10_000 });
    await expect(page).toHaveTitle('Ascent');
    await expect(page.locator('.template-card')).toHaveCount(4);
    await expect(page.locator('.template-card-name')).toContainText([
      'Java Backend Engineer', 'Frontend Developer', 'Data Scientist', 'Start blank'
    ]);
  });

  test('picking Java Backend Engineer lands on /app with the Java roadmap', async ({ page }) => {
    test.skip(!FIREBASE_CONFIGURED, 'Requires FIREBASE_CONFIGURED env var — see issue #37');
    await page.goto('/');
    await page.click('text=Continue as guest');
    await expect(page).toHaveURL(/#\/onboarding/, { timeout: 10_000 });

    await page.locator('.template-card', { hasText: 'Java Backend Engineer' }).click();

    await expect(page).toHaveURL(/#\/app/, { timeout: 10_000 });
    await expect(page.locator('.dashboard')).toBeVisible();
    await expect(page.locator('.phase-name').first()).toContainText('Core Java');
  });

  test('picking Start blank lands on /app with 4 empty phases', async ({ page }) => {
    test.skip(!FIREBASE_CONFIGURED, 'Requires FIREBASE_CONFIGURED env var — see issue #37');
    await page.goto('/');
    await page.click('text=Continue as guest');
    await expect(page).toHaveURL(/#\/onboarding/, { timeout: 10_000 });

    await page.locator('.template-card', { hasText: 'Start blank' }).click();

    await expect(page).toHaveURL(/#\/app/, { timeout: 10_000 });
    await expect(page.locator('.dashboard')).toBeVisible();
    await expect(page.locator('.phase-card')).toHaveCount(4);
    await expect(page.locator('.phase-name')).toContainText(['Learn', 'Practice', 'Build', 'Review']);

    await page.click('[data-toggle-all]');
    await expect(page.locator('.check-item')).toHaveCount(0);
  });

  test('returning user (already picked a template) skips onboarding on reload', async ({ page }) => {
    test.skip(!FIREBASE_CONFIGURED, 'Requires FIREBASE_CONFIGURED env var — see issue #37');
    await page.goto('/');
    await page.click('text=Continue as guest');
    await expect(page).toHaveURL(/#\/onboarding/, { timeout: 10_000 });

    await page.locator('.template-card', { hasText: 'Data Scientist' }).click();
    await expect(page).toHaveURL(/#\/app/, { timeout: 10_000 });
    await expect(page.locator('.dashboard')).toBeVisible();

    await page.reload();

    await expect(page.locator('.dashboard')).toBeVisible({ timeout: 10_000 });
    await expect(page).not.toHaveURL(/#\/onboarding/);
  });
});

test.describe('onboarding — switch template from the dashboard', () => {
  test('"Switch template" reaches the picker with a "Back to my roadmap" link, which returns without changes', async ({ page }) => {
    test.skip(!FIREBASE_CONFIGURED, 'Requires FIREBASE_CONFIGURED env var — see issue #37');
    await page.goto('/');
    await page.click('text=Continue as guest');
    await expect(page).toHaveURL(/#\/onboarding/, { timeout: 10_000 });
    await page.locator('.template-card', { hasText: 'Java Backend Engineer' }).click();
    await expect(page).toHaveURL(/#\/app/, { timeout: 10_000 });

    await page.locator('button', { hasText: 'Switch template' }).click();
    await expect(page).toHaveURL(/#\/onboarding/, { timeout: 10_000 });
    const backBtn = page.locator('button', { hasText: 'Back to my roadmap' });
    await expect(backBtn).toBeVisible();

    await backBtn.click();
    await expect(page).toHaveURL(/#\/app/, { timeout: 10_000 });
    await expect(page.locator('.phase-name').first()).toContainText('Core Java');
  });

  test('picking a new template while switching asks for confirmation and replaces the roadmap once confirmed', async ({ page }) => {
    test.skip(!FIREBASE_CONFIGURED, 'Requires FIREBASE_CONFIGURED env var — see issue #37');
    await page.goto('/');
    await page.click('text=Continue as guest');
    await expect(page).toHaveURL(/#\/onboarding/, { timeout: 10_000 });
    await page.locator('.template-card', { hasText: 'Java Backend Engineer' }).click();
    await expect(page).toHaveURL(/#\/app/, { timeout: 10_000 });

    await page.locator('button', { hasText: 'Switch template' }).click();
    await expect(page).toHaveURL(/#\/onboarding/, { timeout: 10_000 });

    let dialogMessage = '';
    page.once('dialog', async dialog => {
      dialogMessage = dialog.message();
      await dialog.accept();
    });
    await page.locator('.template-card', { hasText: 'Data Scientist' }).click();

    await expect(page).toHaveURL(/#\/app/, { timeout: 10_000 });
    expect(dialogMessage).toContain('Data Scientist');
    expect(dialogMessage).toContain('replaces your current roadmap');
    await expect(page.locator('.phase-name').first()).toContainText('Python for Data Science');
  });

  test('dismissing the confirmation leaves the current roadmap untouched', async ({ page }) => {
    test.skip(!FIREBASE_CONFIGURED, 'Requires FIREBASE_CONFIGURED env var — see issue #37');
    await page.goto('/');
    await page.click('text=Continue as guest');
    await expect(page).toHaveURL(/#\/onboarding/, { timeout: 10_000 });
    await page.locator('.template-card', { hasText: 'Java Backend Engineer' }).click();
    await expect(page).toHaveURL(/#\/app/, { timeout: 10_000 });

    await page.locator('button', { hasText: 'Switch template' }).click();
    await expect(page).toHaveURL(/#\/onboarding/, { timeout: 10_000 });

    page.once('dialog', dialog => dialog.dismiss());
    await page.locator('.template-card', { hasText: 'Data Scientist' }).click();

    // Cancelled — still on the onboarding picker, not switched.
    await expect(page).toHaveURL(/#\/onboarding/);
    await page.locator('button', { hasText: 'Back to my roadmap' }).click();
    await expect(page.locator('.phase-name').first()).toContainText('Core Java');
  });
});
