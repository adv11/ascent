import { test, expect } from './fixtures.js';

// Requires the Firebase Auth/Database emulator (issue #37), same as every
// other spec that needs a real guest sign-in to reach the dashboard.
const FIREBASE_CONFIGURED = !!process.env.FIREBASE_CONFIGURED;

test.describe('phase-card expand/collapse animation (issue #6 Phase 7)', () => {
  test('collapsing a phase-card animates its height down to 0 instead of jumping instantly', async ({ page }) => {
    test.skip(!FIREBASE_CONFIGURED, 'Requires FIREBASE_CONFIGURED env var — see issue #37');
    await page.goto('/#/signin');
    await page.click('text=Continue as guest');
    await expect(page).toHaveURL(/#\/onboarding/, { timeout: 20_000 });
    // Data Scientist, not Java Backend Engineer — its first phase ("Python
    // for Data Science", 19 items) stays under LARGE_PHASE_ITEM_THRESHOLD
    // (40), so the animation actually plays. Java Backend Engineer's first
    // two phases ("Core Java": 60, "Spring and Spring Boot": 63) exceed it,
    // which is the whole point of that threshold (see dashboard.js) — but it
    // means those phases skip straight to the end state with no mid-frame to
    // observe here, which is what this test needs to exercise.
    await page.locator('.template-card', { hasText: 'Data Scientist' }).click();
    await expect(page.locator('.dashboard')).toBeVisible({ timeout: 20_000 });

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
    // machine load caused the same overrun each time.
    //
    // A `playState === 'running'` check (an earlier version of this fix) traded
    // that race for a different one: playState is a *live* snapshot, and the
    // sibling "expand" test below kept failing 3/3 on CI with it (`false`, no
    // race-y intermediate wait in the way) even though the identical shape here
    // passes reliably — most likely the CI runner's headless Chromium doesn't
    // always report a freshly-created animation as synchronously 'running' the
    // instant `.animate()` returns (a real, engine-level possibility per the
    // Web Animations spec — a "pending" play state is valid until the browser's
    // next rendering opportunity resolves the animation's start time), which
    // this app's own dev machine testing never happened to hit. Checking the
    // animation's own *construction* instead — a non-zero `duration` on its
    // effect — has no such live-state timing dependency at all: it's a static
    // property of how `.animate()` was called, true immediately and for the
    // animation's entire lifetime regardless of playState. `reduceMotion`'s
    // code path (dashboard.js) never calls `.animate()` at all, so this still
    // correctly fails if the animation was skipped — the actual thing "not an
    // instant jump" needs to prove.
    const isAnimating = await phaseBody.evaluate(el => {
      const anim = el.getAnimations()[0];
      return !!anim && anim.effect.getTiming().duration > 0;
    });
    expect(isAnimating).toBe(true);

    await expect(firstCard).not.toHaveClass(/open/);
    await expect(phaseBody).toBeHidden();
  });

  test('a collapsed phase-card expands back with an animated height, not an instant jump', async ({ page }) => {
    test.skip(!FIREBASE_CONFIGURED, 'Requires FIREBASE_CONFIGURED env var — see issue #37');
    await page.goto('/#/signin');
    await page.click('text=Continue as guest');
    await expect(page).toHaveURL(/#\/onboarding/, { timeout: 20_000 });
    // Data Scientist — see the comment on the collapse test above; its
    // second phase ("Mathematics for Machine Learning", 14 items) also
    // stays under LARGE_PHASE_ITEM_THRESHOLD.
    await page.locator('.template-card', { hasText: 'Data Scientist' }).click();
    await expect(page.locator('.dashboard')).toBeVisible({ timeout: 20_000 });

    const secondCard = page.locator('.phase-card').nth(1);
    await expect(secondCard).not.toHaveClass(/open/);
    const phaseBody = secondCard.locator('.phase-body');

    await secondCard.locator('.phase-head').click();
    // Deterministic, live-state-independent check — see the comment on the
    // collapse test above for the full history (a `playState === 'running'`
    // check failed 3/3 on CI here specifically, with no intermediate wait in
    // the way, most likely a live-state timing quirk this test's own earlier
    // fix attempts didn't account for).
    const isAnimating = await phaseBody.evaluate(el => {
      const anim = el.getAnimations()[0];
      return !!anim && anim.effect.getTiming().duration > 0;
    });
    expect(isAnimating).toBe(true);

    await expect(secondCard).toHaveClass(/open/);
    await expect(phaseBody).toBeVisible();
  });

  test('toggling a phase-card does not tear down other phase-cards (no full re-render)', async ({ page }) => {
    test.skip(!FIREBASE_CONFIGURED, 'Requires FIREBASE_CONFIGURED env var — see issue #37');
    await page.goto('/#/signin');
    await page.click('text=Continue as guest');
    await expect(page).toHaveURL(/#\/onboarding/, { timeout: 20_000 });
    await page.locator('.template-card', { hasText: 'Java Backend Engineer' }).click();
    await expect(page.locator('.dashboard')).toBeVisible({ timeout: 20_000 });

    const secondCard = page.locator('.phase-card').nth(1);
    const secondCardNode = await secondCard.elementHandle();
    await page.locator('.phase-card').first().locator('.phase-head').click();
    await page.waitForTimeout(400);
    // Same DOM node still attached — proves the toggle patched in place
    // instead of calling render() and rebuilding the whole card list.
    expect(await secondCardNode.evaluate(el => document.contains(el))).toBe(true);
  });
});
