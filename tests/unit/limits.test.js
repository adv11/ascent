import { describe, it, expect } from 'vitest';
import { isValidResource, isValidTags, MAX_RESOURCE_LABEL_LENGTH, MAX_RESOURCE_URL_LENGTH, MAX_TAG_LENGTH, MAX_TAGS_PER_ITEM } from '../../src/core/roadmap/limits.js';
import { clampDurationMs, MIN_DURATION_MS, MAX_DURATION_MS } from '../../src/core/dailyTodo/limits.js';

describe('roadmap/limits — isValidResource', () => {
  it('accepts a valid resource', () => {
    expect(isValidResource({ label: 'Docs', url: 'https://example.com' })).toBe(true);
  });

  it('rejects a falsy resource', () => {
    expect(isValidResource(null)).toBe(false);
    expect(isValidResource(undefined)).toBe(false);
  });

  it('rejects a non-string label or url', () => {
    expect(isValidResource({ label: 1, url: 'https://example.com' })).toBe(false);
    expect(isValidResource({ label: 'Docs', url: null })).toBe(false);
  });

  it('accepts a label/url at exactly the max length', () => {
    const label = 'a'.repeat(MAX_RESOURCE_LABEL_LENGTH);
    const url = 'https://x.com/' + 'a'.repeat(MAX_RESOURCE_URL_LENGTH - 14);
    expect(url.length).toBe(MAX_RESOURCE_URL_LENGTH);
    expect(isValidResource({ label, url })).toBe(true);
  });

  it('rejects a label/url one character over the max length', () => {
    const label = 'a'.repeat(MAX_RESOURCE_LABEL_LENGTH + 1);
    expect(isValidResource({ label, url: 'https://example.com' })).toBe(false);
    const url = 'https://' + 'a'.repeat(MAX_RESOURCE_URL_LENGTH);
    expect(isValidResource({ label: 'Docs', url })).toBe(false);
  });
});

describe('roadmap/limits — isValidTags', () => {
  it('accepts an empty array', () => {
    expect(isValidTags([])).toBe(true);
  });

  it('rejects a non-array', () => {
    expect(isValidTags(null)).toBe(false);
    expect(isValidTags('java')).toBe(false);
  });

  it('accepts exactly MAX_TAGS_PER_ITEM tags', () => {
    const tags = Array.from({ length: MAX_TAGS_PER_ITEM }, (_, i) => `tag${i}`);
    expect(isValidTags(tags)).toBe(true);
  });

  it('rejects one tag over MAX_TAGS_PER_ITEM', () => {
    const tags = Array.from({ length: MAX_TAGS_PER_ITEM + 1 }, (_, i) => `tag${i}`);
    expect(isValidTags(tags)).toBe(false);
  });

  it('rejects an empty-string tag', () => {
    expect(isValidTags(['']))
      .toBe(false);
  });

  it('accepts a tag at exactly MAX_TAG_LENGTH and rejects one over it', () => {
    expect(isValidTags(['a'.repeat(MAX_TAG_LENGTH)])).toBe(true);
    expect(isValidTags(['a'.repeat(MAX_TAG_LENGTH + 1)])).toBe(false);
  });

  it('rejects a non-string tag inside an otherwise valid array', () => {
    expect(isValidTags(['java', 42])).toBe(false);
  });
});

describe('dailyTodo/limits — clampDurationMs', () => {
  it('returns null for NaN', () => {
    expect(clampDurationMs(NaN)).toBeNull();
  });

  it('returns null for Infinity/-Infinity', () => {
    expect(clampDurationMs(Infinity)).toBeNull();
    expect(clampDurationMs(-Infinity)).toBeNull();
  });

  it('returns null for a non-numeric input', () => {
    expect(clampDurationMs('1000')).toBeNull();
    expect(clampDurationMs(undefined)).toBeNull();
  });

  it('clamps a negative value up to MIN_DURATION_MS', () => {
    expect(clampDurationMs(-1000)).toBe(MIN_DURATION_MS);
  });

  it('clamps a value below MIN_DURATION_MS up to the minimum', () => {
    expect(clampDurationMs(1000)).toBe(MIN_DURATION_MS);
  });

  it('clamps a value above MAX_DURATION_MS down to the maximum', () => {
    expect(clampDurationMs(MAX_DURATION_MS + 1000)).toBe(MAX_DURATION_MS);
  });

  it('passes through a value already within bounds unchanged', () => {
    const mid = MIN_DURATION_MS + 1000;
    expect(clampDurationMs(mid)).toBe(mid);
  });

  it('returns the exact boundary values unchanged', () => {
    expect(clampDurationMs(MIN_DURATION_MS)).toBe(MIN_DURATION_MS);
    expect(clampDurationMs(MAX_DURATION_MS)).toBe(MAX_DURATION_MS);
  });
});
