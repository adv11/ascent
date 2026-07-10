// Pure — no DOM, no store, no Firebase. Validates a JSON backup file before
// any of it reaches roadmapStore.importBackupItems() (issue #18). Mirrors the
// parse/validate split importValidator.js (issue #4, AI-import) established,
// but for the backup export/restore schema (backupSchema.js), a different
// shape entirely — do not conflate the two "schemaVersion" numbers, they
// version unrelated JSON formats.
import { EXPORT_SCHEMA_VERSION } from './backupSchema.js';
import { MAX_TITLE_LENGTH } from './limits.js';

export const SUPPORTED_BACKUP_SCHEMA_VERSION = EXPORT_SCHEMA_VERSION;

const VALID_PRIORITIES = ['P0', 'P1', 'P2', 'P3'];
const MAX_VALIDATION_ERRORS = 30;

export function parseBackupJson(rawText) {
  try {
    return { data: JSON.parse(rawText), error: null };
  } catch {
    return { data: null, error: "That file isn't valid JSON — make sure you're uploading an unmodified Ascent backup export." };
  }
}

// One backup item's own field errors, keyed the same `items.<id>.<field>`
// way importValidator.js's `phases[i].sections[j].items[k]` paths read.
function validateBackupItem(id, item) {
  if (!item || typeof item !== 'object') return [`items.${id} is invalid`];
  const errors = [];
  if (typeof item.title !== 'string' || !item.title.trim() || item.title.length > MAX_TITLE_LENGTH) {
    errors.push(`items.${id}.title is invalid`);
  }
  if (typeof item.phase !== 'string' || !item.phase.trim()) errors.push(`items.${id}.phase is invalid`);
  if (typeof item.section !== 'string' || !item.section.trim()) errors.push(`items.${id}.section is invalid`);
  if (!VALID_PRIORITIES.includes(item.priority)) errors.push(`items.${id}.priority is invalid`);
  return errors;
}

// Returns an array of human-readable error strings; empty means valid. Stops
// collecting per-item errors past MAX_VALIDATION_ERRORS so a badly-mangled
// file with thousands of items doesn't produce an unusable wall of text.
export function validateBackupPayload(data) {
  if (!data || typeof data !== 'object' || Array.isArray(data)) {
    return ['File does not contain a valid backup object.'];
  }
  if (data.schemaVersion !== SUPPORTED_BACKUP_SCHEMA_VERSION) {
    return [`Unsupported backup schema version (${data.schemaVersion ?? 'missing'}) — this app reads version ${SUPPORTED_BACKUP_SCHEMA_VERSION}.`];
  }
  if (!data.items || typeof data.items !== 'object' || Array.isArray(data.items)) {
    return ['Backup is missing its "items" map.'];
  }

  const errors = [];
  for (const [id, item] of Object.entries(data.items)) {
    if (errors.length >= MAX_VALIDATION_ERRORS) {
      errors.push('...additional errors omitted.');
      break;
    }
    errors.push(...validateBackupItem(id, item));
  }
  return errors;
}

// Combines parse + validate for UI call sites — `data` is only set once
// `valid` is true, same contract as importValidator.js's validateImportText.
export function validateBackupText(rawText) {
  const { data, error } = parseBackupJson(rawText);
  if (error) return { valid: false, errors: [error], data: null };
  const errors = validateBackupPayload(data);
  return { valid: errors.length === 0, errors, data: errors.length === 0 ? data : null };
}

// Pure diff summary ("X items found, Y already exist, Z new") for the import
// confirmation modal — counts only, never mutates. `currentAllItems` is a
// roadmapStore snapshot's `allItems` map (includes soft-deleted items, same
// as importBackupItems() itself checks, so a restore over a soft-deleted
// item correctly counts as "already exists", not "new").
export function diffBackupItems(currentAllItems, backupItems) {
  const ids = Object.keys(backupItems || {});
  const existingCount = ids.filter(id => !!currentAllItems?.[id]).length;
  return {
    totalCount: ids.length,
    existingCount,
    newCount: ids.length - existingCount
  };
}
