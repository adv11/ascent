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
    // A real, reported CI flake: this used to be `await page.waitForTimeout(80)`
    // then read `getBoundingClientRect().height`, racing wall-clock time against
    // the 200ms animation. On a loaded/shared CI runner, the CDP round-trip for
    // the timeout + the follow-up evaluate() can itself take well over 120ms, so
    // by the time the height was actually sampled the (short) animation had
    // already finished — reading a legitimate 0 and failing an assertion whose
    // premise (mid-flight) no longer held, on every retry, since the same
    // machine load caused the same overrun each time. Querying `getAnimations()`
    // for a `running` WAAPI animation right after `click()` resolves is
    // deterministic instead — a fresh `Element.animate()` call is synchronously
    // `running`, independent of frame timing or how long the round-trip to read
    // it back takes.
    const isAnimating = await phaseBody.evaluate(el => {
      const anim = el.getAnimations()[0];
      return !!anim && anim.playState === 'running';
    });
    expect(isAnimating).toBe(true);

    await expect(firstCard).not.toHaveClass(/open/);
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
    // Deterministic check, not a wall-clock race — see the comment on the
    // collapse test above for why. Read immediately after click() resolves,
    // same as the collapse test — an intermediate `await
    // expect(...).toHaveClass(/open/)` here (an earlier version of this fix)
    // reintroduced the identical race: its own polling round-trip could
    // itself take long enough on a loaded CI runner for the 200ms animation
    // to already finish before this evaluate() ever ran, reproducing the
    // exact flake this rewrite was meant to eliminate (confirmed failing
    // 3/3 attempts on CI with that intermediate wait in place).
    const isAnimating = await phaseBody.evaluate(el => {
      const anim = el.getAnimations()[0];
      return !!anim && anim.playState === 'running';
    });
    expect(isAnimating).toBe(true);

    await expect(secondCard).toHaveClass(/open/);
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
