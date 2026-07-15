import { test, expect } from './fixtures.js';

// Requires the Firebase Auth/Database emulator (issue #37), same as every
// other spec that needs a real (anonymous) sign-in.
const FIREBASE_CONFIGURED = !!process.env.FIREBASE_CONFIGURED;

// Same minimal single-phase/single-section/single-item seed as
// customRoadmap.test.js's createCustomRoadmapViaImport — a roadmap this
// small is complete the moment its one topic is checked off, which is
// exactly the celebration trigger this spec needs to exercise.
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
  await expect(page).toHaveURL(/#\/app/, { timeout: 20_000 });
  await expect(page.locator('.current-roadmap-badge')).toContainText(title, { timeout: 10_000 });
}

test.describe('phase/roadmap completion celebration (issue #181)', () => {
  test('completing the last topic fires the celebration toast once, and it does not refire on reload', async ({ page }) => {
    test.skip(!FIREBASE_CONFIGURED, 'Requires FIREBASE_CONFIGURED env var — see issue #37');
    await createCustomRoadmapViaImport(page, 'Celebration Test Roadmap');

    await page.locator('.check-item', { hasText: 'Seed topic' }).locator('.check-box').click();

    await expect(page.locator('.toast', { hasText: 'Phase complete' })).toBeVisible({ timeout: 5_000 });
    await expect(page.locator('.toast', { hasText: 'Roadmap complete' })).toBeVisible({ timeout: 5_000 });
    await expect(page.locator('.confetti-burst')).toHaveCount(1);

    await page.reload();
    await expect(page.locator('.current-roadmap-badge')).toContainText('Celebration Test Roadmap', { timeout: 10_000 });
    // Give any (incorrect) refire a moment to happen before asserting absence.
    await page.waitForTimeout(1000);
    await expect(page.locator('.toast', { hasText: 'Phase complete' })).toHaveCount(0);
    await expect(page.locator('.toast', { hasText: 'Roadmap complete' })).toHaveCount(0);
  });
});
