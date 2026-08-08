import { test, expect } from './fixtures.js';

// Issue #9 — in-app feedback & bug reporting. Every test here needs a real
// (emulator) sign-in, same FIREBASE_CONFIGURED skip precedent every other
// Firebase-backed E2E spec in this repo already uses (see
// customRoadmap.test.js/accessibility.test.js).
//
// Issue #498 — the old always-present floating `.feedback-widget-trigger`
// (reachable even signed out, on /#/signin, with no auth needed) was
// retired. "Send feedback" now lives in the signed-in account menu
// (`.app-sidebar-identity`'s dropdown) and a Settings page row — both entry
// points open the same feedbackModal.js, but both require a real sign-in to
// reach at all, so every test in this file (not just the submit-flow ones)
// now needs FIREBASE_CONFIGURED.
const FIREBASE_CONFIGURED = !!process.env.FIREBASE_CONFIGURED;

async function signInAsGuest(page) {
  await page.goto('/#/signin');
  await page.click('text=Continue as guest');
  await expect(page).toHaveURL(/#\/onboarding/, { timeout: 10_000 });
}

async function goToDashboardAsGuest(page) {
  await signInAsGuest(page);
  await page.locator('.template-card', { hasText: 'Java Backend Engineer' }).click();
  await expect(page.locator('.dashboard')).toBeVisible({ timeout: 10_000 });
}

async function openFeedbackModalViaAccountMenu(page) {
  await page.locator('.app-sidebar-identity').click();
  await page.locator('.dropdown-item', { hasText: 'Send feedback' }).click();
}

// settings.js's Support tab (and every other tab) only renders for a real,
// non-anonymous account — a guest session sees buildGuestView()'s single
// "Create a free account" card instead, with no tabs at all. Same real
// sign-up flow customRoadmapRace.test.js already uses.
async function signUpNewUser(page) {
  const uniqueEmail = `issue498-${Date.now()}@example.com`;
  const password = 'TestPassword1!';
  await page.goto('/#/signup');
  await expect(page.locator('.auth-title')).toContainText('Create your account', { timeout: 10_000 });
  await page.locator('input[type="email"]').fill(uniqueEmail);
  await page.locator('input[type="password"]').first().fill(password);
  await page.locator('input[type="password"]').last().fill(password);
  await page.locator('[type="submit"]').click();
  await expect(page).toHaveURL(/#\/onboarding/, { timeout: 15_000 });
}

test.describe('feedback entry points — account menu and Settings row (issue #498)', () => {
  test('account menu\'s "Send feedback" opens the single screen with three kind chips', async ({ page }) => {
    test.skip(!FIREBASE_CONFIGURED, 'Requires FIREBASE_CONFIGURED env var — see issue #37');
    await goToDashboardAsGuest(page);

    await openFeedbackModalViaAccountMenu(page);
    const modal = page.locator('.modal-overlay[aria-label="Send feedback"]');
    await expect(modal).toBeVisible();
    await expect(modal.locator('.feedback-kind-chip')).toHaveCount(3);
    await expect(modal.locator('.feedback-kind-chip', { hasText: 'Something is broken' })).toBeVisible();
    await expect(modal.locator('.feedback-kind-chip', { hasText: 'An idea' })).toBeVisible();
    await expect(modal.locator('.feedback-kind-chip', { hasText: 'Something else' })).toBeVisible();
  });

  test('Settings page\'s Support tab has a "Send feedback" row opening the same modal', async ({ page }) => {
    test.skip(!FIREBASE_CONFIGURED, 'Requires FIREBASE_CONFIGURED env var — see issue #37');
    await signUpNewUser(page);
    await page.goto('/#/settings');
    await expect(page.locator('.settings-page')).toBeVisible({ timeout: 10_000 });

    await page.locator('.tab', { hasText: 'Support' }).click();
    await page.locator('.settings-row', { hasText: 'Send feedback' }).getByRole('button', { name: 'Send feedback' }).click();
    await expect(page.locator('.modal-overlay[aria-label="Send feedback"]')).toBeVisible();
  });

  test('"Something is broken" is selected by default and the form has one textarea plus "Send it"', async ({ page }) => {
    test.skip(!FIREBASE_CONFIGURED, 'Requires FIREBASE_CONFIGURED env var — see issue #37');
    await goToDashboardAsGuest(page);
    await openFeedbackModalViaAccountMenu(page);
    const form = page.locator('.feedback-form');
    await expect(form).toBeVisible();
    await expect(form.locator('.feedback-kind-chip.active')).toHaveText('Something is broken');
    await expect(form.locator('.field-label', { hasText: 'What happened?' })).toBeVisible();
    await expect(form.locator('button[type="submit"]')).toHaveText('Send it');
  });

  test('submitting an empty form shows a validation error instead of submitting', async ({ page }) => {
    test.skip(!FIREBASE_CONFIGURED, 'Requires FIREBASE_CONFIGURED env var — see issue #37');
    await goToDashboardAsGuest(page);
    await openFeedbackModalViaAccountMenu(page);
    await page.locator('.feedback-form button[type="submit"]').click();
    await expect(page.getByText('Fill in what happened before sending.')).toBeVisible();
  });
});

test.describe('feedback — full submit flow (requires Firebase emulator)', () => {
  test('guest fills and submits a "Something is broken" report and sees the success screen with a reference id', async ({ page }) => {
    test.skip(!FIREBASE_CONFIGURED, 'Requires FIREBASE_CONFIGURED env var — see issue #37');
    await goToDashboardAsGuest(page);

    await openFeedbackModalViaAccountMenu(page);

    const form = page.locator('.feedback-form');
    await form.locator('textarea.feedback-field-input').fill('Toggled rapidly and saw a visible flicker for ~1s instead of a clean update.');

    await form.locator('button[type="submit"]').click();
    await expect(page.locator('.feedback-reference')).toBeVisible({ timeout: 10_000 });
    await expect(page.locator('.feedback-reference')).toHaveText(/^Reference: #\S{5}$/);
  });

  test('"See my past reports" from inside the modal shows submitted reports', async ({ page }) => {
    test.skip(!FIREBASE_CONFIGURED, 'Requires FIREBASE_CONFIGURED env var — see issue #37');
    await goToDashboardAsGuest(page);

    await openFeedbackModalViaAccountMenu(page);
    await page.locator('.feedback-kind-chip', { hasText: 'Something else' }).click();
    await page.locator('.feedback-form textarea.feedback-field-input').fill('Loving the dashboard.');
    await page.locator('.feedback-form button[type="submit"]').click();
    await expect(page.locator('.feedback-reference')).toBeVisible({ timeout: 10_000 });
    await page.locator('.feedback-modal-close').click();

    await page.locator('.app-sidebar-identity').click();
    await page.locator('.dropdown-item', { hasText: 'My reports' }).click();
    await expect(page.locator('.my-report-row', { hasText: 'Loving the dashboard.' })).toBeVisible({ timeout: 10_000 });
  });

  test('rate limit UI shows a cooldown message after 3 recent submits', async ({ page }) => {
    test.skip(!FIREBASE_CONFIGURED, 'Requires FIREBASE_CONFIGURED env var — see issue #37');
    await signInAsGuest(page);
    await page.evaluate(() => {
      const now = Date.now();
      localStorage.setItem('ascent-feedback-rate', JSON.stringify([now, now, now]));
    });
    await page.reload();
    await expect(page.locator('.onboarding-page')).toBeVisible({ timeout: 10_000 });

    await page.locator('.template-card', { hasText: 'Java Backend Engineer' }).click();
    await expect(page.locator('.dashboard')).toBeVisible({ timeout: 10_000 });
    await openFeedbackModalViaAccountMenu(page);
    await expect(page.locator('.feedback-form button[type="submit"]')).toBeDisabled();
    await expect(page.locator('.feedback-cooldown-message')).toBeVisible();
  });
});
