// Pure, unit-testable time-formatting helpers for the Daily Todos feature
// (issue #56) — no DOM/Firebase dependency. Duration constants/validation
// live in src/core/dailyTodo/limits.js instead, so dailyTodoStore.js doesn't
// have to import from src/ui/.
//
// Expiry is a pure, derived value computed on read (no server cron — see
// CLAUDE.md's "Deploying"/static-hosting notes) rather than a stored/mutated
// state that would need a background job.

import { MISSED_VISIBLE_MS } from '../../core/dailyTodo/limits.js';

export function isExpired(todo, now = Date.now()) {
  return !todo.done && now > todo.expiresAt;
}

// Issue #555 — a missed todo is only shown in dailyTodoPanel.js's Missed
// section while it's inside this window; see MISSED_VISIBLE_MS's own doc
// comment for why this is a display filter, not a deletion. `false` for an
// active or done todo (isExpired() already covers that half).
export function isRecentlyMissed(todo, now = Date.now()) {
  return isExpired(todo, now) && (now - todo.expiresAt) <= MISSED_VISIBLE_MS;
}

export function remainingMs(todo, now = Date.now()) {
  return todo.expiresAt - now;
}

export function formatRemaining(ms) {
  if (ms <= 0) return 'Missed';
  const totalMinutes = Math.floor(ms / 60000);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  if (hours === 0 && minutes === 0) return '<1m left';
  return hours > 0 ? `${hours}h ${minutes}m left` : `${minutes}m left`;
}

// Countdown color band, reusing existing --brand/warning/danger tokens (no
// new hex values) — 'ok' (>6h), 'warn' (<6h), 'danger' (<1h or missed).
export function remainingBand(ms) {
  if (ms < 60 * 60 * 1000) return 'danger';
  if (ms < 6 * 60 * 60 * 1000) return 'warn';
  return 'ok';
}
