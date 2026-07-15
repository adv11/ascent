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

// Issue #182 — groups the review-due set (above) by shared `item.tags` entry,
// so the UI can say "3 items tagged 'two-pointer' are due" instead of one
// reminder per item. A tag only forms a group once 2+ due items share it;
// anything left over (no tags, or a tag no other due item shares) renders as
// its own singleton group with `tag: null`. A multi-tag item can legitimately
// appear in more than one group — it is only left as a singleton if none of
// its tags matched another due item. Pure/no-DOM, per this module's existing
// convention.
export function groupReviewDueItemsByTag(items, now = Date.now()) {
  const due = getReviewDueItems(items, now);
  const tagCounts = new Map();
  due.forEach(item => {
    (item.tags || []).forEach(tag => tagCounts.set(tag, (tagCounts.get(tag) || 0) + 1));
  });

  const groups = [];
  const singletonIds = new Set(due.map(item => item.id));
  tagCounts.forEach((count, tag) => {
    if (count < 2) return;
    const groupItems = due.filter(item => (item.tags || []).includes(tag));
    groups.push({ tag, items: groupItems });
    groupItems.forEach(item => singletonIds.delete(item.id));
  });
  due.forEach(item => {
    if (singletonIds.has(item.id)) groups.push({ tag: null, items: [item] });
  });
  return groups;
}
