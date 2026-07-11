import { AxeBuilder } from '@axe-core/playwright';
import { test, expect } from './fixtures.js';

// Issue #6 Phase 9 — "Run axe-core against every page in CI; zero critical
// violations." Only checks 'critical'/'serious' impact violations, not every
// axe rule. 'color-contrast' is fully enabled on every page except the
// dashboard, where two specific elements are excluded from the whole scan —
// confirmed, not assumed, to be a sampler false positive on this app: axe
// reported ".phase-name" at a 4.49:1 ratio against foreground/background
// colors (#6f7582 on #fafcfd) that don't match its actual computed style at
// all (getComputedStyle() reads rgb(15,23,42) i.e. --ink on rgb(255,255,255),
// a real ~17.85:1) — axe's rendering-based pixel sampler misattributes color
// on this page, most likely from the progress-ring SVG/box-shadow elements
// it overlaps. The same mismatch repro'd on ".badge.P0" (axe: 2.66 with
// #fafcfd/#e67e7f; actual: white on --p0's #dc2626, ~4.83:1). Every
// text/background token pair actually used in the app was verified
// separately with a real WCAG contrast-ratio calculation against the exact
// hex values in app.css (see the --muted/--faint token comments there).
// Rescoped from a blanket app-wide `disableRules(['color-contrast'])` to
// this narrow per-element exclusion (issue #116) — the previous version
// silently disabled the one rule that would have caught the
// `.feedback-type-card`/`.my-report-summary` dark-theme contrast bug (issue
// #116) on every other page too. See .claude/rules/ui-styling.md for the
// full exception list this maps to.
const CONTRAST_FALSE_POSITIVE_SELECTORS = ['.phase-name', '.badge.P0'];
const FIREBASE_CONFIGURED = !!process.env.FIREBASE_CONFIGURED;

function seriousOrCritical(results) {
  return results.violations.filter(v => v.impact === 'serious' || v.impact === 'critical');
}

async function runAxe(page, { excludeContrastFalsePositives = false } = {}) {
  const builder = new AxeBuilder({ page });
  if (excludeContrastFalsePositives) {
    for (const selector of CONTRAST_FALSE_POSITIVE_SELECTORS) builder.exclude([selector]);
  }
  const results = await builder.analyze();
  return seriousOrCritical(results);
}

test.describe('automated accessibility checks (issue #6 Phase 9)', () => {
  test('landing page has zero critical/serious axe violations', async ({ page }) => {
    await page.goto('/#/');
    await expect(page.locator('.landing-page')).toBeVisible({ timeout: 10_000 });
    const violations = await runAxe(page);
    expect(violations, JSON.stringify(violations, null, 2)).toEqual([]);
  });

  test('sign-in page has zero critical/serious axe violations', async ({ page }) => {
    await page.goto('/#/signin');
    await expect(page.locator('.auth-page, .auth-card')).toBeVisible({ timeout: 10_000 });
    const violations = await runAxe(page);
    expect(violations, JSON.stringify(violations, null, 2)).toEqual([]);
  });

  test('sign-up page has zero critical/serious axe violations', async ({ page }) => {
    await page.goto('/#/signup');
    await expect(page.locator('.auth-page, .auth-card')).toBeVisible({ timeout: 10_000 });
    const violations = await runAxe(page);
    expect(violations, JSON.stringify(violations, null, 2)).toEqual([]);
  });

  test('onboarding picker has zero critical/serious axe violations', async ({ page }) => {
    test.skip(!FIREBASE_CONFIGURED, 'Requires FIREBASE_CONFIGURED env var — see issue #37');
    await page.goto('/#/signin');
    await page.click('text=Continue as guest');
    await expect(page).toHaveURL(/#\/onboarding/, { timeout: 10_000 });
    const violations = await runAxe(page);
    expect(violations, JSON.stringify(violations, null, 2)).toEqual([]);
  });

  test('dashboard has zero critical/serious axe violations', async ({ page }) => {
    test.skip(!FIREBASE_CONFIGURED, 'Requires FIREBASE_CONFIGURED env var — see issue #37');
    await page.goto('/#/signin');
    await page.click('text=Continue as guest');
    await expect(page).toHaveURL(/#\/onboarding/, { timeout: 10_000 });
    await page.locator('.template-card', { hasText: 'Java Backend Engineer' }).click();
    await expect(page.locator('.dashboard')).toBeVisible({ timeout: 10_000 });
    const violations = await runAxe(page, { excludeContrastFalsePositives: true });
    expect(violations, JSON.stringify(violations, null, 2)).toEqual([]);
  });
});

// Issue #116 — the light-mode-only axe pass above would never have caught
// the `.feedback-type-card`/`.my-report-summary` dark-theme contrast bug
// (near-black text on a dark navy background), since axe was only ever run
// against the default light theme. Forcing dark theme before navigation and
// re-running the same zero-critical-violations assertion closes that gap.
test.describe('automated accessibility checks — dark theme (issue #116)', () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      window.localStorage.setItem('ascent-theme', 'dark');
    });
  });

  test('landing page has zero critical/serious axe violations in dark theme', async ({ page }) => {
    await page.goto('/#/');
    await expect(page.locator('.landing-page')).toBeVisible({ timeout: 10_000 });
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
    const violations = await runAxe(page);
    expect(violations, JSON.stringify(violations, null, 2)).toEqual([]);
  });

  test('sign-in page has zero critical/serious axe violations in dark theme', async ({ page }) => {
    await page.goto('/#/signin');
    await expect(page.locator('.auth-page, .auth-card')).toBeVisible({ timeout: 10_000 });
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
    const violations = await runAxe(page);
    expect(violations, JSON.stringify(violations, null, 2)).toEqual([]);
  });

  test('dashboard has zero critical/serious axe violations in dark theme', async ({ page }) => {
    test.skip(!FIREBASE_CONFIGURED, 'Requires FIREBASE_CONFIGURED env var — see issue #37');
    await page.goto('/#/signin');
    await page.click('text=Continue as guest');
    await expect(page).toHaveURL(/#\/onboarding/, { timeout: 10_000 });
    await page.locator('.template-card', { hasText: 'Java Backend Engineer' }).click();
    await expect(page.locator('.dashboard')).toBeVisible({ timeout: 10_000 });
    const violations = await runAxe(page, { excludeContrastFalsePositives: true });
    expect(violations, JSON.stringify(violations, null, 2)).toEqual([]);
  });
});
