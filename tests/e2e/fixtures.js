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

export { expect };
