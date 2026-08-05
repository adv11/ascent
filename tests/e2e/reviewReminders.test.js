import { test, expect, openRowOverflowMenu } from './fixtures.js';

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

    // Issue #488 — the header "N due for review" nav badge was retired along
    // with the rest of the old topbar-status controls (deferred to #489's
    // summary-card redesign); the "Review due" filter chip inside the filter
    // panel is the only remaining reachable signal for this feature now.
    await page.locator('.filter-toggle-btn').click();
    await expect(page.locator('.filter-chip[data-p="REVIEW"] .chip-count')).toHaveText('0/0');
    await page.keyboard.press('Escape');

    const firstRow = page.locator('.check-item').nth(0);
    await firstRow.locator('.check-box').click();
    await expect(firstRow).toHaveClass(/done/);

    // Wait for roadmapStore.js's 500ms debounced queueSave() to actually flush
    // before directly rewriting localStorage below — otherwise that pending
    // timer can fire in the gap before page.reload() and clobber the
    // artificial aging back to "just completed" (a real, reported CI flake;
    // see reviewTagGrouping.test.js's identical fix for the full explanation).
    await expect(page.locator('.save-badge')).toContainText('Saved', { timeout: 5_000 });

    await ageFirstItemCompletion(page, 'java-backend', REVIEW_INTERVAL_DAYS + 6);
    await page.reload();
    await expect(page.locator('.dashboard')).toBeVisible({ timeout: 10_000 });

    await page.locator('.filter-toggle-btn').click();
    await expect(page.locator('.filter-chip[data-p="REVIEW"] .chip-count')).toHaveText('1/1', { timeout: 10_000 });

    const reviewChip = page.locator('.filter-chip[data-p="REVIEW"]');
    await reviewChip.click();
    await expect(reviewChip).toHaveClass(/active/);
    // Issue #487 — the chip lives inside the filter panel; close it again so
    // the (now REVIEW-filtered) checklist rows underneath are reachable.
    await page.keyboard.press('Escape');

    const dueRow = page.locator('.check-item').first();
    await openRowOverflowMenu(dueRow, 'Mark reviewed');

    await expect(page.locator('.toast')).toContainText('Marked', { timeout: 5_000 });
    await page.locator('.filter-toggle-btn').click();
    await expect(page.locator('.filter-chip[data-p="REVIEW"] .chip-count')).toHaveText('0/0', { timeout: 5_000 });
    await page.keyboard.press('Escape');

    // Marking the item reviewed drops it out of the REVIEW filter's own
    // criteria (isReviewDue()), so it disappears from this filtered list on
    // re-render — switch back to "All" (issue #477 — the priority chips
    // collapsed into a createSelect() dropdown) to find it and confirm it's
    // still marked done there.
    await page.locator('.filter-toggle-btn').click();
    await page.locator('.priority-filter-select .custom-select-trigger').click();
    await page.locator('.custom-select-option', { hasText: /^All/ }).click();
    await expect(page.locator('.check-item').first()).toHaveClass(/done/);
  });
});
