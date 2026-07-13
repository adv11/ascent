import { test, expect } from './fixtures.js';

// Requires the Firebase Auth/Database emulator (issue #37) — needs a real
// (anonymous) sign-in so roadmapStore's Firebase paths actually run.
const FIREBASE_CONFIGURED = !!process.env.FIREBASE_CONFIGURED;

const REVIEW_INTERVAL_DAYS = 14;
const DAY_MS = 24 * 60 * 60 * 1000;

// Ages the first non-deleted item's completedAt by rewriting the local
// roadmap blob directly (ascent-roadmaps-v1) rather than waiting 14 real
// days — the issue's own testing requirements call this out explicitly
// ("mock Date.now()/inject a pre-aged fixture rather than actually waiting").
// `dirty: true` matches resolveRoadmapItems()'s "a dirty local blob always
// wins over a remote read" guard (roadmap-store.md), so this edit survives
// the reload below instead of being clobbered by a fresh Firebase fetch.
async function ageFirstItemCompletion(page, templateId, daysAgo) {
  await page.evaluate(({ templateId, daysAgo, DAY_MS }) => {
    const all = JSON.parse(localStorage.getItem('ascent-roadmaps-v1') || '{}');
    const blob = all[templateId];
    const firstId = Object.keys(blob.items)[0];
    blob.items[firstId].completedAt = Date.now() - daysAgo * DAY_MS;
    blob.dirty = true;
    localStorage.setItem('ascent-roadmaps-v1', JSON.stringify(all));
  }, { templateId, daysAgo, DAY_MS });
}

test.describe('spaced-repetition review reminders (issue #134)', () => {
  test('completing a topic, aging it past the review interval, marking reviewed, and seeing the count drop', async ({ page }) => {
    test.skip(!FIREBASE_CONFIGURED, 'Requires FIREBASE_CONFIGURED env var — see issue #37');
    await page.goto('/#/signin');
    await page.click('text=Continue as guest');
    await expect(page).toHaveURL(/#\/onboarding/, { timeout: 10_000 });
    await page.locator('.template-card', { hasText: 'Java Backend Engineer' }).click();
    await expect(page.locator('.dashboard')).toBeVisible({ timeout: 10_000 });

    await expect(page.locator('.review-due-nav-badge')).toBeHidden();

    const firstRow = page.locator('.check-item').nth(0);
    await firstRow.locator('.check-box').click();
    await expect(firstRow).toHaveClass(/done/);

    await ageFirstItemCompletion(page, 'java-backend', REVIEW_INTERVAL_DAYS + 6);
    await page.reload();
    await expect(page.locator('.dashboard')).toBeVisible({ timeout: 10_000 });

    const reviewBadge = page.locator('.review-due-nav-badge');
    await expect(reviewBadge).toBeVisible({ timeout: 10_000 });
    await expect(reviewBadge).toContainText('1 due for review');

    await reviewBadge.click();
    const reviewChip = page.locator('.filter-chip[data-p="REVIEW"]');
    await expect(reviewChip).toHaveClass(/active/);

    const dueRow = page.locator('.check-item').first();
    const markReviewedBtn = dueRow.locator('[data-action="mark-reviewed"]');
    await expect(markReviewedBtn).toBeVisible();
    await markReviewedBtn.click();

    await expect(page.locator('.toast')).toContainText('Marked', { timeout: 5_000 });
    await expect(reviewBadge).toBeHidden({ timeout: 5_000 });
    await expect(dueRow).toHaveClass(/done/);
  });
});
