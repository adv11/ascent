import { describe, it, expect } from 'vitest';
import { APP_VERSION, CHANGELOG, getUnseenChangelogEntries, hasUnseenChangelog } from '../../src/data/changelog.js';
import { validateChangelog } from '../../src/core/changelog/version.js';

describe('changelog.json', () => {
  it('validates against the schema', () => {
    expect(validateChangelog(CHANGELOG)).toEqual([]);
  });

  it('APP_VERSION matches the highest entry version', () => {
    expect(APP_VERSION).toBe(Math.max(...CHANGELOG.map(e => e.version)));
  });

  it('every entry has a unique version', () => {
    const versions = CHANGELOG.map(e => e.version);
    expect(new Set(versions).size).toBe(versions.length);
  });
});

describe('getUnseenChangelogEntries/hasUnseenChangelog', () => {
  it('reports nothing unseen once caught up to APP_VERSION', () => {
    expect(hasUnseenChangelog(APP_VERSION)).toBe(false);
    expect(getUnseenChangelogEntries(APP_VERSION)).toEqual([]);
  });

  it('reports everything unseen for a device that has never seen the changelog', () => {
    expect(hasUnseenChangelog(null)).toBe(true);
    expect(getUnseenChangelogEntries(null).length).toBe(CHANGELOG.length);
  });
});
