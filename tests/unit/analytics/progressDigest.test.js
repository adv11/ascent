import { describe, it, expect } from 'vitest';
import {
  computeWeeklyCompletedCount,
  computeProgressDigest,
  hasDigestContent,
  formatDigestMessage
} from '../../../src/core/analytics/progressDigest.js';

const NOW = new Date(2026, 6, 10).getTime(); // 2026-07-10

describe('computeWeeklyCompletedCount', () => {
  it('returns 0 for an empty log', () => {
    expect(computeWeeklyCompletedCount({}, NOW)).toBe(0);
  });

  it('sums the trailing 7 calendar days, today inclusive', () => {
    const log = { '2026-07-10': 3, '2026-07-09': 2, '2026-07-04': 1 };
    expect(computeWeeklyCompletedCount(log, NOW)).toBe(6);
  });

  it('ignores activity outside the trailing 7-day window', () => {
    const log = { '2026-07-10': 1, '2026-07-01': 100 };
    expect(computeWeeklyCompletedCount(log, NOW)).toBe(1);
  });
});

describe('computeProgressDigest', () => {
  it('returns zeros for an empty log with no streak', () => {
    expect(computeProgressDigest({}, NOW)).toEqual({ completedCount: 0, streakDays: 0 });
  });

  it('combines the weekly completed count with the current streak', () => {
    const log = { '2026-07-10': 2, '2026-07-09': 1, '2026-07-08': 1 };
    expect(computeProgressDigest(log, NOW)).toEqual({ completedCount: 4, streakDays: 3 });
  });

  it('treats a frozen date as part of the streak, matching computeStreaks', () => {
    // 07-09 missed but frozen; 07-10 and 07-08 both active.
    const log = { '2026-07-10': 1, '2026-07-08': 1 };
    const digest = computeProgressDigest(log, NOW, ['2026-07-09']);
    expect(digest.streakDays).toBe(3);
  });
});

describe('hasDigestContent', () => {
  it('is false for a digest with no completions and no streak', () => {
    expect(hasDigestContent({ completedCount: 0, streakDays: 0 })).toBe(false);
  });

  it('is true when there are completions, even with no streak', () => {
    expect(hasDigestContent({ completedCount: 1, streakDays: 0 })).toBe(true);
  });

  it('is true when there is a streak, even with zero completions this exact window', () => {
    expect(hasDigestContent({ completedCount: 0, streakDays: 2 })).toBe(true);
  });

  it('is false for a null/undefined digest', () => {
    expect(hasDigestContent(null)).toBe(false);
    expect(hasDigestContent(undefined)).toBe(false);
  });
});

describe('formatDigestMessage', () => {
  it('uses singular "topic" for exactly one completion, no streak sentence', () => {
    expect(formatDigestMessage({ completedCount: 1, streakDays: 0 })).toBe('You completed 1 topic this week.');
  });

  it('uses plural "topics" for zero or more than one', () => {
    expect(formatDigestMessage({ completedCount: 0, streakDays: 0 })).toBe('You completed 0 topics this week.');
    expect(formatDigestMessage({ completedCount: 12, streakDays: 0 })).toBe('You completed 12 topics this week.');
  });

  it('appends a streak sentence for a 1-day streak', () => {
    expect(formatDigestMessage({ completedCount: 3, streakDays: 1 }))
      .toBe("You completed 3 topics this week. You're on a 1-day streak.");
  });

  it('appends a streak sentence for a multi-day streak — "day" stays singular in the compound adjective', () => {
    expect(formatDigestMessage({ completedCount: 12, streakDays: 3 }))
      .toBe("You completed 12 topics this week. You're on a 3-day streak.");
  });
});
