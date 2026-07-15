import { describe, it, expect } from 'vitest';
import { isRoadmapComplete, getCompletedPhaseTitles } from '../../src/core/roadmap/completionCelebration.js';

function item(phase, done) {
  return { phase, done };
}

describe('isRoadmapComplete', () => {
  it('is false for an empty roadmap', () => {
    expect(isRoadmapComplete([])).toBe(false);
  });

  it('is false when any item is not done', () => {
    expect(isRoadmapComplete([item('Phase 1', true), item('Phase 1', false)])).toBe(false);
  });

  it('is true when every item is done', () => {
    expect(isRoadmapComplete([item('Phase 1', true), item('Phase 2', true)])).toBe(true);
  });
});

describe('getCompletedPhaseTitles', () => {
  it('returns an empty list when no items exist', () => {
    expect(getCompletedPhaseTitles([])).toEqual([]);
  });

  it('only returns phases where every item is done', () => {
    const items = [
      item('Phase 1', true),
      item('Phase 1', true),
      item('Phase 2', true),
      item('Phase 2', false)
    ];
    expect(getCompletedPhaseTitles(items)).toEqual(['Phase 1']);
  });

  it('excludes phases with no items', () => {
    expect(getCompletedPhaseTitles([item('', true)])).toEqual([]);
  });

  it('returns multiple completed phases', () => {
    const items = [item('Phase 1', true), item('Phase 2', true)];
    expect(getCompletedPhaseTitles(items).sort()).toEqual(['Phase 1', 'Phase 2']);
  });
});
