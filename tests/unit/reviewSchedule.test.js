import { describe, it, expect } from 'vitest';
import { isReviewDue, getReviewDueItems, groupReviewDueItemsByTag, REVIEW_INTERVAL_MS } from '../../src/core/roadmap/reviewSchedule.js';

const DAY = 24 * 60 * 60 * 1000;

function makeItem(overrides = {}) {
  return {
    id: 'item-1',
    done: true,
    deleted: false,
    completedAt: Date.now(),
    lastReviewedAt: null,
    ...overrides
  };
}

describe('isReviewDue / getReviewDueItems', () => {
  it('is not due for a topic completed just now', () => {
    const now = Date.now();
    expect(isReviewDue(makeItem({ completedAt: now }), now)).toBe(false);
  });

  it('is due for a topic completed 20 days ago and never reviewed', () => {
    const now = Date.now();
    expect(isReviewDue(makeItem({ completedAt: now - 20 * DAY }), now)).toBe(true);
  });

  it('is not due for a topic completed 20 days ago but reviewed 5 days ago', () => {
    const now = Date.now();
    expect(isReviewDue(makeItem({ completedAt: now - 20 * DAY, lastReviewedAt: now - 5 * DAY }), now)).toBe(false);
  });

  it('is due again for a topic completed 20 days ago and reviewed 20 days ago', () => {
    const now = Date.now();
    expect(isReviewDue(makeItem({ completedAt: now - 20 * DAY, lastReviewedAt: now - 20 * DAY }), now)).toBe(true);
  });

  it('excludes a soft-deleted item regardless of dates', () => {
    const now = Date.now();
    expect(isReviewDue(makeItem({ completedAt: now - 20 * DAY, deleted: true }), now)).toBe(false);
  });

  it('excludes an item that is not done', () => {
    const now = Date.now();
    expect(isReviewDue(makeItem({ completedAt: now - 20 * DAY, done: false }), now)).toBe(false);
  });

  it('excludes an item with no completedAt', () => {
    const now = Date.now();
    expect(isReviewDue(makeItem({ completedAt: null }), now)).toBe(false);
  });

  it('is due exactly at the interval boundary', () => {
    const now = Date.now();
    expect(isReviewDue(makeItem({ completedAt: now - REVIEW_INTERVAL_MS }), now)).toBe(true);
  });

  it('getReviewDueItems filters a mixed list', () => {
    const now = Date.now();
    const items = [
      makeItem({ id: 'a', completedAt: now }),
      makeItem({ id: 'b', completedAt: now - 20 * DAY }),
      makeItem({ id: 'c', completedAt: now - 20 * DAY, deleted: true }),
      makeItem({ id: 'd', completedAt: now - 20 * DAY, lastReviewedAt: now - 5 * DAY })
    ];
    expect(getReviewDueItems(items, now).map(i => i.id)).toEqual(['b']);
  });
});

describe('groupReviewDueItemsByTag (issue #182)', () => {
  it('groups items that share a tag together', () => {
    const now = Date.now();
    const items = [
      makeItem({ id: 'a', completedAt: now - 20 * DAY, tags: ['two-pointer'] }),
      makeItem({ id: 'b', completedAt: now - 20 * DAY, tags: ['two-pointer'] })
    ];
    const groups = groupReviewDueItemsByTag(items, now);
    expect(groups).toEqual([{ tag: 'two-pointer', items: items }]);
  });

  it('renders an item with no tags as its own singleton group', () => {
    const now = Date.now();
    const items = [makeItem({ id: 'a', completedAt: now - 20 * DAY, tags: [] })];
    expect(groupReviewDueItemsByTag(items, now)).toEqual([{ tag: null, items }]);
  });

  it('renders an item whose tag no other due item shares as a singleton', () => {
    const now = Date.now();
    const items = [
      makeItem({ id: 'a', completedAt: now - 20 * DAY, tags: ['unique-tag'] }),
      makeItem({ id: 'b', completedAt: now - 20 * DAY, tags: ['shared'] }),
      makeItem({ id: 'c', completedAt: now - 20 * DAY, tags: ['shared'] })
    ];
    const groups = groupReviewDueItemsByTag(items, now);
    expect(groups).toContainEqual({ tag: null, items: [items[0]] });
    expect(groups).toContainEqual({ tag: 'shared', items: [items[1], items[2]] });
  });

  it('a multi-tag item appears in each group its tags are shared in', () => {
    const now = Date.now();
    const a = makeItem({ id: 'a', completedAt: now - 20 * DAY, tags: ['x', 'y'] });
    const b = makeItem({ id: 'b', completedAt: now - 20 * DAY, tags: ['x'] });
    const c = makeItem({ id: 'c', completedAt: now - 20 * DAY, tags: ['y'] });
    const groups = groupReviewDueItemsByTag([a, b, c], now);
    const tagX = groups.find(g => g.tag === 'x');
    const tagY = groups.find(g => g.tag === 'y');
    expect(tagX.items.map(i => i.id)).toEqual(['a', 'b']);
    expect(tagY.items.map(i => i.id)).toEqual(['a', 'c']);
  });
});
