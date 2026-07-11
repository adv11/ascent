// Local calendar-day key (YYYY-MM-DD) — the single source of truth for "which
// day did this happen on" shared by activityLogStore.js's
// recordCompletion/recordUncompletion and every analyticsEngine submodule
// below (issue #8). Deliberately local time, not UTC: a completion at
// 11:30pm must land on the same day a user would call "today", and streaks/
// heatmap/velocity would silently disagree with the store that feeds them if
// each computed day boundaries a different way.
export function dateKey(timestamp = Date.now()) {
  const d = new Date(timestamp);
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

// One calendar day earlier than `key` (a `dateKey()` string), used to walk
// backward through a streak/heatmap without re-deriving a Date each time.
export function previousDateKey(key) {
  const [year, month, day] = key.split('-').map(Number);
  const d = new Date(year, month - 1, day);
  d.setDate(d.getDate() - 1);
  return dateKey(d.getTime());
}

// Parses a `dateKey()` string back into a local-time `Date` — never
// `new Date(dateKeyStr)` directly, which the spec parses as UTC midnight for
// a bare YYYY-MM-DD string and can shift the apparent weekday/month for any
// reader west of UTC.
export function parseDateKey(key) {
  const [year, month, day] = key.split('-').map(Number);
  return new Date(year, month - 1, day);
}

// Shared short month names — used anywhere a dateKey needs a human label
// (the heatmap's month row, chart axis labels), so the abbreviation never
// drifts between call sites.
export const MONTH_ABBR = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
