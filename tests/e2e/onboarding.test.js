import { test, expect } from './fixtures.js';

// Requires the Firebase Auth/Database emulator (issue #37) — every scenario here
// needs a real (anonymous) sign-in so Firebase meta detection actually runs.
const FIREBASE_CONFIGURED = !!process.env.FIREBASE_CONFIGURED;

// Issue #206 §4.1 — a card's favorite/hide/delete actions collapse behind
// one ⋯ overflow trigger; the menu itself is portaled to document.body on
// open (createDropdown()'s own convention, see dropdown.js), so it's never
// a descendant of the card locator that opened it — locate it at the page
// level, not via `card.locator(...)`.
async function clickOverflowAction(card, text) {
  await card.locator('.template-card-overflow-btn').click();
  await card.page().locator('.dropdown-menu .dropdown-item', { hasText: text }).click();
}

test.describe('onboarding — starter template picker (issue #51)', () => {
  test('new guest sign-up lands on /onboarding, title stays Ascent, one card per template plus "Create your own roadmap"', async ({ page }) => {
    test.skip(!FIREBASE_CONFIGURED, 'Requires FIREBASE_CONFIGURED env var — see issue #37');
    await page.goto('/#/signin');
    await page.click('text=Continue as guest');
    await expect(page).toHaveURL(/#\/onboarding/, { timeout: 10_000 });
    await expect(page).toHaveTitle('Ascent');
    // 7 built-in templates ("blank" retired — issue #4 follow-up) + the
    // single "Create your own roadmap" card (issue #100 merged the separate
    // manual-create/import cards into one AI-assisted flow).
    await expect(page.locator('.template-card')).toHaveCount(8);
    await expect(page.locator('.template-card-create')).toContainText('Create your own roadmap');
    await expect(page.locator('.template-card-name')).toContainText([
      'Java Backend Engineer', 'GenAI / Agentic AI Engineer', 'Frontend Developer', 'Data Scientist',
      '12th Grade Mathematics', 'Learning Piano', 'Marketing'
    ]);
    await expect(page.locator('.template-card', { hasText: 'Start blank' })).toHaveCount(0);
  });

  test('picking Java Backend Engineer lands on /app with the Java roadmap', async ({ page }) => {
    test.skip(!FIREBASE_CONFIGURED, 'Requires FIREBASE_CONFIGURED env var — see issue #37');
    await page.goto('/#/signin');
    await page.click('text=Continue as guest');
    await expect(page).toHaveURL(/#\/onboarding/, { timeout: 10_000 });

    await page.locator('.template-card', { hasText: 'Java Backend Engineer' }).click();

    await expect(page).toHaveURL(/#\/app/, { timeout: 10_000 });
    await expect(page.locator('.dashboard')).toBeVisible();
    await expect(page.locator('.phase-name').first()).toContainText('Core Java');
  });

  test('returning user (already picked a template) skips onboarding on reload', async ({ page }) => {
    test.skip(!FIREBASE_CONFIGURED, 'Requires FIREBASE_CONFIGURED env var — see issue #37');
    await page.goto('/#/signin');
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
  test('sidebar "My Roadmaps" reaches the picker with a "Back to my roadmap" link, which returns without changes', async ({ page }) => {
    test.skip(!FIREBASE_CONFIGURED, 'Requires FIREBASE_CONFIGURED env var — see issue #37');
    await page.goto('/#/signin');
    await page.click('text=Continue as guest');
    await expect(page).toHaveURL(/#\/onboarding/, { timeout: 10_000 });
    await page.locator('.template-card', { hasText: 'Java Backend Engineer' }).click();
    await expect(page).toHaveURL(/#\/app/, { timeout: 10_000 });

    await page.locator('.nav-item', { hasText: 'My Roadmaps' }).click();
    await expect(page).toHaveURL(/#\/onboarding/, { timeout: 10_000 });
    const backBtn = page.locator('button', { hasText: 'Back to my roadmap' });
    await expect(backBtn).toBeVisible();

    await backBtn.click();
    await expect(page).toHaveURL(/#\/app/, { timeout: 10_000 });
    await expect(page.locator('.phase-name').first()).toContainText('Core Java');
  });

  test('picking a new template switches instantly with no confirmation dialog', async ({ page }) => {
    test.skip(!FIREBASE_CONFIGURED, 'Requires FIREBASE_CONFIGURED env var — see issue #37');
    await page.goto('/#/signin');
    await page.click('text=Continue as guest');
    await expect(page).toHaveURL(/#\/onboarding/, { timeout: 10_000 });
    await page.locator('.template-card', { hasText: 'Java Backend Engineer' }).click();
    await expect(page).toHaveURL(/#\/app/, { timeout: 10_000 });

    await page.locator('.nav-item', { hasText: 'My Roadmaps' }).click();
    await expect(page).toHaveURL(/#\/onboarding/, { timeout: 10_000 });

    await page.locator('.template-card', { hasText: 'Data Scientist' }).click();
    await expect(page.locator('.modal-overlay')).toHaveCount(0);

    await expect(page).toHaveURL(/#\/app/, { timeout: 10_000 });
    await expect(page.locator('.phase-name').first()).toContainText('Python for Data Science');
  });

  test('the currently active template is marked "Current", and re-picking it just returns to the dashboard unchanged', async ({ page }) => {
    test.skip(!FIREBASE_CONFIGURED, 'Requires FIREBASE_CONFIGURED env var — see issue #37');
    await page.goto('/#/signin');
    await page.click('text=Continue as guest');
    await expect(page).toHaveURL(/#\/onboarding/, { timeout: 10_000 });
    await page.locator('.template-card', { hasText: 'Java Backend Engineer' }).click();
    await expect(page).toHaveURL(/#\/app/, { timeout: 10_000 });

    await page.locator('.nav-item', { hasText: 'My Roadmaps' }).click();
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
    await page.goto('/#/signin');
    await page.click('text=Continue as guest');
    await expect(page).toHaveURL(/#\/onboarding/, { timeout: 10_000 });
    await page.locator('.template-card', { hasText: 'Frontend Developer' }).click();
    await expect(page).toHaveURL(/#\/app/, { timeout: 10_000 });

    const frontendChecks = page.locator('.check-item');
    await frontendChecks.nth(0).click();
    await frontendChecks.nth(1).click();
    await expect(page.locator('.save-badge')).toBeVisible();

    await page.locator('.nav-item', { hasText: 'My Roadmaps' }).click();
    await expect(page).toHaveURL(/#\/onboarding/, { timeout: 10_000 });

    await page.locator('.template-card', { hasText: 'Data Scientist' }).click();
    await expect(page).toHaveURL(/#\/app/, { timeout: 10_000 });
    await expect(page.locator('.phase-name').first()).toContainText('Python for Data Science');

    await page.locator('.check-item').nth(0).click();

    await page.locator('.nav-item', { hasText: 'My Roadmaps' }).click();
    await expect(page).toHaveURL(/#\/onboarding/, { timeout: 10_000 });
    // Now that Data Scientist is active, Frontend is "In progress" (started,
    // not active) rather than disappearing.
    await expect(page.locator('.template-card', { hasText: 'Frontend Developer' }).locator('.template-card-started-badge')).toContainText('In progress');
    await page.locator('.template-card', { hasText: 'Frontend Developer' }).click();
    await expect(page).toHaveURL(/#\/app/, { timeout: 10_000 });

    // Frontend's two earlier checks must still be checked — no data loss.
    await expect(page.locator('.check-item').nth(0).locator('.check-box')).toHaveAttribute('aria-checked', 'true');
    await expect(page.locator('.check-item').nth(1).locator('.check-box')).toHaveAttribute('aria-checked', 'true');

    await page.locator('.nav-item', { hasText: 'My Roadmaps' }).click();
    await page.locator('.template-card', { hasText: 'Data Scientist' }).click();
    await expect(page).toHaveURL(/#\/app/, { timeout: 10_000 });
    // Data Science's own check must also still be intact.
    await expect(page.locator('.check-item').nth(0).locator('.check-box')).toHaveAttribute('aria-checked', 'true');
  });
});

test.describe('onboarding — hiding and restoring templates', () => {
  test('hiding a template removes its card, and it can be restored from "Show hidden templates"', async ({ page }) => {
    test.skip(!FIREBASE_CONFIGURED, 'Requires FIREBASE_CONFIGURED env var — see issue #37');
    await page.goto('/#/signin');
    await page.click('text=Continue as guest');
    await expect(page).toHaveURL(/#\/onboarding/, { timeout: 10_000 });

    const pianoCard = page.locator('.template-card', { hasText: 'Learning Piano' });
    await expect(pianoCard).toBeVisible();

    await clickOverflowAction(pianoCard, 'Hide');
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
    await page.goto('/#/signin');
    await page.click('text=Continue as guest');
    await expect(page).toHaveURL(/#\/onboarding/, { timeout: 10_000 });

    await clickOverflowAction(page.locator('.template-card', { hasText: 'Marketing' }), 'Hide');
    const dialog = page.locator('.modal-overlay[aria-label*="Marketing"]');
    await expect(dialog).toBeVisible();
    await dialog.locator('[data-action="cancel"]').click();

    await expect(page.locator('.template-card', { hasText: 'Marketing' })).toBeVisible();
    await expect(page.locator('.hidden-templates-toggle')).toHaveCount(0);
  });

  // "blank" is retired (issue #4 follow-up) — every built-in template card
  // now has an overflow menu (with a Hide action) with no exceptions.
  test('every built-in template card has an overflow menu trigger, including the ones that used to be exceptions', async ({ page }) => {
    test.skip(!FIREBASE_CONFIGURED, 'Requires FIREBASE_CONFIGURED env var — see issue #37');
    await page.goto('/#/signin');
    await page.click('text=Continue as guest');
    await expect(page).toHaveURL(/#\/onboarding/, { timeout: 10_000 });

    for (const name of ['Java Backend Engineer', 'Learning Piano', 'Marketing']) {
      await expect(page.locator('.template-card', { hasText: name }).locator('.template-card-overflow-btn')).toBeVisible();
    }
    // "Create your own roadmap" has the info corner button instead, never an overflow menu.
    const createCard = page.locator('.template-card-create');
    await expect(createCard.locator('.template-card-info-corner')).toBeVisible();
    await expect(createCard.locator('.template-card-overflow-btn')).toHaveCount(0);
  });

  test('a hidden template stays hidden across a reload (persisted per-user)', async ({ page }) => {
    test.skip(!FIREBASE_CONFIGURED, 'Requires FIREBASE_CONFIGURED env var — see issue #37');
    await page.goto('/#/signin');
    await page.click('text=Continue as guest');
    await expect(page).toHaveURL(/#\/onboarding/, { timeout: 10_000 });

    await clickOverflowAction(page.locator('.template-card', { hasText: 'Learning Piano' }), 'Hide');
    await page.locator('.modal-overlay[aria-label*="Learning Piano"] [data-action="confirm"]').click();
    await expect(page.locator('.template-card', { hasText: 'Learning Piano' })).toHaveCount(0);

    await page.reload();
    await expect(page.locator('.template-card', { hasText: 'Learning Piano' })).toHaveCount(0);
    await expect(page.locator('.hidden-templates-toggle')).toContainText('1 template hidden');
  });
});

test.describe('onboarding — favorite roadmaps (issue #177)', () => {
  test('starring a roadmap re-sorts its card to the front of the grid and the star persists across a reload', async ({ page }) => {
    test.skip(!FIREBASE_CONFIGURED, 'Requires FIREBASE_CONFIGURED env var — see issue #37');
    await page.goto('/#/signin');
    await page.click('text=Continue as guest');
    await expect(page).toHaveURL(/#\/onboarding/, { timeout: 10_000 });

    const marketingCard = page.locator('.template-card', { hasText: 'Marketing' });
    await clickOverflowAction(marketingCard, 'Favorite');

    const firstPickableCard = page.locator('.template-grid:not(.hidden-grid) [role="listitem"]').nth(1).locator('.template-card');
    await expect(firstPickableCard).toContainText('Marketing');

    // The overflow menu's own item text is the observable "is this
    // favorited" state now (no standalone .is-favorite button class exists
    // post-issue-#206) — open it again and confirm it now reads "Unfavorite".
    await marketingCard.locator('.template-card-overflow-btn').click();
    await expect(page.locator('.dropdown-menu .dropdown-item', { hasText: 'Unfavorite' })).toBeVisible();
    await page.keyboard.press('Escape');

    await page.reload();
    const marketingCardAfterReload = page.locator('.template-card', { hasText: 'Marketing' });
    await marketingCardAfterReload.locator('.template-card-overflow-btn').click();
    await expect(page.locator('.dropdown-menu .dropdown-item', { hasText: 'Unfavorite' })).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(page.locator('.template-grid:not(.hidden-grid) [role="listitem"]').nth(1).locator('.template-card')).toContainText('Marketing');
  });

  test('clicking Favorite does not trigger pickTemplate', async ({ page }) => {
    test.skip(!FIREBASE_CONFIGURED, 'Requires FIREBASE_CONFIGURED env var — see issue #37');
    await page.goto('/#/signin');
    await page.click('text=Continue as guest');
    await expect(page).toHaveURL(/#\/onboarding/, { timeout: 10_000 });

    await clickOverflowAction(page.locator('.template-card', { hasText: 'Marketing' }), 'Favorite');
    await expect(page).toHaveURL(/#\/onboarding/);
  });

  test('a 4th favorite is rejected with a toast, leaving the first 3 unchanged', async ({ page }) => {
    test.skip(!FIREBASE_CONFIGURED, 'Requires FIREBASE_CONFIGURED env var — see issue #37');
    await page.goto('/#/signin');
    await page.click('text=Continue as guest');
    await expect(page).toHaveURL(/#\/onboarding/, { timeout: 10_000 });

    for (const name of ['Java Backend Engineer', 'Frontend Developer', 'Data Scientist']) {
      await clickOverflowAction(page.locator('.template-card', { hasText: name }), 'Favorite');
    }
    const marketingCard = page.locator('.template-card', { hasText: 'Marketing' });
    await clickOverflowAction(marketingCard, 'Favorite');

    // Scoped by text, not just `.toast` — the "Guest session started…" toast
    // from sign-up can still be visible/fading out at this point, and a bare
    // `.toast` locator matches both (strict-mode violation).
    await expect(page.locator('.toast', { hasText: 'up to 3' })).toBeVisible();
    await marketingCard.locator('.template-card-overflow-btn').click();
    await expect(page.locator('.dropdown-menu .dropdown-item', { hasText: 'Favorite', hasNotText: 'Unfavorite' })).toBeVisible();
    await page.keyboard.press('Escape');
  });
});

test.describe('onboarding — "build your own roadmap" guide (issue #100)', () => {
  test('the corner info button on "Create your own roadmap" opens a guide explaining the generate-then-fine-tune flow', async ({ page }) => {
    test.skip(!FIREBASE_CONFIGURED, 'Requires FIREBASE_CONFIGURED env var — see issue #37');
    await page.goto('/#/signin');
    await page.click('text=Continue as guest');
    await expect(page).toHaveURL(/#\/onboarding/, { timeout: 10_000 });

    await page.locator('.template-card-create .template-card-info-corner').click();

    const modal = page.locator('.build-guide-card');
    await expect(modal).toBeVisible();
    await expect(modal).toContainText('Build your own roadmap');
    await expect(modal).toContainText('Generate your roadmap with an AI assistant');
    await expect(modal).toContainText('Fine-tune it afterward');

    await modal.locator('button', { hasText: 'Got it' }).click();
    await expect(modal).toHaveCount(0);
    // Clicking the info button must not have created a roadmap.
    await expect(page).toHaveURL(/#\/onboarding/);
  });

  test('the guide\'s "Open the roadmap builder" button closes the guide and opens the create modal directly', async ({ page }) => {
    test.skip(!FIREBASE_CONFIGURED, 'Requires FIREBASE_CONFIGURED env var — see issue #37');
    await page.goto('/#/signin');
    await page.click('text=Continue as guest');
    await expect(page).toHaveURL(/#\/onboarding/, { timeout: 10_000 });

    await page.locator('.template-card-create .template-card-info-corner').click();
    await page.locator('.build-guide-card button', { hasText: 'Open the roadmap builder' }).click();

    await expect(page.locator('.build-guide-card')).toHaveCount(0);
    await expect(page.locator('.modal-overlay[aria-label="Create your own roadmap"]')).toBeVisible();
  });
});
