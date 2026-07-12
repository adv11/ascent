import { describe, it, expect } from 'vitest';
import { adaptImportToRoadmap } from '../../src/core/roadmap/schemaAdapter.js';

function payload(overrides = {}) {
  return {
    schemaVersion: 1,
    title: 'Test Roadmap',
    phases: [
      {
        title: 'Phase One',
        priority: 'P1',
        sections: [
          { title: 'Section One', items: ['Plain item', ['Tuple item', 'P0']] }
        ]
      }
    ],
    ...overrides
  };
}

describe('adaptImportToRoadmap', () => {
  it('produces one phase entry per input phase, with a generated id, title, priority, and null resourceKey', () => {
    const { phases } = adaptImportToRoadmap(payload());
    expect(phases).toHaveLength(1);
    expect(phases[0]).toMatchObject({ title: 'Phase One', priority: 'P1', resourceKey: null });
    expect(phases[0].id).toEqual(expect.any(String));
  });

  it('produces one section entry per input section, with a generated id and title', () => {
    const { phases } = adaptImportToRoadmap(payload());
    expect(phases[0].sections).toHaveLength(1);
    expect(phases[0].sections[0]).toMatchObject({ title: 'Section One' });
    expect(phases[0].sections[0].id).toEqual(expect.any(String));
  });

  it('converts a plain-string item, inheriting the phase priority', () => {
    const { items } = adaptImportToRoadmap(payload());
    const plain = Object.values(items).find(i => i.title === 'Plain item');
    expect(plain).toMatchObject({
      title: 'Plain item',
      phase: 'Phase One',
      section: 'Section One',
      priority: 'P1', // inherited from the phase, not the section
      done: false,
      custom: true,
      deleted: false,
      resources: []
    });
  });

  it('converts a [title, priority] tuple item, using its own priority (not the phase\'s)', () => {
    const { items } = adaptImportToRoadmap(payload());
    const tuple = Object.values(items).find(i => i.title === 'Tuple item');
    expect(tuple).toMatchObject({
      title: 'Tuple item',
      phase: 'Phase One',
      section: 'Section One',
      priority: 'P0'
    });
  });

  it('trims whitespace from item titles', () => {
    const data = payload();
    data.phases[0].sections[0].items = ['  Padded  ', ['  Also padded  ', 'P2']];
    const { items } = adaptImportToRoadmap(data);
    const titles = Object.values(items).map(i => i.title);
    expect(titles).toEqual(['Padded', 'Also padded']);
  });

  it('gives every item a unique id, even for identically-titled items', () => {
    const data = payload();
    data.phases[0].sections[0].items = ['Same title', 'Same title'];
    const { items } = adaptImportToRoadmap(data);
    const ids = Object.keys(items);
    expect(ids).toHaveLength(2);
    expect(ids[0]).not.toBe(ids[1]);
  });

  it('handles multiple phases and multiple sections, keeping items filed under the correct phase/section', () => {
    const data = payload({
      phases: [
        {
          title: 'Phase A',
          priority: 'P0',
          sections: [{ title: 'A1', items: ['a-item'] }]
        },
        {
          title: 'Phase B',
          priority: 'P3',
          sections: [
            { title: 'B1', items: ['b1-item'] },
            { title: 'B2', items: ['b2-item'] }
          ]
        }
      ]
    });
    const { phases, items } = adaptImportToRoadmap(data);
    expect(phases.map(p => p.title)).toEqual(['Phase A', 'Phase B']);
    expect(phases[1].sections.map(s => s.title)).toEqual(['B1', 'B2']);

    const byTitle = Object.fromEntries(Object.values(items).map(i => [i.title, i]));
    expect(byTitle['a-item']).toMatchObject({ phase: 'Phase A', section: 'A1', priority: 'P0' });
    expect(byTitle['b1-item']).toMatchObject({ phase: 'Phase B', section: 'B1', priority: 'P3' });
    expect(byTitle['b2-item']).toMatchObject({ phase: 'Phase B', section: 'B2', priority: 'P3' });
  });

  it('produces an items map keyed by each item\'s own id', () => {
    const { items } = adaptImportToRoadmap(payload());
    Object.entries(items).forEach(([key, item]) => {
      expect(item.id).toBe(key);
    });
  });

  it('generates ids with the phase-/section-/custom- prefixes matching roadmapStore\'s own conventions', () => {
    const { phases, items } = adaptImportToRoadmap(payload());
    expect(phases[0].id).toMatch(/^phase-/);
    expect(phases[0].sections[0].id).toMatch(/^section-/);
    Object.keys(items).forEach(id => expect(id).toMatch(/^custom-/));
  });
});

describe('adaptImportToRoadmap — object-form items with resources (issue #100)', () => {
  it('converts an object item with no priority, inheriting the phase priority', () => {
    const data = payload();
    data.phases[0].sections[0].items = [{ title: 'Learn Docker' }];
    const { items } = adaptImportToRoadmap(data);
    const item = Object.values(items)[0];
    expect(item).toMatchObject({ title: 'Learn Docker', priority: 'P1', resources: [] });
  });

  it('converts an object item with its own priority, not the phase\'s', () => {
    const data = payload();
    data.phases[0].sections[0].items = [{ title: 'Learn Docker', priority: 'P0' }];
    const { items } = adaptImportToRoadmap(data);
    expect(Object.values(items)[0].priority).toBe('P0');
  });

  it('maps resources onto item.resources, trimming labels', () => {
    const data = payload();
    data.phases[0].sections[0].items = [{
      title: 'Learn Docker',
      resources: [
        { label: '  Docker docs  ', url: 'https://docs.docker.com/' },
        { label: 'Crash course', url: 'https://www.youtube.com/watch?v=abc123' }
      ]
    }];
    const { items } = adaptImportToRoadmap(data);
    const item = Object.values(items)[0];
    expect(item.resources).toEqual([
      { label: 'Docker docs', url: 'https://docs.docker.com/' },
      { label: 'Crash course', url: 'https://www.youtube.com/watch?v=abc123' }
    ]);
  });

  it('defaults resources to an empty array when the object item omits it', () => {
    const data = payload();
    data.phases[0].sections[0].items = [{ title: 'Learn Docker' }];
    const { items } = adaptImportToRoadmap(data);
    expect(Object.values(items)[0].resources).toEqual([]);
  });

  it('trims the object item\'s title', () => {
    const data = payload();
    data.phases[0].sections[0].items = [{ title: '  Padded  ' }];
    const { items } = adaptImportToRoadmap(data);
    expect(Object.values(items)[0].title).toBe('Padded');
  });
});

// Issue #100 follow-up: the validator accepts a resource's URL structurally
// (see importValidator.test.js's "priority normalization" and
// "javascript: URL" tests) but doesn't check its protocol or auto-correct a
// missing scheme — that happens here, at conversion time, so a live-tested
// real-world AI response (missing "https://" on some links) imports cleanly
// instead of failing the whole topic.
describe('adaptImportToRoadmap — resource URL sanitization (issue #100 follow-up)', () => {
  it('auto-prepends https:// to a bare-domain resource URL', () => {
    const data = payload();
    data.phases[0].sections[0].items = [{
      title: 'Learn Docker',
      resources: [{ label: 'Docker docs', url: 'docs.docker.com' }]
    }];
    const { items } = adaptImportToRoadmap(data);
    expect(Object.values(items)[0].resources).toEqual([{ label: 'Docker docs', url: 'https://docs.docker.com' }]);
  });

  it('auto-prepends https:// to a bare domain+path resource URL', () => {
    const data = payload();
    data.phases[0].sections[0].items = [{
      title: 'Learn Docker',
      resources: [{ label: 'YouTube', url: 'www.youtube.com/watch?v=abc123' }]
    }];
    const { items } = adaptImportToRoadmap(data);
    expect(Object.values(items)[0].resources).toEqual([{ label: 'YouTube', url: 'https://www.youtube.com/watch?v=abc123' }]);
  });

  it('leaves an already-valid https:// URL untouched', () => {
    const data = payload();
    data.phases[0].sections[0].items = [{
      title: 'Learn Docker',
      resources: [{ label: 'Docs', url: 'https://docs.docker.com/get-started/' }]
    }];
    const { items } = adaptImportToRoadmap(data);
    expect(Object.values(items)[0].resources).toEqual([{ label: 'Docs', url: 'https://docs.docker.com/get-started/' }]);
  });

  it('drops (does not auto-correct) a javascript: resource URL', () => {
    const data = payload();
    data.phases[0].sections[0].items = [{
      title: 'Learn Docker',
      resources: [
        { label: 'Bad link', url: 'javascript:alert(1)' },
        { label: 'Good link', url: 'https://docs.docker.com/' }
      ]
    }];
    const { items } = adaptImportToRoadmap(data);
    expect(Object.values(items)[0].resources).toEqual([{ label: 'Good link', url: 'https://docs.docker.com/' }]);
  });

  it('drops a data: resource URL', () => {
    const data = payload();
    data.phases[0].sections[0].items = [{
      title: 'Learn Docker',
      resources: [{ label: 'Bad link', url: 'data:text/html,<script>alert(1)</script>' }]
    }];
    const { items } = adaptImportToRoadmap(data);
    expect(Object.values(items)[0].resources).toEqual([]);
  });

  it('drops an empty-string resource URL', () => {
    const data = payload();
    data.phases[0].sections[0].items = [{
      title: 'Learn Docker',
      resources: [{ label: 'Empty', url: '   ' }]
    }];
    const { items } = adaptImportToRoadmap(data);
    expect(Object.values(items)[0].resources).toEqual([]);
  });
});

// Issue #100 follow-up: normalize priority casing/whitespace consistently
// with importValidator.js's normalizePriority(), so an item that passed
// validation with "p0"/" P0 " still ends up with the canonical "P0" in the
// store, not a value the rest of the app's priority-based filtering
// wouldn't recognize.
describe('adaptImportToRoadmap — priority normalization (issue #100 follow-up)', () => {
  it('normalizes a lowercase phase priority', () => {
    const data = payload();
    data.phases[0].priority = 'p1';
    const { phases, items } = adaptImportToRoadmap(data);
    expect(phases[0].priority).toBe('P1');
    expect(Object.values(items).find(i => i.title === 'Plain item').priority).toBe('P1');
  });

  it('normalizes a lowercase tuple-item priority', () => {
    const data = payload();
    data.phases[0].sections[0].items = [['Tuple item', 'p0']];
    const { items } = adaptImportToRoadmap(data);
    expect(Object.values(items)[0].priority).toBe('P0');
  });

  it('normalizes a whitespace-padded object-item priority', () => {
    const data = payload();
    data.phases[0].sections[0].items = [{ title: 'Learn Docker', priority: ' p2 ' }];
    const { items } = adaptImportToRoadmap(data);
    expect(Object.values(items)[0].priority).toBe('P2');
  });
});
