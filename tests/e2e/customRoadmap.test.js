import { test, expect } from './fixtures.js';

// Requires the Firebase Auth/Database emulator (issue #37) — every scenario here
// needs a real (anonymous) sign-in so roadmapStore's Firebase paths actually run.
const FIREBASE_CONFIGURED = !!process.env.FIREBASE_CONFIGURED;

test.describe('manual roadmap creation — full phase/section/topic CRUD (issue #4)', () => {
  test('creating a roadmap, adding a phase, a section, and a topic all render correctly', async ({ page }) => {
    test.skip(!FIREBASE_CONFIGURED, 'Requires FIREBASE_CONFIGURED env var — see issue #37');
    await page.goto('/');
    await page.click('text=Continue as guest');
    await expect(page).toHaveURL(/#\/onboarding/, { timeout: 10_000 });

    await page.click('.template-card-create');
    const modal = page.locator('.modal-overlay[aria-label="Create your own roadmap"]');
    await expect(modal).toBeVisible();
    await modal.locator('input.field-input').fill('My Test Roadmap');
    await modal.locator('textarea.field-input').fill('A roadmap for testing');
    await modal.locator('button', { hasText: 'Create roadmap' }).click();

    await expect(page).toHaveURL(/#\/app/, { timeout: 10_000 });
    await expect(page.locator('.current-roadmap-badge')).toContainText('My Test Roadmap');
    // A brand-new custom roadmap starts with zero phases — only the "+ Add
    // phase" control, no phase cards yet.
    await expect(page.locator('.phase-card')).toHaveCount(0);

    await page.fill('input[placeholder="New phase name…"]', 'Phase One');
    await page.locator('button', { hasText: '+ Add phase' }).click();
    const phaseCard = page.locator('.phase-card', { hasText: 'Phase One' });
    await expect(phaseCard).toBeVisible();
    // Freshly-added phase has zero sections — must still render the card
    // (regression check: it must not disappear, since that would hide the
    // only way to reach "+ Add section").
    await expect(phaseCard.locator('.phase-manage-row')).toBeVisible();

    await phaseCard.locator('input[placeholder="New section name…"]').fill('Section One');
    await phaseCard.locator('button', { hasText: '+ Add section' }).click();
    await expect(phaseCard.locator('.section-manage-row')).toBeVisible();

    await phaseCard.locator('input[placeholder="Add a custom topic…"]').fill('My first topic');
    await phaseCard.locator('button', { hasText: /^Add$/ }).click();
    await expect(phaseCard.locator('.check-item', { hasText: 'My first topic' })).toBeVisible();
  });

  test('renaming a phase and a section updates their titles and keeps the topic filed correctly', async ({ page }) => {
    test.skip(!FIREBASE_CONFIGURED, 'Requires FIREBASE_CONFIGURED env var — see issue #37');
    await page.goto('/');
    await page.click('text=Continue as guest');
    await expect(page).toHaveURL(/#\/onboarding/, { timeout: 10_000 });
    await page.click('.template-card-create');
    await page.locator('.modal-overlay input.field-input').fill('Rename Test');
    await page.locator('.modal-overlay button', { hasText: 'Create roadmap' }).click();
    await expect(page).toHaveURL(/#\/app/, { timeout: 10_000 });

    await page.fill('input[placeholder="New phase name…"]', 'Old Phase');
    await page.locator('button', { hasText: '+ Add phase' }).click();
    const phaseCard = page.locator('.phase-card');
    await phaseCard.locator('input[placeholder="New section name…"]').fill('Old Section');
    await phaseCard.locator('button', { hasText: '+ Add section' }).click();
    await phaseCard.locator('input[placeholder="Add a custom topic…"]').fill('Topic');
    await phaseCard.locator('button', { hasText: /^Add$/ }).click();

    await phaseCard.locator('.phase-manage-row input').fill('New Phase');
    await phaseCard.locator('.phase-manage-row button', { hasText: 'Rename' }).click();
    await expect(page.locator('.phase-name')).toContainText('New Phase');

    await phaseCard.locator('.section-manage-row input').fill('New Section');
    await phaseCard.locator('.section-manage-row button', { hasText: 'Rename' }).click();
    await expect(phaseCard.locator('.section-manage-row input')).toHaveValue('New Section');
    await expect(phaseCard.locator('.check-item', { hasText: 'Topic' })).toBeVisible();
  });

  test('deleting a section removes its topics; deleting a phase removes the whole card', async ({ page }) => {
    test.skip(!FIREBASE_CONFIGURED, 'Requires FIREBASE_CONFIGURED env var — see issue #37');
    await page.goto('/');
    await page.click('text=Continue as guest');
    await expect(page).toHaveURL(/#\/onboarding/, { timeout: 10_000 });
    await page.click('.template-card-create');
    await page.locator('.modal-overlay input.field-input').fill('Delete Test');
    await page.locator('.modal-overlay button', { hasText: 'Create roadmap' }).click();
    await expect(page).toHaveURL(/#\/app/, { timeout: 10_000 });

    await page.fill('input[placeholder="New phase name…"]', 'Doomed Phase');
    await page.locator('button', { hasText: '+ Add phase' }).click();
    const phaseCard = page.locator('.phase-card');
    await phaseCard.locator('input[placeholder="New section name…"]').fill('Doomed Section');
    await phaseCard.locator('button', { hasText: '+ Add section' }).click();
    await phaseCard.locator('input[placeholder="Add a custom topic…"]').fill('Doomed Topic');
    await phaseCard.locator('button', { hasText: /^Add$/ }).click();

    await phaseCard.locator('.section-manage-row button', { hasText: 'Delete section' }).click();
    await page.locator('.modal-overlay [data-action="confirm"]').click();
    await expect(page.locator('.check-item', { hasText: 'Doomed Topic' })).toHaveCount(0);

    await phaseCard.locator('.phase-manage-row button', { hasText: 'Delete phase' }).click();
    await page.locator('.modal-overlay [data-action="confirm"]').click();
    await expect(page.locator('.phase-card')).toHaveCount(0);
  });

  test('the onboarding picker lists the custom roadmap with a delete button, and deleting it removes the card', async ({ page }) => {
    test.skip(!FIREBASE_CONFIGURED, 'Requires FIREBASE_CONFIGURED env var — see issue #37');
    await page.goto('/');
    await page.click('text=Continue as guest');
    await expect(page).toHaveURL(/#\/onboarding/, { timeout: 10_000 });
    await page.click('.template-card-create');
    await page.locator('.modal-overlay input.field-input').fill('Deletable Roadmap');
    await page.locator('.modal-overlay button', { hasText: 'Create roadmap' }).click();
    await expect(page).toHaveURL(/#\/app/, { timeout: 10_000 });

    await page.locator('button', { hasText: 'Switch template' }).click();
    await expect(page).toHaveURL(/#\/onboarding/, { timeout: 10_000 });

    const card = page.locator('.template-card', { hasText: 'Deletable Roadmap' });
    await expect(card.locator('.template-card-current-badge')).toContainText('Current');
    await card.locator('[data-action="delete"]').click();
    await page.locator('.modal-overlay [data-action="confirm"]').click();

    await expect(page.locator('.template-card', { hasText: 'Deletable Roadmap' })).toHaveCount(0);
    // Deleting the active roadmap falls back to the default built-in template.
    await expect(page).toHaveURL(/#\/onboarding/);
  });

  test('cancelling the create modal does not create a roadmap', async ({ page }) => {
    test.skip(!FIREBASE_CONFIGURED, 'Requires FIREBASE_CONFIGURED env var — see issue #37');
    await page.goto('/');
    await page.click('text=Continue as guest');
    await expect(page).toHaveURL(/#\/onboarding/, { timeout: 10_000 });

    await page.click('.template-card-create');
    const modal = page.locator('.modal-overlay[aria-label="Create your own roadmap"]');
    await expect(modal).toBeVisible();
    await modal.locator('button', { hasText: 'Cancel' }).click();

    await expect(modal).toHaveCount(0);
    await expect(page).toHaveURL(/#\/onboarding/);
    await expect(page.locator('.template-card')).toHaveCount(10);
  });
});
