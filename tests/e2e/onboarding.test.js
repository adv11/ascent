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
    await expect(page.locator('.template-card')).toHaveCount(8);
    await expect(page.locator('.template-card-name')).toContainText([
      'Java Backend Engineer', 'GenAI / Agentic AI Engineer', 'Frontend Developer', 'Data Scientist',
      '12th Grade Mathematics', 'Learning Piano', 'Marketing', 'Start blank'
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

test.describe('onboarding — hiding and restoring templates', () => {
  test('hiding a template removes its card, and it can be restored from "Show hidden templates"', async ({ page }) => {
    test.skip(!FIREBASE_CONFIGURED, 'Requires FIREBASE_CONFIGURED env var — see issue #37');
    await page.goto('/');
    await page.click('text=Continue as guest');
    await expect(page).toHaveURL(/#\/onboarding/, { timeout: 10_000 });

    const pianoCard = page.locator('.template-card', { hasText: 'Learning Piano' });
    await expect(pianoCard).toBeVisible();

    page.once('dialog', dialog => dialog.accept());
    await pianoCard.locator('.template-card-hide').click();

    await expect(page.locator('.template-card', { hasText: 'Learning Piano' })).toHaveCount(0);
    const toggle = page.locator('.hidden-templates-toggle');
    await expect(toggle).toContainText('1 template hidden');

    await toggle.click();
    const restoreCard = page.locator('.template-card-hidden', { hasText: 'Learning Piano' });
    await expect(restoreCard).toBeVisible();
    await restoreCard.locator('button', { hasText: 'Restore' }).click();

    await expect(page.locator('.hidden-templates-toggle')).toHaveCount(0);
    await expect(page.locator('.template-grid:not(.hidden-grid) .template-card', { hasText: 'Learning Piano' })).toBeVisible();
  });

  test('dismissing the hide confirmation leaves the card in place', async ({ page }) => {
    test.skip(!FIREBASE_CONFIGURED, 'Requires FIREBASE_CONFIGURED env var — see issue #37');
    await page.goto('/');
    await page.click('text=Continue as guest');
    await expect(page).toHaveURL(/#\/onboarding/, { timeout: 10_000 });

    page.once('dialog', dialog => dialog.dismiss());
    await page.locator('.template-card', { hasText: 'Marketing' }).locator('.template-card-hide').click();

    await expect(page.locator('.template-card', { hasText: 'Marketing' })).toBeVisible();
    await expect(page.locator('.hidden-templates-toggle')).toHaveCount(0);
  });

  test('the "Start blank" card has no hide button — it can never be hidden', async ({ page }) => {
    test.skip(!FIREBASE_CONFIGURED, 'Requires FIREBASE_CONFIGURED env var — see issue #37');
    await page.goto('/');
    await page.click('text=Continue as guest');
    await expect(page).toHaveURL(/#\/onboarding/, { timeout: 10_000 });

    const blankCard = page.locator('.template-card', { hasText: 'Start blank' });
    await expect(blankCard.locator('.template-card-hide')).toHaveCount(0);
    await expect(blankCard.locator('.template-card-info')).toBeVisible();
  });

  test('a hidden template stays hidden across a reload (persisted per-user)', async ({ page }) => {
    test.skip(!FIREBASE_CONFIGURED, 'Requires FIREBASE_CONFIGURED env var — see issue #37');
    await page.goto('/');
    await page.click('text=Continue as guest');
    await expect(page).toHaveURL(/#\/onboarding/, { timeout: 10_000 });

    page.once('dialog', dialog => dialog.accept());
    await page.locator('.template-card', { hasText: 'Learning Piano' }).locator('.template-card-hide').click();
    await expect(page.locator('.template-card', { hasText: 'Learning Piano' })).toHaveCount(0);

    await page.reload();
    await expect(page.locator('.template-card', { hasText: 'Learning Piano' })).toHaveCount(0);
    await expect(page.locator('.hidden-templates-toggle')).toContainText('1 template hidden');
  });
});

test.describe('onboarding — "build your own roadmap" guide', () => {
  test('the info button on "Start blank" opens a guide explaining manual and AI-assisted roadmap building', async ({ page }) => {
    test.skip(!FIREBASE_CONFIGURED, 'Requires FIREBASE_CONFIGURED env var — see issue #37');
    await page.goto('/');
    await page.click('text=Continue as guest');
    await expect(page).toHaveURL(/#\/onboarding/, { timeout: 10_000 });

    await page.locator('.template-card', { hasText: 'Start blank' }).locator('.template-card-info').click();

    const modal = page.locator('.build-guide-card');
    await expect(modal).toBeVisible();
    await expect(modal).toContainText('Build your own roadmap');
    await expect(modal).toContainText('Add topics manually');
    await expect(modal).toContainText('AI assistant');

    await modal.locator('button', { hasText: 'Got it' }).click();
    await expect(modal).toHaveCount(0);
    // Clicking the info button must not have picked the blank template.
    await expect(page).toHaveURL(/#\/onboarding/);
  });
});
