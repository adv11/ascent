// Pure Daily Todo statistics (issue #555) — no DOM, no store access, safe to
// unit test with plain fixture data, following the same convention every
// other module under src/core/analytics/ already follows.
//
// Deliberately computed directly from a live dailyTodoStore snapshot
// (`store.getSnapshot().todos`), not a separate persisted aggregate counter
// — dailyTodoStore.js never auto-deletes a todo (see
// src/core/dailyTodo/limits.js's MISSED_VISIBLE_MS doc comment), so this
// stays accurate for as long as the user hasn't manually deleted a row via
// the panel's own overflow menu. That's an accepted, honestly-labeled
// limitation, the same one /progress's existing "Time tracked" stat already
// has (also a live sum, not a historical ledger) — see todoStats.js's own
// page copy.
import { dateKey } from './dateKey.js';

const DAILY_BUCKET_DAYS = 30;

// Same one-line predicate as src/ui/utils/dailyTodo.js's isExpired() —
// duplicated rather than imported, the identical "keep the two independent"
// precedent dailyTodoStore.js's own stableStringify() doc comment already
// established for a small pure helper crossing a store/module boundary; a
// pure src/core/ module reaching into src/ui/utils/ would be a new kind of
// dependency this codebase doesn't otherwise have.
function isMissed(todo, now) {
  return !todo.done && now > todo.expiresAt;
}

function isActive(todo, now) {
  return !todo.done && now <= todo.expiresAt;
}

function average(values) {
  if (!values.length) return null;
  return values.reduce((sum, v) => sum + v, 0) / values.length;
}

// Builds an ordered, zero-filled { date, created, done, missed } series for
// the last DAILY_BUCKET_DAYS days (oldest first, ending on today's dateKey)
// so a caller never has to handle a missing day itself.
function buildDailyBuckets(todos, now) {
  const buckets = new Map();
  const nowDate = new Date(now);
  for (let i = DAILY_BUCKET_DAYS - 1; i >= 0; i -= 1) {
    const d = new Date(nowDate.getFullYear(), nowDate.getMonth(), nowDate.getDate() - i);
    buckets.set(dateKey(d.getTime()), { date: dateKey(d.getTime()), created: 0, done: 0, missed: 0 });
  }
  todos.forEach(todo => {
    const createdBucket = buckets.get(dateKey(todo.createdAt));
    if (createdBucket) createdBucket.created += 1;
    if (todo.done && todo.doneAt) {
      const doneBucket = buckets.get(dateKey(todo.doneAt));
      if (doneBucket) doneBucket.done += 1;
    } else if (isMissed(todo, now)) {
      const missedBucket = buckets.get(dateKey(todo.expiresAt));
      if (missedBucket) missedBucket.missed += 1;
    }
  });
  return [...buckets.values()];
}

// Returns totals/rates plus a 30-day daily series. Every rate/average is
// `null` (never NaN/Infinity) when there's no data to compute it from —
// callers must handle that explicitly rather than assuming a number.
export function computeDailyTodoStats(todos, now = Date.now()) {
  const totalCount = todos.length;
  const doneTodos = todos.filter(t => t.done);
  const missedTodos = todos.filter(t => isMissed(t, now));
  const activeCount = todos.filter(t => isActive(t, now)).length;
  const resolvedCount = doneTodos.length + missedTodos.length;

  const trackedSeconds = todos
    .map(t => t.timeSpentSeconds)
    .filter(seconds => Number.isFinite(seconds) && seconds > 0);
  const turnaroundMs = doneTodos
    .filter(t => Number.isFinite(t.doneAt))
    .map(t => t.doneAt - t.createdAt)
    .filter(ms => ms >= 0);

  return {
    totalCount,
    doneCount: doneTodos.length,
    missedCount: missedTodos.length,
    activeCount,
    completionRatePct: resolvedCount === 0 ? null : Math.round((doneTodos.length / resolvedCount) * 100),
    avgTimeSpentSeconds: average(trackedSeconds),
    avgTurnaroundMs: average(turnaroundMs),
    dailyBuckets: buildDailyBuckets(todos, now)
  };
}
