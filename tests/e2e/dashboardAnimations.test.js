import { test, expect } from './fixtures.js';

// Requires the Firebase Auth/Database emulator (issue #37), same as every
// other spec that needs a real guest sign-in to reach the dashboard.
const FIREBASE_CONFIGURED = !!process.env.FIREBASE_CONFIGURED;

test.describe('phase-card expand/collapse animation (issue #6 Phase 7)', () => {
  test('collapsing a phase-card animates its height down to 0 instead of jumping instantly', async ({ page }) => {
    test.skip(!FIREBASE_CONFIGURED, 'Requires FIREBASE_CONFIGURED env var — see issue #37');
    await page.goto('/#/signin');
    await page.click('text=Continue as guest');
    await expect(page).toHaveURL(/#\/onboarding/, { timeout: 10_000 });
    // Data Scientist, not Java Backend Engineer — its first phase ("Python
    // for Data Science", 19 items) stays under LARGE_PHASE_ITEM_THRESHOLD
    // (40), so the animation actually plays. Java Backend Engineer's first
    // two phases ("Core Java": 60, "Spring and Spring Boot": 63) exceed it,
    // which is the whole point of that threshold (see dashboard.js) — but it
    // means those phases skip straight to the end state with no mid-frame to
    // observe here, which is what this test needs to exercise.
    await page.locator('.template-card', { hasText: 'Data Scientist' }).click();
    await expect(page.locator('.dashboard')).toBeVisible({ timeout: 10_000 });

    const firstCard = page.locator('.phase-card').first();
    await expect(firstCard).toHaveClass(/open/);
    const phaseBody = firstCard.locator('.phase-body');

    await firstCard.locator('.phase-head').click();
    // Mid-animation: still visible (not yet display:none) and partway collapsed.
    await page.waitForTimeout(80);
    const midHeight = await phaseBody.evaluate(el => el.getBoundingClientRect().height);
    expect(midHeight).toBeGreaterThan(0);

    await expect(firstCard).not.toHaveClass(/open/);
    await page.waitForTimeout(300);
    await expect(phaseBody).toBeHidden();
  });

  test('a collapsed phase-card expands back with an animated height, not an instant jump', async ({ page }) => {
    test.skip(!FIREBASE_CONFIGURED, 'Requires FIREBASE_CONFIGURED env var — see issue #37');
    await page.goto('/#/signin');
    await page.click('text=Continue as guest');
    await expect(page).toHaveURL(/#\/onboarding/, { timeout: 10_000 });
    // Data Scientist — see the comment on the collapse test above; its
    // second phase ("Mathematics for Machine Learning", 14 items) also
    // stays under LARGE_PHASE_ITEM_THRESHOLD.
    await page.locator('.template-card', { hasText: 'Data Scientist' }).click();
    await expect(page.locator('.dashboard')).toBeVisible({ timeout: 10_000 });

    const secondCard = page.locator('.phase-card').nth(1);
    await expect(secondCard).not.toHaveClass(/open/);
    const phaseBody = secondCard.locator('.phase-body');

    await secondCard.locator('.phase-head').click();
    await expect(secondCard).toHaveClass(/open/);
    await page.waitForTimeout(80);
    const midHeight = await phaseBody.evaluate(el => el.getBoundingClientRect().height);
    expect(midHeight).toBeGreaterThan(0);

    await page.waitForTimeout(300);
    await expect(phaseBody).toBeVisible();
  });

  test('toggling a phase-card does not tear down other phase-cards (no full re-render)', async ({ page }) => {
    test.skip(!FIREBASE_CONFIGURED, 'Requires FIREBASE_CONFIGURED env var — see issue #37');
    await page.goto('/#/signin');
    await page.click('text=Continue as guest');
    await expect(page).toHaveURL(/#\/onboarding/, { timeout: 10_000 });
    await page.locator('.template-card', { hasText: 'Java Backend Engineer' }).click();
    await expect(page.locator('.dashboard')).toBeVisible({ timeout: 10_000 });

    const secondCard = page.locator('.phase-card').nth(1);
    const secondCardNode = await secondCard.elementHandle();
    await page.locator('.phase-card').first().locator('.phase-head').click();
    await page.waitForTimeout(400);
    // Same DOM node still attached — proves the toggle patched in place
    // instead of calling render() and rebuilding the whole card list.
    expect(await secondCardNode.evaluate(el => document.contains(el))).toBe(true);
  });
});
