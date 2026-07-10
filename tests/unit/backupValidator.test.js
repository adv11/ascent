import { describe, it, expect } from 'vitest';
import {
  parseBackupJson,
  validateBackupPayload,
  validateBackupText,
  diffBackupItems,
  SUPPORTED_BACKUP_SCHEMA_VERSION
} from '../../src/core/roadmap/backupValidator.js';

function validBackup(overrides = {}) {
  return {
    schemaVersion: SUPPORTED_BACKUP_SCHEMA_VERSION,
    exportedAt: '2023-11-14T22:13:20.000Z',
    templateId: 'java-backend',
    items: {
      'item-1': { title: 'Topic one', phase: 'Core', section: 'Basics', priority: 'P1', done: true, completedAt: 1, resources: [], notes: '' }
    },
    ...overrides
  };
}

describe('parseBackupJson', () => {
  it('parses valid JSON', () => {
    const result = parseBackupJson('{"a": 1}');
    expect(result.error).toBeNull();
    expect(result.data).toEqual({ a: 1 });
  });

  it('returns a friendly error for invalid JSON', () => {
    const result = parseBackupJson('{not valid json');
    expect(result.data).toBeNull();
    expect(result.error).toMatch(/valid JSON/);
  });
});

describe('validateBackupPayload — happy path', () => {
  it('accepts a valid backup with no errors', () => {
    expect(validateBackupPayload(validBackup())).toEqual([]);
  });

  it('accepts a backup with an empty items map', () => {
    expect(validateBackupPayload(validBackup({ items: {} }))).toEqual([]);
  });
});

describe('validateBackupPayload — top-level shape', () => {
  it('rejects null/non-object data', () => {
    expect(validateBackupPayload(null)).toEqual(['File does not contain a valid backup object.']);
    expect(validateBackupPayload('a string')).toEqual(['File does not contain a valid backup object.']);
  });

  it('rejects a missing or mismatched schemaVersion', () => {
    const [error] = validateBackupPayload(validBackup({ schemaVersion: undefined }));
    expect(error).toMatch(/Unsupported backup schema version \(missing\)/);

    const [futureError] = validateBackupPayload(validBackup({ schemaVersion: 99 }));
    expect(futureError).toMatch(/Unsupported backup schema version \(99\)/);
  });

  it('rejects a payload with no items map', () => {
    expect(validateBackupPayload(validBackup({ items: undefined }))).toEqual(['Backup is missing its "items" map.']);
    expect(validateBackupPayload(validBackup({ items: [] }))).toEqual(['Backup is missing its "items" map.']);
  });
});

describe('validateBackupPayload — per-item errors', () => {
  it('flags a missing/empty title', () => {
    const errors = validateBackupPayload(validBackup({
      items: { 'item-1': { title: '', phase: 'Core', section: 'Basics', priority: 'P1' } }
    }));
    expect(errors).toContain('items.item-1.title is invalid');
  });

  it('flags a missing phase/section', () => {
    const errors = validateBackupPayload(validBackup({
      items: { 'item-1': { title: 'Topic', phase: '', section: '', priority: 'P1' } }
    }));
    expect(errors).toContain('items.item-1.phase is invalid');
    expect(errors).toContain('items.item-1.section is invalid');
  });

  it('flags an invalid priority', () => {
    const errors = validateBackupPayload(validBackup({
      items: { 'item-1': { title: 'Topic', phase: 'Core', section: 'Basics', priority: 'urgent' } }
    }));
    expect(errors).toContain('items.item-1.priority is invalid');
  });

  it('flags a non-object item value', () => {
    const errors = validateBackupPayload(validBackup({ items: { 'item-1': 'not an object' } }));
    expect(errors).toEqual(['items.item-1 is invalid']);
  });

  it('caps the number of collected errors so a mangled file stays readable', () => {
    const items = {};
    for (let i = 0; i < 50; i += 1) items[`item-${i}`] = { title: '' };
    const errors = validateBackupPayload(validBackup({ items }));
    expect(errors.length).toBeLessThan(50 * 4);
    expect(errors.at(-1)).toBe('...additional errors omitted.');
  });
});

describe('validateBackupText', () => {
  it('combines parse + validate, only setting data when valid', () => {
    const result = validateBackupText(JSON.stringify(validBackup()));
    expect(result.valid).toBe(true);
    expect(result.errors).toEqual([]);
    expect(result.data.templateId).toBe('java-backend');
  });

  it('reports invalid JSON without ever calling the payload validator', () => {
    const result = validateBackupText('{broken');
    expect(result.valid).toBe(false);
    expect(result.data).toBeNull();
  });

  it('reports schema errors for otherwise-parseable JSON', () => {
    const result = validateBackupText(JSON.stringify({ schemaVersion: 1 }));
    expect(result.valid).toBe(false);
    expect(result.data).toBeNull();
    expect(result.errors[0]).toMatch(/items/);
  });
});

describe('diffBackupItems', () => {
  it('counts new vs. existing by id', () => {
    const currentAllItems = { 'existing-1': {}, 'existing-2': {} };
    const backupItems = { 'existing-1': {}, 'new-1': {}, 'new-2': {} };
    expect(diffBackupItems(currentAllItems, backupItems)).toEqual({
      totalCount: 3,
      existingCount: 1,
      newCount: 2
    });
  });

  it('treats a soft-deleted current item as "already exists", not "new"', () => {
    const currentAllItems = { 'item-1': { deleted: true } };
    const backupItems = { 'item-1': {} };
    expect(diffBackupItems(currentAllItems, backupItems)).toEqual({
      totalCount: 1,
      existingCount: 1,
      newCount: 0
    });
  });

  it('handles an empty backup', () => {
    expect(diffBackupItems({ 'item-1': {} }, {})).toEqual({ totalCount: 0, existingCount: 0, newCount: 0 });
  });
});
