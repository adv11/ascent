// Spaced-repetition review reminders — Phase A (issue #134). This is
// deliberately a simple fixed-interval reminder, not a full spaced-repetition
// algorithm (no per-item ease factors, no growing intervals) — a true SRS
// model is out of scope for this first version, see the issue for why.
export const REVIEW_INTERVAL_DAYS = 14;
export const REVIEW_INTERVAL_MS = REVIEW_INTERVAL_DAYS * 24 * 60 * 60 * 1000;

// `item.lastReviewedAt` (number | null, missing/null both mean "never
// reviewed since completion" — same backward-compat convention as
// `notes`/`completedViaTodoAt`) wins over `completedAt` once set, so a topic
// can cycle review-due -> reviewed -> review-due-again indefinitely without
// ever touching `done`/`completedAt`.
export function isReviewDue(item, now = Date.now()) {
  if (item.deleted || !item.done || !Number.isFinite(item.completedAt)) return false;
  const since = Number.isFinite(item.lastReviewedAt) ? item.lastReviewedAt : item.completedAt;
  return now - since >= REVIEW_INTERVAL_MS;
}

export function getReviewDueItems(items, now = Date.now()) {
  return items.filter(item => isReviewDue(item, now));
}
