export const KEYS = {
  THEME: 'ascent-theme',
  // Pre-#58 single-roadmap blob. Never written to anymore — read once by
  // roadmapStore's migration into ROADMAPS, then left in place untouched.
  ROADMAP: 'ascent-roadmap-v3',
  // { [templateId]: { version, dirty, items } } — one entry per started template.
  ROADMAPS: 'ascent-roadmaps-v1',
  UI_STATE: 'ascent-ui-v3',
  ONBOARDING_DONE: 'ascent-onboarding-done',
  // First-time feature tour (issue #17) — distinct from ONBOARDING_DONE
  // (#51's template-picker completion flag). Account-scoped, synced via
  // Firebase meta the same way ONBOARDING_DONE is, with this as the local
  // fallback — never written 'false', same "only ever persist a positive
  // state" precedent as ONBOARDING_DONE (its absence already means "not
  // done", so there's nothing useful to write on the false path).
  TOUR_DONE: 'ascent-tour-done',
  // Now means the *active* template id (issue #58) — the one currently displayed.
  TEMPLATE_ID: 'ascent-template-id',
  HIDDEN_TEMPLATES: 'ascent-hidden-templates',
  // Array of { id, title, description, createdAt } — one entry per roadmap the
  // user has created manually (issue #4). Each entry's `id` also appears in
  // KEYS.ROADMAPS/startedTemplateIds like any built-in template id.
  CUSTOM_ROADMAPS: 'ascent-custom-roadmaps-v1',
  // Array of up to 3 roadmap ids (built-in template or `croadmap-...`,
  // issue #177) the user has starred as favorites on the onboarding picker.
  FAVORITE_ROADMAPS: 'ascent-favorite-roadmaps-v1',
  // Dedicated store for LocalStorageAdapter (issue #5) — a standalone
  // StorageAdapter implementation, separate from roadmapStore's own
  // ROADMAPS/ONBOARDING_DONE/etc. local-cache bookkeeping above. Not yet
  // wired into roadmapStore; reserved for a future guest-only/offline-cache
  // adapter selection.
  LOCAL_ADAPTER_ROADMAPS: 'ascent-local-adapter-roadmaps-v1',
  LOCAL_ADAPTER_META: 'ascent-local-adapter-meta-v1',
  // { [todoId]: {...} } — Daily Todos (issue #56), a separate rolling-deadline
  // list stored independently of the roadmap stores above.
  DAILY_TODOS: 'ascent-daily-todos-v1',
  // { [YYYY-MM-DD]: count } — daily completion counts (issue #8), a separate
  // account-scoped synced store from the roadmap items above, following the
  // same DAILY_TODOS pattern (not per-uid keyed, since it's one value per
  // account, synced to Firebase, same as DAILY_TODOS). Survives an item
  // later being unchecked — see activityLogStore.js.
  ACTIVITY_LOG: 'ascent-activity-log-v1',
  // { available, usedDates, lastGrantedAt } — streak freeze / grace-day state
  // (issue #179), synced the same way ACTIVITY_LOG is (account-scoped, not
  // per-uid keyed) — see activityLogStore.js.
  STREAK_FREEZES: 'ascent-streak-freezes-v1',
  // Collapse/expand state of the Today's Todos panel (issue #83) — a purely
  // cosmetic, device-level preference, not account data, so it follows
  // THEME's pattern (plain localStorage, read/written directly by the
  // component, never cleared on sign-out) rather than UI_STATE's per-account
  // pattern (owned by roadmapStore.js, cleared by clearLocal() on sign-out).
  DAILY_TODOS_COLLAPSED: 'ascent-daily-todos-collapsed',
  // Manual desktop icon-rail collapse for .app-sidebar (issue #6 Phase 2) — a
  // device-level cosmetic preference, same pattern as DAILY_TODOS_COLLAPSED
  // above (not per-account, never cleared on sign-out). Independent of the
  // automatic tablet-width icon-rail breakpoint, which is CSS-only and not
  // persisted.
  SIDEBAR_COLLAPSED: 'ascent-sidebar-collapsed',
  // Settings page preference (issue #16) — which priority filter chip
  // dashboard.js's renderDashboard starts on, read as a fallback *before*
  // the roadmap's own sticky `ui.filter` (KEYS.UI_STATE) so it only actually
  // takes effect the first time a roadmap is opened, before the user has
  // ever changed the filter themselves. Device-level, same pattern as THEME
  // (not cleared on sign-out, not synced to Firebase).
  DEFAULT_FILTER: 'ascent-default-filter',
  // One-shot cross-page signal (issue #8): progress.js's phase-breakdown row
  // click writes the target phase title here just before navigating to
  // `#/app`; dashboard.js reads and immediately clears it on its next mount
  // to open + scroll to that phase. sessionStorage, not localStorage — same
  // "read once, then clear" precedent as verificationBanner.js's dismiss key.
  SCROLL_TO_PHASE: 'ascent-scroll-to-phase',
  // In-app feedback widget (issue #9) — a half-written report so a modal
  // closed mid-fill is never lost, and a client-side submission-log rate
  // limiter. Both device-level (not synced to Firebase, not cleared on
  // sign-out) since a report is a one-shot action, not account state.
  FEEDBACK_DRAFT: 'ascent-feedback-draft',
  FEEDBACK_RATE: 'ascent-feedback-rate',
  // PWA install prompt (issue #19) — set once the app is installed, or the
  // user dismisses the banner, so it never reappears. Device-level (each
  // device installs independently), not synced to Firebase.
  PWA_INSTALL_DISMISSED: 'ascent-pwa-install-dismissed',
  // What's New changelog (issue #20) — the highest changelog.json `version`
  // the notification bell has already been opened for on this device. A
  // missing key means "never seen any version" (pre-#20 device, or fresh
  // install), so every entry is unread. Device-level, same pattern as THEME
  // (not per-account, never cleared on sign-out) since "have I clicked the
  // bell on this browser" is a device fact, not an account one.
  LAST_SEEN_CHANGELOG_VERSION: 'ascent-last-seen-version',
  // "New" feature badges (issue #20 Phase C) — `{ [featureKey]: { firstShownAt: number, dismissed: boolean } }`.
  // Device-level, same reasoning as LAST_SEEN_CHANGELOG_VERSION above.
  FEATURE_BADGE_STATE: 'ascent-feature-badge-state',
  // Daily Todo local reminder opt-in (issue #132) — 'true' only once the
  // user has explicitly opted in AND Notification.requestPermission()
  // actually granted. Device-level (a single-device, best-effort reminder,
  // no cross-device push — see .claude/rules/roadmap-store.md), same
  // pattern as DAILY_TODOS_COLLAPSED.
  DAILY_TODO_REMINDERS_ENABLED: 'ascent-daily-todo-reminders-enabled'
};

export function verifyDismissedKey(uid) {
  return `ascent-verify-dismissed-${uid}`;
}

// Backup-reminder bookkeeping (issue #18 follow-up) — three small per-uid
// timestamps, same keyed-by-uid pattern as verifyDismissedKey above (not a
// fixed KEYS entry, since there's one value per account, not per device).
// Device-level, never synced to Firebase or cleared on sign-out — a purely
// local nudge, same precedent as DAILY_TODOS_COLLAPSED/SIDEBAR_COLLAPSED,
// and harmless to leave behind since it's namespaced by uid already.
export function backupFirstSeenAtKey(uid) {
  return `ascent-backup-first-seen-${uid}`;
}

export function lastBackupAtKey(uid) {
  return `ascent-last-backup-at-${uid}`;
}

export function backupReminderDismissedAtKey(uid) {
  return `ascent-backup-reminder-dismissed-${uid}`;
}

// Guest data-risk nudge (issue #123) — a one-shot dismiss-and-remember flag,
// same per-uid keyed pattern as the backup-reminder timestamps above.
// Device-level: if a guest clears storage, this flag is gone too, but so is
// everything else the nudge exists to warn about, so re-showing it once more
// on a cleared device is harmless.
export function guestRiskNudgeShownKey(uid) {
  return `ascent-guest-risk-nudge-shown-${uid}`;
}

// Phase/roadmap completion celebration (issue #181) — a one-shot "have we
// already celebrated this" flag, same per-uid keyed pattern as
// guestRiskNudgeShownKey above. Value is
// `{ [templateId]: { roadmap: true, phases: ["Phase title", ...] } }`.
// Device-level only, not synced to Firebase: re-showing the celebration once
// more on a different device for a roadmap finished elsewhere is harmless,
// and this mirrors every other "already dismissed" flag in this file.
export function celebrationShownKey(uid) {
  return `ascent-celebration-shown-${uid}`;
}

// Weekly progress digest (issue #284) — the timestamp the digest banner was
// last shown, same per-uid keyed pattern as the backup-reminder timestamps
// above (one value per account, not per device). Device-level, not synced to
// Firebase: re-showing the digest once more on a different device is
// harmless, same reasoning every other "already shown" flag in this file
// uses. Written both when the banner renders (so a reload within the same
// period doesn't show it again) and left untouched if there was nothing
// worth summarizing that week (see `hasDigestContent()` in
// `src/core/analytics/progressDigest.js`), so the banner can still appear
// the moment there's real activity to report.
export function progressDigestLastShownKey(uid) {
  return `ascent-progress-digest-last-shown-${uid}`;
}
