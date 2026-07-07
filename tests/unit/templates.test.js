import { describe, it, expect } from 'vitest';
import { TEMPLATES, getTemplate, buildSeedItems, getTemplatePhases, getLegacyBlankTemplateData } from '../../src/data/templates/index.js';
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

  it('includes all 7 expected templates', () => {
    const ids = TEMPLATES.map(t => t.id);
    expect(ids).toEqual(expect.arrayContaining([
      'java-backend', 'frontend', 'data-science', 'genai-agentic-ai', 'math-grade12',
      'piano', 'marketing'
    ]));
    expect(ids).toHaveLength(7);
  });

  // 'blank' was retired (issue #4 follow-up) — it was a strict subset of
  // "Create your own roadmap" once manual CRUD + AI import both existed.
  // getTemplate/buildSeedItems/getTemplatePhases fall back to TEMPLATES[0]
  // for it now, exactly like any other unrecognized id.
  it('"blank" is no longer in the registry and falls back like any unknown id', () => {
    expect(TEMPLATES.map(t => t.id)).not.toContain('blank');
    expect(getTemplate('blank')).toBe(TEMPLATES[0]);
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

  it('every registered template returns a non-empty, well-shaped item map', async () => {
    const ids = TEMPLATES.map(t => t.id);
    expect(ids.length).toBeGreaterThan(0);
    for (const id of ids) {
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
  it("getTemplatePhases('blank') no longer returns blank's own phases (falls back to TEMPLATES[0])", async () => {
    const phases = await getTemplatePhases('blank');
    expect(phases).toBe(JAVA_BACKEND_PHASES);
  });

  it("getTemplatePhases('java-backend') matches the java-backend module's PHASES export", async () => {
    const phases = await getTemplatePhases('java-backend');
    expect(phases).toBe(JAVA_BACKEND_PHASES);
  });
});

// blank.js itself is untouched and still directly importable — only its
// registration in TEMPLATES was removed. roadmapStore.js's setUser()
// migration for pre-retirement 'blank' accounts depends on this.
describe('getLegacyBlankTemplateData (migration-only, issue #4 follow-up)', () => {
  it("returns blank.js's own 4 fixed phases and empty seed, bypassing the TEMPLATES fallback", async () => {
    const { baseItems, phases } = await getLegacyBlankTemplateData();
    expect(baseItems).toEqual({});
    expect(phases).toHaveLength(4);
    expect(phases.map(p => p.title)).toEqual(['Learn', 'Practice', 'Build', 'Review']);
  });
});
