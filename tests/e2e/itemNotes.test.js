import { test, expect } from './fixtures.js';

// Requires the Firebase Auth/Database emulator (issue #37) — every scenario here
// needs a real (anonymous) sign-in so roadmapStore's Firebase paths actually run.
const FIREBASE_CONFIGURED = !!process.env.FIREBASE_CONFIGURED;

async function openFirstItemPanel(page) {
  await page.locator('[data-action="edit"]').nth(0).click();
  await expect(page.locator('.item-panel')).toBeVisible({ timeout: 5_000 });
}

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
    await expect(page.locator('.notes-status')).toContainText('Autosaved', { timeout: 3_000 });
    await page.locator('button', { hasText: 'Cancel' }).click();
    await expect(page.locator('.item-panel')).toHaveCount(0);

    await openFirstItemPanel(page);
    await expect(page.locator('.notes-textarea')).toHaveValue('Remember: virtual threads need JDK 21+');
  });

  test('a saved note shows the notes indicator on the roadmap row, and clicking it focuses the notes textarea', async ({ page }) => {
    test.skip(!FIREBASE_CONFIGURED, 'Requires FIREBASE_CONFIGURED env var — see issue #37');
    await page.goto('/#/signin');
    await page.click('text=Continue as guest');
    await expect(page).toHaveURL(/#\/onboarding/, { timeout: 10_000 });
    await page.locator('.template-card', { hasText: 'Java Backend Engineer' }).click();
    await expect(page.locator('.dashboard')).toBeVisible({ timeout: 10_000 });

    const firstRow = page.locator('.check-item').nth(0);
    await expect(firstRow.locator('[data-action="notes"]')).toHaveCount(0);

    await openFirstItemPanel(page);
    await page.locator('.notes-textarea').fill('Key command examples here');
    await expect(page.locator('.notes-status')).toContainText('Autosaved', { timeout: 3_000 });
    await page.locator('button', { hasText: 'Cancel' }).click();
    await expect(page.locator('.item-panel')).toHaveCount(0);

    const notesIndicator = firstRow.locator('[data-action="notes"]');
    await expect(notesIndicator).toBeVisible();
    await notesIndicator.click();
    await expect(page.locator('.item-panel')).toBeVisible({ timeout: 5_000 });
    await expect(page.locator('.notes-textarea')).toBeFocused();
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
    await expect(page.locator('.notes-status')).toContainText('Autosaved', { timeout: 3_000 });
    await page.locator('button', { hasText: 'Cancel' }).click();

    await page.reload();
    await expect(page.locator('.dashboard')).toBeVisible({ timeout: 10_000 });
    await openFirstItemPanel(page);
    await expect(page.locator('.notes-textarea')).toHaveValue('Survives reload');
  });
});
