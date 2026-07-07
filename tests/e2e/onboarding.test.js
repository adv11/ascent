import { test, expect } from './fixtures.js';

// Requires the Firebase Auth/Database emulator (issue #37) — every scenario here
// needs a real (anonymous) sign-in so Firebase meta detection actually runs.
const FIREBASE_CONFIGURED = !!process.env.FIREBASE_CONFIGURED;

test.describe('onboarding — starter template picker (issue #51)', () => {
  test('new guest sign-up lands on /onboarding, title stays Ascent, one card per template plus "Create your own roadmap" and "Import roadmap"', async ({ page }) => {
    test.skip(!FIREBASE_CONFIGURED, 'Requires FIREBASE_CONFIGURED env var — see issue #37');
    await page.goto('/');
    await page.click('text=Continue as guest');
    await expect(page).toHaveURL(/#\/onboarding/, { timeout: 10_000 });
    await expect(page).toHaveTitle('Ascent');
    // 7 built-in templates ("blank" retired — issue #4 follow-up) + "Create
    // your own roadmap" + "Import roadmap" (issue #4).
    await expect(page.locator('.template-card')).toHaveCount(9);
    await expect(page.locator('.template-card-create')).toContainText('Create your own roadmap');
    await expect(page.locator('.template-card-import')).toContainText('Import roadmap');
    await expect(page.locator('.template-card-name')).toContainText([
      'Java Backend Engineer', 'GenAI / Agentic AI Engineer', 'Frontend Developer', 'Data Scientist',
      '12th Grade Mathematics', 'Learning Piano', 'Marketing'
    ]);
    await expect(page.locator('.template-card', { hasText: 'Start blank' })).toHaveCount(0);
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

test.describe('onboarding — switch template from the dashboard (issue #58: non-destructive, concurrent progress)', () => {
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

  test('picking a new template switches instantly with no confirmation dialog', async ({ page }) => {
    test.skip(!FIREBASE_CONFIGURED, 'Requires FIREBASE_CONFIGURED env var — see issue #37');
    await page.goto('/');
    await page.click('text=Continue as guest');
    await expect(page).toHaveURL(/#\/onboarding/, { timeout: 10_000 });
    await page.locator('.template-card', { hasText: 'Java Backend Engineer' }).click();
    await expect(page).toHaveURL(/#\/app/, { timeout: 10_000 });

    await page.locator('button', { hasText: 'Switch template' }).click();
    await expect(page).toHaveURL(/#\/onboarding/, { timeout: 10_000 });

    await page.locator('.template-card', { hasText: 'Data Scientist' }).click();
    await expect(page.locator('.modal-overlay')).toHaveCount(0);

    await expect(page).toHaveURL(/#\/app/, { timeout: 10_000 });
    await expect(page.locator('.phase-name').first()).toContainText('Python for Data Science');
  });

  test('the currently active template is marked "Current", and re-picking it just returns to the dashboard unchanged', async ({ page }) => {
    test.skip(!FIREBASE_CONFIGURED, 'Requires FIREBASE_CONFIGURED env var — see issue #37');
    await page.goto('/');
    await page.click('text=Continue as guest');
    await expect(page).toHaveURL(/#\/onboarding/, { timeout: 10_000 });
    await page.locator('.template-card', { hasText: 'Java Backend Engineer' }).click();
    await expect(page).toHaveURL(/#\/app/, { timeout: 10_000 });

    await page.locator('button', { hasText: 'Switch template' }).click();
    await expect(page).toHaveURL(/#\/onboarding/, { timeout: 10_000 });

    const currentCard = page.locator('.template-card', { hasText: 'Java Backend Engineer' });
    await expect(currentCard.locator('.template-card-current-badge')).toContainText('Current');

    await currentCard.click();
    await expect(page).toHaveURL(/#\/app/, { timeout: 10_000 });
    await expect(page.locator('.phase-name').first()).toContainText('Core Java');
    // No confirmation dialog should have appeared for re-picking the same template.
    await expect(page.locator('.modal-overlay')).toHaveCount(0);
  });

  // The core regression scenario issue #58 exists to fix: progress on two
  // different templates must coexist, and switching between them must never
  // lose either one's checked-off items.
  test('two templates keep fully independent progress across repeated switches', async ({ page }) => {
    test.skip(!FIREBASE_CONFIGURED, 'Requires FIREBASE_CONFIGURED env var — see issue #37');
    await page.goto('/');
    await page.click('text=Continue as guest');
    await expect(page).toHaveURL(/#\/onboarding/, { timeout: 10_000 });
    await page.locator('.template-card', { hasText: 'Frontend Developer' }).click();
    await expect(page).toHaveURL(/#\/app/, { timeout: 10_000 });

    const frontendChecks = page.locator('.check-item');
    await frontendChecks.nth(0).click();
    await frontendChecks.nth(1).click();
    await expect(page.locator('.save-badge')).toBeVisible();

    await page.locator('button', { hasText: 'Switch template' }).click();
    await expect(page).toHaveURL(/#\/onboarding/, { timeout: 10_000 });

    await page.locator('.template-card', { hasText: 'Data Scientist' }).click();
    await expect(page).toHaveURL(/#\/app/, { timeout: 10_000 });
    await expect(page.locator('.phase-name').first()).toContainText('Python for Data Science');

    await page.locator('.check-item').nth(0).click();

    await page.locator('button', { hasText: 'Switch template' }).click();
    await expect(page).toHaveURL(/#\/onboarding/, { timeout: 10_000 });
    // Now that Data Scientist is active, Frontend is "In progress" (started,
    // not active) rather than disappearing.
    await expect(page.locator('.template-card', { hasText: 'Frontend Developer' }).locator('.template-card-started-badge')).toContainText('In progress');
    await page.locator('.template-card', { hasText: 'Frontend Developer' }).click();
    await expect(page).toHaveURL(/#\/app/, { timeout: 10_000 });

    // Frontend's two earlier checks must still be checked — no data loss.
    await expect(page.locator('.check-item').nth(0)).toHaveAttribute('aria-checked', 'true');
    await expect(page.locator('.check-item').nth(1)).toHaveAttribute('aria-checked', 'true');

    await page.locator('button', { hasText: 'Switch template' }).click();
    await page.locator('.template-card', { hasText: 'Data Scientist' }).click();
    await expect(page).toHaveURL(/#\/app/, { timeout: 10_000 });
    // Data Science's own check must also still be intact.
    await expect(page.locator('.check-item').nth(0)).toHaveAttribute('aria-checked', 'true');
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

    await pianoCard.locator('.template-card-hide').click();
    const dialog = page.locator('.modal-overlay[aria-label*="Learning Piano"]');
    await expect(dialog).toBeVisible();
    await dialog.locator('[data-action="confirm"]').click();

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

    await page.locator('.template-card', { hasText: 'Marketing' }).locator('.template-card-hide').click();
    const dialog = page.locator('.modal-overlay[aria-label*="Marketing"]');
    await expect(dialog).toBeVisible();
    await dialog.locator('[data-action="cancel"]').click();

    await expect(page.locator('.template-card', { hasText: 'Marketing' })).toBeVisible();
    await expect(page.locator('.hidden-templates-toggle')).toHaveCount(0);
  });

  // "blank" is retired (issue #4 follow-up) — every built-in template card
  // now has a hide button with no exceptions.
  test('every built-in template card has a hide button, including the ones that used to be exceptions', async ({ page }) => {
    test.skip(!FIREBASE_CONFIGURED, 'Requires FIREBASE_CONFIGURED env var — see issue #37');
    await page.goto('/');
    await page.click('text=Continue as guest');
    await expect(page).toHaveURL(/#\/onboarding/, { timeout: 10_000 });

    for (const name of ['Java Backend Engineer', 'Learning Piano', 'Marketing']) {
      await expect(page.locator('.template-card', { hasText: name }).locator('.template-card-hide')).toBeVisible();
    }
    // "Create your own roadmap" has the info corner button instead, never a hide button.
    const createCard = page.locator('.template-card-create');
    await expect(createCard.locator('.template-card-info-corner')).toBeVisible();
    await expect(createCard.locator('.template-card-hide')).toHaveCount(0);
  });

  test('a hidden template stays hidden across a reload (persisted per-user)', async ({ page }) => {
    test.skip(!FIREBASE_CONFIGURED, 'Requires FIREBASE_CONFIGURED env var — see issue #37');
    await page.goto('/');
    await page.click('text=Continue as guest');
    await expect(page).toHaveURL(/#\/onboarding/, { timeout: 10_000 });

    await page.locator('.template-card', { hasText: 'Learning Piano' }).locator('.template-card-hide').click();
    await page.locator('.modal-overlay[aria-label*="Learning Piano"] [data-action="confirm"]').click();
    await expect(page.locator('.template-card', { hasText: 'Learning Piano' })).toHaveCount(0);

    await page.reload();
    await expect(page.locator('.template-card', { hasText: 'Learning Piano' })).toHaveCount(0);
    await expect(page.locator('.hidden-templates-toggle')).toContainText('1 template hidden');
  });
});

test.describe('onboarding — "build your own roadmap" guide (issue #4 follow-up)', () => {
  test('the corner info button on "Create your own roadmap" opens a guide explaining manual and AI-assisted roadmap building', async ({ page }) => {
    test.skip(!FIREBASE_CONFIGURED, 'Requires FIREBASE_CONFIGURED env var — see issue #37');
    await page.goto('/');
    await page.click('text=Continue as guest');
    await expect(page).toHaveURL(/#\/onboarding/, { timeout: 10_000 });

    await page.locator('.template-card-create .template-card-info-corner').click();

    const modal = page.locator('.build-guide-card');
    await expect(modal).toBeVisible();
    await expect(modal).toContainText('Build your own roadmap');
    await expect(modal).toContainText('Add topics manually');
    await expect(modal).toContainText('Import roadmap');

    await modal.locator('button', { hasText: 'Got it' }).click();
    await expect(modal).toHaveCount(0);
    // Clicking the info button must not have created a roadmap.
    await expect(page).toHaveURL(/#\/onboarding/);
  });

  test('the guide\'s "Open Import roadmap" button closes the guide and opens the import modal directly', async ({ page }) => {
    test.skip(!FIREBASE_CONFIGURED, 'Requires FIREBASE_CONFIGURED env var — see issue #37');
    await page.goto('/');
    await page.click('text=Continue as guest');
    await expect(page).toHaveURL(/#\/onboarding/, { timeout: 10_000 });

    await page.locator('.template-card-create .template-card-info-corner').click();
    await page.locator('.build-guide-card button', { hasText: 'Open Import roadmap' }).click();

    await expect(page.locator('.build-guide-card')).toHaveCount(0);
    await expect(page.locator('.modal-overlay[aria-label="Import roadmap"]')).toBeVisible();
  });
});
