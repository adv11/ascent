import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './tests/e2e',
  timeout: 30_000,
  retries: process.env.CI ? 2 : 0,
  // No reporter was previously configured, which silently defaults to the
  // terminal `list` reporter only — `playwright-report/` (the HTML report,
  // which embeds screenshots/videos/traces for a failed run) was never
  // actually generated, so ci.yml's "Upload Playwright report on failure"
  // step had nothing to upload and no failure evidence ever reached CI
  // artifacts (found investigating issue #294's flaky-test report — there
  // was no way to see what a failed run actually looked like). `open: 'never'`
  // keeps this from trying to launch a browser locally after `npm run
  // test:e2e`.
  reporter: [['html', { open: 'never' }], ['list']],
  use: {
    baseURL: 'http://localhost:4173',
    headless: true,
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
    trace: 'retain-on-failure',
  },
  webServer: {
    command: 'npx serve . -p 4173 -s',
    port: 4173,
    reuseExistingServer: !process.env.CI,
  },
  projects: [
    { name: 'chromium', use: { browserName: 'chromium' } },
  ],
});
