import { test, expect } from './fixtures.js';

// Requires the Firebase Auth/Database emulator (issue #37) — this test needs
// a real (non-guest) account and a genuine sign-out/sign-in round trip, since
// a guest's data is intentionally deleted on sign-out (see signOut.js's own
// "Guest data never reaches Firebase either way... deleted by
// signOutWithCleanup() regardless" comment) — a guest session can never
// exercise the "does this survive a sign-out/sign-in cycle" half of this
// repro at all.
const FIREBASE_CONFIGURED = !!process.env.FIREBASE_CONFIGURED;

// Issue #100's AI-import flow is the only way to create a custom roadmap —
// same minimal valid payload shape customRoadmap.test.js already uses.
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

async function importRoadmap(page, title) {
  await page.locator('.template-card-create .template-card-pick').click();
  const modal = page.locator('.modal-overlay[aria-label="Create your own roadmap"]');
  await expect(modal).toBeVisible();
  await modal.locator('.import-paste-area').fill(minimalImportJson(title));
  await modal.locator('button', { hasText: 'Import roadmap' }).click();
}

// Reproduces issue #153's exact reported repro: two custom roadmaps imported
// back-to-back (deliberately not waiting for the first import's save badge
// to settle before starting the second — see roadmapStore.js's
// serializeMetaMutation() for why this used to be able to silently erase
// one roadmap's id from meta.startedTemplateIds), then a sign-out/sign-in
// cycle, asserting both roadmaps are still present with their real content —
// not missing, and not re-seeded empty.
test.describe('two custom roadmaps imported back-to-back survive a sign-out/sign-in cycle (issue #153)', () => {
  test('both roadmaps are present with correct content after signing out and back in', async ({ page }) => {
    test.skip(!FIREBASE_CONFIGURED, 'Requires FIREBASE_CONFIGURED env var — see issue #37');

    const uniqueEmail = `issue153-${Date.now()}@example.com`;
    const password = 'TestPassword1!';

    await page.goto('/#/signup');
    await expect(page.locator('.auth-title')).toContainText('Create your account', { timeout: 10_000 });
    await page.locator('input[type="email"]').fill(uniqueEmail);
    await page.locator('input[type="password"]').first().fill(password);
    await page.locator('input[type="password"]').last().fill(password);
    await page.locator('[type="submit"]').click();
    await expect(page).toHaveURL(/#\/onboarding/, { timeout: 15_000 });

    // Import roadmap A but don't wait for its own save state to settle —
    // navigate straight back to /onboarding to start roadmap B while A's
    // switchRoadmap()/saveMeta() may still be in flight, matching the
    // reported repro's "Immediately... do not wait for the save badge to
    // settle" step.
    await importRoadmap(page, 'Roadmap A');
    await expect(page).toHaveURL(/#\/app/, { timeout: 20_000 });

    await page.goto('/#/onboarding');
    await importRoadmap(page, 'Roadmap B');
    await expect(page).toHaveURL(/#\/app/, { timeout: 20_000 });
    await expect(page.locator('.current-roadmap-badge')).toContainText('Roadmap B', { timeout: 10_000 });

    // Sign out via onboarding.js's standalone sign-out button (this page has
    // no app-shell sidebar) and accept the confirmation dialog.
    await page.goto('/#/onboarding');
    await page.locator('[aria-label="Sign out"]').click();
    await page.locator('.modal-overlay [data-action="confirm"]').click();
    await expect(page).toHaveURL(/#\/signin/, { timeout: 10_000 });

    // Signing back in with an already-onboarded account routes straight to
    // /app (main.js's own routing — onboardingDone is already true), not
    // back to /onboarding, so wait for either and then navigate to the
    // picker explicitly to check both cards.
    await page.locator('input[type="email"]').fill(uniqueEmail);
    await page.locator('input[type="password"]').fill(password);
    await page.locator('[type="submit"]').click();
    await expect(page).toHaveURL(/#\/(onboarding|app)/, { timeout: 15_000 });
    await page.goto('/#/onboarding');

    // Both roadmaps must still be listed as pickable cards — neither id was
    // silently dropped from meta.startedTemplateIds/meta.customRoadmaps.
    await expect(page.locator('.template-card-name', { hasText: 'Roadmap A' })).toBeVisible({ timeout: 10_000 });
    await expect(page.locator('.template-card-name', { hasText: 'Roadmap B' })).toBeVisible();

    // And each roadmap's actual content survived — not re-seeded empty by a
    // false-positive "fresh seed" switchRoadmap() branch.
    await page.locator('.template-card', { hasText: 'Roadmap A' }).locator('.template-card-pick').click();
    await expect(page).toHaveURL(/#\/app/, { timeout: 15_000 });
    await expect(page.locator('.check-item', { hasText: 'Seed topic' })).toBeVisible({ timeout: 10_000 });

    await page.goto('/#/onboarding');
    await page.locator('.template-card', { hasText: 'Roadmap B' }).locator('.template-card-pick').click();
    await expect(page).toHaveURL(/#\/app/, { timeout: 15_000 });
    await expect(page.locator('.check-item', { hasText: 'Seed topic' })).toBeVisible({ timeout: 10_000 });
  });
});
