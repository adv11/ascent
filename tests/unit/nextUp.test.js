import { describe, it, expect } from 'vitest';
import { selectNextUpTopics, NEXT_UP_LIMIT } from '../../src/core/roadmap/nextUp.js';

function makeItem(overrides = {}) {
  return {
    id: `item-${Math.random()}`,
    title: 'Untitled',
    phase: 'Phase 1',
    priority: 'P1',
    done: false,
    completedAt: null,
    ...overrides
  };
}

describe('selectNextUpTopics', () => {
  it('returns the first three topics of phase 1 on a brand-new roadmap', () => {
    const phases = [{ title: 'Phase 1' }, { title: 'Phase 2' }];
    const items = [
      makeItem({ id: 'a', phase: 'Phase 1' }),
      makeItem({ id: 'b', phase: 'Phase 1' }),
      makeItem({ id: 'c', phase: 'Phase 1' }),
      makeItem({ id: 'd', phase: 'Phase 1' }),
      makeItem({ id: 'e', phase: 'Phase 2' })
    ];
    const { topics, complete } = selectNextUpTopics(items, phases);
    expect(complete).toBe(false);
    expect(topics.map(t => t.id)).toEqual(['a', 'b', 'c']);
  });

  it('returns a completion state on a fully-completed roadmap', () => {
    const phases = [{ title: 'Phase 1' }];
    const items = [
      makeItem({ id: 'a', done: true, completedAt: 1 }),
      makeItem({ id: 'b', done: true, completedAt: 2 })
    ];
    const { topics, complete } = selectNextUpTopics(items, phases);
    expect(complete).toBe(true);
    expect(topics).toEqual([]);
  });

  it('never returns more than three topics', () => {
    const phases = [{ title: 'Phase 1' }];
    const items = Array.from({ length: 10 }, (_, i) => makeItem({ id: `item-${i}`, phase: 'Phase 1' }));
    const { topics } = selectNextUpTopics(items, phases);
    expect(topics.length).toBe(NEXT_UP_LIMIT);
  });

  it('prefers the phase containing the most recently completed topic', () => {
    const phases = [{ title: 'Phase 1' }, { title: 'Phase 2' }];
    const items = [
      makeItem({ id: 'a', phase: 'Phase 1', done: true, completedAt: 100 }),
      makeItem({ id: 'b', phase: 'Phase 2', done: true, completedAt: 200 }),
      makeItem({ id: 'c', phase: 'Phase 1' }),
      makeItem({ id: 'd', phase: 'Phase 2' })
    ];
    const { topics } = selectNextUpTopics(items, phases);
    expect(topics.map(t => t.id)).toEqual(['d']);
  });

  it('falls through to the first unfinished phase once the most-recent phase is fully done', () => {
    const phases = [{ title: 'Phase 1' }, { title: 'Phase 2' }];
    const items = [
      makeItem({ id: 'a', phase: 'Phase 1', done: true, completedAt: 100 }),
      makeItem({ id: 'b', phase: 'Phase 2' })
    ];
    const { topics } = selectNextUpTopics(items, phases);
    expect(topics.map(t => t.id)).toEqual(['b']);
  });

  it('orders Must do before Should do before Later within a phase', () => {
    const phases = [{ title: 'Phase 1' }];
    const items = [
      makeItem({ id: 'later', phase: 'Phase 1', priority: 'P3' }),
      makeItem({ id: 'should', phase: 'Phase 1', priority: 'P1' }),
      makeItem({ id: 'must', phase: 'Phase 1', priority: 'P0' })
    ];
    const { topics } = selectNextUpTopics(items, phases);
    expect(topics.map(t => t.id)).toEqual(['must', 'should', 'later']);
  });

  it('skips excluded topics ("Not today") without marking the roadmap complete', () => {
    const phases = [{ title: 'Phase 1' }];
    const items = [
      makeItem({ id: 'a', phase: 'Phase 1' }),
      makeItem({ id: 'b', phase: 'Phase 1' })
    ];
    const { topics, complete } = selectNextUpTopics(items, phases, { excludeIds: new Set(['a', 'b']) });
    expect(complete).toBe(false);
    expect(topics).toEqual([]);
  });

  it('falls back to source order for topics of the same priority tier', () => {
    const phases = [{ title: 'Phase 1' }];
    const items = [
      makeItem({ id: 'p2-first', phase: 'Phase 1', priority: 'P2' }),
      makeItem({ id: 'p3-second', phase: 'Phase 1', priority: 'P3' }),
      makeItem({ id: 'p2-third', phase: 'Phase 1', priority: 'P2' })
    ];
    const { topics } = selectNextUpTopics(items, phases);
    expect(topics.map(t => t.id)).toEqual(['p2-first', 'p3-second', 'p2-third']);
  });
});
