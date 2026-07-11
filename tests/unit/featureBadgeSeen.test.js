import { describe, it, expect, beforeEach } from 'vitest';
import { shouldShowFeatureBadge, dismissFeatureBadge } from '../../src/services/featureBadgeSeen.js';
import { setLastSeenChangelogVersion } from '../../src/services/changelogSeen.js';
import { getFeatureIntroducedVersion } from '../../src/data/changelog.js';

describe('featureBadgeSeen', () => {
  beforeEach(() => localStorage.clear());

  it('does not show a badge for an unknown featureKey', () => {
    expect(shouldShowFeatureBadge('not-a-real-feature')).toBe(false);
  });

  it('does not show a badge before the introducing changelog entry has been seen', () => {
    expect(shouldShowFeatureBadge('pwa-install')).toBe(false);
  });

  it('shows and then persists the badge once the introducing entry is seen', () => {
    setLastSeenChangelogVersion(getFeatureIntroducedVersion('pwa-install'));
    expect(shouldShowFeatureBadge('pwa-install')).toBe(true);
    // A second call should still be true (within the 7-day window) and not
    // reset firstShownAt on every call.
    expect(shouldShowFeatureBadge('pwa-install')).toBe(true);
  });

  it('dismissFeatureBadge permanently hides it', () => {
    setLastSeenChangelogVersion(getFeatureIntroducedVersion('pwa-install'));
    expect(shouldShowFeatureBadge('pwa-install')).toBe(true);
    dismissFeatureBadge('pwa-install');
    expect(shouldShowFeatureBadge('pwa-install')).toBe(false);
  });
});
