import { KEYS } from './localStorageKeys.js';
import { getFeatureIntroducedVersion } from '../data/changelog.js';
import { isFeatureBadgeActive } from '../core/changelog/featureBadge.js';
import { getLastSeenChangelogVersion } from './changelogSeen.js';

// Device-level localStorage read/write for Phase C (issue #20) "New" feature
// badges — a thin wrapper the same shape as changelogSeen.js, kept separate
// since it stores a per-featureKey map rather than a single number.
function readState() {
  try {
    return JSON.parse(localStorage.getItem(KEYS.FEATURE_BADGE_STATE)) || {};
  } catch {
    return {};
  }
}

function writeState(state) {
  localStorage.setItem(KEYS.FEATURE_BADGE_STATE, JSON.stringify(state));
}

// Returns whether `featureKey`'s "New" badge should render right now, and
// records `firstShownAt` the first time it becomes eligible (so the 7-day
// window starts counting from the first real render, not from whenever this
// happens to be called again). Safe to call on every render — a no-op write
// once `firstShownAt` is already set.
export function shouldShowFeatureBadge(featureKey) {
  const introducedVersion = getFeatureIntroducedVersion(featureKey);
  const lastSeenChangelogVersion = getLastSeenChangelogVersion();
  const state = readState();
  const entry = state[featureKey] || null;
  const active = isFeatureBadgeActive({ introducedVersion, lastSeenChangelogVersion, state: entry });
  if (active && entry?.firstShownAt == null) {
    writeState({ ...state, [featureKey]: { firstShownAt: Date.now(), dismissed: false } });
  }
  return active;
}

// Called the moment the user interacts with the badged feature itself
// (issue #20: "auto-dismisses after the user interacts with the feature").
export function dismissFeatureBadge(featureKey) {
  const state = readState();
  const entry = state[featureKey] || { firstShownAt: Date.now(), dismissed: false };
  writeState({ ...state, [featureKey]: { ...entry, dismissed: true } });
}
