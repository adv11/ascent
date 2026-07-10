import { test, expect } from './fixtures.js';

test('title is Ascent', async ({ page }) => {
  await page.goto('/#/signin');
  await expect(page).toHaveTitle('Ascent');
});

test('manifest.json is reachable and describes Ascent', async ({ page }) => {
  const response = await page.request.get('/public/manifest.json');
  expect(response.ok()).toBe(true);
  const manifest = await response.json();
  expect(manifest.name).toBe('Ascent');
  expect(manifest.icons.length).toBeGreaterThan(0);
});

test('existing user with the pre-rename theme key migrates with no data loss', async ({ page }) => {
  await page.addInitScript(() => {
    window.localStorage.setItem('switchprep-theme', 'dark');
  });
  await page.goto('/#/signin');

  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  await expect
    .poll(() => page.evaluate(() => window.localStorage.getItem('ascent-theme')))
    .toBe('dark');
  await expect
    .poll(() => page.evaluate(() => window.localStorage.getItem('switchprep-theme')))
    .toBeNull();
});
