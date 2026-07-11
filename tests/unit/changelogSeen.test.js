import { describe, it, expect, beforeEach } from 'vitest';
import { getLastSeenChangelogVersion, setLastSeenChangelogVersion } from '../../src/services/changelogSeen.js';
import { KEYS } from '../../src/services/localStorageKeys.js';

describe('changelogSeen', () => {
  beforeEach(() => localStorage.clear());

  it('returns null when nothing has been written yet', () => {
    expect(getLastSeenChangelogVersion()).toBeNull();
  });

  it('round-trips a written version', () => {
    setLastSeenChangelogVersion(3);
    expect(getLastSeenChangelogVersion()).toBe(3);
    expect(localStorage.getItem(KEYS.LAST_SEEN_CHANGELOG_VERSION)).toBe('3');
  });

  it('returns null for a corrupted non-numeric value instead of throwing', () => {
    localStorage.setItem(KEYS.LAST_SEEN_CHANGELOG_VERSION, 'not-a-number');
    expect(getLastSeenChangelogVersion()).toBeNull();
  });
});
