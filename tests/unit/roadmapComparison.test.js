import { describe, it, expect } from 'vitest';
import { compareRoadmapTopics, groupComparisonByPhase, comparisonKey } from '../../src/core/roadmap/roadmapComparison.js';

function item(overrides) {
  return {
    id: overrides.id || overrides.title,
    title: overrides.title,
    phase: overrides.phase ?? 'Phase 1',
    section: overrides.section ?? 'Section 1',
    done: !!overrides.done,
    deleted: !!overrides.deleted
  };
}

function toMap(items) {
  const map = {};
  items.forEach(i => { map[i.id] = i; });
  return map;
}

describe('comparisonKey', () => {
  it('normalizes phase + title, trimming and lowercasing', () => {
    const a = comparisonKey({ phase: ' Phase One ', title: ' Learn Basics ' });
    const b = comparisonKey({ phase: 'phase one', title: 'learn basics' });
    expect(a).toBe(b);
  });

  it('handles a missing phase/title without throwing', () => {
    expect(comparisonKey({})).toBe('::');
  });
});

describe('compareRoadmapTopics', () => {
  it('matches topics that share the same normalized (phase, title) key', () => {
    const a = toMap([item({ title: 'Learn Basics', done: true })]);
    const b = toMap([item({ id: 'other-id', title: 'learn basics', done: false })]);

    const result = compareRoadmapTopics(a, b);

    expect(result.matched).toHaveLength(1);
    expect(result.onlyInA).toHaveLength(0);
    expect(result.onlyInB).toHaveLength(0);
    expect(result.matched[0].status).toBe('a-only-done');
  });

  it('reports a topic only in A as an addition, and a topic only in B as missing', () => {
    const a = toMap([item({ title: 'Custom Topic' })]);
    const b = toMap([item({ id: 'template-1', title: 'Template Topic' })]);

    const result = compareRoadmapTopics(a, b);

    expect(result.onlyInA).toHaveLength(1);
    expect(result.onlyInA[0].title).toBe('Custom Topic');
    expect(result.onlyInB).toHaveLength(1);
    expect(result.onlyInB[0].title).toBe('Template Topic');
    expect(result.matched).toHaveLength(0);
  });

  it('computes all four match-status buckets correctly', () => {
    const a = toMap([
      item({ id: 'a1', title: 'Both done', done: true }),
      item({ id: 'a2', title: 'A only done', done: true }),
      item({ id: 'a3', title: 'B only done', done: false }),
      item({ id: 'a4', title: 'Neither done', done: false })
    ]);
    const b = toMap([
      item({ id: 'b1', title: 'Both done', done: true }),
      item({ id: 'b2', title: 'A only done', done: false }),
      item({ id: 'b3', title: 'B only done', done: true }),
      item({ id: 'b4', title: 'Neither done', done: false })
    ]);

    const result = compareRoadmapTopics(a, b);

    expect(result.summary).toEqual({
      matchedCount: 4,
      bothDone: 1,
      aOnlyDone: 1,
      bOnlyDone: 1,
      neitherDone: 1,
      onlyInACount: 0,
      onlyInBCount: 0,
      totalTopics: 4
    });
  });

  it('excludes soft-deleted items from both sides', () => {
    const a = toMap([item({ title: 'Gone', deleted: true }), item({ id: 'a2', title: 'Alive' })]);
    const b = toMap([item({ id: 'b1', title: 'Alive' })]);

    const result = compareRoadmapTopics(a, b);

    expect(result.matched).toHaveLength(1);
    expect(result.onlyInA).toHaveLength(0);
    expect(result.onlyInB).toHaveLength(0);
  });

  it('collapses a duplicate (phase, title) pair within the same set to a single row', () => {
    const a = toMap([
      item({ id: 'a1', title: 'Dup' }),
      item({ id: 'a2', title: 'Dup' })
    ]);
    const b = toMap([item({ id: 'b1', title: 'Dup' })]);

    const result = compareRoadmapTopics(a, b);

    expect(result.matched).toHaveLength(1);
    expect(result.onlyInA).toHaveLength(0);
  });

  it('handles two empty item maps without throwing', () => {
    const result = compareRoadmapTopics({}, {});
    expect(result.summary.totalTopics).toBe(0);
  });
});

describe('groupComparisonByPhase', () => {
  it('buckets matched/onlyInA/onlyInB rows by phase, falling back to "Untitled phase"', () => {
    const a = toMap([
      item({ id: 'a1', title: 'X', phase: 'Phase A' }),
      item({ id: 'a2', title: 'Y', phase: '' })
    ]);
    const b = toMap([item({ id: 'b1', title: 'Z', phase: 'Phase A' })]);

    const comparison = compareRoadmapTopics(a, b);
    const groups = groupComparisonByPhase(comparison);

    const phaseA = groups.find(g => g.phase === 'Phase A');
    const untitled = groups.find(g => g.phase === 'Untitled phase');

    expect(phaseA.matched).toHaveLength(0);
    expect(phaseA.onlyInA).toHaveLength(1);
    expect(phaseA.onlyInB).toHaveLength(1);
    expect(untitled.onlyInA).toHaveLength(1);
  });
});
