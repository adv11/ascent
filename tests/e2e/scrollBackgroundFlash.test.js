import { test, expect } from './fixtures.js';

// Issue #455 — real, reported production bug (3 screenshots, dark theme,
// desktop): scrolling a long, expanded roadmap visibly flashed the dark
// page background toward grey, and the same flattened surfaces read as
// "content getting cut" against the surrounding near-black page. Root
// cause, confirmed via git history: `.phase-card.open` and the
// `[data-scrolling]` scroll-perf fallback (`app.css`, `src/services/
// scrollPerfMode.js`) dropped `backdrop-filter` in favor of a flat
// `--color-surface-raised` fill — a workaround issue #435 shipped for a
// real hue mismatch in `--v3-surface` at the time. Issue #440 later retuned
// `--v3-surface`/`--v3-bg`/`--v3-surface-elevated` to the exact HSL
// equivalent of the real `--color-bg`/`--color-surface` hex values, which
// fixed the hue mismatch #435 was working around — but #435's now-stale
// `--color-surface-raised` substitution was never reverted, and
// `--color-surface-raised` is genuinely lighter than the page background in
// both themes. With a dozen-plus glass surfaces (phase-cards, tag-chips)
// simultaneously visible while scrolling a fully-expanded roadmap, that
// mismatch reads as the whole page flashing grey. This spec asserts the
// resolved background of every `.phase-card`/`.card`/`.template-card`/
// `.tag-chip` surface stays close to `--color-bg`'s own brightness — both
// while a phase-card is simply open (no scrolling) and while
// `[data-scrolling]` is actively engaged — following this repo's own
// "scripted before/after repro, pixel/color-sampled against the page's own
// background" methodology (see issue #433/#450's own tests and
// `.claude/rules/ui-styling.md`'s entries for them). Fails against the
// pre-fix `--color-surface-raised` value (verified by reverting the
// `app.css` change locally and re-running).
const FIREBASE_CONFIGURED = !!process.env.FIREBASE_CONFIGURED;

// WCAG relative luminance — same formula this repo's own contrast-ratio
// verification comments (`app.css`, `.claude/rules/ui-styling.md`) already
// use, reimplemented here since axe/contrast helpers aren't wired into this
// spec and the check only needs a single value, not a full ratio.
function relLuminance([r, g, b]) {
  const f = (c) => { c /= 255; return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4; };
  return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
}

test.describe('scroll background must stay dark, not flash grey (issue #455)', () => {
  test('open phase-cards and scroll-perf-mode surfaces stay close to --color-bg brightness in dark theme', async ({ page }) => {
    test.skip(!FIREBASE_CONFIGURED, 'Requires FIREBASE_CONFIGURED env var — see issue #37');

    await page.addInitScript(() => { window.localStorage.setItem('ascent-theme', 'dark'); });
    await page.goto('/#/signin');
    await page.click('text=Continue as guest');
    await expect(page).toHaveURL(/#\/onboarding/, { timeout: 10_000 });
    await page.locator('.template-card', { hasText: 'Java Backend Engineer' }).click();
    await expect(page.locator('.dashboard')).toBeVisible({ timeout: 10_000 });
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');

    // Open a large phase (>40 items — the FLIP-animation-skip threshold,
    // dashboard.js's LARGE_PHASE_ITEM_THRESHOLD) so scrolling through it
    // exercises row virtualization and multiple simultaneously-open
    // sections, the same repro shape #433/#450 used.
    const target = page.locator('.phase-card', { hasText: 'Spring and Spring Boot' }).first();
    await target.locator('.phase-head').click();
    await expect(target).toHaveClass(/open/);

    const bgLum = await page.evaluate(() => {
      const hex = getComputedStyle(document.documentElement).getPropertyValue('--color-bg').trim();
      const rgb = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
      const f = (c) => { c /= 255; return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4; };
      return 0.2126 * f(rgb[0]) + 0.7152 * f(rgb[1]) + 0.0722 * f(rgb[2]);
    });

    // A realistic, sustained mouse-wheel-paced scroll (not a synthetic
    // instant jump) through the open phase, sampling every visible glass
    // surface's resolved background on every tick.
    const violations = [];
    for (let i = 0; i < 12; i++) {
      await page.mouse.wheel(0, 260);
      await page.waitForTimeout(20);

      const samples = await page.evaluate(() => {
        const scrolling = document.documentElement.hasAttribute('data-scrolling');
        const out = [];
        document.querySelectorAll('.phase-card.open, .card, .template-card, .tag-chip').forEach((el) => {
          const rect = el.getBoundingClientRect();
          if (rect.bottom < 0 || rect.top > window.innerHeight) return;
          const bg = getComputedStyle(el).backgroundColor;
          const m = bg.match(/rgba?\(([\d.]+),\s*([\d.]+),\s*([\d.]+)/);
          if (!m) return;
          out.push({ scrolling, className: el.className.split(' ')[0], rgb: [+m[1], +m[2], +m[3]] });
        });
        return out;
      });

      for (const s of samples) {
        const lum = relLuminance(s.rgb);
        // --color-surface-raised (the pre-fix regression) is roughly 2-2.5x
        // brighter than --color-bg in dark theme (#252221 vs #141312) — a
        // 1.6x tolerance comfortably passes the fixed hsl(var(--v3-surface))
        // fill (near-identical to --color-bg) while still catching a
        // regression back to --color-surface-raised.
        if (lum > bgLum * 1.6 + 0.005) {
          violations.push({ tick: i, ...s, lum, bgLum });
        }
      }
    }

    expect(violations, JSON.stringify(violations, null, 2)).toEqual([]);
  });

  test('.phase-card.open stays close to --color-bg brightness even with no active scroll', async ({ page }) => {
    test.skip(!FIREBASE_CONFIGURED, 'Requires FIREBASE_CONFIGURED env var — see issue #37');

    await page.addInitScript(() => { window.localStorage.setItem('ascent-theme', 'dark'); });
    await page.goto('/#/signin');
    await page.click('text=Continue as guest');
    await expect(page).toHaveURL(/#\/onboarding/, { timeout: 10_000 });
    await page.locator('.template-card', { hasText: 'Java Backend Engineer' }).click();
    await expect(page.locator('.dashboard')).toBeVisible({ timeout: 10_000 });

    const firstCard = page.locator('.phase-card').first();
    const alreadyOpen = await firstCard.evaluate((el) => el.classList.contains('open'));
    if (!alreadyOpen) await firstCard.locator('.phase-head').click();
    await expect(firstCard).toHaveClass(/open/);

    const { lum, bgLum } = await page.evaluate((cardEl) => {
      const bg = getComputedStyle(cardEl).backgroundColor;
      const m = bg.match(/rgba?\(([\d.]+),\s*([\d.]+),\s*([\d.]+)/);
      const rgb = [+m[1], +m[2], +m[3]];
      const f = (c) => { c /= 255; return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4; };
      const lumOf = (col) => 0.2126 * f(col[0]) + 0.7152 * f(col[1]) + 0.0722 * f(col[2]);
      const hex = getComputedStyle(document.documentElement).getPropertyValue('--color-bg').trim();
      const bgRgb = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
      return { lum: lumOf(rgb), bgLum: lumOf(bgRgb) };
    }, await firstCard.elementHandle());

    expect(lum).toBeLessThan(bgLum * 1.6 + 0.005);
  });
});
