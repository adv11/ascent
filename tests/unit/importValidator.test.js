import { describe, it, expect } from 'vitest';
import { parseImportJson, validateImportPayload, validateImportText, SUPPORTED_SCHEMA_VERSION } from '../../src/core/roadmap/importValidator.js';

function validPayload() {
  return {
    schemaVersion: SUPPORTED_SCHEMA_VERSION,
    title: 'Test Roadmap',
    phases: [
      {
        title: 'Phase One',
        priority: 'P1',
        sections: [
          {
            title: 'Section One',
            items: ['Plain item', ['Tuple item', 'P0']]
          }
        ]
      }
    ]
  };
}

describe('parseImportJson', () => {
  it('parses valid JSON', () => {
    const result = parseImportJson('{"a": 1}');
    expect(result.error).toBeNull();
    expect(result.data).toEqual({ a: 1 });
  });

  it('returns a friendly error for invalid JSON', () => {
    const result = parseImportJson('{not valid json');
    expect(result.data).toBeNull();
    expect(result.error).toBe('Invalid JSON — check for missing commas or brackets');
  });

  it('strips a ```json fenced code block before parsing', () => {
    const result = parseImportJson('```json\n{"a": 1}\n```');
    expect(result.error).toBeNull();
    expect(result.data).toEqual({ a: 1 });
  });

  it('strips a bare ``` fenced code block (no language tag) before parsing', () => {
    const result = parseImportJson('```\n{"a": 1}\n```');
    expect(result.error).toBeNull();
    expect(result.data).toEqual({ a: 1 });
  });

  it('still returns the friendly error for a genuinely invalid payload after stripping fences', () => {
    const result = parseImportJson('```json\n{not valid json\n```');
    expect(result.data).toBeNull();
    expect(result.error).toBe('Invalid JSON — check for missing commas or brackets');
  });
});

describe('validateImportPayload — happy path', () => {
  it('accepts a valid payload with no errors', () => {
    expect(validateImportPayload(validPayload())).toEqual([]);
  });

  it('accepts a plain-string item (inherits phase priority) and a [title, priority] tuple item', () => {
    const data = validPayload();
    data.phases[0].sections[0].items = ['Plain', ['Tuple', 'P3']];
    expect(validateImportPayload(data)).toEqual([]);
  });

  it('accepts multiple phases, each with multiple sections', () => {
    const data = validPayload();
    data.phases.push({
      title: 'Phase Two',
      priority: 'P2',
      sections: [
        { title: 'S1', items: ['A'] },
        { title: 'S2', items: ['B', 'C'] }
      ]
    });
    expect(validateImportPayload(data)).toEqual([]);
  });
});

describe('validateImportPayload — top-level shape', () => {
  it('rejects null', () => {
    expect(validateImportPayload(null)).toEqual(['Invalid JSON — check for missing commas or brackets']);
  });

  it('rejects an array at the top level', () => {
    expect(validateImportPayload([])).toEqual(['Invalid JSON — check for missing commas or brackets']);
  });

  it('rejects a non-object primitive', () => {
    expect(validateImportPayload('a string')).toEqual(['Invalid JSON — check for missing commas or brackets']);
  });

  it('flags an unsupported schemaVersion', () => {
    const data = { ...validPayload(), schemaVersion: 2 };
    expect(validateImportPayload(data)).toContain('Unsupported schema version');
  });

  it('flags a missing schemaVersion', () => {
    const data = validPayload();
    delete data.schemaVersion;
    expect(validateImportPayload(data)).toContain('Unsupported schema version');
  });

  it('flags a missing title', () => {
    const data = validPayload();
    delete data.title;
    expect(validateImportPayload(data)).toContain('title is required');
  });

  it('flags an empty/whitespace-only title', () => {
    const data = { ...validPayload(), title: '   ' };
    expect(validateImportPayload(data)).toContain('title is required');
  });

  it('flags a non-string title', () => {
    const data = { ...validPayload(), title: 42 };
    expect(validateImportPayload(data)).toContain('title is required');
  });

  it('flags a missing phases array and stops further validation', () => {
    const data = validPayload();
    delete data.phases;
    expect(validateImportPayload(data)).toEqual(['roadmap must have at least one phase']);
  });

  it('flags an empty phases array', () => {
    const data = { ...validPayload(), phases: [] };
    expect(validateImportPayload(data)).toContain('roadmap must have at least one phase');
  });
});

describe('validateImportPayload — phase-level', () => {
  it('flags a non-object phase entry', () => {
    const data = { ...validPayload(), phases: ['not an object'] };
    expect(validateImportPayload(data)).toContain('phases[0] is invalid');
  });

  it('flags a phase missing a title', () => {
    const data = validPayload();
    delete data.phases[0].title;
    expect(validateImportPayload(data)).toContain('phases[0].title is required');
  });

  it('flags a phase with an invalid priority', () => {
    const data = validPayload();
    data.phases[0].priority = 'URGENT';
    expect(validateImportPayload(data)).toContain('phases[0].priority must be one of P0, P1, P2, P3');
  });

  it('flags a phase missing sections', () => {
    const data = validPayload();
    delete data.phases[0].sections;
    expect(validateImportPayload(data)).toContain('phases[0].sections must be a non-empty array');
  });

  it('flags a phase with an empty sections array', () => {
    const data = validPayload();
    data.phases[0].sections = [];
    expect(validateImportPayload(data)).toContain('phases[0].sections must be a non-empty array');
  });
});

describe('validateImportPayload — section-level', () => {
  it('flags a non-object section entry', () => {
    const data = validPayload();
    data.phases[0].sections = ['not an object'];
    expect(validateImportPayload(data)).toContain('phases[0].sections[0] is invalid');
  });

  it('flags a section missing a title', () => {
    const data = validPayload();
    delete data.phases[0].sections[0].title;
    expect(validateImportPayload(data)).toContain('phases[0].sections[0].title is required');
  });

  it('flags a section missing items', () => {
    const data = validPayload();
    delete data.phases[0].sections[0].items;
    expect(validateImportPayload(data)).toContain('phases[0].sections[0].items must have at least one item');
  });

  it('flags a section with an empty items array', () => {
    const data = validPayload();
    data.phases[0].sections[0].items = [];
    expect(validateImportPayload(data)).toContain('phases[0].sections[0].items must have at least one item');
  });
});

describe('validateImportPayload — item-level', () => {
  it('flags an empty-string item', () => {
    const data = validPayload();
    data.phases[0].sections[0].items = ['   '];
    expect(validateImportPayload(data)).toContain('item at phases[0].sections[0].items[0] is invalid');
  });

  it('flags a tuple item with an invalid priority', () => {
    const data = validPayload();
    data.phases[0].sections[0].items = [['Title', 'URGENT']];
    expect(validateImportPayload(data)).toContain('item at phases[0].sections[0].items[0] is invalid');
  });

  it('flags a tuple item with an empty title', () => {
    const data = validPayload();
    data.phases[0].sections[0].items = [['   ', 'P0']];
    expect(validateImportPayload(data)).toContain('item at phases[0].sections[0].items[0] is invalid');
  });

  it('flags a tuple item with the wrong arity', () => {
    const data = validPayload();
    data.phases[0].sections[0].items = [['Title', 'P0', 'extra']];
    expect(validateImportPayload(data)).toContain('item at phases[0].sections[0].items[0] is invalid');
  });

  it('flags a non-string, non-array item (e.g. a number or object)', () => {
    const data = validPayload();
    data.phases[0].sections[0].items = [42];
    expect(validateImportPayload(data)).toContain('item at phases[0].sections[0].items[0] is invalid');
  });
});

describe('validateImportPayload — item count cap', () => {
  it('accepts exactly 500 items (boundary)', () => {
    const data = {
      schemaVersion: SUPPORTED_SCHEMA_VERSION,
      title: 'Big Roadmap',
      phases: [{
        title: 'Phase',
        priority: 'P1',
        sections: [{ title: 'Section', items: Array.from({ length: 500 }, (_, i) => `Item ${i}`) }]
      }]
    };
    expect(validateImportPayload(data)).toEqual([]);
  });

  it('rejects 501 items (just over the boundary)', () => {
    const data = {
      schemaVersion: SUPPORTED_SCHEMA_VERSION,
      title: 'Too Big Roadmap',
      phases: [{
        title: 'Phase',
        priority: 'P1',
        sections: [{ title: 'Section', items: Array.from({ length: 501 }, (_, i) => `Item ${i}`) }]
      }]
    };
    expect(validateImportPayload(data)).toContain('Roadmap too large (> 500 items)');
  });

  it('counts items across multiple phases/sections toward the cap', () => {
    const data = {
      schemaVersion: SUPPORTED_SCHEMA_VERSION,
      title: 'Spread Roadmap',
      phases: Array.from({ length: 2 }, (_, p) => ({
        title: `Phase ${p}`,
        priority: 'P1',
        sections: [{ title: 'Section', items: Array.from({ length: 251 }, (_, i) => `Item ${p}-${i}`) }]
      }))
    };
    expect(validateImportPayload(data)).toContain('Roadmap too large (> 500 items)');
  });
});

describe('validateImportText', () => {
  it('returns valid: true with parsed data for a valid JSON string', () => {
    const result = validateImportText(JSON.stringify(validPayload()));
    expect(result.valid).toBe(true);
    expect(result.errors).toEqual([]);
    expect(result.data.title).toBe('Test Roadmap');
  });

  it('returns valid: false with the JSON parse error for malformed JSON', () => {
    const result = validateImportText('{bad json');
    expect(result.valid).toBe(false);
    expect(result.errors).toEqual(['Invalid JSON — check for missing commas or brackets']);
    expect(result.data).toBeNull();
  });

  it('returns valid: false with schema errors for well-formed but invalid JSON', () => {
    const result = validateImportText('{"schemaVersion": 1}');
    expect(result.valid).toBe(false);
    expect(result.errors).toContain('title is required');
    expect(result.data).toBeNull();
  });
});
