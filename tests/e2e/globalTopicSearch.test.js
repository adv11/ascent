import { test, expect } from './fixtures.js';

// Issue #283 — global topic search across all of a user's roadmaps, wired into the
// command palette (Cmd/Ctrl+K). Requires the Firebase Auth/Database emulator, same
// as customRoadmap.test.js — creating a second custom roadmap needs a real
// (anonymous) sign-in so roadmapStore's Firebase paths actually run.
const FIREBASE_CONFIGURED = !!process.env.FIREBASE_CONFIGURED;

function minimalImportJson(title, topicTitle) {
  return JSON.stringify({
    schemaVersion: 1,
    title,
    phases: [{
      title: 'Seed Phase',
      priority: 'P1',
      sections: [{ title: 'Seed Section', items: [topicTitle] }]
    }]
  });
}

async function dismissTourIfPresent(page) {
  const tourWelcome = page.locator('.tour-welcome-card [data-action="skip"]');
  if (await tourWelcome.isVisible({ timeout: 3_000 }).catch(() => false)) {
    await tourWelcome.click();
    await expect(page.locator('.tour-welcome-card')).toBeHidden();
  }
}

async function createCustomRoadmapViaImport(page, title, topicTitle) {
  await page.locator('.template-card-create .template-card-pick').click();
  const modal = page.locator('.modal-overlay[aria-label="Create your own roadmap"]');
  await expect(modal).toBeVisible();
  await modal.locator('.import-paste-area').fill(minimalImportJson(title, topicTitle));
  await modal.locator('button', { hasText: 'Import roadmap' }).click();
  await expect(page).toHaveURL(/#\/app/, { timeout: 20_000 });
  await expect(page.locator('.current-roadmap-badge')).toContainText(title, { timeout: 10_000 });
  await dismissTourIfPresent(page);
}

test.describe('global topic search (issue #283)', () => {
  test('search surfaces topics from a non-active roadmap and navigates + opens it on selection', async ({ page }) => {
    test.skip(!FIREBASE_CONFIGURED, 'Requires FIREBASE_CONFIGURED env var — see issue #37');

    await page.goto('/#/signin');
    await page.click('text=Continue as guest');
    await expect(page).toHaveURL(/#\/onboarding/, { timeout: 10_000 });

    // Roadmap A — becomes inactive the moment roadmap B is created below.
    await createCustomRoadmapViaImport(page, 'Alpha Roadmap', 'Zylophone Fundamentals Q7');
    // Roadmap B — created second, so it's the active roadmap once both exist.
    await page.locator('a.brand').click();
    await expect(page).toHaveURL(/#\/onboarding/, { timeout: 10_000 });
    await createCustomRoadmapViaImport(page, 'Beta Roadmap', 'Quokka Habitat Research');

    // Beta is active — confirm Alpha's topic is NOT visible on this dashboard's
    // own local search (the per-roadmap filter box), so a hit for it can only
    // have come from the global cross-roadmap search below.
    await expect(page.locator('.current-roadmap-badge')).toContainText('Beta Roadmap');
    await expect(page.locator('.check-title', { hasText: 'Zylophone Fundamentals Q7' })).toHaveCount(0);

    // Open the command palette and search for Alpha's topic by its distinctive title.
    await page.keyboard.press('Control+k');
    const palette = page.locator('.command-palette-card');
    await expect(palette).toBeVisible();
    await page.locator('.command-palette-input').fill('Zylophone Fundamentals');

    const topicResult = page.locator('.command-palette-item', { hasText: 'Zylophone Fundamentals Q7' });
    await expect(topicResult).toBeVisible({ timeout: 10_000 });
    await expect(page.locator('.command-palette-group-label', { hasText: 'Topics' })).toBeVisible();
    await expect(topicResult).toContainText('Alpha Roadmap');

    await topicResult.click();

    // Selecting it: switches the active roadmap to Alpha, and opens + scrolls to
    // the matching topic's edit panel.
    await expect(page.locator('.current-roadmap-badge')).toContainText('Alpha Roadmap', { timeout: 15_000 });
    const itemPanel = page.locator('.item-panel[aria-label="Edit topic"]');
    await expect(itemPanel).toBeVisible({ timeout: 10_000 });
    await expect(itemPanel.locator('.field-input').first()).toHaveValue('Zylophone Fundamentals Q7');
  });

  test('a query below the minimum length shows nav results only, no Topics group', async ({ page }) => {
    test.skip(!FIREBASE_CONFIGURED, 'Requires FIREBASE_CONFIGURED env var — see issue #37');

    await page.goto('/#/signin');
    await page.click('text=Continue as guest');
    await expect(page).toHaveURL(/#\/onboarding/, { timeout: 10_000 });
    await page.locator('.template-card:not(.template-card-create) .template-card-pick').first().click();
    await expect(page).toHaveURL(/#\/app/, { timeout: 15_000 });
    await dismissTourIfPresent(page);

    await page.keyboard.press('Control+k');
    await expect(page.locator('.command-palette-card')).toBeVisible();
    await page.locator('.command-palette-input').fill('a');

    await expect(page.locator('.command-palette-group-label')).toHaveCount(0);
    await expect(page.locator('.command-palette-item').first()).toBeVisible();
  });
});
