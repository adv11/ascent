import { describe, it, expect } from 'vitest';
import { computeElapsedSeconds, accumulateElapsed, formatTimeSpent } from '../../src/core/time/timeTracking.js';

describe('computeElapsedSeconds', () => {
  it('returns whole seconds between startedAt and now', () => {
    expect(computeElapsedSeconds(1000, 1000 + 65000)).toBe(65);
  });

  it('floors partial seconds', () => {
    expect(computeElapsedSeconds(1000, 1000 + 1999)).toBe(1);
  });

  it('clamps a backward clock adjustment to 0, never negative', () => {
    expect(computeElapsedSeconds(2000, 1000)).toBe(0);
  });

  it('returns 0 for a non-finite startedAt', () => {
    expect(computeElapsedSeconds(null, 1000)).toBe(0);
    expect(computeElapsedSeconds(undefined, 1000)).toBe(0);
  });
});

describe('accumulateElapsed — start, pause/resume, stop', () => {
  it('start -> stop adds the elapsed session to the running total', () => {
    const startedAt = 1000;
    const now = 1000 + 30000;
    expect(accumulateElapsed(0, startedAt, now)).toBe(30);
  });

  it('pause then resume (a second independent session) does not double-count the first session', () => {
    // First session: 0 -> 30s elapsed, folded into the total on pause.
    const total1 = accumulateElapsed(0, 1000, 1000 + 30000);
    expect(total1).toBe(30);

    // Resuming starts a brand-new session from a fresh startedAt — the
    // caller must never re-pass the old startedAt, so a second 20s session
    // on top of the 30s total should land at exactly 50, not 80 or more.
    const startedAt2 = 5000;
    const total2 = accumulateElapsed(total1, startedAt2, startedAt2 + 20000);
    expect(total2).toBe(50);
  });

  it('treats a missing/invalid prior total as 0', () => {
    expect(accumulateElapsed(undefined, 1000, 1000 + 10000)).toBe(10);
    expect(accumulateElapsed(NaN, 1000, 1000 + 10000)).toBe(10);
    expect(accumulateElapsed(-5, 1000, 1000 + 10000)).toBe(10);
  });
});

describe('formatTimeSpent', () => {
  it('formats seconds only under a minute', () => {
    expect(formatTimeSpent(45)).toBe('45s');
  });

  it('formats minutes with no hours', () => {
    expect(formatTimeSpent(125)).toBe('2m');
  });

  it('formats hours and minutes', () => {
    expect(formatTimeSpent(3723)).toBe('1h 2m');
  });

  it('treats missing/invalid input as 0', () => {
    expect(formatTimeSpent(undefined)).toBe('0s');
    expect(formatTimeSpent(-10)).toBe('0s');
    expect(formatTimeSpent(NaN)).toBe('0s');
  });
});
