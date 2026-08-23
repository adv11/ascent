import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './tests/e2e',
  timeout: 30_000,
  retries: process.env.CI ? 2 : 0,
  // CI runs every FIREBASE_CONFIGURED spec against a single shared Firebase
  // Auth/Database emulator instance (ci.yml starts exactly one) — Playwright's
  // default worker count (~half the runner's CPUs, 2 on GitHub's standard
  // ubuntu-latest runner) lets two specs hit that one emulator concurrently.
  // Found chasing a recurring, non-deterministic CI failure (issue #551 PR
  // review): a *different* reload-dependent test each run (itemNotes,
  // reviewTagGrouping, onboarding, featureTour) would time out waiting for
  // `.dashboard` after `page.reload()`, instead landing back on the sign-in
  // screen — i.e. the anonymous session hadn't rehydrated from the emulator
  // in time. Serializing E2E workers in CI removes the contention at the
  // root instead of padding reload timeouts higher (which would just raise
  // the threshold without fixing the underlying race). Local runs (no CI env)
  // keep Playwright's normal parallel default — only CI shares one emulator.
  workers: process.env.CI ? 1 : undefined,
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
  expect: {
    timeout: 20_000,
  },
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
