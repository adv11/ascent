import { describe, it, expect, beforeEach } from 'vitest';
import { canSubmit, recordSubmit, msUntilNextSubmit } from '../../src/services/feedbackRateLimit.js';
import { KEYS } from '../../src/services/localStorageKeys.js';

const NOW = 1_800_000_000_000;

beforeEach(() => {
  localStorage.clear();
});

describe('canSubmit', () => {
  it('is true with a fresh state', () => {
    expect(canSubmit(NOW)).toBe(true);
  });

  it('is false after 3 submits within 24h', () => {
    recordSubmit(NOW - 3 * 3600_000);
    recordSubmit(NOW - 2 * 3600_000);
    recordSubmit(NOW - 1 * 3600_000);
    expect(canSubmit(NOW)).toBe(false);
  });

  it('is false after 1 submit within the last 60s (burst guard)', () => {
    recordSubmit(NOW - 10_000);
    expect(canSubmit(NOW)).toBe(false);
  });

  it('is true again once the burst window and daily count both clear', () => {
    recordSubmit(NOW - 25 * 3600_000);
    expect(canSubmit(NOW)).toBe(true);
  });
});

describe('recordSubmit', () => {
  it('prunes entries older than 24h', () => {
    recordSubmit(NOW - 25 * 3600_000);
    recordSubmit(NOW);
    const log = JSON.parse(localStorage.getItem(KEYS.FEEDBACK_RATE));
    expect(log).toEqual([NOW]);
  });
});

describe('msUntilNextSubmit', () => {
  it('is 0 when submission is currently allowed', () => {
    expect(msUntilNextSubmit(NOW)).toBe(0);
  });

  it('reflects the burst cooldown', () => {
    recordSubmit(NOW - 10_000);
    const remaining = msUntilNextSubmit(NOW);
    expect(remaining).toBeGreaterThan(0);
    expect(remaining).toBeLessThanOrEqual(50_000);
  });
});
