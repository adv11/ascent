import { dateKey, previousDateKey } from './dateKey.js';

// Streak freeze / grace day (issue #179) — a small number of "freeze" tokens
// a user can spend to keep `current` alive across a single missed day,
// matching the near-universal Duolingo-style precedent named in the issue.
// Only `current` is ever protected — `longest` is untouched, per the issue's
// explicit scoping.
export const MAX_STREAK_FREEZES = 1;
export const FREEZE_GRANT_INTERVAL_DAYS = 7;
export const FREEZE_GRANT_INTERVAL_MS = FREEZE_GRANT_INTERVAL_DAYS * 24 * 60 * 60 * 1000;

// computeStreaks(activityLog, now, frozenDates) → { current, longest }. A day
// "counts" if entries[date] >= 1, OR if its dateKey is in `frozenDates` (a
// freeze token already spent on that day — see maybeAutoApplyStreakFreeze
// below). Today counts toward the current streak the moment at least one
// item is completed today; if today has zero activity yet, the streak is
// still "in progress" (walking back from yesterday keeps it alive) rather
// than broken — it just isn't extended until something is completed.
export function computeStreaks(activityLog = {}, now = Date.now(), frozenDates = []) {
  const entries = activityLog || {};
  const frozenSet = new Set(frozenDates);
  const todayKey = dateKey(now);
  const hasToday = (entries[todayKey] || 0) >= 1;

  let current = 0;
  let cursor = hasToday ? todayKey : previousDateKey(todayKey);
  while ((entries[cursor] || 0) >= 1 || frozenSet.has(cursor)) {
    current += 1;
    cursor = previousDateKey(cursor);
  }

  // Longest streak: walk the sorted set of active dates (string sort is
  // chronological order for zero-padded YYYY-MM-DD) and track the longest
  // run of consecutive calendar days.
  const activeDates = Object.keys(entries).filter(date => (entries[date] || 0) >= 1).sort();
  let longest = 0;
  let run = 0;
  let prevDate = null;
  activeDates.forEach(date => {
    run = prevDate && previousDateKey(date) === prevDate ? run + 1 : 1;
    longest = Math.max(longest, run);
    prevDate = date;
  });

  return { current, longest };
}

// Grants a freeze token every FREEZE_GRANT_INTERVAL_MS, up to MAX_STREAK_FREEZES
// held at once — pure, so activityLogStore.js can call this on every load/sync
// without any Firebase/DOM dependency. `streakFreezes` is `{ available,
// usedDates, lastGrantedAt }`; a null `lastGrantedAt` (never granted before)
// establishes a baseline on first call rather than granting immediately, so a
// brand-new account doesn't start with a freeze already banked on day one.
export function maybeGrantStreakFreeze(streakFreezes, now = Date.now()) {
  const { available = 0, usedDates = [], lastGrantedAt = null } = streakFreezes || {};
  if (lastGrantedAt == null) {
    return { available, usedDates, lastGrantedAt: now };
  }
  if (available >= MAX_STREAK_FREEZES || now - lastGrantedAt < FREEZE_GRANT_INTERVAL_MS) {
    return { available, usedDates, lastGrantedAt };
  }
  return { available: available + 1, usedDates, lastGrantedAt: now };
}

function dayIsActive(entries, usedDates, key) {
  return (entries[key] || 0) >= 1 || usedDates.includes(key);
}

// Whether yesterday is eligible to have a freeze spent on it: no freeze left
// to spend, already frozen, or genuinely completed (nothing to protect) all
// disqualify it — extracted so maybeAutoApplyStreakFreeze's own complexity
// stays under the eslint `complexity` gate (root CLAUDE.md).
function yesterdayNeedsFreeze(entries, available, usedDates, yesterdayKey) {
  if (available <= 0) return false;
  if (usedDates.includes(yesterdayKey)) return false;
  return (entries[yesterdayKey] || 0) < 1;
}

// Automatically spends one freeze token on yesterday's date the moment a
// streak would otherwise break — the issue's chosen UX (automatic beats a
// manual toggle, matching the Duolingo precedent most closely and needing no
// extra UI). Only spends when there was actually a streak going into
// yesterday (the day before it was active or already frozen) — there is
// nothing to protect otherwise. Returns `streakFreezes` unchanged when no
// spend applies, or a new object with `available` decremented and
// yesterday's dateKey appended to `usedDates` when it does.
export function maybeAutoApplyStreakFreeze(activityLog, streakFreezes, now = Date.now()) {
  const entries = activityLog || {};
  const { available = 0, usedDates = [], lastGrantedAt = null } = streakFreezes || {};
  const todayKey = dateKey(now);
  const yesterdayKey = previousDateKey(todayKey);

  if (!yesterdayNeedsFreeze(entries, available, usedDates, yesterdayKey)) return streakFreezes;

  const dayBeforeKey = previousDateKey(yesterdayKey);
  if (!dayIsActive(entries, usedDates, dayBeforeKey)) return streakFreezes;

  return { available: available - 1, usedDates: [...usedDates, yesterdayKey], lastGrantedAt };
}
