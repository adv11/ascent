import { describe, it, expect } from 'vitest';
import { pickCustomRoadmapIcon } from '../../src/ui/utils/customRoadmapIcon.js';

describe('pickCustomRoadmapIcon', () => {
  it('is deterministic — same id always yields the same icon', () => {
    const first = pickCustomRoadmapIcon('croadmap-1700000000-abc123');
    const second = pickCustomRoadmapIcon('croadmap-1700000000-abc123');
    expect(first).toBe(second);
  });

  it('returns a non-empty string for any id', () => {
    expect(typeof pickCustomRoadmapIcon('croadmap-1-a')).toBe('string');
    expect(pickCustomRoadmapIcon('croadmap-1-a').length).toBeGreaterThan(0);
  });

  it('differing ids commonly resolve to different icons', () => {
    const icons = new Set([
      pickCustomRoadmapIcon('croadmap-1-aws'),
      pickCustomRoadmapIcon('croadmap-2-kubernetes'),
      pickCustomRoadmapIcon('croadmap-3-interview-prep')
    ]);
    expect(icons.size).toBeGreaterThan(1);
  });

  it('handles a missing/undefined id without throwing', () => {
    expect(() => pickCustomRoadmapIcon(undefined)).not.toThrow();
    expect(typeof pickCustomRoadmapIcon(undefined)).toBe('string');
  });
});
