import { test, expect } from './fixtures.js';

// Requires the Firebase Auth/Database emulator (issue #37) — every scenario here
// needs a real (anonymous) sign-in so roadmapStore's Firebase paths actually run.
const FIREBASE_CONFIGURED = !!process.env.FIREBASE_CONFIGURED;

function validImportJson() {
  return JSON.stringify({
    schemaVersion: 1,
    title: 'Imported Roadmap',
    phases: [
      {
        title: 'Phase One',
        priority: 'P1',
        sections: [
          { title: 'Section One', items: ['Topic A', ['Topic B', 'P0']] }
        ]
      }
    ]
  });
}

function importJsonWithResources() {
  return JSON.stringify({
    schemaVersion: 1,
    title: 'Roadmap With Resources',
    phases: [
      {
        title: 'Phase One',
        priority: 'P1',
        sections: [
          {
            title: 'Section One',
            items: [
              {
                title: 'Learn Docker',
                priority: 'P0',
                resources: [
                  { label: 'Docker official docs', url: 'https://docs.docker.com/' },
                  { label: 'Docker crash course', url: 'https://www.youtube.com/watch?v=abc123' }
                ]
              }
            ]
          }
        ]
      }
    ]
  });
}

async function openCreateModal(page) {
  await page.goto('/#/signin');
  await page.click('text=Continue as guest');
  await expect(page).toHaveURL(/#\/onboarding/, { timeout: 10_000 });
  await page.locator('.template-card-create .template-card-pick').click();
  const modal = page.locator('.modal-overlay[aria-label="Create your own roadmap"]');
  await expect(modal).toBeVisible();
  return modal;
}

test.describe('AI-assisted roadmap creation — two-column layout (issue #100)', () => {
  test('the "Create your own roadmap" card opens a modal with the build column and paste column both visible', async ({ page }) => {
    test.skip(!FIREBASE_CONFIGURED, 'Requires FIREBASE_CONFIGURED env var — see issue #37');
    const modal = await openCreateModal(page);
    await expect(modal.locator('.import-prompt-block')).toContainText('schemaVersion');
    await expect(modal.locator('.import-paste-area')).toBeVisible();
  });

  test('"Copy prompt" is disabled until a topic is entered, then copies the prompt to the clipboard', async ({ page, context }) => {
    test.skip(!FIREBASE_CONFIGURED, 'Requires FIREBASE_CONFIGURED env var — see issue #37');
    await context.grantPermissions(['clipboard-read', 'clipboard-write']);
    const modal = await openCreateModal(page);
    const copyBtn = modal.locator('button', { hasText: 'Copy prompt' });
    await expect(copyBtn).toBeDisabled();

    await modal.locator('textarea').first().fill('Kubernetes for backend engineers');
    await expect(modal.locator('.import-prompt-block')).toContainText('Kubernetes for backend engineers');
    await expect(copyBtn).toBeEnabled();

    await copyBtn.click();
    await expect(modal.locator('button', { hasText: 'Copied!' })).toBeVisible();

    const clipboardText = await page.evaluate(() => navigator.clipboard.readText());
    expect(clipboardText).toContain('Kubernetes for backend engineers');
    expect(clipboardText).toContain('schemaVersion');
  });

  test('selecting customization inputs updates the prompt without touching the JSON schema', async ({ page }) => {
    test.skip(!FIREBASE_CONFIGURED, 'Requires FIREBASE_CONFIGURED env var — see issue #37');
    const modal = await openCreateModal(page);

    await modal.locator('.import-option-chips button', { hasText: 'Intermediate' }).click();
    await modal.locator('.import-option-chips button', { hasText: '3 months' }).click();
    // issue #136 Phase 3 — the Goal/context field is now a custom-styled
    // listbox (select.js), not a native <select>; its listbox is a
    // body-level portal (see select.js's own comment), so the open option
    // is queried on `page`, not scoped to `modal`.
    await modal.locator('.custom-select-trigger').click();
    await page.locator('.custom-select-option', { hasText: 'Interview prep' }).click();
    await modal.locator('.import-options input[type="text"]').fill('already comfortable with Docker');

    // "Already know" is debounced (150ms), unlike the chip/select clicks above,
    // which update synchronously — wait for its line to actually land before
    // reading the full prompt text, or this assertion races the debounce.
    const promptBlock = modal.locator('.import-prompt-block');
    await expect(promptBlock).toContainText('Already know: already comfortable with Docker');

    const promptText = await promptBlock.textContent();
    expect(promptText).toContain('Experience level: Intermediate');
    expect(promptText).toContain('Target timeframe: 3 months');
    expect(promptText).toContain('Goal / context: Interview prep');
    expect(promptText).toContain('"schemaVersion": 1');
  });

  test('pasting invalid JSON shows a plain-language summary and a "Copy fix-it message for your AI" button, keeps "Import roadmap" disabled', async ({ page, context }) => {
    test.skip(!FIREBASE_CONFIGURED, 'Requires FIREBASE_CONFIGURED env var — see issue #37');
    await context.grantPermissions(['clipboard-read', 'clipboard-write']);
    const modal = await openCreateModal(page);

    await modal.locator('.import-paste-area').fill('{not valid json');
    await expect(modal.locator('.form-message.error')).toContainText(/need.*fixing/i);
    await expect(modal.locator('button', { hasText: 'Import roadmap' })).toBeDisabled();

    const fixItBtn = modal.locator('button', { hasText: "Copy fix-it message for your AI" });
    await expect(fixItBtn).toBeVisible();
    await fixItBtn.click();
    const clipboardText = await page.evaluate(() => navigator.clipboard.readText());
    expect(clipboardText.length).toBeGreaterThan(0);

    await modal.locator('.import-paste-area').fill('{"schemaVersion": 1}');
    await modal.locator('button', { hasText: 'Show technical details' }).click();
    await expect(modal.locator('.import-errors')).toContainText('title is required');
    await expect(modal.locator('button', { hasText: 'Import roadmap' })).toBeDisabled();
  });

  test('pasting valid JSON enables "Import roadmap", and importing renders the roadmap on the dashboard', async ({ page }) => {
    test.skip(!FIREBASE_CONFIGURED, 'Requires FIREBASE_CONFIGURED env var — see issue #37');
    const modal = await openCreateModal(page);

    await modal.locator('.import-paste-area').fill(validImportJson());
    await expect(modal.locator('.form-message.success')).toContainText('2 topics found');

    const importBtn = modal.locator('button', { hasText: 'Import roadmap' });
    await expect(importBtn).toBeEnabled();
    await importBtn.click();

    await expect(page).toHaveURL(/#\/app/, { timeout: 10_000 });
    await expect(page.locator('.current-roadmap-badge')).toContainText('Imported Roadmap');
    await expect(page.locator('.phase-name').first()).toContainText('Phase One');
    await expect(page.locator('.check-item')).toHaveCount(2);
    await expect(page.locator('.check-item', { hasText: 'Topic A' })).toBeVisible();
    await expect(page.locator('.check-item', { hasText: 'Topic B' })).toBeVisible();
  });

  test('"Copy prompt" is visible without scrolling the build column, even before any filters are touched', async ({ page }) => {
    test.skip(!FIREBASE_CONFIGURED, 'Requires FIREBASE_CONFIGURED env var — see issue #37');
    await page.setViewportSize({ width: 1440, height: 900 });
    const modal = await openCreateModal(page);
    await expect(modal.locator('button', { hasText: 'Copy prompt' })).toBeInViewport();
  });

  test('importing a roadmap whose items carry resources renders them on the dashboard checklist', async ({ page }) => {
    test.skip(!FIREBASE_CONFIGURED, 'Requires FIREBASE_CONFIGURED env var — see issue #37');
    const modal = await openCreateModal(page);

    await modal.locator('.import-paste-area').fill(importJsonWithResources());
    await expect(modal.locator('.form-message.success')).toContainText('1 topic found');
    await modal.locator('button', { hasText: 'Import roadmap' }).click();

    await expect(page).toHaveURL(/#\/app/, { timeout: 10_000 });
    const row = page.locator('.check-item', { hasText: 'Learn Docker' });
    await expect(row).toBeVisible();
    await expect(row.locator('[data-action="resources"]')).toContainText('2');
  });

  test('the "Resources" filter chip shows every resource link inline, in one go (issue #100 follow-up)', async ({ page }) => {
    test.skip(!FIREBASE_CONFIGURED, 'Requires FIREBASE_CONFIGURED env var — see issue #37');
    const modal = await openCreateModal(page);

    await modal.locator('.import-paste-area').fill(importJsonWithResources());
    await modal.locator('button', { hasText: 'Import roadmap' }).click();
    await expect(page).toHaveURL(/#\/app/, { timeout: 10_000 });

    const resourcesChip = page.locator('.filter-chip', { hasText: 'Resources' });
    await expect(resourcesChip).toBeVisible();
    await resourcesChip.click();
    await expect(resourcesChip).toHaveClass(/active/);

    const row = page.locator('.check-item', { hasText: 'Learn Docker' });
    const inline = row.locator('.check-resources-inline .resource-inline-link');
    await expect(inline).toHaveCount(2);
    await expect(inline.first()).toHaveAttribute('href', /^https:\/\//);
    await expect(inline.first()).toHaveAttribute('target', '_blank');
  });

  test('a corrupted title (encoded/JSON-fragment text spliced in) is rejected with an actionable error, not silently imported', async ({ page }) => {
    test.skip(!FIREBASE_CONFIGURED, 'Requires FIREBASE_CONFIGURED env var — see issue #37');
    const modal = await openCreateModal(page);

    const corrupted = JSON.stringify({
      schemaVersion: 1,
      title: 'Corrupted Roadmap',
      phases: [{
        title: 'Phase One',
        priority: 'P1',
        sections: [{
          title: 'Section One',
          items: ['Learn](https://example.com%22]},{%22title%22:%22Learn) the basics']
        }]
      }]
    });

    await modal.locator('.import-paste-area').fill(corrupted);
    await expect(modal.locator('.import-errors')).toBeHidden();
    await modal.locator('button', { hasText: 'Show technical details' }).click();
    await expect(modal.locator('.import-errors')).toContainText(/looks corrupted/i);
    await expect(modal.locator('button', { hasText: 'Import roadmap' })).toBeDisabled();
  });

  test('pasting a fenced-code-block-wrapped payload still imports successfully', async ({ page }) => {
    test.skip(!FIREBASE_CONFIGURED, 'Requires FIREBASE_CONFIGURED env var — see issue #37');
    const modal = await openCreateModal(page);

    await modal.locator('.import-paste-area').fill('```json\n' + validImportJson() + '\n```');
    await expect(modal.locator('.form-message.success')).toContainText('2 topics found');
    await expect(modal.locator('button', { hasText: 'Import roadmap' })).toBeEnabled();
  });

  test('cancelling the create modal does not create a roadmap', async ({ page }) => {
    test.skip(!FIREBASE_CONFIGURED, 'Requires FIREBASE_CONFIGURED env var — see issue #37');
    const modal = await openCreateModal(page);
    await modal.locator('button', { hasText: 'Cancel' }).click();

    await expect(modal).toHaveCount(0);
    await expect(page).toHaveURL(/#\/onboarding/);
  });

  test('the created roadmap also appears in the onboarding picker, like any other custom roadmap', async ({ page }) => {
    test.skip(!FIREBASE_CONFIGURED, 'Requires FIREBASE_CONFIGURED env var — see issue #37');
    const modal = await openCreateModal(page);
    await modal.locator('.import-paste-area').fill(validImportJson());
    await modal.locator('button', { hasText: 'Import roadmap' }).click();
    await expect(page).toHaveURL(/#\/app/, { timeout: 10_000 });

    await page.locator('.nav-item', { hasText: 'My Roadmaps' }).click();
    await expect(page).toHaveURL(/#\/onboarding/, { timeout: 10_000 });

    const card = page.locator('.template-card', { hasText: 'Imported Roadmap' });
    await expect(card.locator('.template-card-current-badge')).toContainText('Current');
    // Issue #206 §4.1 — Delete moved behind the card's ⋯ overflow menu.
    await expect(card.locator('.template-card-overflow-btn')).toBeVisible();
  });
});

test.describe('AI-assisted roadmap creation — responsive layout (issue #100)', () => {
  test('desktop viewport shows the two-column build/paste split with no horizontal scroll', async ({ page }) => {
    test.skip(!FIREBASE_CONFIGURED, 'Requires FIREBASE_CONFIGURED env var — see issue #37');
    await page.setViewportSize({ width: 1440, height: 900 });
    const modal = await openCreateModal(page);

    const buildBox = await modal.locator('.import-column-build').boundingBox();
    const pasteBox = await modal.locator('.import-column-paste').boundingBox();
    expect(buildBox.x).toBeLessThan(pasteBox.x);

    const scrollWidth = await page.evaluate(() => document.documentElement.scrollWidth);
    const clientWidth = await page.evaluate(() => document.documentElement.clientWidth);
    expect(scrollWidth).toBeLessThanOrEqual(clientWidth + 1);

    await expect(modal.locator('button', { hasText: 'Import roadmap' })).toBeInViewport();
    await expect(modal.locator('button', { hasText: 'Cancel' })).toBeInViewport();
  });

  test('narrow viewport collapses to a single stacked column with no horizontal scroll', async ({ page }) => {
    test.skip(!FIREBASE_CONFIGURED, 'Requires FIREBASE_CONFIGURED env var — see issue #37');
    await page.setViewportSize({ width: 390, height: 844 });
    const modal = await openCreateModal(page);

    const buildBox = await modal.locator('.import-column-build').boundingBox();
    const pasteBox = await modal.locator('.import-column-paste').boundingBox();
    // Stacked: paste column starts below the build column, not beside it.
    expect(pasteBox.y).toBeGreaterThanOrEqual(buildBox.y + buildBox.height - 1);

    const scrollWidth = await page.evaluate(() => document.documentElement.scrollWidth);
    const clientWidth = await page.evaluate(() => document.documentElement.clientWidth);
    expect(scrollWidth).toBeLessThanOrEqual(clientWidth + 1);
  });
});
