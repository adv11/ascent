import { KEYS } from '../../services/localStorageKeys.js';

// Settings page preference (issue #16, src/ui/pages/settings.js) — pulled out
// into its own tiny module, not left inline in settings.js, specifically so
// dashboard.js's renderDashboard can read it without a page-to-page import
// (same reasoning deleteAccountModal.js was extracted for). Read by
// dashboard.js as a fallback *before* the roadmap's own sticky `ui.filter`
// (KEYS.UI_STATE) — see KEYS.DEFAULT_FILTER's comment.
export function readDefaultFilterPreference() {
  return localStorage.getItem(KEYS.DEFAULT_FILTER) || 'ALL';
}
