import { describe, it, expect } from 'vitest';
import {
  validateBugReport,
  validateFeatureRequest,
  validateGeneralFeedback,
  validateReport,
  buildReportPayload
} from '../../src/core/feedback/reportSchema.js';

describe('validateBugReport', () => {
  const valid = { title: 'Crashes on save', severity: 'high', whatHappened: 'Clicked save and it crashed.' };

  it('accepts a fully filled report', () => {
    expect(validateBugReport(valid)).toEqual([]);
  });

  it('accepts a report with no severity set — it defaults later, not required here', () => {
    expect(validateBugReport({ ...valid, severity: undefined })).toEqual([]);
  });

  it('flags a missing title', () => {
    expect(validateBugReport({ ...valid, title: '' })).toContain('title is required');
  });

  it('flags a missing "what happened" field', () => {
    expect(validateBugReport({ ...valid, whatHappened: '' })).toContain('whatHappened is required');
  });
});

describe('validateFeatureRequest', () => {
  it('accepts title + description', () => {
    expect(validateFeatureRequest({ title: 'Dark mode', description: 'Add a toggle for night use' })).toEqual([]);
  });

  it('flags a missing description', () => {
    const errors = validateFeatureRequest({ title: 'Dark mode', description: '' });
    expect(errors).toContain('description is required');
  });
});

describe('validateGeneralFeedback', () => {
  it('accepts title + description', () => {
    expect(validateGeneralFeedback({ title: 'Nice app', description: 'Loving it' })).toEqual([]);
  });

  it('flags missing fields', () => {
    expect(validateGeneralFeedback({ title: '', description: '' })).toEqual(['title is required', 'description is required']);
  });
});

describe('validateReport', () => {
  it('dispatches to the right validator by type', () => {
    expect(validateReport('bug', {})).toContain('title is required');
    expect(validateReport('feature', {})).toContain('title is required');
    expect(validateReport('feedback', {})).toContain('title is required');
  });

  it('rejects an unrecognized type', () => {
    expect(validateReport('nonsense', {})).toEqual(['type is invalid']);
  });
});

describe('buildReportPayload', () => {
  it('nulls out fields that do not apply to the given type', () => {
    const payload = buildReportPayload({
      type: 'feature',
      form: { title: 'Export PDF', description: 'Add PDF export', usageFreq: 'weekly' },
      metadata: null,
      userId: 'uid-1',
      isAnonymous: false,
      now: 12345
    });
    expect(payload.severity).toBeNull();
    expect(payload.whatHappened).toBeNull();
    expect(payload.description).toBe('Add PDF export');
    expect(payload.status).toBe('new');
    expect(payload.submittedAt).toBe(12345);
  });

  it('defaults an unset bug-report severity to "medium"', () => {
    const payload = buildReportPayload({
      type: 'bug',
      form: { title: 'Bug', whatHappened: 'It broke.' },
      metadata: null,
      userId: 'uid-1',
      isAnonymous: false,
      now: 1
    });
    expect(payload.severity).toBe('medium');
  });

  it('never has a screenshotB64/screenshotOmitted field — removed in issue #348', () => {
    const payload = buildReportPayload({
      type: 'bug',
      form: { title: 'Bug', severity: 'low', whatHappened: 'It broke.' },
      metadata: null,
      userId: 'uid-1',
      isAnonymous: false,
      now: 1
    });
    expect('screenshotB64' in payload).toBe(false);
    expect('screenshotOmitted' in payload).toBe(false);
  });
});
