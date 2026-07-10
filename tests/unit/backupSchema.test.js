import { describe, it, expect } from 'vitest';
import { buildRoadmapExport, buildRoadmapCsv, exportFileBaseName, EXPORT_SCHEMA_VERSION } from '../../src/core/roadmap/backupSchema.js';

function snapshot(overrides = {}) {
  return {
    uid: 'user-123',
    activeTemplateId: 'java-backend',
    allItems: {
      'item-1': {
        id: 'item-1', title: 'Spring Boot basics', phase: 'Core', section: 'Framework',
        priority: 'P1', done: true, completedAt: 1700000000000,
        resources: [{ label: 'Docs', url: 'https://example.com' }], notes: 'Read chapter 2',
        custom: false, deleted: false, createdAt: 1699999999999
      },
      'item-2': {
        id: 'item-2', title: 'Deleted topic', phase: 'Core', section: 'Framework',
        priority: 'P2', done: false, completedAt: null, resources: [], notes: '',
        custom: true, deleted: true, createdAt: 1699999999999
      },
      'item-3': {
        id: 'item-3', title: 'Has a comma, and "quotes"', phase: 'Core, Advanced', section: 'Framework',
        priority: 'P3', done: false, completedAt: null, resources: [], notes: 'line one\nline two',
        custom: true, deleted: false, createdAt: 1699999999999
      }
    },
    ...overrides
  };
}

describe('buildRoadmapExport', () => {
  it('produces a versioned payload with the active template id and item count', () => {
    const payload = buildRoadmapExport(snapshot());
    expect(payload.schemaVersion).toBe(EXPORT_SCHEMA_VERSION);
    expect(payload.templateId).toBe('java-backend');
    expect(typeof payload.exportedAt).toBe('string');
    expect(payload.itemCount).toBe(2); // excludes the soft-deleted item
  });

  it('excludes soft-deleted items', () => {
    const payload = buildRoadmapExport(snapshot());
    expect(payload.items['item-2']).toBeUndefined();
  });

  it('round-trips every field a restore needs', () => {
    const payload = buildRoadmapExport(snapshot());
    expect(payload.items['item-1']).toEqual({
      title: 'Spring Boot basics',
      phase: 'Core',
      section: 'Framework',
      priority: 'P1',
      done: true,
      completedAt: 1700000000000,
      resources: [{ label: 'Docs', url: 'https://example.com' }],
      notes: 'Read chapter 2'
    });
  });

  it('records exportedByUid informationally, never used to scope import', () => {
    const payload = buildRoadmapExport(snapshot());
    expect(payload.exportedByUid).toBe('user-123');
  });

  it('re-parses cleanly through JSON.stringify/JSON.parse (the actual download/upload path)', () => {
    const payload = buildRoadmapExport(snapshot());
    const roundTripped = JSON.parse(JSON.stringify(payload));
    expect(roundTripped).toEqual(payload);
  });
});

describe('exportFileBaseName', () => {
  it('includes the template id and an ISO date', () => {
    const name = exportFileBaseName('java-backend');
    expect(name).toMatch(/^ascent-roadmap-java-backend-\d{4}-\d{2}-\d{2}$/);
  });

  it('sanitizes a custom roadmap id into a filename-safe slug', () => {
    const name = exportFileBaseName('croadmap-1700000000000-ab12cd');
    expect(name).toMatch(/^ascent-roadmap-croadmap-1700000000000-ab12cd-\d{4}-\d{2}-\d{2}$/);
  });
});

describe('buildRoadmapCsv', () => {
  it('emits the required column headers in order', () => {
    const csv = buildRoadmapCsv(snapshot());
    const [header] = csv.split('\r\n');
    expect(header).toBe('phase,section,title,priority,done,completedAt,resourceCount,notes');
  });

  it('excludes soft-deleted items and uses CRLF row separators', () => {
    const csv = buildRoadmapCsv(snapshot());
    const rows = csv.split('\r\n');
    expect(rows).toHaveLength(3); // header + 2 non-deleted items
    expect(csv).not.toContain('Deleted topic');
  });

  it('RFC 4180-quotes a field containing a comma and doubles internal quotes', () => {
    const csv = buildRoadmapCsv(snapshot());
    expect(csv).toContain('"Core, Advanced"');
    expect(csv).toContain('"Has a comma, and ""quotes"""');
  });

  it('quotes a field containing an embedded newline', () => {
    const csv = buildRoadmapCsv(snapshot());
    expect(csv).toContain('"line one\nline two"');
  });

  it('formats completedAt as an ISO string, or empty when not completed', () => {
    const csv = buildRoadmapCsv(snapshot());
    expect(csv).toContain('2023-11-14T22:13:20.000Z');
    const rows = csv.split('\r\n');
    // item-3 (no completedAt) ends its resourceCount/notes fields with an empty completedAt column
    const item3Row = rows.find(row => row.includes('Has a comma'));
    expect(item3Row).toMatch(/,,0,/);
  });
});
