import { test, expect } from './fixtures.js';

// Requires the Firebase Auth/Database emulator (issue #37) — every scenario here
// needs a real (anonymous) sign-in so roadmapStore's Firebase paths actually run.
const FIREBASE_CONFIGURED = !!process.env.FIREBASE_CONFIGURED;

async function openItemPanelForRow(row) {
  await row.locator('[data-action="edit"]').click();
}

test.describe('optional topic prerequisites (issue #381)', () => {
  test('setting a prerequisite locks the dependent topic, and completing the prerequisite unlocks it without a reload', async ({ page }) => {
    test.skip(!FIREBASE_CONFIGURED, 'Requires FIREBASE_CONFIGURED env var — see issue #37');
    await page.goto('/#/signin');
    await page.click('text=Continue as guest');
    await expect(page).toHaveURL(/#\/onboarding/, { timeout: 10_000 });
    await page.locator('.template-card', { hasText: 'Java Backend Engineer' }).click();
    await expect(page.locator('.dashboard')).toBeVisible({ timeout: 10_000 });

    // The first phase renders open by default (dashboard.js's initial
    // openPhases state), so its rows are already visible.
    const rows = page.locator('.check-item');
    const firstRow = rows.nth(0);
    const secondRow = rows.nth(1);
    const firstTitle = await firstRow.locator('.check-title').innerText();

    // Set the second row's prerequisite to the first row's topic.
    await openItemPanelForRow(secondRow);
    await expect(page.locator('.item-panel')).toBeVisible({ timeout: 5_000 });
    await page.locator('.item-panel .custom-select-trigger', { hasText: 'None' }).click();
    await page.getByRole('option', { name: firstTitle, exact: true }).click();
    await page.locator('button', { hasText: 'Save changes' }).click();
    await expect(page.locator('.item-panel')).toHaveCount(0);

    // The dependent row now renders locked with a "Blocked by" chip, and its
    // checkbox click is a no-op.
    await expect(secondRow).toHaveClass(/locked/);
    await expect(secondRow.locator('.prerequisite-lock-chip')).toContainText(`Blocked by: ${firstTitle}`);
    // `aria-disabled="true"` makes Playwright's actionability check refuse a
    // plain click on this element — force it, since we're deliberately
    // verifying the click is a no-op (toggleDone()'s own isBlocked() guard),
    // not testing browser-level disabled-element behavior.
    await secondRow.locator('.check-box').click({ force: true });
    await expect(secondRow).toHaveClass(/locked/);
    await expect(secondRow).not.toHaveClass(/\bdone\b/);

    // Completing the prerequisite unlocks the dependent row via the existing
    // store subscription — no page reload needed.
    await firstRow.locator('.check-box').click();
    await expect(firstRow).toHaveClass(/done/);
    await expect(secondRow).not.toHaveClass(/locked/);
    await expect(secondRow.locator('.prerequisite-lock-chip')).toHaveCount(0);

    // Now the checkbox actually toggles.
    await secondRow.locator('.check-box').click();
    await expect(secondRow).toHaveClass(/done/);
  });
});
