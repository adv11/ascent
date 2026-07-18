import { test, expect } from './fixtures.js';

// Requires the Firebase Auth/Database emulator (issue #37) — every scenario here
// needs a real (anonymous) sign-in so roadmapStore's Firebase paths actually run.
const FIREBASE_CONFIGURED = !!process.env.FIREBASE_CONFIGURED;

// Issue #100 retired manual "start truly blank" creation — every custom
// roadmap now starts via the AI-import flow (paste a minimal valid payload)
// instead of the old title/description-only modal. Everything after
// creation — the dashboard-level manual phase/section/topic CRUD this file
// actually exercises — is untouched by that change.
function minimalImportJson(title) {
  return JSON.stringify({
    schemaVersion: 1,
    title,
    phases: [{
      title: 'Seed Phase',
      priority: 'P1',
      sections: [{ title: 'Seed Section', items: ['Seed topic'] }]
    }]
  });
}

async function createCustomRoadmapViaImport(page, title) {
  await page.goto('/#/signin');
  await page.click('text=Continue as guest');
  await expect(page).toHaveURL(/#\/onboarding/, { timeout: 10_000 });

  await page.locator('.template-card-create .template-card-pick').click();
  const modal = page.locator('.modal-overlay[aria-label="Create your own roadmap"]');
  await expect(modal).toBeVisible();
  await modal.locator('.import-paste-area').fill(minimalImportJson(title));
  await modal.locator('button', { hasText: 'Import roadmap' }).click();
  // createCustomRoadmap() -> switchRoadmap() is a real round trip against the
  // Firebase emulator (seed write + meta write + first listener attach), not
  // just a render — under concurrent Playwright workers sharing one emulator,
  // this can take noticeably longer than a render-only wait should need
  // (issue #141 item 3: intermittent full-suite-only flakes traced to timing
  // pressure across this file's sequential CRUD steps). Give the network-bound
  // navigation its own generous timeout, then separately wait for the
  // dashboard to actually finish rendering the new roadmap's badge before any
  // caller starts interacting with it — the URL can change slightly before
  // the dashboard has fetched/rendered the roadmap it just switched to.
  await expect(page).toHaveURL(/#\/app/, { timeout: 20_000 });
  await expect(page.locator('.current-roadmap-badge')).toContainText(title, { timeout: 10_000 });
}

test.describe('manual roadmap creation — full phase/section/topic CRUD (issue #4, seeded via issue #100\'s AI-import flow)', () => {
  test('creating a roadmap, adding a phase, a section, and a topic all render correctly', async ({ page }) => {
    test.skip(!FIREBASE_CONFIGURED, 'Requires FIREBASE_CONFIGURED env var — see issue #37');
    await createCustomRoadmapViaImport(page, 'My Test Roadmap');
    await expect(page.locator('.current-roadmap-badge')).toContainText('My Test Roadmap');
    // The seed payload already has one phase — this is the "add a second
    // phase and CRUD it" scenario, not a from-empty one anymore, since #100
    // dropped the from-empty starting point.
    await expect(page.locator('.phase-card')).toHaveCount(1);

    await page.fill('input[placeholder="New phase name…"]', 'Phase One');
    await page.locator('button', { hasText: '+ Add phase' }).click();
    const phaseCard = page.locator('.phase-card', { hasText: 'Phase One' });
    await expect(phaseCard).toBeVisible();
    // Only the first phase (index 0) starts open by default — with the seed
    // phase already occupying index 0, the freshly-added phase lands at
    // index 1 and starts collapsed, so its .phase-manage-row (inside
    // .phase-body, `.phase-card.open .phase-body { display: block }`) isn't
    // reachable until its header is clicked.
    await phaseCard.locator('.phase-head').click();
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
    await createCustomRoadmapViaImport(page, 'Rename Test');

    await page.fill('input[placeholder="New phase name…"]', 'Old Phase');
    await page.locator('button', { hasText: '+ Add phase' }).click();
    // A `hasText` filter re-evaluates lazily on every use — after the rename
    // below, a locator still filtered on "Old Phase" would stop matching
    // anything. `+ Add phase` always appends, so the freshly-added phase is
    // reliably the last `.phase-card`; keep that positional handle instead.
    const phaseCard = page.locator('.phase-card').last();
    await expect(phaseCard).toContainText('Old Phase');
    // See the "creating a roadmap..." test's comment — a freshly-added phase
    // lands at index 1 (behind the seed phase) and starts collapsed.
    await phaseCard.locator('.phase-head').click();
    await phaseCard.locator('input[placeholder="New section name…"]').fill('Old Section');
    await phaseCard.locator('button', { hasText: '+ Add section' }).click();
    await phaseCard.locator('input[placeholder="Add a custom topic…"]').fill('Topic');
    await phaseCard.locator('button', { hasText: /^Add$/ }).click();

    await phaseCard.locator('.phase-manage-row input').fill('New Phase');
    await phaseCard.locator('.phase-manage-row button', { hasText: 'Rename' }).click();
    await expect(phaseCard.locator('.phase-name', { hasText: 'New Phase' })).toBeVisible();

    await phaseCard.locator('.section-manage-row input').fill('New Section');
    await phaseCard.locator('.section-manage-row button', { hasText: 'Rename' }).click();
    await expect(phaseCard.locator('.section-manage-row input')).toHaveValue('New Section');
    await expect(phaseCard.locator('.check-item', { hasText: 'Topic' })).toBeVisible();
  });

  test('deleting a section removes its topics; deleting a phase removes the whole card', async ({ page }) => {
    test.skip(!FIREBASE_CONFIGURED, 'Requires FIREBASE_CONFIGURED env var — see issue #37');
    await createCustomRoadmapViaImport(page, 'Delete Test');

    await page.fill('input[placeholder="New phase name…"]', 'Doomed Phase');
    await page.locator('button', { hasText: '+ Add phase' }).click();
    const phaseCard = page.locator('.phase-card', { hasText: 'Doomed Phase' });
    // See the "creating a roadmap..." test's comment — a freshly-added phase
    // lands at index 1 (behind the seed phase) and starts collapsed.
    await phaseCard.locator('.phase-head').click();
    await phaseCard.locator('input[placeholder="New section name…"]').fill('Doomed Section');
    await phaseCard.locator('button', { hasText: '+ Add section' }).click();
    await phaseCard.locator('input[placeholder="Add a custom topic…"]').fill('Doomed Topic');
    await phaseCard.locator('button', { hasText: /^Add$/ }).click();

    await phaseCard.locator('.section-manage-row button', { hasText: 'Delete section' }).click();
    await page.locator('.modal-overlay [data-action="confirm"]').click();
    await expect(page.locator('.check-item', { hasText: 'Doomed Topic' })).toHaveCount(0);

    await phaseCard.locator('.phase-manage-row button', { hasText: 'Delete phase' }).click();
    await page.locator('.modal-overlay [data-action="confirm"]').click();
    await expect(page.locator('.phase-card', { hasText: 'Doomed Phase' })).toHaveCount(0);
  });

  test('the onboarding picker lists the custom roadmap with a delete button, and deleting it removes the card', async ({ page }) => {
    test.skip(!FIREBASE_CONFIGURED, 'Requires FIREBASE_CONFIGURED env var — see issue #37');
    await createCustomRoadmapViaImport(page, 'Deletable Roadmap');

    await page.locator('.nav-item', { hasText: 'My Roadmaps' }).click();
    await expect(page).toHaveURL(/#\/onboarding/, { timeout: 10_000 });

    const card = page.locator('.template-card', { hasText: 'Deletable Roadmap' });
    await expect(card.locator('.template-card-current-badge')).toContainText('Current');
    // Issue #206 §4.1 — Delete moved behind the card's ⋯ overflow menu; the
    // menu itself is portaled to document.body on open (dropdown.js), so
    // it's located at the page level, not via the card locator.
    await card.locator('.template-card-overflow-btn').click();
    await page.locator('.dropdown-menu .dropdown-item', { hasText: 'Delete' }).click();
    await page.locator('.modal-overlay [data-action="confirm"]').click();

    await expect(page.locator('.template-card', { hasText: 'Deletable Roadmap' })).toHaveCount(0);
    // Deleting the active roadmap falls back to the default built-in template.
    await expect(page).toHaveURL(/#\/onboarding/);
  });

  test('cancelling the create modal does not create a roadmap', async ({ page }) => {
    test.skip(!FIREBASE_CONFIGURED, 'Requires FIREBASE_CONFIGURED env var — see issue #37');
    await page.goto('/#/signin');
    await page.click('text=Continue as guest');
    await expect(page).toHaveURL(/#\/onboarding/, { timeout: 10_000 });

    await page.locator('.template-card-create .template-card-pick').click();
    const modal = page.locator('.modal-overlay[aria-label="Create your own roadmap"]');
    await expect(modal).toBeVisible();
    await modal.locator('button', { hasText: 'Cancel' }).click();

    await expect(modal).toHaveCount(0);
    await expect(page).toHaveURL(/#\/onboarding/);
    // 7 built-in templates + the single "Create your own roadmap" card
    // (issue #100 merged what used to be two separate cards into one).
    await expect(page.locator('.template-card')).toHaveCount(8);
  });
});
