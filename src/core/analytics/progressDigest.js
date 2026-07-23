import { dateKey, previousDateKey } from './dateKey.js';
import { computeStreaks } from './streaks.js';

// Weekly progress digest (issue #284) — a small, pure summary of "how did
// the prior week go", built on top of the existing streaks/activityLog
// primitives (no new computation, per the issue's explicit scope). Kept
// separate from analyticsEngine.js's computeAnalytics() (which computes
// every metric the /progress page needs) since the digest banner only ever
// needs two of those numbers and is evaluated far more often (every
// dashboard mount) — no reason to pay for heatmap/projection/priority
// breakdown work just to decide whether to show a one-line banner.
const DIGEST_WINDOW_DAYS = 7;

// Sum of activityLog counts over the trailing 7 calendar days (today
// inclusive) — the same trailing-window shape computeVelocity() uses, just
// summed instead of averaged, since the banner reads better as a whole
// number of topics than a per-day rate.
export function computeWeeklyCompletedCount(activityLog = {}, now = Date.now()) {
  const entries = activityLog || {};
  let total = 0;
  let cursor = dateKey(now);
  for (let i = 0; i < DIGEST_WINDOW_DAYS; i += 1) {
    total += entries[cursor] || 0;
    cursor = previousDateKey(cursor);
  }
  return total;
}

// computeProgressDigest(activityLog, now, frozenDates) → { completedCount, streakDays }.
// `activityLog` should be the effective log (buildEffectiveActivityLog()'s
// output, same as every other analytics consumer) so pre-activityLog
// history and streak-freeze days are both accounted for. Pure — no DOM/store
// access — safe to unit test with any fixed clock.
export function computeProgressDigest(activityLog = {}, now = Date.now(), frozenDates = []) {
  const completedCount = computeWeeklyCompletedCount(activityLog, now);
  const { current: streakDays } = computeStreaks(activityLog, now, frozenDates);
  return { completedCount, streakDays };
}

// Whether the digest is worth showing at all — a week with zero completions
// and no ongoing streak has nothing to summarize, so the banner should never
// render an empty "You completed 0 topics this week." sentence.
export function hasDigestContent(digest) {
  return !!digest && (digest.completedCount > 0 || digest.streakDays > 0);
}

// Plain-language summary sentence per .claude/rules/content-style.md — "topics"
// (not "items"), second person, terminal punctuation. Streak is folded into
// the same sentence when there is one, rather than a separate fragment.
export function formatDigestMessage({ completedCount, streakDays }) {
  const topicWord = completedCount === 1 ? 'topic' : 'topics';
  const base = `You completed ${completedCount} ${topicWord} this week.`;
  if (streakDays <= 0) return base;
  // "3-day streak" not "3-days streak" — a hyphenated compound adjective
  // stays singular regardless of the number, same as "5-year plan".
  return `${base} You're on a ${streakDays}-day streak.`;
}
