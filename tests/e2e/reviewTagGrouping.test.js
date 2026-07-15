import { test, expect } from './fixtures.js';

// Requires the Firebase Auth/Database emulator (issue #37) — same reasoning
// as tests/e2e/reviewReminders.test.js.
const FIREBASE_CONFIGURED = !!process.env.FIREBASE_CONFIGURED;

const REVIEW_INTERVAL_DAYS = 14;
const DAY_MS = 24 * 60 * 60 * 1000;

// Ages the given items' completedAt by rewriting the local roadmap blob
// directly, same technique as reviewReminders.test.js — see that file's
// comment for why this beats waiting 14 real days.
async function ageItemsCompletion(page, templateId, itemIds, daysAgo) {
  await page.evaluate(({ templateId, itemIds, daysAgo, DAY_MS }) => {
    const all = JSON.parse(localStorage.getItem('ascent-roadmaps-v1') || '{}');
    const blob = all[templateId];
    itemIds.forEach(id => {
      blob.items[id].completedAt = Date.now() - daysAgo * DAY_MS;
    });
    blob.dirty = true;
    localStorage.setItem('ascent-roadmaps-v1', JSON.stringify(all));
  }, { templateId, itemIds, daysAgo, DAY_MS });
}

test.describe('review-due tag grouping (issue #182)', () => {
  test('two topics tagged alike, both due for review, surface grouped by tag', async ({ page }) => {
    test.skip(!FIREBASE_CONFIGURED, 'Requires FIREBASE_CONFIGURED env var — see issue #37');
    await page.goto('/#/signin');
    await page.click('text=Continue as guest');
    await expect(page).toHaveURL(/#\/onboarding/, { timeout: 10_000 });
    await page.locator('.template-card', { hasText: 'Java Backend Engineer' }).click();
    await expect(page.locator('.dashboard')).toBeVisible({ timeout: 10_000 });

    const rows = page.locator('.check-item');
    const firstRow = rows.nth(0);
    const secondRow = rows.nth(1);

    await firstRow.locator('.check-box').click();
    await secondRow.locator('.check-box').click();

    for (const row of [firstRow, secondRow]) {
      await row.locator('[data-action="edit"]').click();
      await page.fill('.item-panel input[placeholder*="two-pointer"]', 'two-pointer');
      await page.click('.item-panel >> text=Save changes');
      await expect(page.locator('.item-panel')).toBeHidden();
    }

    const itemIds = await page.evaluate(() => {
      const all = JSON.parse(localStorage.getItem('ascent-roadmaps-v1') || '{}');
      return Object.keys(all['java-backend'].items).slice(0, 2);
    });
    await ageItemsCompletion(page, 'java-backend', itemIds, REVIEW_INTERVAL_DAYS + 6);
    await page.reload();
    await expect(page.locator('.dashboard')).toBeVisible({ timeout: 10_000 });

    await page.locator('.filter-chip[data-p="REVIEW"]').click();
    await expect(page.locator('.review-tag-group-banner')).toBeVisible({ timeout: 10_000 });
    await expect(page.locator('.review-tag-group-line')).toContainText('2 items tagged "two-pointer"');
  });
});
