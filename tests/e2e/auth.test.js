import { test, expect } from '@playwright/test';

test('page loads and shows sign-in screen', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('.brand-name')).toBeVisible();
  await expect(page.locator('.brand-name')).toContainText('SwitchPrep');
});

test('theme toggle is visible on sign-in screen', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('button[aria-label*="mode"]')).toBeVisible();
});

test('guest session starts and dashboard loads', async ({ page }) => {
  await page.goto('/');
  await page.click('text=Continue as guest');
  await expect(page.locator('.dashboard')).toBeVisible({ timeout: 10_000 });
  await expect(page.locator('.brand-name')).toContainText('SwitchPrep');
});

test('Add resource button works without ReferenceError', async ({ page }) => {
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));

  await page.goto('/');
  await page.click('text=Continue as guest');
  await expect(page.locator('.dashboard')).toBeVisible({ timeout: 10_000 });

  await page.click('.phase-head >> nth=0');
  await page.click('text=Edit >> nth=0');
  await page.fill('input[placeholder="Resource label"]', 'Test resource');
  await page.fill('input[type="url"]', 'https://spring.io');
  await page.click('text=Add resource');
  await expect(page.locator('.resource-row')).toHaveCount(1);

  expect(errors.filter(e => e.includes('ReferenceError'))).toHaveLength(0);
});
