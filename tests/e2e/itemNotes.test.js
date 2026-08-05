import { test, expect, openFirstItemPanel } from './fixtures.js';

// Requires the Firebase Auth/Database emulator (issue #37) — every scenario here
// needs a real (anonymous) sign-in so roadmapStore's Firebase paths actually run.
const FIREBASE_CONFIGURED = !!process.env.FIREBASE_CONFIGURED;

// The "Autosaved" indicator itself only depends on the 800ms
// NOTES_AUTOSAVE_DEBOUNCE_MS timer firing (itemPanel.js) — it's shown
// synchronously right after the local store call, not after any Firebase
// round trip. Under concurrent Playwright workers, though, main-thread
// scheduling jitter can delay that setTimeout firing well past a tight
// margin, which is what made this assertion intermittently time out under
// full-suite load. Give it real headroom rather than a margin barely wider
// than the debounce itself.
const AUTOSAVE_INDICATOR_TIMEOUT = 8_000;

test.describe('personal notes per topic (issue #15)', () => {
  test('adding a note, closing, and reopening the panel shows the note restored', async ({ page }) => {
    test.skip(!FIREBASE_CONFIGURED, 'Requires FIREBASE_CONFIGURED env var — see issue #37');
    await page.goto('/#/signin');
    await page.click('text=Continue as guest');
    await expect(page).toHaveURL(/#\/onboarding/, { timeout: 10_000 });
    await page.locator('.template-card', { hasText: 'Java Backend Engineer' }).click();
    await expect(page.locator('.dashboard')).toBeVisible({ timeout: 10_000 });

    await openFirstItemPanel(page);
    await page.locator('.notes-textarea').fill('Remember: virtual threads need JDK 21+');
    await expect(page.locator('.notes-status')).toContainText('Autosaved', { timeout: AUTOSAVE_INDICATOR_TIMEOUT });
    await page.locator('button', { hasText: 'Cancel' }).click();
    await expect(page.locator('.item-panel')).toHaveCount(0);

    await openFirstItemPanel(page);
    await expect(page.locator('.notes-textarea')).toHaveValue('Remember: virtual threads need JDK 21+');
  });

  test('a saved note reopens correctly via the row overflow menu\'s "Open" action', async ({ page }) => {
    test.skip(!FIREBASE_CONFIGURED, 'Requires FIREBASE_CONFIGURED env var — see issue #37');
    await page.goto('/#/signin');
    await page.click('text=Continue as guest');
    await expect(page).toHaveURL(/#\/onboarding/, { timeout: 10_000 });
    await page.locator('.template-card', { hasText: 'Java Backend Engineer' }).click();
    await expect(page.locator('.dashboard')).toBeVisible({ timeout: 10_000 });

    await openFirstItemPanel(page);
    await page.locator('.notes-textarea').fill('Key command examples here');
    await expect(page.locator('.notes-status')).toContainText('Autosaved', { timeout: AUTOSAVE_INDICATOR_TIMEOUT });
    await page.locator('button', { hasText: 'Cancel' }).click();
    await expect(page.locator('.item-panel')).toHaveCount(0);

    await openFirstItemPanel(page);
    await expect(page.locator('.notes-textarea')).toHaveValue('Key command examples here');
  });

  test('notes survive a page reload', async ({ page }) => {
    test.skip(!FIREBASE_CONFIGURED, 'Requires FIREBASE_CONFIGURED env var — see issue #37');
    await page.goto('/#/signin');
    await page.click('text=Continue as guest');
    await expect(page).toHaveURL(/#\/onboarding/, { timeout: 10_000 });
    await page.locator('.template-card', { hasText: 'Java Backend Engineer' }).click();
    await expect(page.locator('.dashboard')).toBeVisible({ timeout: 10_000 });

    await openFirstItemPanel(page);
    await page.locator('.notes-textarea').fill('Survives reload');
    await expect(page.locator('.notes-status')).toContainText('Autosaved', { timeout: AUTOSAVE_INDICATOR_TIMEOUT });
    await page.locator('button', { hasText: 'Cancel' }).click();

    await page.reload();
    await expect(page.locator('.dashboard')).toBeVisible({ timeout: 10_000 });
    await openFirstItemPanel(page);
    await expect(page.locator('.notes-textarea')).toHaveValue('Survives reload');
  });
});
