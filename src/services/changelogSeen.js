import { KEYS } from './localStorageKeys.js';

// Thin localStorage read/write pair for the "last changelog version this
// device has opened the bell for" — deliberately not folded into
// roadmapStore.js/dailyTodoStore.js's Store pattern, since this is a single
// device-level number with no subscribe/sync/echo-guard needs, same
// precedent as theme.js's plain getTheme()/setTheme().
export function getLastSeenChangelogVersion() {
  const raw = localStorage.getItem(KEYS.LAST_SEEN_CHANGELOG_VERSION);
  if (raw == null) return null;
  const parsed = Number(raw);
  return Number.isFinite(parsed) ? parsed : null;
}

export function setLastSeenChangelogVersion(version) {
  localStorage.setItem(KEYS.LAST_SEEN_CHANGELOG_VERSION, String(version));
}
