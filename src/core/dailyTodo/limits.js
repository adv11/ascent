// Dependency-free constants/validators for the Daily Todos feature (issue
// #56) — same reasoning as src/core/roadmap/limits.js: dailyTodoStore.js and
// dailyTodoPanel.js both need these without pulling in each other's imports.

export const MAX_TODO_TITLE_LENGTH = 200;

// Firebase rules can't count a map's children, so the active-todo cap is
// enforced client-side, same precedent as roadmapStore.js's MAX_ITEMS_PER_ROADMAP.
export const MAX_ACTIVE_TODOS = 20;

// Deadline model: a rolling deadline counted from creation
// (`expiresAt = createdAt + durationMs`), not a calendar-day reset — see
// issue #56's "Decision required" section. The duration itself is chosen
// per-todo by the user (a deviation from the issue's original fixed-24h
// sketch, confirmed before implementation — see the issue comment) rather
// than always being exactly 24h.
export const MIN_DURATION_MS = 15 * 60 * 1000; // 15 minutes
export const MAX_DURATION_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

// Common choices surfaced in the UI; "Custom…" lets the user type any value
// (in hours) between MIN_DURATION_MS and MAX_DURATION_MS.
export const DURATION_PRESETS = [
  { label: '1 hour', ms: 60 * 60 * 1000 },
  { label: '3 hours', ms: 3 * 60 * 60 * 1000 },
  { label: '6 hours', ms: 6 * 60 * 60 * 1000 },
  { label: '12 hours', ms: 12 * 60 * 60 * 1000 },
  { label: '24 hours', ms: 24 * 60 * 60 * 1000 },
  { label: '48 hours', ms: 48 * 60 * 60 * 1000 }
];

// Local reminder lead time (issue #132) — how long before a todo's
// `expiresAt` its "Remind me" notification fires. A named constant here
// (not a magic number in reminderScheduling.js/reminderScheduler.js) since
// dailyTodoStore.js/dailyTodoPanel.js already import their own duration
// caps from this same module.
export const REMINDER_LEAD_MS = 15 * 60 * 1000; // 15 minutes

// Issue #555 — how long a missed (expired, not done) todo keeps rendering in
// dailyTodoPanel.js's "Missed" section before it stops appearing there. This
// is a display window only, never a deletion: dailyTodoStore.js's own
// documented convention is that deletion is always an explicit, confirmed
// user action (see removeTodo's doc comment) — nothing here auto-deletes a
// todo. A todo older than this window simply stops rendering in the Missed
// list; it's still present in the store, still manually deletable via the
// existing overflow-menu Delete action, and still counted by
// src/core/analytics/dailyTodoAnalytics.js's stats. This exists because
// nothing previously bounded how long the Missed section could grow — a
// todo missed weeks ago rendered identically to one missed an hour ago,
// which is what caused the reported "todo card keeps getting taller" bug.
export const MISSED_VISIBLE_MS = 48 * 60 * 60 * 1000; // 48 hours

export function clampDurationMs(ms) {
  if (!Number.isFinite(ms)) return null;
  return Math.min(Math.max(ms, MIN_DURATION_MS), MAX_DURATION_MS);
}
