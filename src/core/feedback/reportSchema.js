// Pure report-type definitions + validators for the in-app feedback system
// (issue #9, simplified in issue #348) — no DOM, no Firebase, no store access,
// mirroring importValidator.js's "parse/validate is pure, everything else
// composes around it" precedent (.claude/rules/roadmap-store.md).

export const REPORT_TYPES = ['bug', 'feature', 'feedback'];
export const SEVERITIES = ['critical', 'high', 'medium', 'low'];
export const DEFAULT_SEVERITY = 'medium';
export const USAGE_FREQUENCIES = ['daily', 'weekly', 'occasionally', 'one-time'];

export const MAX_TITLE_LENGTH = 120;
export const MAX_DESCRIPTION_LENGTH = 2000;

function isNonEmptyString(value, maxLength) {
  return typeof value === 'string' && value.trim().length > 0 && value.length <= maxLength;
}

// Every validator returns an array of field-error strings — empty means
// valid, same contract importValidator.js's validateImportText() uses.
// Issue #348 collapsed the bug report's Steps/Expected/Actual fields into one
// "What happened?" field, and dropped Severity's required status (it defaults
// to 'medium' when left unset — see buildReportPayload below).
export function validateBugReport(report) {
  const errors = [];
  if (!isNonEmptyString(report?.title, MAX_TITLE_LENGTH)) errors.push('title is required');
  if (!isNonEmptyString(report?.whatHappened, MAX_DESCRIPTION_LENGTH)) errors.push('whatHappened is required');
  return errors;
}

// Issue #348 collapsed "Describe the feature"/"Your use case" into one
// "Describe the feature" field.
export function validateFeatureRequest(report) {
  const errors = [];
  if (!isNonEmptyString(report?.title, MAX_TITLE_LENGTH)) errors.push('title is required');
  if (!isNonEmptyString(report?.description, MAX_DESCRIPTION_LENGTH)) errors.push('description is required');
  return errors;
}

export function validateGeneralFeedback(report) {
  const errors = [];
  if (!isNonEmptyString(report?.title, MAX_TITLE_LENGTH)) errors.push('title is required');
  if (!isNonEmptyString(report?.description, MAX_DESCRIPTION_LENGTH)) errors.push('description is required');
  return errors;
}

export function validateReport(type, report) {
  if (type === 'bug') return validateBugReport(report);
  if (type === 'feature') return validateFeatureRequest(report);
  if (type === 'feedback') return validateGeneralFeedback(report);
  return ['type is invalid'];
}

// Every report type's own schema fields — every other type's copy of these
// fields is explicitly null (see buildReportPayload's own comment below for
// why). Extracted out of buildReportPayload to keep its own complexity under
// the ESLint gate (root CLAUDE.md).
function bugTypeFields(form) {
  return {
    severity: form.severity || DEFAULT_SEVERITY,
    description: null,
    whatHappened: (form.whatHappened || '').trim(),
    usageFreq: null
  };
}

function featureTypeFields(form) {
  return {
    severity: null,
    description: (form.description || '').trim(),
    whatHappened: null,
    usageFreq: form.usageFreq || null
  };
}

function feedbackTypeFields(form) {
  return {
    severity: null,
    description: (form.description || '').trim(),
    whatHappened: null,
    usageFreq: null
  };
}

function typeSpecificFields(type, form) {
  if (type === 'bug') return bugTypeFields(form);
  if (type === 'feature') return featureTypeFields(form);
  return feedbackTypeFields(form);
}

// Builds the exact payload shape written to Firebase (§6.1 of issue #9) from
// form state + collected metadata — every field the schema doesn't apply to
// a given type is explicitly null, never omitted, so every report document
// has the same shape regardless of type. Written to both `reports/{id}` and
// `users/{uid}/reports/{id}` — issue #348 removed the screenshot feature
// entirely, so there is no longer a separate, smaller summary shape to build;
// both paths get this exact payload.
export function buildReportPayload({ type, form, metadata, userId, isAnonymous, now }) {
  return {
    type,
    title: form.title.trim(),
    ...typeSpecificFields(type, form),
    metadata: metadata || null,
    userId: userId || null,
    isAnonymous: !!isAnonymous,
    status: 'new',
    submittedAt: now
  };
}
