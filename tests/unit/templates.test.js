import { describe, it, expect } from 'vitest';
import { TEMPLATES, getTemplate, buildSeedItems, getTemplatePhases } from '../../src/data/templates/index.js';
import { buildSeedItems as buildJavaBackendSeedItems, PHASES as JAVA_BACKEND_PHASES } from '../../src/data/templates/java-backend.js';
import { buildSeedItems as buildRoadmapShimSeedItems, PHASES as ROADMAP_SHIM_PHASES } from '../../src/data/roadmap.js';

describe('template registry', () => {
  it('every template has id, name, description, icon, and a buildItems function', () => {
    expect(TEMPLATES.length).toBeGreaterThan(0);
    TEMPLATES.forEach(template => {
      expect(typeof template.id).toBe('string');
      expect(template.id.length).toBeGreaterThan(0);
      expect(typeof template.name).toBe('string');
      expect(typeof template.description).toBe('string');
      expect(typeof template.icon).toBe('string');
      expect(typeof template.buildItems).toBe('function');
    });
  });

  it('has no duplicate template ids', () => {
    const ids = TEMPLATES.map(t => t.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('includes all 8 expected templates', () => {
    const ids = TEMPLATES.map(t => t.id);
    expect(ids).toEqual(expect.arrayContaining([
      'java-backend', 'frontend', 'data-science', 'genai-agentic-ai', 'math-grade12',
      'piano', 'marketing', 'blank'
    ]));
    expect(ids).toHaveLength(8);
  });

  it('getTemplate falls back to the first template for an unknown id', () => {
    expect(getTemplate('does-not-exist')).toBe(TEMPLATES[0]);
    expect(getTemplate(undefined)).toBe(TEMPLATES[0]);
  });
});

describe('buildSeedItems(templateId)', () => {
  it("buildSeedItems('java-backend') matches the original java-backend.js buildSeedItems() (no regression)", async () => {
    const viaRegistry = await buildSeedItems('java-backend');
    const direct = buildJavaBackendSeedItems();
    expect(Object.keys(viaRegistry)).toEqual(Object.keys(direct));
    expect(viaRegistry).toEqual(direct);
  });

  it('the data/roadmap.js backward-compat shim still returns the java-backend roadmap', () => {
    expect(ROADMAP_SHIM_PHASES).toBe(JAVA_BACKEND_PHASES);
    expect(Object.keys(buildRoadmapShimSeedItems()).length).toBe(Object.keys(buildJavaBackendSeedItems()).length);
  });

  it("buildSeedItems('blank') returns zero items", async () => {
    const items = await buildSeedItems('blank');
    expect(items).toEqual({});
  });

  it('every non-blank template returns a non-empty, well-shaped item map', async () => {
    const nonBlankIds = TEMPLATES.map(t => t.id).filter(id => id !== 'blank');
    expect(nonBlankIds.length).toBeGreaterThan(0);
    for (const id of nonBlankIds) {
      const items = await buildSeedItems(id);
      const values = Object.values(items);
      expect(values.length).toBeGreaterThan(0);
      values.forEach(item => {
        expect(item).toMatchObject({
          title: expect.any(String),
          phase: expect.any(String),
          section: expect.any(String),
          priority: expect.any(String),
          done: false,
          custom: false,
          deleted: false
        });
        expect(Array.isArray(item.resources)).toBe(true);
      });
    }
  });
});

describe('getTemplatePhases(templateId)', () => {
  it("getTemplatePhases('blank') returns exactly 4 phases", async () => {
    const phases = await getTemplatePhases('blank');
    expect(phases).toHaveLength(4);
    expect(phases.map(p => p.title)).toEqual(['Learn', 'Practice', 'Build', 'Review']);
  });

  it("getTemplatePhases('java-backend') matches the java-backend module's PHASES export", async () => {
    const phases = await getTemplatePhases('java-backend');
    expect(phases).toBe(JAVA_BACKEND_PHASES);
  });
});
