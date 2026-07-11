import { describe, it, expect } from 'vitest';
import { isNewerVersion, getUnseenEntries, hasUnseenEntries, validateChangelog } from '../../src/core/changelog/version.js';

const CHANGELOG = [
  { version: 1, date: '2026-01-01', items: [{ type: 'feat', title: 'A', description: 'a' }] },
  { version: 2, date: '2026-02-01', items: [{ type: 'fix', title: 'B', description: 'b' }] },
  { version: 3, date: '2026-03-01', items: [{ type: 'improvement', title: 'C', description: 'c' }] }
];

describe('isNewerVersion', () => {
  it('treats a null/undefined lastSeen as older than every version', () => {
    expect(isNewerVersion(1, null)).toBe(true);
    expect(isNewerVersion(1, undefined)).toBe(true);
  });

  it('compares numerically', () => {
    expect(isNewerVersion(3, 2)).toBe(true);
    expect(isNewerVersion(2, 3)).toBe(false);
    expect(isNewerVersion(2, 2)).toBe(false);
  });
});

describe('getUnseenEntries', () => {
  it('returns entries newer than lastSeen, newest first', () => {
    const unseen = getUnseenEntries(CHANGELOG, 1);
    expect(unseen.map(e => e.version)).toEqual([3, 2]);
  });

  it('returns every entry when lastSeen is null', () => {
    expect(getUnseenEntries(CHANGELOG, null).length).toBe(3);
  });

  it('returns an empty array once caught up', () => {
    expect(getUnseenEntries(CHANGELOG, 3)).toEqual([]);
  });
});

describe('hasUnseenEntries', () => {
  it('is true when anything is unseen', () => {
    expect(hasUnseenEntries(CHANGELOG, 2)).toBe(true);
  });

  it('is false once every entry has been seen', () => {
    expect(hasUnseenEntries(CHANGELOG, 3)).toBe(false);
  });
});

describe('validateChangelog', () => {
  it('accepts a well-formed changelog', () => {
    expect(validateChangelog(CHANGELOG)).toEqual([]);
  });

  it('flags a missing required field', () => {
    const errors = validateChangelog([{ version: 1, items: [] }]);
    expect(errors).toContain('entries[0].date is required');
    expect(errors).toContain('entries[0].items must be a non-empty array');
  });

  it('flags an item with an invalid type', () => {
    const errors = validateChangelog([
      { version: 1, date: '2026-01-01', items: [{ type: 'nope', title: 'x', description: 'y' }] }
    ]);
    expect(errors).toContain('entries[0].items[0].type must be one of feat|fix|improvement');
  });
});
