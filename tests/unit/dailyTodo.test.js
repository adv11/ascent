import { describe, it, expect } from 'vitest';
import { isExpired, remainingMs, formatRemaining, remainingBand } from '../../src/ui/utils/dailyTodo.js';
import { clampDurationMs, MIN_DURATION_MS, MAX_DURATION_MS } from '../../src/core/dailyTodo/limits.js';

describe('isExpired', () => {
  it('is not expired when now < expiresAt', () => {
    expect(isExpired({ done: false, expiresAt: 2000 }, 1000)).toBe(false);
  });

  it('is expired when now > expiresAt', () => {
    expect(isExpired({ done: false, expiresAt: 1000 }, 2000)).toBe(true);
  });

  it('a done item is never expired regardless of time', () => {
    expect(isExpired({ done: true, expiresAt: 1000 }, 999999)).toBe(false);
  });
});

describe('remainingMs', () => {
  it('returns the difference between expiresAt and now', () => {
    expect(remainingMs({ expiresAt: 5000 }, 2000)).toBe(3000);
  });
});

describe('formatRemaining', () => {
  it('exact-boundary ms === 0 -> Missed', () => {
    expect(formatRemaining(0)).toBe('Missed');
  });

  it('negative (already missed) -> Missed', () => {
    expect(formatRemaining(-1)).toBe('Missed');
  });

  it('just-created (~24h remaining)', () => {
    expect(formatRemaining(24 * 60 * 60 * 1000)).toBe('24h 0m left');
  });

  it('just-under-a-minute', () => {
    expect(formatRemaining(59 * 1000)).toBe('<1m left');
  });

  it('minutes only, no hours', () => {
    expect(formatRemaining(5 * 60 * 1000)).toBe('5m left');
  });
});

describe('remainingBand', () => {
  it('ok when > 6h remaining', () => {
    expect(remainingBand(7 * 60 * 60 * 1000)).toBe('ok');
  });

  it('warn when < 6h remaining', () => {
    expect(remainingBand(3 * 60 * 60 * 1000)).toBe('warn');
  });

  it('danger when < 1h remaining', () => {
    expect(remainingBand(30 * 60 * 1000)).toBe('danger');
  });

  it('danger when already missed', () => {
    expect(remainingBand(-1)).toBe('danger');
  });
});

describe('clampDurationMs', () => {
  it('clamps below the minimum', () => {
    expect(clampDurationMs(1000)).toBe(MIN_DURATION_MS);
  });

  it('clamps above the maximum', () => {
    expect(clampDurationMs(MAX_DURATION_MS * 10)).toBe(MAX_DURATION_MS);
  });

  it('passes through an in-range value', () => {
    const ms = 5 * 60 * 60 * 1000;
    expect(clampDurationMs(ms)).toBe(ms);
  });

  it('returns null for a non-finite value', () => {
    expect(clampDurationMs(NaN)).toBeNull();
    expect(clampDurationMs(undefined)).toBeNull();
  });
});
