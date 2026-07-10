import { backupFirstSeenAtKey, lastBackupAtKey, backupReminderDismissedAtKey } from '../../services/localStorageKeys.js';

// Issue #18 follow-up — nudges a user to download a fresh backup periodically,
// since nothing else in the app ever prompts for one and a stale backup is as
// good as no backup once enough progress has changed since it was taken.
// Deliberately simple interval math, not a scheduled/server-side reminder —
// this is a client-only, best-effort nudge shown at most once per
// REMINDER_AFTER_MS window, checked on every dashboard render (see
// backupReminderBanner.js), not a background timer.
export const REMINDER_AFTER_MS = 14 * 24 * 60 * 60 * 1000; // 14 days since the last backup (or first seen)
export const SNOOZE_AFTER_DISMISS_MS = 7 * 24 * 60 * 60 * 1000; // don't re-nag for a week after "Not now"

function readTimestamp(key) {
  const raw = localStorage.getItem(key);
  const parsed = raw ? Number(raw) : NaN;
  return Number.isFinite(parsed) ? parsed : null;
}

// Call once per uid, the first time the dashboard ever renders for them —
// establishes the baseline a brand-new account's 14-day countdown starts
// from, so a user isn't nagged to back up a roadmap they made five minutes
// ago just because they've never explicitly exported one yet. `now` is
// injectable (defaults to the real clock) purely so tests can control it.
export function ensureBackupFirstSeenAt(uid, now = Date.now()) {
  if (!uid) return;
  const key = backupFirstSeenAtKey(uid);
  if (!localStorage.getItem(key)) localStorage.setItem(key, String(now));
}

// Called after a real JSON backup download succeeds (never for a CSV export,
// which is one-way/lossy and not a restorable backup) — resets the "how long
// since your last backup" clock.
export function markBackupTaken(uid, now = Date.now()) {
  if (!uid) return;
  localStorage.setItem(lastBackupAtKey(uid), String(now));
}

// Called when the reminder banner is dismissed ("Not now") — starts the
// SNOOZE_AFTER_DISMISS_MS quiet window so closing it once doesn't mean
// closing it forever, but also doesn't bring it right back on the next
// reload.
export function dismissBackupReminder(uid, now = Date.now()) {
  if (!uid) return;
  localStorage.setItem(backupReminderDismissedAtKey(uid), String(now));
}

// `hasRealProgress` mirrors roadmapStore.js's own internal check (custom or
// done items exist) — there's nothing worth backing up on a freshly seeded
// roadmap with zero user changes, so never nag for one.
export function shouldShowBackupReminder(uid, hasRealProgress, now = Date.now()) {
  if (!uid || !hasRealProgress) return false;

  const referenceAt = readTimestamp(lastBackupAtKey(uid)) ?? readTimestamp(backupFirstSeenAtKey(uid)) ?? now;
  if (now - referenceAt < REMINDER_AFTER_MS) return false;

  const dismissedAt = readTimestamp(backupReminderDismissedAtKey(uid));
  if (dismissedAt && now - dismissedAt < SNOOZE_AFTER_DISMISS_MS) return false;

  return true;
}
