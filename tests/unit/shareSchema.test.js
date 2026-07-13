import { describe, it, expect } from 'vitest';
import { buildRoadmapShareSnapshot, SHARE_SCHEMA_VERSION } from '../../src/core/roadmap/shareSchema.js';

function snapshot(overrides = {}) {
  return {
    activeTemplateId: 'java-backend',
    phases: [{ title: 'Core', sections: [{ title: 'Framework' }] }],
    allItems: {
      'item-1': {
        id: 'item-1', title: 'Spring Boot basics', phase: 'Core', section: 'Framework',
        priority: 'P1', done: true, completedAt: 1700000000000,
        resources: [
          { label: 'Docs', url: 'https://example.com' },
          { label: 'Bad', url: 'javascript:alert(1)' }
        ],
        notes: 'Read chapter 2', custom: false, deleted: false, createdAt: 1699999999999
      },
      'item-2': {
        id: 'item-2', title: 'Deleted topic', phase: 'Core', section: 'Framework',
        priority: 'P2', done: false, completedAt: null, resources: [], notes: '',
        custom: true, deleted: true, createdAt: 1699999999999
      }
    },
    ...overrides
  };
}

describe('buildRoadmapShareSnapshot', () => {
  it('produces a versioned, owner-tagged payload', () => {
    const payload = buildRoadmapShareSnapshot(snapshot(), { uid: 'user-123', title: 'My Roadmap' });
    expect(payload.schemaVersion).toBe(SHARE_SCHEMA_VERSION);
    expect(payload.ownerUid).toBe('user-123');
    expect(payload.templateId).toBe('java-backend');
    expect(payload.title).toBe('My Roadmap');
    expect(typeof payload.publishedAt).toBe('number');
  });

  it('strips notes and completedAt even when present on the source item', () => {
    const payload = buildRoadmapShareSnapshot(snapshot(), { uid: 'user-123', title: 'x' });
    const item = payload.items['item-1'];
    expect(item.notes).toBeUndefined();
    expect(item.completedAt).toBeUndefined();
    expect(item).toEqual({
      title: 'Spring Boot basics',
      phase: 'Core',
      section: 'Framework',
      priority: 'P1',
      done: true,
      resources: [{ label: 'Docs', url: 'https://example.com' }]
    });
  });

  it('drops resources with an invalid URL protocol', () => {
    const payload = buildRoadmapShareSnapshot(snapshot(), { uid: 'user-123', title: 'x' });
    expect(payload.items['item-1'].resources).toHaveLength(1);
    expect(payload.items['item-1'].resources[0].url).toBe('https://example.com');
  });

  it('excludes soft-deleted items', () => {
    const payload = buildRoadmapShareSnapshot(snapshot(), { uid: 'user-123', title: 'x' });
    expect(payload.items['item-2']).toBeUndefined();
  });

  it('caps the title length and falls back to a default when missing', () => {
    const long = 'x'.repeat(300);
    const payload = buildRoadmapShareSnapshot(snapshot(), { uid: 'user-123', title: long });
    expect(payload.title).toHaveLength(200);

    const fallback = buildRoadmapShareSnapshot(snapshot(), { uid: 'user-123', title: '' });
    expect(fallback.title).toBe('My roadmap');
  });
});
