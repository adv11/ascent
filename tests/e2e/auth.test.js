import { test, expect } from './fixtures.js';

// Tests that require real Firebase credentials are skipped until FIREBASE_CONFIGURED=true.
// The fixtures.js page extension injects window.__USE_FIREBASE_EMULATOR__ so the app
// SDK connects to the local emulator instead of production Firebase.
const FIREBASE_CONFIGURED = !!process.env.FIREBASE_CONFIGURED;

test('page loads and shows sign-in screen', async ({ page }) => {
  await page.goto('/#/signin');
  // issue #6 Phase 5 added a second, decorative "Ascent" wordmark inside the
  // aria-hidden marketing panel (.auth-marketing) — `.brand-name` alone now
  // matches two elements. getByRole('link', ...) resolves to just the real,
  // navigable brand link since aria-hidden content is excluded from the
  // accessibility tree.
  const brandLink = page.getByRole('link', { name: 'Ascent' });
  await expect(brandLink).toBeVisible({ timeout: 10_000 });
  await expect(brandLink).toContainText('Ascent');
});

test('theme toggle is visible on sign-in screen', async ({ page }) => {
  await page.goto('/#/signin');
  await expect(page.locator('button[aria-label*="mode"]')).toBeVisible({ timeout: 10_000 });
});

test('guest session starts, lands on the onboarding picker, and reaches the dashboard after picking a template', async ({ page }) => {
  test.skip(!FIREBASE_CONFIGURED, 'Requires FIREBASE_CONFIGURED env var — see issue #37');
  await page.goto('/#/signin');
  await page.click('text=Continue as guest');
  await expect(page).toHaveURL(/#\/onboarding/, { timeout: 10_000 });
  await page.locator('.template-card', { hasText: 'Java Backend Engineer' }).click();
  await expect(page.locator('.dashboard')).toBeVisible({ timeout: 10_000 });
  await expect(page.locator('.brand-name')).toContainText('Ascent');
});

test('"Forgot password?" link is visible on sign-in screen', async ({ page }) => {
  await page.goto('/#/signin');
  await expect(page.locator('.forgot-link')).toBeVisible({ timeout: 10_000 });
  await expect(page.locator('.forgot-link')).toContainText('Forgot password?');
});

test('"Forgot password?" opens reset view with correct title', async ({ page }) => {
  await page.goto('/#/signin');
  await page.click('.forgot-link');
  await expect(page.locator('.auth-title')).toContainText('Reset your password', { timeout: 5_000 });
  await expect(page.locator('[type="submit"]')).toContainText('Send reset link');
});

test('"Back to sign in" from reset view restores sign-in form', async ({ page }) => {
  await page.goto('/#/signin');
  await page.fill('input[type="email"]', 'back@example.com');
  await page.click('.forgot-link');
  await expect(page.locator('.auth-title')).toContainText('Reset your password', { timeout: 5_000 });
  await page.click('text=← Back to sign in');
  await expect(page.locator('.auth-title')).toContainText('Welcome back', { timeout: 5_000 });
  await expect(page.locator('input[type="email"]')).toHaveValue('back@example.com');
});

test('reset view shows validation error on empty submit', async ({ page }) => {
  await page.goto('/#/signin');
  await page.click('.forgot-link');
  await expect(page.locator('.auth-title')).toContainText('Reset your password', { timeout: 5_000 });
  await page.locator('input[type="email"]').fill('');
  await page.locator('[type="submit"]').click();
  await expect(page.locator('.form-message.error')).toContainText('Enter your email address.');
});

test('reset flow shows success state with emulator', async ({ page }) => {
  test.skip(!FIREBASE_CONFIGURED, 'Requires FIREBASE_CONFIGURED env var — see issue #37');
  await page.goto('/#/signin');
  await page.click('.forgot-link');
  await expect(page.locator('.auth-title')).toContainText('Reset your password', { timeout: 5_000 });
  await page.fill('input[type="email"]', 'nobody@example.com');
  await page.click('[type="submit"]');
  await expect(page.locator('.auth-title')).toContainText('Check your inbox', { timeout: 5_000 });
  await expect(page.locator('.reset-success-msg')).toBeVisible();
});

test('Add resource button works without ReferenceError', async ({ page }) => {
  test.skip(!FIREBASE_CONFIGURED, 'Requires FIREBASE_CONFIGURED env var — see issue #37');
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));

  await page.goto('/#/signin');
  await page.click('text=Continue as guest');
  await expect(page).toHaveURL(/#\/onboarding/, { timeout: 10_000 });
  await page.locator('.template-card', { hasText: 'Java Backend Engineer' }).click();
  await expect(page.locator('.dashboard')).toBeVisible({ timeout: 10_000 });

  await page.locator('[data-action="edit"]').nth(0).click();
  await expect(page.locator('.item-panel')).toBeVisible({ timeout: 5_000 });
  const initialCount = await page.locator('.item-panel .resource-row').count();
  await page.fill('input[placeholder*="Resource label"]', 'Test resource');
  await page.fill('input[type="url"]', 'https://spring.io');
  await page.click('text=Add resource');
  await expect(page.locator('.item-panel .resource-row')).toHaveCount(initialCount + 1);

  expect(errors.filter(e => e.includes('ReferenceError'))).toHaveLength(0);
});

// Issue #26 — auth form UX improvements

test('sign-up page shows Create a password and Confirm password fields', async ({ page }) => {
  await page.goto('/#/signup');
  await expect(page.locator('.auth-title')).toContainText('Create your account', { timeout: 10_000 });
  const pwdInputs = page.locator('input[type="password"]');
  await expect(pwdInputs).toHaveCount(2);
});

test('sign-up page has strength meter', async ({ page }) => {
  await page.goto('/#/signup');
  await expect(page.locator('.auth-title')).toContainText('Create your account', { timeout: 10_000 });
  await expect(page.locator('.strength-meter')).toBeVisible();
  await expect(page.locator('.strength-segment')).toHaveCount(4);
});

test('sign-up confirm mismatch shows error and does not navigate', async ({ page }) => {
  await page.goto('/#/signup');
  await expect(page.locator('.auth-title')).toContainText('Create your account', { timeout: 10_000 });
  await page.locator('input[type="email"]').fill('test@example.com');
  await page.locator('input[type="password"]').first().fill('Password1!');
  await page.locator('input[type="password"]').last().fill('Mismatch1!');
  await page.locator('[type="submit"]').click();
  await expect(page.locator('.field-error')).toContainText('do not match');
  await expect(page.locator('.auth-title')).toContainText('Create your account');
});

test('show/hide toggle on sign-in password field changes input type', async ({ page }) => {
  await page.goto('/#/signin');
  await expect(page.locator('.auth-title')).toContainText('Welcome back', { timeout: 10_000 });
  const pwdInput = page.locator('input[type="password"]').first();
  await expect(pwdInput).toHaveAttribute('type', 'password');
  await page.locator('.password-toggle').first().click();
  await expect(page.locator('input[type="text"]').first()).toBeVisible();
  await page.locator('.password-toggle').first().click();
  await expect(pwdInput).toHaveAttribute('type', 'password');
});

test('sign-up page has Continue as guest button', async ({ page }) => {
  await page.goto('/#/signup');
  await expect(page.locator('.auth-title')).toContainText('Create your account', { timeout: 10_000 });
  await expect(page.locator('.auth-divider')).toBeVisible();
  await expect(page.locator('.btn.btn-secondary.btn-block')).toContainText('Continue as guest');
});

test('sign-up page Continue as guest navigates to the onboarding picker, then the dashboard', async ({ page }) => {
  test.skip(!FIREBASE_CONFIGURED, 'Requires FIREBASE_CONFIGURED env var — see issue #37');
  await page.goto('/#/signup');
  await page.click('text=Continue as guest');
  await expect(page).toHaveURL(/#\/onboarding/, { timeout: 10_000 });
  // .first() would now hit the "Create your own roadmap" card (issue #4,
  // always first in the grid) instead of a template — pick an actual template.
  await page.locator('.template-card', { hasText: 'Java Backend Engineer' }).click();
  await expect(page.locator('.dashboard')).toBeVisible({ timeout: 10_000 });
});
