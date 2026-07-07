// Pure validation for AI-import roadmap JSON (issue #4) — no DOM, no store,
// no Firebase. Deliberately decoupled from schemaAdapter.js: bumping
// SUPPORTED_SCHEMA_VERSION and adding a new adapter is how a future schema
// version gets supported, not by editing what "valid" means here.

const VALID_PRIORITIES = ['P0', 'P1', 'P2', 'P3'];
const MAX_ITEMS = 500;
export const SUPPORTED_SCHEMA_VERSION = 1;

export function parseImportJson(rawText) {
  try {
    return { data: JSON.parse(rawText), error: null };
  } catch {
    return { data: null, error: 'Invalid JSON — check for missing commas or brackets' };
  }
}

function isValidItem(item) {
  if (typeof item === 'string') return item.trim().length > 0;
  if (Array.isArray(item) && item.length === 2) {
    const [title, priority] = item;
    return typeof title === 'string' && title.trim().length > 0 && VALID_PRIORITIES.includes(priority);
  }
  return false;
}

// Returns an array of human-readable error strings — empty means valid.
// Field-level messages include the phases[i].sections[j].items[k] path so a
// user can find the exact spot in their pasted JSON that needs fixing.
export function validateImportPayload(data) {
  if (data === null || typeof data !== 'object' || Array.isArray(data)) {
    return ['Invalid JSON — check for missing commas or brackets'];
  }

  const errors = [];

  if (data.schemaVersion !== SUPPORTED_SCHEMA_VERSION) {
    errors.push('Unsupported schema version');
  }
  if (typeof data.title !== 'string' || !data.title.trim()) {
    errors.push('title is required');
  }
  if (!Array.isArray(data.phases) || data.phases.length === 0) {
    errors.push('roadmap must have at least one phase');
    return errors;
  }

  let totalItems = 0;
  data.phases.forEach((phase, i) => {
    if (!phase || typeof phase !== 'object' || Array.isArray(phase)) {
      errors.push(`phases[${i}] is invalid`);
      return;
    }
    if (typeof phase.title !== 'string' || !phase.title.trim()) {
      errors.push(`phases[${i}].title is required`);
    }
    if (!VALID_PRIORITIES.includes(phase.priority)) {
      errors.push(`phases[${i}].priority must be one of ${VALID_PRIORITIES.join(', ')}`);
    }
    if (!Array.isArray(phase.sections) || phase.sections.length === 0) {
      errors.push(`phases[${i}].sections must be a non-empty array`);
      return;
    }
    phase.sections.forEach((section, j) => {
      if (!section || typeof section !== 'object' || Array.isArray(section)) {
        errors.push(`phases[${i}].sections[${j}] is invalid`);
        return;
      }
      if (typeof section.title !== 'string' || !section.title.trim()) {
        errors.push(`phases[${i}].sections[${j}].title is required`);
      }
      if (!Array.isArray(section.items) || section.items.length === 0) {
        errors.push(`phases[${i}].sections[${j}].items must have at least one item`);
        return;
      }
      section.items.forEach((item, k) => {
        if (!isValidItem(item)) {
          errors.push(`item at phases[${i}].sections[${j}].items[${k}] is invalid`);
        } else {
          totalItems += 1;
        }
      });
    });
  });

  if (totalItems > MAX_ITEMS) {
    errors.push(`Roadmap too large (> ${MAX_ITEMS} items)`);
  }

  return errors;
}

// Convenience wrapper combining parse + validate for UI call sites — returns
// `{ valid, errors, data }` where `data` is only set when `valid` is true.
export function validateImportText(rawText) {
  const { data, error } = parseImportJson(rawText);
  if (error) return { valid: false, errors: [error], data: null };
  const errors = validateImportPayload(data);
  return { valid: errors.length === 0, errors, data: errors.length === 0 ? data : null };
}
