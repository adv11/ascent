import { describe, it, expect } from 'vitest';
import { parseImportJson, validateImportPayload, validateImportText, SUPPORTED_SCHEMA_VERSION } from '../../src/core/roadmap/importValidator.js';
import { MAX_TITLE_LENGTH } from '../../src/core/roadmap/limits.js';

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

// LLM output commonly varies priority casing/whitespace ("p0", " P0 ") in a
// way that's harmless to normalize rather than reject — issue #100
// follow-up, found live: an otherwise-valid roadmap was rejected wholesale
// over exactly this.
// Issue #186 — the AI-import path had no upper bound on title fields at
// all, unlike the manual-entry path's MAX_TITLE_LENGTH cap (roadmapStore.js's
// addItem()/updateItem()). An absurdly long title (tens of thousands of
// chars) used to pass validation cleanly and get persisted as-is.
describe('validateImportPayload — title length cap (issue #186)', () => {
  it('accepts an item title at exactly MAX_TITLE_LENGTH (boundary)', () => {
    const data = validPayload();
    data.phases[0].sections[0].items = ['x'.repeat(MAX_TITLE_LENGTH)];
    expect(validateImportPayload(data)).toEqual([]);
  });

  it('flags a plain-string item title over MAX_TITLE_LENGTH with a structured error', () => {
    const data = validPayload();
    data.phases[0].sections[0].items = ['x'.repeat(MAX_TITLE_LENGTH + 1)];
    expect(validateImportPayload(data)).toContain(
      `phases[0].sections[0].items[0].title exceeds ${MAX_TITLE_LENGTH} characters`
    );
  });

  it('flags a tuple item title over MAX_TITLE_LENGTH', () => {
    const data = validPayload();
    data.phases[0].sections[0].items = [['x'.repeat(MAX_TITLE_LENGTH + 1), 'P0']];
    expect(validateImportPayload(data)).toContain(
      `phases[0].sections[0].items[0].title exceeds ${MAX_TITLE_LENGTH} characters`
    );
  });

  it('flags an object item title over MAX_TITLE_LENGTH', () => {
    const data = validPayload();
    data.phases[0].sections[0].items = [{ title: 'x'.repeat(MAX_TITLE_LENGTH + 1), priority: 'P0' }];
    expect(validateImportPayload(data)).toContain(
      `phases[0].sections[0].items[0].title exceeds ${MAX_TITLE_LENGTH} characters`
    );
  });

  it('flags a phase title over MAX_TITLE_LENGTH', () => {
    const data = validPayload();
    data.phases[0].title = 'x'.repeat(MAX_TITLE_LENGTH + 1);
    expect(validateImportPayload(data)).toContain(
      `phases[0].title exceeds ${MAX_TITLE_LENGTH} characters`
    );
  });

  it('accepts a phase title at exactly MAX_TITLE_LENGTH (boundary)', () => {
    const data = validPayload();
    data.phases[0].title = 'x'.repeat(MAX_TITLE_LENGTH);
    expect(validateImportPayload(data)).toEqual([]);
  });

  it('flags a section title over MAX_TITLE_LENGTH', () => {
    const data = validPayload();
    data.phases[0].sections[0].title = 'x'.repeat(MAX_TITLE_LENGTH + 1);
    expect(validateImportPayload(data)).toContain(
      `phases[0].sections[0].title exceeds ${MAX_TITLE_LENGTH} characters`
    );
  });

  it('accepts a section title at exactly MAX_TITLE_LENGTH (boundary)', () => {
    const data = validPayload();
    data.phases[0].sections[0].title = 'x'.repeat(MAX_TITLE_LENGTH);
    expect(validateImportPayload(data)).toEqual([]);
  });
});

describe('validateImportPayload — priority normalization (issue #100 follow-up)', () => {
  it('accepts a lowercase priority on a phase', () => {
    const data = validPayload();
    data.phases[0].priority = 'p1';
    expect(validateImportPayload(data)).toEqual([]);
  });

  it('accepts a lowercase priority on a tuple item', () => {
    const data = validPayload();
    data.phases[0].sections[0].items = [['Tuple item', 'p0']];
    expect(validateImportPayload(data)).toEqual([]);
  });

  it('accepts a lowercase priority on an object item', () => {
    const data = validPayload();
    data.phases[0].sections[0].items = [{ title: 'Learn Docker', priority: 'p2' }];
    expect(validateImportPayload(data)).toEqual([]);
  });

  it('accepts a priority with surrounding whitespace', () => {
    const data = validPayload();
    data.phases[0].sections[0].items = [['Tuple item', ' P0 ']];
    expect(validateImportPayload(data)).toEqual([]);
  });

  it('still rejects a genuinely invalid priority after normalization', () => {
    const data = validPayload();
    data.phases[0].sections[0].items = [{ title: 'Learn Docker', priority: 'urgent' }];
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

describe('validateImportPayload — object-form items with resources (issue #100)', () => {
  it('accepts an object item with title only (inherits phase priority)', () => {
    const data = validPayload();
    data.phases[0].sections[0].items = [{ title: 'Learn Docker' }];
    expect(validateImportPayload(data)).toEqual([]);
  });

  it('accepts an object item with its own priority', () => {
    const data = validPayload();
    data.phases[0].sections[0].items = [{ title: 'Learn Docker', priority: 'P0' }];
    expect(validateImportPayload(data)).toEqual([]);
  });

  it('rejects an object item with an invalid priority', () => {
    const data = validPayload();
    data.phases[0].sections[0].items = [{ title: 'Learn Docker', priority: 'URGENT' }];
    expect(validateImportPayload(data)).toContain('item at phases[0].sections[0].items[0] is invalid');
  });

  it('rejects an object item with an empty title', () => {
    const data = validPayload();
    data.phases[0].sections[0].items = [{ title: '   ' }];
    expect(validateImportPayload(data)).toContain('item at phases[0].sections[0].items[0] is invalid');
  });

  it('accepts an object item with valid http(s) resources', () => {
    const data = validPayload();
    data.phases[0].sections[0].items = [{
      title: 'Learn Docker',
      resources: [
        { label: 'Docker official docs', url: 'https://docs.docker.com/' },
        { label: 'Docker crash course', url: 'https://www.youtube.com/watch?v=abc123' }
      ]
    }];
    expect(validateImportPayload(data)).toEqual([]);
  });

  it('accepts an object item with no resources field at all (optional)', () => {
    const data = validPayload();
    data.phases[0].sections[0].items = [{ title: 'Learn Docker' }];
    expect(validateImportPayload(data)).toEqual([]);
  });

  // URL *protocol* safety (javascript:/data: rejection) is deliberately not
  // checked at this schema-validation layer — see importValidator.js's
  // isValidResourceEntry() doc comment. Rejecting the whole topic here
  // because one resource's URL was missing "https://" (a common, harmless
  // LLM quirk) used to cascade into "item is invalid" errors across
  // otherwise-good roadmaps (issue #100 follow-up). Protocol
  // safety/auto-correction now happens in adaptImportToRoadmap() —
  // schemaAdapter.test.js's "sanitizes resources" describe block covers a
  // javascript:/data: URL actually being dropped before it ever reaches the
  // store.
  it('accepts a resource with a javascript: URL at the schema level (dropped later, at conversion time — see schemaAdapter.test.js)', () => {
    const data = validPayload();
    data.phases[0].sections[0].items = [{
      title: 'Learn Docker',
      resources: [{ label: 'Bad link', url: 'javascript:alert(1)' }]
    }];
    expect(validateImportPayload(data)).toEqual([]);
  });

  it('accepts a resource with a bare-domain URL (missing https://) at the schema level — auto-corrected at conversion time', () => {
    const data = validPayload();
    data.phases[0].sections[0].items = [{
      title: 'Learn Docker',
      resources: [{ label: 'Docker docs', url: 'docs.docker.com' }]
    }];
    expect(validateImportPayload(data)).toEqual([]);
  });

  it('rejects a resource with an empty label', () => {
    const data = validPayload();
    data.phases[0].sections[0].items = [{
      title: 'Learn Docker',
      resources: [{ label: '  ', url: 'https://docs.docker.com/' }]
    }];
    expect(validateImportPayload(data)).toContain('item at phases[0].sections[0].items[0] is invalid');
  });

  it('rejects a resource with an oversized label or url', () => {
    const dataLabel = validPayload();
    dataLabel.phases[0].sections[0].items = [{
      title: 'Learn Docker',
      resources: [{ label: 'x'.repeat(121), url: 'https://docs.docker.com/' }]
    }];
    expect(validateImportPayload(dataLabel)).toContain('item at phases[0].sections[0].items[0] is invalid');

    const dataUrl = validPayload();
    dataUrl.phases[0].sections[0].items = [{
      title: 'Learn Docker',
      resources: [{ label: 'Docs', url: `https://docs.docker.com/${'x'.repeat(2048)}` }]
    }];
    expect(validateImportPayload(dataUrl)).toContain('item at phases[0].sections[0].items[0] is invalid');
  });

  it('rejects more than 5 resources on a single item', () => {
    const data = validPayload();
    data.phases[0].sections[0].items = [{
      title: 'Learn Docker',
      resources: Array.from({ length: 6 }, (_, i) => ({ label: `Link ${i}`, url: `https://example.com/${i}` }))
    }];
    expect(validateImportPayload(data)).toContain('item at phases[0].sections[0].items[0] is invalid');
  });

  it('accepts exactly 5 resources on a single item (boundary)', () => {
    const data = validPayload();
    data.phases[0].sections[0].items = [{
      title: 'Learn Docker',
      resources: Array.from({ length: 5 }, (_, i) => ({ label: `Link ${i}`, url: `https://example.com/${i}` }))
    }];
    expect(validateImportPayload(data)).toEqual([]);
  });

  it('rejects a non-array resources field', () => {
    const data = validPayload();
    data.phases[0].sections[0].items = [{ title: 'Learn Docker', resources: 'not an array' }];
    expect(validateImportPayload(data)).toContain('item at phases[0].sections[0].items[0] is invalid');
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

// Issue #100 follow-up — a real report: some AI chat UIs auto-linkify raw
// URLs found inside a code block when a user selects/copies rendered text
// instead of using the tool's own "copy raw" button, splicing markdown-link
// syntax and URL-encoded JSON fragments into neighboring text. The result
// still parses as valid JSON (quotes stay balanced) but every field
// involved is nonsense — these tests use a corrupted title/label/url
// matching the exact pattern from that report.
describe('validateImportPayload — corrupted-text detection (issue #100 follow-up)', () => {
  const CORRUPTED_TITLE = 'Learn](https://www.khanacademy.org/computing%22]},{%22title%22:%22Learn) the command line';

  it('flags a plain-string item title containing a corruption marker', () => {
    const data = validPayload();
    data.phases[0].sections[0].items = [CORRUPTED_TITLE];
    const errors = validateImportPayload(data);
    expect(errors.some(e => e.includes('phases[0].sections[0].items[0].title looks corrupted'))).toBe(true);
  });

  it('flags a tuple item title containing a corruption marker', () => {
    const data = validPayload();
    data.phases[0].sections[0].items = [[CORRUPTED_TITLE, 'P0']];
    const errors = validateImportPayload(data);
    expect(errors.some(e => e.includes('.title looks corrupted'))).toBe(true);
  });

  it('flags an object item title containing a corruption marker', () => {
    const data = validPayload();
    data.phases[0].sections[0].items = [{ title: CORRUPTED_TITLE }];
    const errors = validateImportPayload(data);
    expect(errors.some(e => e.includes('.title looks corrupted'))).toBe(true);
  });

  it('flags a corrupted resource label or url without flagging the (clean) title', () => {
    const data = validPayload();
    data.phases[0].sections[0].items = [{
      title: 'Learn Docker',
      resources: [{ label: 'Docker docs%22]},{%22title%22', url: 'https://docs.docker.com/' }]
    }];
    const errors = validateImportPayload(data);
    expect(errors.some(e => e.includes('phases[0].sections[0].items[0].resources[0] looks corrupted'))).toBe(true);
    expect(errors.some(e => e.includes('.title looks corrupted'))).toBe(false);
  });

  it('flags a corrupted resource url', () => {
    const data = validPayload();
    data.phases[0].sections[0].items = [{
      title: 'Learn Docker',
      resources: [{ label: 'Docker docs', url: 'https://docs.docker.com/%22]},{%22title%22:%22' }]
    }];
    const errors = validateImportPayload(data);
    expect(errors.some(e => e.includes('phases[0].sections[0].items[0].resources[0] looks corrupted'))).toBe(true);
  });

  it('flags a corrupted phase title', () => {
    const data = validPayload();
    data.phases[0].title = CORRUPTED_TITLE;
    const errors = validateImportPayload(data);
    expect(errors.some(e => e.includes('phases[0].title looks corrupted'))).toBe(true);
  });

  it('flags a corrupted section title', () => {
    const data = validPayload();
    data.phases[0].sections[0].title = CORRUPTED_TITLE;
    const errors = validateImportPayload(data);
    expect(errors.some(e => e.includes('phases[0].sections[0].title looks corrupted'))).toBe(true);
  });

  it('does not flag ordinary titles that happen to contain brackets or parentheses', () => {
    const data = validPayload();
    data.phases[0].sections[0].items = ['Understand how computers work (CPU, RAM, storage)', ['Arrays [and] lists', 'P0']];
    expect(validateImportPayload(data)).toEqual([]);
  });

  it('the corruption error message gives actionable guidance, not just "is invalid"', () => {
    const data = validPayload();
    data.phases[0].sections[0].items = [CORRUPTED_TITLE];
    const errors = validateImportPayload(data);
    const corruptionError = errors.find(e => e.includes('looks corrupted'));
    expect(corruptionError).toMatch(/copy/i);
  });
});

// Issue #121 item 1: a real ChatGPT payload was captured live and diffed
// against what our code receives — this fixture is that exact payload
// (a "Music Development" roadmap, ChatGPT web UI, 6 phases), confirming the
// corruption markers are genuinely present in the raw text before it ever
// reaches parseImportJson()/validateImportPayload(), not introduced by our
// code. Every "%22"/"]("-style corruption in this fixture is literal
// markdown-link syntax (`[label](url%22},{%22...)`) spliced into the JSON
// string values — ChatGPT's web UI auto-linkified the bare https:// URLs it
// found inside the JSON, and copying the *rendered* response (rather than
// via the "copy code" button) captured that markdown-link source text
// instead of raw JSON. The identical prompt handed to Claude in the same
// session did not trigger this and imported cleanly — this fixture is
// ChatGPT-specific, not a generic AI-output quirk. Locks in the validator's
// existing (correct) rejection behavior; see `.claude/rules/roadmap-store.md`
// for the fix this shipped alongside (provider-specific copy guidance in
// `importRoadmapModal.js`, not a validator/recovery change).
describe('validateImportText — real captured ChatGPT payload (issue #121 item 1)', () => {
  it('rejects the payload with corruption errors, matching the exact reported error count (41)', async () => {
    const { CHATGPT_CORRUPTED_PAYLOAD } = await import('./fixtures/chatgptCorruptedPayload.js');
    const result = validateImportText(CHATGPT_CORRUPTED_PAYLOAD);
    expect(result.valid).toBe(false);
    expect(result.errors).toHaveLength(41);
    expect(result.errors.every(e => e.includes('looks corrupted'))).toBe(true);
  });

  it('flags the exact first corrupted field ChatGPT produced: the second resource of the first item', async () => {
    const { CHATGPT_CORRUPTED_PAYLOAD } = await import('./fixtures/chatgptCorruptedPayload.js');
    const result = validateImportText(CHATGPT_CORRUPTED_PAYLOAD);
    expect(result.errors[0]).toContain('phases[0].sections[0].items[0].resources[1] looks corrupted');
  });
});

// Issue #121 item 2 — automated edge-case matrix. This environment has no
// live access to ChatGPT/Gemini/Claude/Copilot chat sessions, so this covers
// what CAN be verified without one: the structural edge cases the issue
// itself named (near-cap-size roadmap, resource-heavy roadmap, non-ASCII
// titles, mixed item shapes) plus the "multiple consecutive fix-it round
// trips" scenario, all run through the real validator with no mocking. A
// live manual matrix across real AI provider sessions (the issue's own
// action item) is a separate, human-in-the-loop follow-up this suite cannot
// substitute for — see the PR description.
describe('validateImportPayload — cross-provider/edge-case matrix (issue #121 item 2)', () => {
  it('accepts a roadmap just under the 500-item cap with resources on every item', async () => {
    const { buildLargeRoadmapPayload } = await import('./fixtures/aiProviderPayloads.js');
    const payload = buildLargeRoadmapPayload(490);
    const errors = validateImportPayload(payload);
    expect(errors).toEqual([]);
  });

  it('still rejects a roadmap one item over the 500-item cap, even resource-heavy', async () => {
    const { buildLargeRoadmapPayload } = await import('./fixtures/aiProviderPayloads.js');
    const payload = buildLargeRoadmapPayload(501);
    const errors = validateImportPayload(payload);
    expect(errors).toEqual(['Roadmap too large (> 500 items)']);
  });

  it('accepts non-ASCII/unicode titles at every level (Japanese, Arabic, accented Latin) with no false-positive corruption flags', async () => {
    const { NON_ASCII_PAYLOAD } = await import('./fixtures/aiProviderPayloads.js');
    const errors = validateImportPayload(NON_ASCII_PAYLOAD);
    expect(errors).toEqual([]);
  });

  it('accepts a payload mixing all three allowed item shapes (string, tuple, resource-bearing object) in the same section', async () => {
    const { MIXED_SHAPE_CLEAN_PAYLOAD } = await import('./fixtures/aiProviderPayloads.js');
    const errors = validateImportPayload(MIXED_SHAPE_CLEAN_PAYLOAD);
    expect(errors).toEqual([]);
  });

  it('accepts a resource URL missing its scheme (docs.docker.com) in the mixed-shape payload — validation defers protocol correctness to adaptImportToRoadmap', async () => {
    const { MIXED_SHAPE_CLEAN_PAYLOAD } = await import('./fixtures/aiProviderPayloads.js');
    const dockerItem = MIXED_SHAPE_CLEAN_PAYLOAD.phases[0].sections[0].items[2];
    expect(dockerItem.resources[0].url).toBe('docs.docker.com');
    const errors = validateImportPayload(MIXED_SHAPE_CLEAN_PAYLOAD);
    expect(errors).toEqual([]);
  });

  // Issue #121 item 1's own follow-up ask: confirm the fix-it loop actually
  // terminates across several consecutive rounds instead of looping forever
  // — each round fixes exactly the errors from the previous round's result,
  // simulating an AI assistant iteratively correcting its own output.
  it('a payload with several consecutive rounds of "fix it and resend" converges to zero errors, never regressing back to a prior error', () => {
    const round1 = {
      schemaVersion: 1,
      // Missing top-level title (round 1 error).
      phases: [
        { title: 'Phase One', priority: 'p0', sections: [{ title: 'Section One', items: ['Learn the basics'] }] }
      ]
    };
    const round1Errors = validateImportPayload(round1);
    expect(round1Errors).toEqual(['title is required']);

    // Round 2: title added, but a new mistake introduced (empty section title) —
    // simulates an AI response that fixes the reported issue but introduces
    // a different one, which is common in real multi-round-trip use.
    const round2 = { ...round1, title: 'My Roadmap', phases: [{ ...round1.phases[0], sections: [{ title: '', items: ['Learn the basics'] }] }] };
    const round2Errors = validateImportPayload(round2);
    expect(round2Errors).toEqual(['phases[0].sections[0].title is required']);
    expect(round2Errors).not.toContain('title is required');

    // Round 3: fully corrected.
    const round3 = { ...round2, phases: [{ ...round2.phases[0], sections: [{ title: 'Section One', items: ['Learn the basics'] }] }] };
    expect(validateImportPayload(round3)).toEqual([]);
  });
});
