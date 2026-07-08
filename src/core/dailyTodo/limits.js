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

export function clampDurationMs(ms) {
  if (!Number.isFinite(ms)) return null;
  return Math.min(Math.max(ms, MIN_DURATION_MS), MAX_DURATION_MS);
}
