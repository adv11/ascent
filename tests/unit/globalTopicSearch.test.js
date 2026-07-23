import { describe, it, expect } from 'vitest';
import { searchTopicsAcrossRoadmaps } from '../../src/core/roadmap/globalTopicSearch.js';

function makeRoadmaps() {
  return [
    {
      id: 'java-backend',
      title: 'Java Backend Engineer',
      items: {
        'item-1': { id: 'item-1', title: 'Spring Boot Basics', phase: 'Core Java', section: 'Frameworks', notes: '', resources: [] },
        'item-2': { id: 'item-2', title: 'Deleted Topic', phase: 'Core Java', section: 'Frameworks', deleted: true }
      }
    },
    {
      id: 'croadmap-123',
      title: 'My roadmap',
      items: {
        'item-3': {
          id: 'item-3',
          title: 'Learn Docker',
          phase: 'Infra',
          section: 'Containers',
          notes: 'Great resource: docs.docker.com',
          resources: [{ label: 'Official docs', url: 'https://docs.docker.com' }]
        }
      }
    }
  ];
}

describe('searchTopicsAcrossRoadmaps', () => {
  it('returns no results for an empty or whitespace query', () => {
    expect(searchTopicsAcrossRoadmaps(makeRoadmaps(), '')).toEqual([]);
    expect(searchTopicsAcrossRoadmaps(makeRoadmaps(), '   ')).toEqual([]);
  });

  it('matches a topic title across roadmaps and carries roadmap/phase context', () => {
    const results = searchTopicsAcrossRoadmaps(makeRoadmaps(), 'spring');
    expect(results).toHaveLength(1);
    expect(results[0]).toMatchObject({
      roadmapId: 'java-backend',
      roadmapTitle: 'Java Backend Engineer',
      itemId: 'item-1',
      itemTitle: 'Spring Boot Basics',
      phase: 'Core Java',
      section: 'Frameworks',
      matchedFields: ['title']
    });
  });

  it('matches a topic in a custom roadmap by title', () => {
    const results = searchTopicsAcrossRoadmaps(makeRoadmaps(), 'docker');
    expect(results.map(r => r.roadmapId)).toEqual(['croadmap-123']);
    expect(results[0].itemTitle).toBe('Learn Docker');
  });

  it('matches on notes and resource label/url, not just title', () => {
    const notesMatch = searchTopicsAcrossRoadmaps(makeRoadmaps(), 'great resource');
    expect(notesMatch).toHaveLength(1);
    expect(notesMatch[0].matchedFields).toContain('notes');

    const resourceMatch = searchTopicsAcrossRoadmaps(makeRoadmaps(), 'official docs');
    expect(resourceMatch).toHaveLength(1);
    expect(resourceMatch[0].matchedFields).toContain('resources');
  });

  it('never returns a soft-deleted item', () => {
    const results = searchTopicsAcrossRoadmaps(makeRoadmaps(), 'deleted topic');
    expect(results).toEqual([]);
  });

  it('ranks a title match above a notes/resource-only match', () => {
    const roadmaps = [{
      id: 'r1',
      title: 'R1',
      items: {
        a: { id: 'a', title: 'Docker basics', phase: 'P', section: 'S', notes: '', resources: [] },
        b: { id: 'b', title: 'Something else', phase: 'P', section: 'S', notes: 'docker deep dive', resources: [] }
      }
    }];
    const results = searchTopicsAcrossRoadmaps(roadmaps, 'docker');
    expect(results.map(r => r.itemId)).toEqual(['a', 'b']);
  });

  it('respects the limit option', () => {
    const items = {};
    for (let i = 0; i < 30; i++) {
      items[`item-${i}`] = { id: `item-${i}`, title: `Topic ${i} search-me`, phase: 'P', section: 'S' };
    }
    const roadmaps = [{ id: 'r1', title: 'R1', items }];
    const results = searchTopicsAcrossRoadmaps(roadmaps, 'search-me', { limit: 5 });
    expect(results).toHaveLength(5);
  });

  it('handles a missing/empty roadmaps array gracefully', () => {
    expect(searchTopicsAcrossRoadmaps(null, 'anything')).toEqual([]);
    expect(searchTopicsAcrossRoadmaps([], 'anything')).toEqual([]);
  });
});
