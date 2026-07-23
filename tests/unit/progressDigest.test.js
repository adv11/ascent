import { describe, it, expect, beforeEach } from 'vitest';
import {
  shouldShowProgressDigest,
  markProgressDigestShown,
  DIGEST_INTERVAL_MS
} from '../../src/ui/utils/progressDigest.js';

const UID = 'user-123';
const NOW = 1_800_000_000_000;

beforeEach(() => {
  localStorage.clear();
});

describe('shouldShowProgressDigest', () => {
  it('never shows for a signed-out user', () => {
    expect(shouldShowProgressDigest(null, NOW)).toBe(false);
    expect(shouldShowProgressDigest(undefined, NOW)).toBe(false);
  });

  it('shows the first time it is ever checked for an account', () => {
    expect(shouldShowProgressDigest(UID, NOW)).toBe(true);
  });

  it('stays hidden for a full week after being marked shown', () => {
    markProgressDigestShown(UID, NOW);
    expect(shouldShowProgressDigest(UID, NOW + 1)).toBe(false);
    expect(shouldShowProgressDigest(UID, NOW + DIGEST_INTERVAL_MS - 1)).toBe(false);
  });

  it('shows again once the full interval has elapsed', () => {
    markProgressDigestShown(UID, NOW);
    expect(shouldShowProgressDigest(UID, NOW + DIGEST_INTERVAL_MS)).toBe(true);
    expect(shouldShowProgressDigest(UID, NOW + DIGEST_INTERVAL_MS + 1)).toBe(true);
  });

  it('keeps two different accounts on this device fully independent', () => {
    markProgressDigestShown('user-a', NOW);
    expect(shouldShowProgressDigest('user-a', NOW + 1)).toBe(false);
    expect(shouldShowProgressDigest('user-b', NOW + 1)).toBe(true);
  });
});

describe('markProgressDigestShown', () => {
  it('is a no-op for a signed-out user (nothing to key the timestamp to)', () => {
    markProgressDigestShown(null, NOW);
    expect(shouldShowProgressDigest(null, NOW + 1)).toBe(false);
  });

  it('overwrites an earlier timestamp with a later one', () => {
    markProgressDigestShown(UID, NOW);
    markProgressDigestShown(UID, NOW + 100);
    expect(shouldShowProgressDigest(UID, NOW + DIGEST_INTERVAL_MS)).toBe(false);
    expect(shouldShowProgressDigest(UID, NOW + 100 + DIGEST_INTERVAL_MS)).toBe(true);
  });
});
