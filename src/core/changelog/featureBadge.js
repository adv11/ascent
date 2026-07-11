// Pure eligibility logic for a changelog-linked "New" feature badge (issue
// #20, Phase C). Separate from version.js since this reasons about a
// *different* axis of "seen" — not "has this changelog version been opened"
// but "has this specific feature's badge already been shown long enough /
// dismissed" — kept pure so it's testable against fixture timestamps
// without touching localStorage or the DOM.

export const FEATURE_BADGE_DURATION_MS = 7 * 24 * 60 * 60 * 1000;

// `introducedVersion` is the changelog `version` of the entry whose item
// carries this featureKey (see changelog.js's getFeatureIntroducedVersion).
// `lastSeenChangelogVersion` is whatever changelogSeen.js currently has.
// `state` is `{ firstShownAt: number | null, dismissed: boolean } | null`
// (null means "never recorded" — same as `{ firstShownAt: null, dismissed:
// false }`). A badge is only ever eligible to show *after* the user has
// opened the drawer and seen the entry that introduces it — never before,
// per the issue's "one session after the user first sees the changelog
// entry that introduces it" wording.
export function isFeatureBadgeActive({ introducedVersion, lastSeenChangelogVersion, state, now = Date.now() }) {
  if (introducedVersion == null) return false;
  if (state?.dismissed) return false;
  if (lastSeenChangelogVersion == null || lastSeenChangelogVersion < introducedVersion) return false;
  const firstShownAt = state?.firstShownAt;
  if (firstShownAt == null) return true;
  return now - firstShownAt < FEATURE_BADGE_DURATION_MS;
}
