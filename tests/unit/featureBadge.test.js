import { describe, it, expect } from 'vitest';
import { isFeatureBadgeActive, FEATURE_BADGE_DURATION_MS } from '../../src/core/changelog/featureBadge.js';

describe('isFeatureBadgeActive', () => {
  it('is false when the feature has no introducing changelog entry', () => {
    expect(isFeatureBadgeActive({ introducedVersion: null, lastSeenChangelogVersion: 5, state: null })).toBe(false);
  });

  it('is false when the introducing entry has not been seen yet', () => {
    expect(isFeatureBadgeActive({ introducedVersion: 2, lastSeenChangelogVersion: 1, state: null })).toBe(false);
    expect(isFeatureBadgeActive({ introducedVersion: 2, lastSeenChangelogVersion: null, state: null })).toBe(false);
  });

  it('is true the first time it becomes eligible (no state yet)', () => {
    expect(isFeatureBadgeActive({ introducedVersion: 2, lastSeenChangelogVersion: 2, state: null })).toBe(true);
  });

  it('is true while within the 7-day window since first shown', () => {
    const now = Date.now();
    const state = { firstShownAt: now - 1000, dismissed: false };
    expect(isFeatureBadgeActive({ introducedVersion: 1, lastSeenChangelogVersion: 1, state, now })).toBe(true);
  });

  it('is false once past the 7-day window', () => {
    const now = Date.now();
    const state = { firstShownAt: now - FEATURE_BADGE_DURATION_MS - 1, dismissed: false };
    expect(isFeatureBadgeActive({ introducedVersion: 1, lastSeenChangelogVersion: 1, state, now })).toBe(false);
  });

  it('is false once dismissed, regardless of the time window', () => {
    const now = Date.now();
    const state = { firstShownAt: now - 1000, dismissed: true };
    expect(isFeatureBadgeActive({ introducedVersion: 1, lastSeenChangelogVersion: 1, state, now })).toBe(false);
  });
});
