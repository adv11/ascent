// Pure report-type definitions + validators for the in-app feedback system
// (issue #9) — no DOM, no Firebase, no store access, mirroring
// importValidator.js's "parse/validate is pure, everything else composes
// around it" precedent (.claude/rules/roadmap-store.md).

export const REPORT_TYPES = ['bug', 'feature', 'feedback'];
export const SEVERITIES = ['critical', 'high', 'medium', 'low'];
export const USAGE_FREQUENCIES = ['daily', 'weekly', 'occasionally', 'one-time'];

export const MAX_TITLE_LENGTH = 120;
export const MAX_DESCRIPTION_LENGTH = 2000;
export const MAX_STEPS_LENGTH = 2000;

function isNonEmptyString(value, maxLength) {
  return typeof value === 'string' && value.trim().length > 0 && value.length <= maxLength;
}

// The bug report's own free-text fields (everything but severity, checked
// separately by validateBugReport below) — extracted to keep that
// function's own complexity under the ESLint gate (root CLAUDE.md).
function validateBugReportTextFields(report) {
  const errors = [];
  if (!isNonEmptyString(report?.title, MAX_TITLE_LENGTH)) errors.push('title is required');
  if (!isNonEmptyString(report?.steps, MAX_STEPS_LENGTH)) errors.push('steps is required');
  if (!isNonEmptyString(report?.expected, MAX_DESCRIPTION_LENGTH)) errors.push('expected is required');
  if (!isNonEmptyString(report?.actual, MAX_DESCRIPTION_LENGTH)) errors.push('actual is required');
  return errors;
}

// Every validator returns an array of field-error strings — empty means
// valid, same contract importValidator.js's validateImportText() uses.
export function validateBugReport(report) {
  const errors = validateBugReportTextFields(report);
  if (!SEVERITIES.includes(report?.severity)) errors.push('severity is required');
  return errors;
}

export function validateFeatureRequest(report) {
  const errors = [];
  if (!isNonEmptyString(report?.title, MAX_TITLE_LENGTH)) errors.push('title is required');
  if (!isNonEmptyString(report?.description, MAX_DESCRIPTION_LENGTH)) errors.push('description is required');
  if (!isNonEmptyString(report?.useCase, MAX_DESCRIPTION_LENGTH)) errors.push('useCase is required');
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
    severity: form.severity,
    description: null,
    steps: (form.steps || '').trim(),
    expected: (form.expected || '').trim(),
    actual: (form.actual || '').trim(),
    useCase: null,
    usageFreq: null
  };
}

function featureTypeFields(form) {
  return {
    severity: null,
    description: (form.description || '').trim(),
    steps: null,
    expected: null,
    actual: null,
    useCase: (form.useCase || '').trim(),
    usageFreq: form.usageFreq || null
  };
}

function feedbackTypeFields(form) {
  return {
    severity: null,
    description: (form.description || '').trim(),
    steps: null,
    expected: null,
    actual: null,
    useCase: null,
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
// has the same shape regardless of type.
export function buildReportPayload({ type, form, metadata, userId, isAnonymous, screenshotB64, screenshotOmitted, now }) {
  return {
    type,
    title: form.title.trim(),
    ...typeSpecificFields(type, form),
    screenshotB64: screenshotB64 || null,
    screenshotOmitted: !!screenshotOmitted,
    metadata: metadata || null,
    userId: userId || null,
    isAnonymous: !!isAnonymous,
    status: 'new',
    submittedAt: now
  };
}

// The users/{uid}/reports/{id} summary payload — everything but the
// screenshot, to save quota (§6.2).
export function buildReportSummary(fullPayload) {
  // eslint-disable-next-line no-unused-vars -- destructured only to exclude it
  const { screenshotB64, ...summary } = fullPayload;
  return summary;
}
