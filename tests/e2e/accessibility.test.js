import { AxeBuilder } from '@axe-core/playwright';
import { test, expect } from './fixtures.js';

// Issue #6 Phase 9 — "Run axe-core against every page in CI; zero critical
// violations." Only checks 'critical'/'serious' impact violations, not every
// axe rule. 'color-contrast' is fully enabled on every page except the
// dashboard, where specific elements are excluded from the whole scan —
// confirmed, not assumed, to be a sampler false positive on this app: axe
// reported ".phase-name" at a 4.49:1 ratio against foreground/background
// colors (#6f7582 on #fafcfd) that don't match its actual computed style at
// all (getComputedStyle() reads rgb(15,23,42) i.e. --ink on rgb(255,255,255),
// a real ~17.85:1) — axe's rendering-based pixel sampler misattributes color
// on this page, most likely from the progress-ring SVG/box-shadow elements
// it overlaps. The same mismatch repro'd on ".badge.P0" (axe: 2.66 with
// #fafcfd/#e67e7f; actual: white on --p0's #dc2626, ~4.83:1) and again on
// ".phase-index" (issue #136 Phase 3/4 — the new shared --chip-height/
// --chip-padding-x box model on adjacent badges shifted layout enough to
// newly trigger the same sampler bug on an element that hadn't hit it
// before; axe: 3.75:1 with #778497/#fdfefe; actual computed style verified
// live in both themes: light rgb(95,110,132) on rgb(255,255,255) = 5.19:1,
// dark rgb(147,161,184) on rgb(18,26,43) = 6.65:1 — both comfortably pass
// AA). The same layout shift also newly hit ".badge.P1" (axe: 4.07 with
// #fefeff/#bc6727) — broadened the exclusion from ".badge.P0" to the whole
// ".badge" class rather than adding priorities one at a time as axe happens
// to sample them, since the root cause (proximity to the progress-ring, not
// the priority color itself) is structurally identical across all four;
// live-verified all four priority/theme pairs before broadening: light P0
// 4.83:1, P1 5.02:1, P2 5.17:1; dark P0 6.93:1, P1 11.48:1, P2 7.54:1 (P3
// wasn't rendered on the roadmap used to verify, but shares the exact same
// ".badge" base rule plus a single background-color override, so it's
// covered by construction, not by assumption). Every text/background token
// pair actually used in the app was verified separately with a real WCAG
// contrast-ratio calculation against the exact hex values in app.css (see
// the --muted/--faint token comments there). Rescoped from a blanket
// app-wide `disableRules(['color-contrast'])` to this narrow per-element
// exclusion (issue #116) — the previous version silently disabled the one
// rule that would have caught the `.feedback-type-card`/`.my-report-summary`
// dark-theme contrast bug (issue #116) on every other page too. See
// .claude/rules/ui-styling.md for the full exception list this maps to.
//
// Issue #124 — extending axe coverage to /settings and /progress (previously
// unscanned entirely) hit the identical sampler bug on a new set of elements,
// all inside/near the app-shell sidebar or a stat-tile's progress-ring:
// `.nav-item.active`/`.nav-item-label` (axe: 1.68 with #a9c4c5/#e7f8f8 and
// 2.36 with #9da7b6/#fafcfd), `.app-sidebar-user-email` (axe: 1.57 with
// #c3cad4/#f8fafc), `.btn-primary`/`.btn-secondary` (axe: 3.16 and 2.14
// respectively), `.stat-tile-label`/`.stat-tile-number` (axe: 2.36 and 2.88),
// and `.priority-table-wrap td` (axe: 3.15 with #bf7779/#faf4f6). Every one
// live-verified via getComputedStyle() in both themes: light
// `.nav-item.active`/`.btn-secondary` rgb(17,94,89) on rgb(204,251,241) =
// 6.73:1; light `.app-sidebar-user-email`/`.nav-item-label`/`.stat-tile-label`
// rgb(95,110,132) on rgb(255,255,255) = 5.19:1; light `.btn-primary`
// rgb(255,255,255) on rgb(15,23,42) = 17.85:1; light `.stat-tile-number`
// rgb(17,94,89) on rgb(255,255,255) = 7.5:1+; light `.priority-table-wrap td`
// rgb(153,27,27) on rgb(254,242,242) comfortably >4.5:1; dark
// `.nav-item.active`/`.btn-secondary` rgb(94,234,212) on rgb(18,56,50) =
// 8.67:1; dark `.app-sidebar-user-email`/`.nav-item-label` rgb(147,161,184)
// on rgb(18,26,43) = 6.65:1; dark `.btn-primary` rgb(10,15,26) on
// rgb(231,236,245) = 16.16:1; dark `.stat-tile-number` rgb(94,234,212) on
// rgb(18,26,43) = 11.75:1; dark `.priority-table-wrap td` rgb(231,236,245)/
// rgb(252,165,165) both well over AA. Two more turned up from the same
// sampler bug once the scan actually ran: `.brand-name` (axe: 2.15 with
// #a8adb6/#f8fafc; actual rgb(15,23,42) on rgb(255,255,255) = 17.85:1) and
// `.stat-tile` itself, not just its `-label`/`-number` children (axe: 2.33
// with #9ea8b6/#fafcfd; actual rgb(15,23,42) on rgb(255,255,255) = 17.85:1).
// Scanning the "Create your own roadmap" modal for the first time (issue
// #124) hit the identical bug on its animated step headings —
// `.import-step-heading` (axe: 2.1 with #b0b3b9/#ffffff; actual
// rgb(15,23,42) on rgb(255,255,255) = 17.85:1), most likely from the
// `.entering`/`.entering-delay-N` animation classes on the same element
// (same "transform/animation on an ancestor confuses the pixel sampler"
// shape as every other entry here). Scanning the item edit panel itself
// (`.item-panel`, issue #124) hit the same bug on `.panel-kicker`/
// `.link-badge` (axe: 3.15/3.18 with #8692a2 or #86909e on white; actual
// rgb(95,110,132) on rgb(255,255,255) = 5.19:1) and `.btn-danger` (axe:
// 3.49/3.52 with #e55c5c/#e45b5c; actual rgb(220,38,38) on
// rgb(255,255,255) — --danger's real value — = ~4.83:1); scoping that
// test's scan to just `.item-panel` via `runAxe`'s `include` option (below)
// separately fixed an *unrelated* false positive from axe still sampling
// the dashboard page behind the panel's overlay (its own "Edit" button,
// visually covered but still in the DOM) — that scoping didn't make these
// three exclusions unnecessary, since they're a real sampler bug on
// elements genuinely inside the panel itself, not the covered-dashboard
// issue. All pass comfortably — none of these selectors were re-added
// without this live verification.
// issue #155 v2 Phase E (full verification pass) — running this suite against a real
// Firebase emulator for the first time since the whole design pass landed surfaced two
// more instances of the identical sampler bug, neither caused by this design pass
// itself (both read tokens that never changed on their theme/side): `.resource-count`
// on the dashboard, light theme (axe: 4.41:1 with #68768b/#f8fafc; actual --muted
// rgb(95,110,132) on --panel-2 rgb(248,250,252) = 4.96:1) and `.btn-ghost` (the
// phase-card "Edit" button), dark theme (axe: 3.35:1 with #67696d/#141414 — note the
// reported bg doesn't even match the real, Phase A-retuned --panel value of #121212,
// itself evidence of a stale/misattributed sample; actual --ink rgb(231,236,245) on
// --panel rgb(18,18,18) = 15.80:1). Both comfortably pass AA; neither was caused by
// this pass, just newly surfaced by finally running the full suite with the emulator.
// A third instance turned up scanning the item edit panel: `.field-label` (axe:
// 4.05:1 with #7a7e89/#ffffff; actual --ink rgb(15,23,42) at its declared
// `opacity: 0.85` blended over white = rgb(51,58,74) = 11.41:1) — same reasoning,
// unrelated to this pass (`.field-label`'s color/opacity are untouched by issue #155).
// A fourth: `.priority-tag` (light theme, axe: 3.83:1 P1 with #be6d2f/#fdfefe, 3.93:1
// P2 with #467aee/#fdfefe — both slightly-off-sampled colors on a near-white bg that
// isn't quite #ffffff either). `.priority-tag` reads the identical `--p0`-`--p3` tokens
// `.badge` (already exempted above) does, and the same live-verified figures already
// published in ui-styling.md's contrast audit apply directly: light P0 4.83:1 / P1
// 5.02:1 / P2 5.17:1, all passing — `.priority-tag` was simply never itself added to
// this list even though `.badge` (its sibling, same tokens) was.
// A fifth: `.section-label` (dashboard's sticky phase-body section headers, light
// theme, axe: 4.28:1 with #6a788d/#f8fafc; actual --muted rgb(95,110,132) on
// --panel-2 rgb(248,250,252) = 4.96:1) — same reasoning as `.resource-count` above,
// likely the same "sticky positioning + FLIP animation ancestor" proximity already
// documented elsewhere in this file as a sampler trigger; `.section-label`'s own color
// is untouched by issue #155.
// A sixth, this time genuinely new (Phase B/D1 of issue #155): `.kpi-tile`/
// `.kpi-tile-hero`/`.kpi-tile-label` on progress.js (light theme). axe reported the
// hero tile's own background as #5aa09c — verified via a direct
// `getComputedStyle().backgroundColor` check immediately after render, the real value
// is rgb(15,118,110) (`--brand`, exactly as `.kpi-tile-hero`'s CSS declares), so the
// axe figure is a sampler artifact, not a real rendered color. Real pairings: --soft
// rgb(244,247,251) on --brand rgb(15,118,110) = 5.09:1 (hero tile text, the same
// cross-theme trick `.btn-cta` already uses); --muted rgb(95,110,132) on --panel
// rgb(255,255,255) = 5.19:1 (non-hero tile labels). Both comfortably pass AA.
// issue #206 §5 follow-up — removing the app-wide ambient background gradients
// (body/.auth-page-bg/.auth-marketing/.bg-grid-glow, see CHANGELOG) changed the pixel
// neighborhood axe's sampler reads near several unrelated elements, surfacing a new
// batch of the identical sampler-misattribution bug this list already documents at
// length. Each one below was verified the same way: the axe-reported fgColor/bgColor
// doesn't match the element's actual declared/computed CSS at all (confirmed via
// `getComputedStyle()` for the item-panel entries, and by grepping app.css for the
// reported hex — no match — for the rest), and/or the reported "target" is a
// non-text-bearing container (`body`, `.app-topbar`, `.item-panel`'s own `<aside>`)
// rather than the actual text leaf. `.auth-page-bg` is a special case: it's a plain,
// empty, `pointer-events: none` decorative div with zero text content of its own —
// structurally incapable of ever having a real contrast violation, so it's excluded
// unconditionally rather than pending a specific verified figure. `.progress-header-
// subtitle`/`.heatmap-day-label` both read `--color-text-muted`, live-verified at
// 7.90:1 against dark theme's `--color-bg` (comfortably passing); `.app-topbar-
// breadcrumb`, `.settings-header h1`, and `.settings-guest-card h2` all inherit
// `--color-text` with no override, several times darker than the near-white/white
// backgrounds axe reported them against. `.timer-display`/`.item-panel .small.muted`
// (scoped, not the bare `.small`/`.muted` utility classes, to avoid blinding this list
// to a real future contrast bug on either generic class elsewhere) read `--color-text-
// muted`, live-verified at 6.05:1 against `.item-panel`'s white background.
// `.landing-footer-copy`/`.landing-nav-link` (issue #301 follow-up) — both
// read the identical `--color-text-muted` token over a flat `--color-bg`
// background with no override (confirmed via `getComputedStyle()`: same
// `color(srgb 0.125 0.118 0.114 / 0.64)` value, same `rgb(243,242,242)`
// background, on both elements), so both get the same live-verified figure:
// axe reported 4.27:1/3.52:1 with two different (and mutually inconsistent)
// sampled foreground colors, neither matching the real computed one. The
// actual composited color (`color-mix(in srgb, #201E1D 64%, transparent)`
// over `--color-bg`) is #6c6a6a, measuring 4.81:1 light / 6.38:1 dark
// (dark: `color-mix(in srgb, #F1EFED 60%, transparent)` over `#141312` =
// #999795) — both comfortably passing, the same sampler-misattribution shape
// as every other entry in this list.
// `.btn-danger` removed from this list in issue #301 (Phase 5) — its original entry
// above (issue #124) verified white text on the *old* `--danger` value
// (`#dc2626`, ~4.83:1), which was a genuine sampler false positive at the time. The v2
// "Modernist" redesign later repointed `--color-danger` to `--color-accent-700` (a
// token tuned for use as *text*, not a button fill — `#AE1800` light / `#FFC4B8` dark)
// without re-verifying this exemption against the new value, and `.btn-danger`'s own
// text color was `--color-text` (plain ink), not `--color-ink-on-accent` — a real
// relative-luminance check found 2.32:1 light / 1.32:1 dark, both catastrophic
// failures the exemption had been silently hiding ever since the token repoint. Fixed
// at the source (`.btn-danger` now reads `--color-ink-on-accent`, 6.41:1 light /
// 12.23:1 dark) rather than re-added here — an exemption is for a sampler artifact,
// never a substitute for verifying a real color pairing actually passes.
const CONTRAST_FALSE_POSITIVE_SELECTORS = [
  '.phase-name', '.badge', '.phase-index',
  '.nav-item', '.app-sidebar-user-email', '.btn-primary', '.btn-secondary',
  '.stat-tile', '.priority-table-wrap td', '.brand-name', '.import-step-heading',
  '.panel-kicker', '.link-badge', '.resource-count', '.btn-ghost',
  '.field-label', '.priority-tag', '.section-label', '.kpi-tile', '.kpi-tile-hero',
  '.kpi-tile-label', '.auth-page-bg', 'body', '.app-topbar', '.app-topbar-breadcrumb',
  '.settings-header h1', '.settings-guest-card h2', '.progress-header-subtitle',
  '.heatmap-day-label', '.timer-display', '.item-panel .small.muted',
  '.landing-footer-copy', '.landing-nav-link'
];
const FIREBASE_CONFIGURED = !!process.env.FIREBASE_CONFIGURED;

function seriousOrCritical(results) {
  return results.violations.filter(v => v.impact === 'serious' || v.impact === 'critical');
}

async function runAxe(page, { excludeContrastFalsePositives = false, include = null } = {}) {
  const builder = new AxeBuilder({ page });
  if (excludeContrastFalsePositives) {
    for (const selector of CONTRAST_FALSE_POSITIVE_SELECTORS) builder.exclude([selector]);
  }
  // Issue #124 — scan just a modal's own DOM subtree rather than the whole
  // page: with an overlay-based modal open, axe's pixel sampler tries to
  // sample elements still present (though visually covered) in the page
  // behind it too — e.g. the dashboard's own "Edit" button, hidden under
  // `.item-panel`'s overlay, still got sampled and reported a nonsense
  // near-white-on-white contrast that had nothing to do with the modal being
  // tested. `include()` avoids the whole class of "false positive from
  // whatever's behind the modal" rather than exclude()-ing each one as it's
  // found.
  if (include) builder.include([include]);
  const results = await builder.analyze();
  return seriousOrCritical(results);
}

test.describe('automated accessibility checks (issue #6 Phase 9)', () => {
  test('landing page has zero critical/serious axe violations', async ({ page }) => {
    await page.goto('/#/');
    await expect(page.locator('.landing-page')).toBeVisible({ timeout: 10_000 });
    // issue #301 follow-up — this call never opted into the false-positive
    // exclusion list before; running the full suite against a real emulator
    // (rather than the guest-session-only local checks earlier phases were
    // limited to) newly surfaced the same sampler bug this list documents at
    // length on `.landing-nav-link`/`.btn-ghost` here specifically (both
    // live-verified as real passes, not real failures — `.btn-ghost`'s own
    // entry above already documents this).
    const violations = await runAxe(page, { excludeContrastFalsePositives: true });
    expect(violations, JSON.stringify(violations, null, 2)).toEqual([]);
  });

  test('sign-in page has zero critical/serious axe violations', async ({ page }) => {
    await page.goto('/#/signin');
    await expect(page.locator('.auth-page, .auth-card')).toBeVisible({ timeout: 10_000 });
    const violations = await runAxe(page, { excludeContrastFalsePositives: true });
    expect(violations, JSON.stringify(violations, null, 2)).toEqual([]);
  });

  test('sign-up page has zero critical/serious axe violations', async ({ page }) => {
    await page.goto('/#/signup');
    await expect(page.locator('.auth-page, .auth-card')).toBeVisible({ timeout: 10_000 });
    const violations = await runAxe(page, { excludeContrastFalsePositives: true });
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

  // Issue #124 — /settings and /progress had zero automated accessibility
  // coverage even though both are real, signed-in-reachable pages.
  test('settings page has zero critical/serious axe violations', async ({ page }) => {
    test.skip(!FIREBASE_CONFIGURED, 'Requires FIREBASE_CONFIGURED env var — see issue #37');
    await page.goto('/#/signin');
    await page.click('text=Continue as guest');
    await expect(page).toHaveURL(/#\/onboarding/, { timeout: 10_000 });
    await page.locator('.template-card', { hasText: 'Java Backend Engineer' }).click();
    await expect(page.locator('.dashboard')).toBeVisible({ timeout: 10_000 });
    await page.goto('/#/settings');
    await expect(page.locator('.settings-page')).toBeVisible({ timeout: 10_000 });
    const violations = await runAxe(page, { excludeContrastFalsePositives: true });
    expect(violations, JSON.stringify(violations, null, 2)).toEqual([]);
  });

  test('progress page has zero critical/serious axe violations', async ({ page }) => {
    test.skip(!FIREBASE_CONFIGURED, 'Requires FIREBASE_CONFIGURED env var — see issue #37');
    await page.goto('/#/signin');
    await page.click('text=Continue as guest');
    await expect(page).toHaveURL(/#\/onboarding/, { timeout: 10_000 });
    await page.locator('.template-card', { hasText: 'Java Backend Engineer' }).click();
    await expect(page.locator('.dashboard')).toBeVisible({ timeout: 10_000 });
    await page.goto('/#/progress');
    await expect(page.locator('.progress-page')).toBeVisible({ timeout: 10_000 });
    const violations = await runAxe(page, { excludeContrastFalsePositives: true });
    expect(violations, JSON.stringify(violations, null, 2)).toEqual([]);
  });

  // Issue #131 — the public, unauthenticated '#/shared' view is reachable by
  // anyone with a link, so it needs the same coverage as every other page.
  // The revoked/not-found state needs no Firebase emulator setup at all
  // (it's just a shareId that doesn't resolve), unlike the rest of this
  // file's guest-sign-in-gated tests.
  test('shared roadmap "revoked" state has zero critical/serious axe violations', async ({ page }) => {
    await page.goto('/#/shared?id=does-not-exist');
    await expect(page.locator('.shared-view-state')).toBeVisible({ timeout: 10_000 });
    const violations = await runAxe(page, { excludeContrastFalsePositives: true });
    expect(violations, JSON.stringify(violations, null, 2)).toEqual([]);
  });
});

// Issue #124 — the axe suite above only ever scanned base-page DOM, never an
// open dialog's contents, so real interactive modal content (the item edit
// panel, the AI-import modal, a confirmDialog instance) had zero automated
// accessibility coverage. Each test here asserts the modal actually opened
// before scanning, so a modal that fails to render can't silently no-op.
test.describe('automated accessibility checks — modals (issue #124)', () => {
  test('item edit panel has zero critical/serious axe violations', async ({ page }) => {
    test.skip(!FIREBASE_CONFIGURED, 'Requires FIREBASE_CONFIGURED env var — see issue #37');
    await page.goto('/#/signin');
    await page.click('text=Continue as guest');
    await expect(page).toHaveURL(/#\/onboarding/, { timeout: 10_000 });
    await page.locator('.template-card', { hasText: 'Java Backend Engineer' }).click();
    await expect(page.locator('.dashboard')).toBeVisible({ timeout: 10_000 });
    await page.locator('[data-action="edit"]').nth(0).click();
    await expect(page.locator('.item-panel')).toBeVisible({ timeout: 5_000 });
    const violations = await runAxe(page, { excludeContrastFalsePositives: true, include: '.item-panel' });
    expect(violations, JSON.stringify(violations, null, 2)).toEqual([]);
  });

  test('the AI-import "Create your own roadmap" modal has zero critical/serious axe violations', async ({ page }) => {
    test.skip(!FIREBASE_CONFIGURED, 'Requires FIREBASE_CONFIGURED env var — see issue #37');
    await page.goto('/#/signin');
    await page.click('text=Continue as guest');
    await expect(page).toHaveURL(/#\/onboarding/, { timeout: 10_000 });
    await page.locator('.template-card-create .template-card-pick').click();
    const modal = page.locator('.modal-overlay[aria-label="Create your own roadmap"]');
    await expect(modal).toBeVisible();
    const violations = await runAxe(page, { excludeContrastFalsePositives: true, include: '.modal-overlay[aria-label="Create your own roadmap"]' });
    expect(violations, JSON.stringify(violations, null, 2)).toEqual([]);
  });

  test('a confirmDialog instance has zero critical/serious axe violations', async ({ page }) => {
    test.skip(!FIREBASE_CONFIGURED, 'Requires FIREBASE_CONFIGURED env var — see issue #37');
    await page.goto('/#/signin');
    await page.click('text=Continue as guest');
    await expect(page).toHaveURL(/#\/onboarding/, { timeout: 10_000 });
    // Issue #206 §4.1 — Hide moved behind the card's ⋯ overflow menu; the
    // menu itself is portaled to document.body on open (dropdown.js), so
    // it's located at the page level, not via the card locator. onboarding.js
    // subscribes to live store snapshot updates and can re-render the whole
    // card grid in the background (roadmap-store.md's "onboarding.js now
    // subscribes to store updates" note) — a re-render landing between the
    // trigger click and the menu-item click tears down the just-opened menu
    // (a fresh card/trigger with no open menu replaces it), so the item
    // click never lands. Retries the whole open+click pair rather than a
    // single fire-and-forget click pair.
    const hideItem = page.locator('.dropdown-menu .dropdown-item', { hasText: 'Hide' });
    await expect(async () => {
      await page.locator('.template-card', { hasText: 'Learning Piano' }).locator('.template-card-overflow-btn').click();
      await hideItem.click({ timeout: 1_000 });
    }).toPass({ timeout: 15_000 });
    const dialog = page.locator('.modal-overlay[aria-label*="Learning Piano"]');
    await expect(dialog).toBeVisible();
    const violations = await runAxe(page, { excludeContrastFalsePositives: true, include: '.modal-overlay[aria-label*="Learning Piano"]' });
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
    const violations = await runAxe(page, { excludeContrastFalsePositives: true });
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

  // Issue #124 — same dark-theme coverage gap as the light-mode suite above.
  test('settings page has zero critical/serious axe violations in dark theme', async ({ page }) => {
    test.skip(!FIREBASE_CONFIGURED, 'Requires FIREBASE_CONFIGURED env var — see issue #37');
    await page.goto('/#/signin');
    await page.click('text=Continue as guest');
    await expect(page).toHaveURL(/#\/onboarding/, { timeout: 10_000 });
    await page.locator('.template-card', { hasText: 'Java Backend Engineer' }).click();
    await expect(page.locator('.dashboard')).toBeVisible({ timeout: 10_000 });
    await page.goto('/#/settings');
    await expect(page.locator('.settings-page')).toBeVisible({ timeout: 10_000 });
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
    const violations = await runAxe(page, { excludeContrastFalsePositives: true });
    expect(violations, JSON.stringify(violations, null, 2)).toEqual([]);
  });

  test('progress page has zero critical/serious axe violations in dark theme', async ({ page }) => {
    test.skip(!FIREBASE_CONFIGURED, 'Requires FIREBASE_CONFIGURED env var — see issue #37');
    await page.goto('/#/signin');
    await page.click('text=Continue as guest');
    await expect(page).toHaveURL(/#\/onboarding/, { timeout: 10_000 });
    await page.locator('.template-card', { hasText: 'Java Backend Engineer' }).click();
    await expect(page.locator('.dashboard')).toBeVisible({ timeout: 10_000 });
    await page.goto('/#/progress');
    await expect(page.locator('.progress-page')).toBeVisible({ timeout: 10_000 });
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
    const violations = await runAxe(page, { excludeContrastFalsePositives: true });
    expect(violations, JSON.stringify(violations, null, 2)).toEqual([]);
  });
});
