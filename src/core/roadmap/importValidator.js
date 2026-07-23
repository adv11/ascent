// Pure validation for AI-import roadmap JSON (issue #4) — no DOM, no store,
// no Firebase. Deliberately decoupled from schemaAdapter.js: bumping
// SUPPORTED_SCHEMA_VERSION and adding a new adapter is how a future schema
// version gets supported, not by editing what "valid" means here.
import { MAX_RESOURCE_LABEL_LENGTH, MAX_RESOURCE_URL_LENGTH, MAX_TITLE_LENGTH } from './limits.js';

const VALID_PRIORITIES = ['P0', 'P1', 'P2', 'P3'];
const MAX_ITEMS = 500;
const MAX_RESOURCES_PER_ITEM = 5;
export const SUPPORTED_SCHEMA_VERSION = 1;

// Many AI assistants wrap JSON output in a fenced code block (```json ... ```)
// even when explicitly told not to — this is the single most common reason a
// pasted payload fails to parse. Strip one leading/trailing fence (with or
// without a `json` language tag) before attempting JSON.parse, and only fall
// through to the "Invalid JSON" error if that still fails.
function stripFencedCodeBlock(rawText) {
  const match = rawText.trim().match(/^```(?:json)?\s*\n?([\s\S]*?)\n?```$/i);
  return match ? match[1] : rawText;
}

export function parseImportJson(rawText) {
  try {
    return { data: JSON.parse(stripFencedCodeBlock(rawText)), error: null };
  } catch {
    return { data: null, error: 'Invalid JSON — check for missing commas or brackets' };
  }
}

// Issue #100 follow-up — found via a real report: some AI chat UIs
// auto-linkify raw URLs found inside a code block when a user selects and
// copies rendered text instead of using the tool's own "copy raw" button,
// splicing markdown-link syntax and URL-encoded JSON fragments into
// neighboring text. The result still parses as valid JSON (quotes stay
// balanced), so it slips past parseImportJson() — but every field involved
// is now nonsense text like `Learn](https://example.com%22]},{%22title%22`.
// These markers are essentially never legitimate in a roadmap title,
// section name, or resource label, so treat any of them as a strong,
// specific "this text is corrupted" signal — worth a much more actionable
// error than a bare "is invalid" would be, since the fix is "re-copy the
// raw JSON," not "edit the JSON."
const CORRUPTION_MARKERS = ['%22', '%5B', '%5D', '"title":', '"url":', '"label":', '"resources":', '"priority":', '"schemaVersion"'];

function looksCorrupted(text) {
  return typeof text === 'string' && CORRUPTION_MARKERS.some(marker => text.includes(marker));
}

// LLM output is real-world-messy in small, harmless ways ("p0" instead of
// "P0", a trailing space) that shouldn't fail an otherwise-good roadmap —
// normalize before comparing against VALID_PRIORITIES rather than rejecting
// on the raw value. Exported so schemaAdapter.js can apply the exact same
// normalization when it re-reads a field this function already accepted.
export function normalizePriority(value) {
  return typeof value === 'string' ? value.trim().toUpperCase() : value;
}

// Issue #326 — a payload can be schema-shaped and non-empty at every field yet
// still not be a real roadmap: buildImportPrompt() (src/data/importPrompt.js)
// uses these exact literal strings as its own schema-illustration placeholders,
// and a weaker model can echo the template's shape back with them still
// unfilled — every check above accepts that as valid, since every field is a
// non-empty string under the length cap. Exact literal strings only (not a
// generic "<...>" regex), so a legitimate title that happens to contain angle
// brackets — "Intro to <T> generics in Java" — can never false-positive.
const PLACEHOLDER_MARKERS = ['<roadmap title>', '<phase title>', '<section title>', '<item title>', '<https:// link>', '<short resource name>'];

// An AI refusal ("I'm sorry, but I can't help with that...") wrapped just
// enough to satisfy the schema is the sibling failure mode this issue closes —
// matched as recognizable multi-word openers, never a bare "I" prefix, so a
// legitimate title starting with "I" ("Iterators in Python") never
// false-positives.
const REFUSAL_OPENERS = ['i cannot', "i'm sorry, but", 'as an ai language model'];

// Checked before looksCorrupted()/normal shape validation, same priority as
// the corruption check it sits alongside — an unfilled placeholder or a
// wrapped refusal is a more specific, more actionable problem than a bare
// "is invalid"/"is required". `fieldPath` is the full dotted field path
// (e.g. "title" or "phases[0].sections[1].items[2].title") so the returned
// message matches this file's existing structured/technical convention.
function placeholderOrRefusalError(text, fieldPath) {
  if (typeof text !== 'string') return null;
  if (PLACEHOLDER_MARKERS.some(marker => text.includes(marker))) {
    return `${fieldPath} looks like unfilled placeholder text — make sure you pasted the AI's actual generated roadmap, not the prompt template`;
  }
  const lower = text.trim().toLowerCase();
  if (REFUSAL_OPENERS.some(opener => lower.startsWith(opener))) {
    return `${fieldPath} looks like an AI refusal or explanation, not real roadmap content — ask the AI to generate the roadmap JSON and paste its actual output`;
  }
  return null;
}

// A resource entry mirrors the app's own { label, url } shape (limits.js's
// isValidResource) — label required and capped, url required and capped.
// Deliberately **not** checking the URL's protocol here — that's a save-time
// concern (roadmap-store.md's "Resource URLs must be validated before use"
// already applies it at both render time and save time), handled by
// schemaAdapter.js's normalizeResourceUrl()/isHttpUrl() when the item is
// actually converted. Rejecting a whole topic here because one resource's
// URL was missing "https://" (a very common, harmless LLM quirk — see issue
// #100 follow-up) was cascading into "item is invalid" errors across
// otherwise-perfectly-good roadmaps; the adapter now auto-corrects or
// silently drops a bad individual resource instead of failing the item.
function isValidResourceEntry(resource) {
  return !!resource && typeof resource === 'object' && !Array.isArray(resource)
    && typeof resource.label === 'string' && resource.label.trim().length > 0
    && resource.label.length <= MAX_RESOURCE_LABEL_LENGTH
    && typeof resource.url === 'string' && resource.url.trim().length > 0
    && resource.url.length <= MAX_RESOURCE_URL_LENGTH;
}

// A copy-code/copy-raw button was originally recommended here as the fix,
// but a live report (issue #121 item 1 follow-up) showed ChatGPT's own copy
// button reproducing the identical corruption, while manually selecting the
// raw text in the code block and copying that selection did not — a copy
// button is not reliably safe across AI providers/UI versions, so this no
// longer tells the user to trust one.
const CORRUPTION_HINT = 'this usually means it was copied from a rendered/markdown view of the AI\'s response instead of the raw text — try selecting the raw text directly with your mouse or trackpad instead of using a copy button, or ask it to resend the JSON';

function extractItemTitleText(item) {
  if (typeof item === 'string') return item;
  if (Array.isArray(item)) return item[0];
  return item?.title;
}

// Index of the first corrupted resource entry, or -1. `resources` may be
// anything (undefined, a non-array, etc.) — only a real array is scanned.
function findCorruptedResourceIndex(resources) {
  if (!Array.isArray(resources)) return -1;
  return resources.findIndex(r => looksCorrupted(r?.label) || looksCorrupted(r?.url));
}

// Index of the first (only) too-long title, or -1 — mirrors
// findCorruptedResourceIndex's "-1 means none found" convention. Checked
// before isValidItem()'s normal shape validation, same as the corruption
// check below, so an oversized title gets a specific, actionable
// "exceeds N characters" error instead of a bare "is invalid".
function itemTitleTooLong(item) {
  const titleText = extractItemTitleText(item);
  return typeof titleText === 'string' && titleText.length > MAX_TITLE_LENGTH;
}

// Scans a single item's title and resource label/url fields for the
// corruption markers above, returning the first specific error found (or
// `null`). Checked *before* isValidItem()'s normal shape validation so a
// corrupted item gets this actionable message instead of a bare "is
// invalid" — same path prefix (`phases[i].sections[j].items[k]`) either way.
function findItemCorruption(item, path) {
  const titleText = extractItemTitleText(item);
  const placeholderError = placeholderOrRefusalError(titleText, `${path}.title`);
  if (placeholderError) return placeholderError;
  if (looksCorrupted(titleText)) {
    return `${path}.title looks corrupted (contains encoded/JSON-like text) — ${CORRUPTION_HINT}`;
  }
  const isObjectItem = item && typeof item === 'object' && !Array.isArray(item);
  const badIndex = findCorruptedResourceIndex(isObjectItem ? item.resources : null);
  if (badIndex !== -1) {
    return `${path}.resources[${badIndex}] looks corrupted (contains encoded/JSON-like text) — ${CORRUPTION_HINT}`;
  }
  return null;
}

function isValidResourcesField(resources) {
  return resources === undefined
    || (Array.isArray(resources) && resources.length <= MAX_RESOURCES_PER_ITEM && resources.every(isValidResourceEntry));
}

function isValidTupleItem(item) {
  if (item.length !== 2) return false;
  const [title, priority] = item;
  return typeof title === 'string' && title.trim().length > 0 && title.length <= MAX_TITLE_LENGTH
    && VALID_PRIORITIES.includes(normalizePriority(priority));
}

function isValidObjectItem(item) {
  const titleOk = typeof item.title === 'string' && item.title.trim().length > 0 && item.title.length <= MAX_TITLE_LENGTH;
  const priorityOk = item.priority === undefined || VALID_PRIORITIES.includes(normalizePriority(item.priority));
  return titleOk && priorityOk && isValidResourcesField(item.resources);
}

// An item is one of three shapes: a plain string (inherits the phase's
// priority, no resources); a [title, priority] tuple; or an object form
// `{ title, priority?, resources? }` — the only shape that can carry
// resource links, added in issue #100's resources support. `priority` is
// optional on the object form (inherits the phase's priority when omitted),
// matching the plain-string item's existing behavior. Priority values are
// normalized (trim + uppercase) before the VALID_PRIORITIES check.
function isValidItem(item) {
  if (typeof item === 'string') return item.trim().length > 0 && item.length <= MAX_TITLE_LENGTH;
  if (Array.isArray(item)) return isValidTupleItem(item);
  if (item && typeof item === 'object') return isValidObjectItem(item);
  return false;
}

// One titled node's (phase/section) title check — corrupted, missing, or
// over length, in that priority order. Shared by the phase- and
// section-title checks below since both follow the identical three-way
// branch, just against a different `path` prefix.
function validateTitledNodeTitle(title, path, errors) {
  const placeholderError = placeholderOrRefusalError(title, `${path}.title`);
  if (placeholderError) {
    errors.push(placeholderError);
  } else if (looksCorrupted(title)) {
    errors.push(`${path}.title looks corrupted (contains encoded/JSON-like text) — ${CORRUPTION_HINT}`);
  } else if (typeof title !== 'string' || !title.trim()) {
    errors.push(`${path}.title is required`);
  } else if (title.length > MAX_TITLE_LENGTH) {
    errors.push(`${path}.title exceeds ${MAX_TITLE_LENGTH} characters`);
  }
}

// Validates one section's own items array, returning how many items were
// valid (rolled up into the payload-wide MAX_ITEMS check by the caller).
// Extracted out of validateImportPayload to keep its own complexity under
// the ESLint gate (root CLAUDE.md).
function validateSectionItems(section, path, errors) {
  if (!Array.isArray(section.items) || section.items.length === 0) {
    errors.push(`${path}.items must have at least one item`);
    return 0;
  }
  let validCount = 0;
  section.items.forEach((item, k) => {
    const itemPath = `${path}.items[${k}]`;
    const corruption = findItemCorruption(item, itemPath);
    if (corruption) {
      errors.push(corruption);
    } else if (itemTitleTooLong(item)) {
      errors.push(`${itemPath}.title exceeds ${MAX_TITLE_LENGTH} characters`);
    } else if (!isValidItem(item)) {
      errors.push(`item at ${itemPath} is invalid`);
    } else {
      validCount += 1;
    }
  });
  return validCount;
}

// Validates one phase's own sections array, returning the total valid item
// count across all of them.
function validatePhaseSections(phase, phasePath, errors) {
  if (!Array.isArray(phase.sections) || phase.sections.length === 0) {
    errors.push(`${phasePath}.sections must be a non-empty array`);
    return 0;
  }
  let totalItems = 0;
  phase.sections.forEach((section, j) => {
    const sectionPath = `${phasePath}.sections[${j}]`;
    if (!section || typeof section !== 'object' || Array.isArray(section)) {
      errors.push(`${sectionPath} is invalid`);
      return;
    }
    validateTitledNodeTitle(section.title, sectionPath, errors);
    totalItems += validateSectionItems(section, sectionPath, errors);
  });
  return totalItems;
}

// Validates one phase (shape/title/priority/sections), returning its own
// valid item count. Extracted out of validateImportPayload's phases.forEach
// to keep that function's complexity under the ESLint gate.
function validatePhase(phase, i, errors) {
  const phasePath = `phases[${i}]`;
  if (!phase || typeof phase !== 'object' || Array.isArray(phase)) {
    errors.push(`${phasePath} is invalid`);
    return 0;
  }
  validateTitledNodeTitle(phase.title, phasePath, errors);
  if (!VALID_PRIORITIES.includes(normalizePriority(phase.priority))) {
    errors.push(`${phasePath}.priority must be one of ${VALID_PRIORITIES.join(', ')}`);
  }
  return validatePhaseSections(phase, phasePath, errors);
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
  const titlePlaceholderError = placeholderOrRefusalError(data.title, 'title');
  if (titlePlaceholderError) {
    errors.push(titlePlaceholderError);
  } else if (typeof data.title !== 'string' || !data.title.trim()) {
    errors.push('title is required');
  }
  if (!Array.isArray(data.phases) || data.phases.length === 0) {
    errors.push('roadmap must have at least one phase');
    return errors;
  }

  let totalItems = 0;
  data.phases.forEach((phase, i) => {
    totalItems += validatePhase(phase, i, errors);
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
