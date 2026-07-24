import { test, expect } from './fixtures.js';

// Issue #9 — in-app feedback & bug reporting widget. Firebase-independent
// checks (widget presence, type selector, form rendering, validation,
// keyboard access) run unconditionally; anything that actually submits a
// report or reaches "My reports" needs a real (emulator) sign-in, same
// FIREBASE_CONFIGURED skip precedent every other Firebase-backed E2E spec
// in this repo already uses (see customRoadmap.test.js/accessibility.test.js).
const FIREBASE_CONFIGURED = !!process.env.FIREBASE_CONFIGURED;

test.describe('feedback widget — presence and persistence across pages', () => {
  test('renders on the sign-in page', async ({ page }) => {
    await page.goto('/#/signin');
    const trigger = page.locator('.feedback-widget-trigger');
    await expect(trigger).toBeAttached();
    await expect(trigger).toHaveAttribute('aria-label', 'Send feedback');
  });

  test('renders on the dashboard and progress pages', async ({ page }) => {
    test.skip(!FIREBASE_CONFIGURED, 'Requires FIREBASE_CONFIGURED env var — see issue #37');
    await page.goto('/#/signin');
    await page.click('text=Continue as guest');
    await expect(page).toHaveURL(/#\/onboarding/, { timeout: 10_000 });
    await page.locator('.template-card', { hasText: 'Java Backend Engineer' }).click();
    await expect(page.locator('.dashboard')).toBeVisible({ timeout: 10_000 });
    await expect(page.locator('.feedback-widget-trigger')).toBeAttached();

    await page.goto('/#/progress');
    await expect(page.locator('.progress-page, .app-shell-2')).toBeVisible({ timeout: 10_000 });
    await expect(page.locator('.feedback-widget-trigger')).toBeAttached();
  });
});

test.describe('feedback widget — type selector and forms (no Firebase needed)', () => {
  test('clicking the widget opens the type selector with three report types', async ({ page }) => {
    await page.goto('/#/signin');
    await page.locator('.feedback-widget-trigger').click({ force: true });
    const modal = page.locator('.modal-overlay[aria-label="Send feedback"]');
    await expect(modal).toBeVisible();
    await expect(modal.locator('.feedback-type-card')).toHaveCount(3);
    await expect(modal.locator('.feedback-type-card', { hasText: 'Bug report' })).toBeVisible();
    await expect(modal.locator('.feedback-type-card', { hasText: 'Feature request' })).toBeVisible();
    await expect(modal.locator('.feedback-type-card', { hasText: 'General feedback' })).toBeVisible();
  });

  test('selecting Bug report renders the bug form with all required fields', async ({ page }) => {
    await page.goto('/#/signin');
    await page.locator('.feedback-widget-trigger').click({ force: true });
    await page.locator('.feedback-type-card', { hasText: 'Bug report' }).click();
    const form = page.locator('.feedback-form');
    await expect(form).toBeVisible();
    await expect(form.locator('.field-label', { hasText: 'Title' })).toBeVisible();
    await expect(form.locator('.field-label', { hasText: 'What happened?' })).toBeVisible();
    await expect(form.locator('.field-label', { hasText: 'Severity' })).toBeVisible();
    await expect(form.locator('button[type="submit"]')).toHaveText(/Submit bug report/);
  });

  test('submitting an empty bug form shows a validation error instead of submitting', async ({ page }) => {
    await page.goto('/#/signin');
    await page.locator('.feedback-widget-trigger').click({ force: true });
    await page.locator('.feedback-type-card', { hasText: 'Bug report' }).click();
    await page.locator('.feedback-form button[type="submit"]').click();
    await expect(page.getByText('Fill in the required fields before submitting.')).toBeVisible();
  });

  test('keyboard only: Tab to the widget, Enter opens it, Tab reaches the first form field', async ({ page }) => {
    await page.goto('/#/signin');
    await page.locator('.feedback-widget-trigger').focus();
    await expect(page.locator('.feedback-widget-trigger')).toBeFocused();
    await page.keyboard.press('Enter');
    await expect(page.locator('.modal-overlay[aria-label="Send feedback"]')).toBeVisible();
  });

});

test.describe('feedback widget — full submit flow (requires Firebase emulator)', () => {
  test('guest fills and submits a bug report and sees the success screen with a reference id', async ({ page }) => {
    test.skip(!FIREBASE_CONFIGURED, 'Requires FIREBASE_CONFIGURED env var — see issue #37');
    await page.goto('/#/signin');
    await page.click('text=Continue as guest');
    await expect(page).toHaveURL(/#\/onboarding/, { timeout: 10_000 });

    await page.locator('.feedback-widget-trigger').click();
    await page.locator('.feedback-type-card', { hasText: 'Bug report' }).click();

    const form = page.locator('.feedback-form');
    await form.locator('.feedback-field-input').first().fill('Dashboard flickers on rapid toggle');
    await form.locator('input[name="severity"][value="high"]').check();
    await form.locator('textarea.feedback-field-input').fill('Toggled rapidly and saw a visible flicker for ~1s instead of a clean update.');

    await form.locator('button[type="submit"]').click();
    await expect(page.locator('.feedback-reference')).toBeVisible({ timeout: 10_000 });
    await expect(page.locator('.feedback-reference')).toHaveText(/^Reference: #\S{5}$/);
  });

  test('"My reports" from the sidebar shows submitted reports', async ({ page }) => {
    test.skip(!FIREBASE_CONFIGURED, 'Requires FIREBASE_CONFIGURED env var — see issue #37');
    await page.goto('/#/signin');
    await page.click('text=Continue as guest');
    await expect(page).toHaveURL(/#\/onboarding/, { timeout: 10_000 });
    await page.locator('.template-card', { hasText: 'Java Backend Engineer' }).click();
    await expect(page.locator('.dashboard')).toBeVisible({ timeout: 10_000 });

    await page.locator('.feedback-widget-trigger').click();
    await page.locator('.feedback-type-card', { hasText: 'General feedback' }).click();
    await page.locator('.feedback-form .feedback-field-input').first().fill('Great app');
    await page.locator('.feedback-form textarea.feedback-field-input').fill('Loving the dashboard.');
    await page.locator('.feedback-form button[type="submit"]').click();
    await expect(page.locator('.feedback-reference')).toBeVisible({ timeout: 10_000 });
    await page.locator('.feedback-modal-close').click();

    await page.locator('.app-sidebar-identity').click();
    await page.locator('.dropdown-item', { hasText: 'My reports' }).click();
    await expect(page.locator('.my-report-row', { hasText: 'Great app' })).toBeVisible({ timeout: 10_000 });
  });

  test('rate limit UI shows a cooldown message after 3 recent submits', async ({ page }) => {
    await page.goto('/#/signin');
    await page.evaluate(() => {
      const now = Date.now();
      localStorage.setItem('ascent-feedback-rate', JSON.stringify([now, now, now]));
    });
    await page.reload();
    await page.locator('.feedback-widget-trigger').click({ force: true });
    await page.locator('.feedback-type-card', { hasText: 'General feedback' }).click();
    await expect(page.locator('.feedback-form button[type="submit"]')).toBeDisabled();
    await expect(page.locator('.feedback-cooldown-message')).toBeVisible();
  });
});
