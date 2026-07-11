import { describe, it, expect, beforeEach } from 'vitest';
import { createFeatureBadge } from '../../src/ui/components/featureBadge.js';
import { setLastSeenChangelogVersion } from '../../src/services/changelogSeen.js';
import { getFeatureIntroducedVersion } from '../../src/data/changelog.js';

describe('createFeatureBadge', () => {
  beforeEach(() => localStorage.clear());

  it('returns null when not eligible', () => {
    expect(createFeatureBadge('pwa-install')).toBeNull();
  });

  it('returns a "New" pill once eligible', () => {
    setLastSeenChangelogVersion(getFeatureIntroducedVersion('pwa-install'));
    const node = createFeatureBadge('pwa-install');
    expect(node).not.toBeNull();
    expect(node.className).toBe('feature-new-badge');
    expect(node.textContent).toBe('New');
  });
});
