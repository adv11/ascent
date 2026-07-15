// Pure time-tracking accumulation logic (issue #180) — no DOM/store access.
// A running timer's "session start" is kept only in the UI layer (start/pause
// is local, device-only state per the issue's scope); this module just does
// the elapsed-seconds math so stopping/pausing folds a session's elapsed time
// into the cumulative total exactly once, without double-counting a resumed
// session.

// Elapsed whole seconds between startedAt and now (both epoch ms). Never
// negative — a backward clock adjustment during a running session clamps to
// 0 rather than producing a negative accumulation.
export function computeElapsedSeconds(startedAt, now = Date.now()) {
  if (!Number.isFinite(startedAt)) return 0;
  return Math.max(0, Math.floor((now - startedAt) / 1000));
}

// Folds a running session's elapsed time into a prior cumulative total.
// Callers must discard `startedAt` after calling this (starting a new
// session begins counting from a fresh `startedAt`) — this function itself
// has no notion of "already accumulated," so calling it twice for the same
// session would double-count.
export function accumulateElapsed(priorTotalSeconds, startedAt, now = Date.now()) {
  const prior = Number.isFinite(priorTotalSeconds) && priorTotalSeconds > 0 ? priorTotalSeconds : 0;
  return prior + computeElapsedSeconds(startedAt, now);
}

// "1h 23m" / "45m" / "30s" — matches formatRemaining()'s (src/ui/utils/dailyTodo.js)
// coarse-unit display style rather than a full HH:MM:SS clock.
export function formatTimeSpent(totalSeconds) {
  const seconds = Math.max(0, Math.floor(Number.isFinite(totalSeconds) ? totalSeconds : 0));
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  if (hours > 0) return `${hours}h ${minutes}m`;
  if (minutes > 0) return `${minutes}m`;
  return `${seconds}s`;
}
