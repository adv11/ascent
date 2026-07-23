import { progressDigestLastShownKey } from '../../services/localStorageKeys.js';

// Weekly progress digest gating (issue #284) — "once per calendar week,
// whichever is less naggy" per the issue's own scope, so this is a rolling
// 7-day interval rather than a per-session flag. Kept as its own small
// module (mirroring backupReminder.js's split from backupReminderBanner.js)
// so the gating logic can be unit tested independent of any DOM rendering.
export const DIGEST_INTERVAL_MS = 7 * 24 * 60 * 60 * 1000;

function readTimestamp(uid) {
  const raw = localStorage.getItem(progressDigestLastShownKey(uid));
  const parsed = raw ? Number(raw) : NaN;
  return Number.isFinite(parsed) ? parsed : null;
}

// Whether the digest banner is allowed to appear this session — never shown
// before, or the last time it was shown is at least a full week ago. `now`
// is injectable purely so tests can control the clock.
export function shouldShowProgressDigest(uid, now = Date.now()) {
  if (!uid) return false;
  const lastShown = readTimestamp(uid);
  if (lastShown == null) return true;
  return now - lastShown >= DIGEST_INTERVAL_MS;
}

// Called the moment the banner actually renders (see progressDigestBanner.js)
// — not on dismissal specifically, since a reload within the same week must
// not re-show it whether or not the user clicked "Dismiss" first.
export function markProgressDigestShown(uid, now = Date.now()) {
  if (!uid) return;
  localStorage.setItem(progressDigestLastShownKey(uid), String(now));
}
