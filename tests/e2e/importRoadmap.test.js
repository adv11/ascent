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

async function openImportModal(page) {
  await page.goto('/');
  await page.click('text=Continue as guest');
  await expect(page).toHaveURL(/#\/onboarding/, { timeout: 10_000 });
  await page.click('.template-card-import');
  const modal = page.locator('.modal-overlay[aria-label="Import roadmap"]');
  await expect(modal).toBeVisible();
  return modal;
}

test.describe('AI-assisted roadmap import (issue #4)', () => {
  test('the "Import roadmap" card opens a modal with "Generate with AI" active by default', async ({ page }) => {
    test.skip(!FIREBASE_CONFIGURED, 'Requires FIREBASE_CONFIGURED env var — see issue #37');
    const modal = await openImportModal(page);
    await expect(modal.locator('.import-tab-btn.active')).toContainText('Generate with AI');
    await expect(modal.locator('.import-prompt-block')).toContainText('schemaVersion');
  });

  test('typing a topic updates the copyable prompt, and "Copy prompt" copies it to the clipboard', async ({ page, context }) => {
    test.skip(!FIREBASE_CONFIGURED, 'Requires FIREBASE_CONFIGURED env var — see issue #37');
    await context.grantPermissions(['clipboard-read', 'clipboard-write']);
    const modal = await openImportModal(page);

    await modal.locator('textarea').first().fill('Kubernetes for backend engineers');
    await expect(modal.locator('.import-prompt-block')).toContainText('Kubernetes for backend engineers');

    await modal.locator('button', { hasText: 'Copy prompt' }).click();
    await expect(modal.locator('button', { hasText: 'Copied!' })).toBeVisible();

    const clipboardText = await page.evaluate(() => navigator.clipboard.readText());
    expect(clipboardText).toContain('Kubernetes for backend engineers');
    expect(clipboardText).toContain('schemaVersion');
  });

  test('pasting invalid JSON shows field errors and keeps "Import roadmap" disabled', async ({ page }) => {
    test.skip(!FIREBASE_CONFIGURED, 'Requires FIREBASE_CONFIGURED env var — see issue #37');
    const modal = await openImportModal(page);
    await modal.locator('.import-tab-btn', { hasText: 'Paste & Import' }).click();

    await modal.locator('.import-paste-area').fill('{not valid json');
    await expect(modal.locator('.import-errors')).toContainText('Invalid JSON');
    await expect(modal.locator('button', { hasText: 'Import roadmap' })).toBeDisabled();

    await modal.locator('.import-paste-area').fill('{"schemaVersion": 1}');
    await expect(modal.locator('.import-errors')).toContainText('title is required');
    await expect(modal.locator('button', { hasText: 'Import roadmap' })).toBeDisabled();
  });

  test('pasting valid JSON enables "Import roadmap", and importing renders the roadmap on the dashboard', async ({ page }) => {
    test.skip(!FIREBASE_CONFIGURED, 'Requires FIREBASE_CONFIGURED env var — see issue #37');
    const modal = await openImportModal(page);
    await modal.locator('.import-tab-btn', { hasText: 'Paste & Import' }).click();

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

  test('cancelling the import modal does not create a roadmap', async ({ page }) => {
    test.skip(!FIREBASE_CONFIGURED, 'Requires FIREBASE_CONFIGURED env var — see issue #37');
    const modal = await openImportModal(page);
    await modal.locator('button', { hasText: 'Cancel' }).click();

    await expect(modal).toHaveCount(0);
    await expect(page).toHaveURL(/#\/onboarding/);
  });

  test('the imported roadmap also appears in the onboarding picker, like any other custom roadmap', async ({ page }) => {
    test.skip(!FIREBASE_CONFIGURED, 'Requires FIREBASE_CONFIGURED env var — see issue #37');
    const modal = await openImportModal(page);
    await modal.locator('.import-tab-btn', { hasText: 'Paste & Import' }).click();
    await modal.locator('.import-paste-area').fill(validImportJson());
    await modal.locator('button', { hasText: 'Import roadmap' }).click();
    await expect(page).toHaveURL(/#\/app/, { timeout: 10_000 });

    await page.locator('button', { hasText: 'Switch template' }).click();
    await expect(page).toHaveURL(/#\/onboarding/, { timeout: 10_000 });

    const card = page.locator('.template-card', { hasText: 'Imported Roadmap' });
    await expect(card.locator('.template-card-current-badge')).toContainText('Current');
    await expect(card.locator('[data-action="delete"]')).toBeVisible();
  });
});
