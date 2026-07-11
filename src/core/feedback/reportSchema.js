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

// Every validator returns an array of field-error strings — empty means
// valid, same contract importValidator.js's validateImportText() uses.
export function validateBugReport(report) {
  const errors = [];
  if (!isNonEmptyString(report?.title, MAX_TITLE_LENGTH)) errors.push('title is required');
  if (!SEVERITIES.includes(report?.severity)) errors.push('severity is required');
  if (!isNonEmptyString(report?.steps, MAX_STEPS_LENGTH)) errors.push('steps is required');
  if (!isNonEmptyString(report?.expected, MAX_DESCRIPTION_LENGTH)) errors.push('expected is required');
  if (!isNonEmptyString(report?.actual, MAX_DESCRIPTION_LENGTH)) errors.push('actual is required');
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

// Builds the exact payload shape written to Firebase (§6.1 of issue #9) from
// form state + collected metadata — every field the schema doesn't apply to
// a given type is explicitly null, never omitted, so every report document
// has the same shape regardless of type.
export function buildReportPayload({ type, form, metadata, userId, isAnonymous, screenshotB64, screenshotOmitted, now }) {
  return {
    type,
    severity: type === 'bug' ? form.severity : null,
    title: form.title.trim(),
    description: type === 'bug' ? null : (form.description || '').trim(),
    steps: type === 'bug' ? (form.steps || '').trim() : null,
    expected: type === 'bug' ? (form.expected || '').trim() : null,
    actual: type === 'bug' ? (form.actual || '').trim() : null,
    useCase: type === 'feature' ? (form.useCase || '').trim() : null,
    usageFreq: type === 'feature' ? (form.usageFreq || null) : null,
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
