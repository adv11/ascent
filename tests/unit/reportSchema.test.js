import { describe, it, expect } from 'vitest';
import {
  validateBugReport,
  validateFeatureRequest,
  validateGeneralFeedback,
  validateReport,
  buildReportPayload,
  buildReportSummary
} from '../../src/core/feedback/reportSchema.js';

describe('validateBugReport', () => {
  const valid = { title: 'Crashes on save', severity: 'high', steps: '1. Click save', expected: 'Saves', actual: 'Crashes' };

  it('accepts a fully filled report', () => {
    expect(validateBugReport(valid)).toEqual([]);
  });

  it('flags a missing title', () => {
    expect(validateBugReport({ ...valid, title: '' })).toContain('title is required');
  });

  it('flags a missing description-equivalent fields', () => {
    expect(validateBugReport({ ...valid, steps: '' })).toContain('steps is required');
    expect(validateBugReport({ ...valid, expected: '' })).toContain('expected is required');
    expect(validateBugReport({ ...valid, actual: '' })).toContain('actual is required');
  });

  it('flags severity out of range', () => {
    expect(validateBugReport({ ...valid, severity: 'urgent' })).toContain('severity is required');
    expect(validateBugReport({ ...valid, severity: undefined })).toContain('severity is required');
  });
});

describe('validateFeatureRequest', () => {
  it('accepts a fully filled request', () => {
    expect(validateFeatureRequest({ title: 'Dark mode', description: 'Add a toggle', useCase: 'Night use' })).toEqual([]);
  });

  it('flags a missing use case', () => {
    const errors = validateFeatureRequest({ title: 'Dark mode', description: 'Add a toggle', useCase: '' });
    expect(errors).toContain('useCase is required');
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

describe('buildReportPayload / buildReportSummary', () => {
  it('nulls out fields that do not apply to the given type', () => {
    const payload = buildReportPayload({
      type: 'feature',
      form: { title: 'Export PDF', description: 'Add PDF export', useCase: 'Sharing', usageFreq: 'weekly' },
      metadata: null,
      userId: 'uid-1',
      isAnonymous: false,
      screenshotB64: null,
      screenshotOmitted: false,
      now: 12345
    });
    expect(payload.severity).toBeNull();
    expect(payload.steps).toBeNull();
    expect(payload.useCase).toBe('Sharing');
    expect(payload.status).toBe('new');
    expect(payload.submittedAt).toBe(12345);
  });

  it('never includes screenshotB64 in the summary payload', () => {
    const full = buildReportPayload({
      type: 'bug',
      form: { title: 'Bug', severity: 'low', steps: 's', expected: 'e', actual: 'a' },
      metadata: null,
      userId: 'uid-1',
      isAnonymous: false,
      screenshotB64: 'data:image/png;base64,abc',
      screenshotOmitted: false,
      now: 1
    });
    const summary = buildReportSummary(full);
    expect(summary.screenshotB64).toBeUndefined();
    expect('screenshotB64' in summary).toBe(false);
    expect(summary.title).toBe('Bug');
  });
});
