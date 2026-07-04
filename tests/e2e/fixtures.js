import { test as base, expect } from '@playwright/test';

// Extend the base `page` fixture to inject the Firebase emulator flag before
// page scripts run. Only active when FIREBASE_CONFIGURED=true (set in CI when
// the FIREBASE_CONFIG_TEST secret is present).
export const test = base.extend({
  page: async ({ page }, use) => {
    if (process.env.FIREBASE_CONFIGURED) {
      await page.addInitScript(() => {
        window.__USE_FIREBASE_EMULATOR__ = true;
      });
    }
    await use(page);
  },
});

export { expect };
