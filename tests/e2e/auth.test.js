import { test, expect } from './fixtures.js';

// Tests that require real Firebase credentials are skipped until FIREBASE_CONFIGURED=true.
// The fixtures.js page extension injects window.__USE_FIREBASE_EMULATOR__ so the app
// SDK connects to the local emulator instead of production Firebase.
const FIREBASE_CONFIGURED = !!process.env.FIREBASE_CONFIGURED;

test('page loads and shows sign-in screen', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('.brand-name')).toBeVisible({ timeout: 10_000 });
  await expect(page.locator('.brand-name')).toContainText('SwitchPrep');
});

test('theme toggle is visible on sign-in screen', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('button[aria-label*="mode"]')).toBeVisible({ timeout: 10_000 });
});

test('guest session starts and dashboard loads', async ({ page }) => {
  test.skip(!FIREBASE_CONFIGURED, 'Requires FIREBASE_CONFIGURED env var — see issue #37');
  await page.goto('/');
  await page.click('text=Continue as guest');
  await expect(page.locator('.dashboard')).toBeVisible({ timeout: 10_000 });
  await expect(page.locator('.brand-name')).toContainText('SwitchPrep');
});

test('Add resource button works without ReferenceError', async ({ page }) => {
  test.skip(!FIREBASE_CONFIGURED, 'Requires FIREBASE_CONFIGURED env var — see issue #37');
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));

  await page.goto('/');
  await page.click('text=Continue as guest');
  await expect(page.locator('.dashboard')).toBeVisible({ timeout: 10_000 });

  await page.locator('.phase-head').nth(0).click();
  await page.locator('text=Edit').nth(0).click();
  await page.fill('input[placeholder="Resource label"]', 'Test resource');
  await page.fill('input[type="url"]', 'https://spring.io');
  await page.click('text=Add resource');
  await expect(page.locator('.resource-row')).toHaveCount(1);

  expect(errors.filter(e => e.includes('ReferenceError'))).toHaveLength(0);
});
