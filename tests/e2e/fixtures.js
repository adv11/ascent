import { test as base, expect } from '@playwright/test';

// Extend the base `page` fixture to inject the Firebase emulator flag before
// page scripts run. Only active when FIREBASE_CONFIGURED=true (set in CI when
// the FIREBASE_CONFIG_TEST secret is present).
//
// Also auto-dismisses issue #17's first-time feature tour, which auto-starts
// the moment a fresh guest finishes onboarding and swallows every click via
// its full-page `.tour-scrim` (z-index 1100+) until dismissed. Every test
// suite that reaches the dashboard for the first time as a fresh guest hit
// this — not just the ones that happened to interact with dashboard controls
// immediately — so this is handled once, centrally, instead of duplicated
// per call site (see customRoadmap.test.js's older inline version of the
// same skip, now redundant but left as-is since it's harmless). Tests that
// need to exercise the tour itself (featureTour.test.js) opt out via
// `test.use({ skipTourAutoDismiss: true })`.
export const test = base.extend({
  skipTourAutoDismiss: [false, { option: true }],
  page: async ({ page, skipTourAutoDismiss }, use) => {
    if (process.env.FIREBASE_CONFIGURED) {
      await page.addInitScript(() => {
        window.__USE_FIREBASE_EMULATOR__ = true;
      });
    }
    if (!skipTourAutoDismiss) {
      await page.addInitScript(() => {
        const dismissIfPresent = () => {
          const skipBtn = document.querySelector('.tour-welcome-card [data-action="skip"]');
          if (skipBtn) skipBtn.click();
        };
        document.addEventListener('DOMContentLoaded', () => {
          new MutationObserver(dismissIfPresent).observe(document.body, { childList: true, subtree: true });
          dismissIfPresent();
        });
      });
    }
    await use(page);
  },
});

// Issue #486 (B1) — every checklist row's secondary actions (Open, Add to
// today, Mark reviewed, Add a link, Delete) live behind a single ⋮ overflow
// menu now, rather than a direct always-present button. Opening it is a
// two-step interaction (click the trigger, then click the menu item) instead
// of the old single click — under CI's parallel-worker load, a re-render
// landing between those two Playwright actions (e.g. the dashboard's initial
// Firebase-listener-attach render, right after a `page.reload()`) can swap
// the trigger's DOM node out from under an in-flight click, silently
// no-opping it and leaving the menu never opened. `expect(...).toPass()` (the
// same retry pattern `customRoadmap.test.js`'s own overflow-menu delete flow
// already uses) re-attempts the whole open sequence from scratch whenever
// that happens, rather than a single wrapped `.toPass()` around Playwright's
// own already-generous per-action timeout, so a re-render mid-sequence just
// costs one more attempt instead of failing the test outright.
export async function openRowOverflowMenu(row, actionText) {
  await expect(async () => {
    await row.locator('.check-item-overflow-btn').click();
    await row.page().locator('.dropdown-menu .dropdown-item').filter({ hasText: actionText }).click({ timeout: 1_000 });
  }).toPass({ timeout: 15_000 });
}

// Convenience wrapper for the common "open the first row's edit panel" case
// every spec that reaches into a topic's fields needs.
export async function openFirstItemPanel(page) {
  await openRowOverflowMenu(page.locator('.check-item').first(), 'Open');
  await expect(page.locator('.item-panel')).toBeVisible({ timeout: 5_000 });
}

export { expect };
