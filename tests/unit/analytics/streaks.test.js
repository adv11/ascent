import { describe, it, expect } from 'vitest';
import {
  computeStreaks,
  maybeGrantStreakFreeze,
  maybeAutoApplyStreakFreeze,
  MAX_STREAK_FREEZES,
  FREEZE_GRANT_INTERVAL_MS
} from '../../../src/core/analytics/streaks.js';

const NOW = new Date(2026, 6, 10).getTime(); // 2026-07-10

describe('computeStreaks', () => {
  it('returns zeros for an empty log', () => {
    expect(computeStreaks({}, NOW)).toEqual({ current: 0, longest: 0 });
  });

  it('counts a current streak ending today', () => {
    const log = { '2026-07-08': 1, '2026-07-09': 2, '2026-07-10': 1 };
    expect(computeStreaks(log, NOW)).toEqual({ current: 3, longest: 3 });
  });

  it('today with 0 items does not break an existing streak but does not extend it', () => {
    const log = { '2026-07-08': 1, '2026-07-09': 1, '2026-07-10': 0 };
    expect(computeStreaks(log, NOW).current).toBe(2);
  });

  it('a gap breaks the current streak', () => {
    const log = { '2026-07-05': 1, '2026-07-06': 1, '2026-07-08': 1, '2026-07-09': 1, '2026-07-10': 1 };
    const result = computeStreaks(log, NOW);
    expect(result.current).toBe(3);
    expect(result.longest).toBe(3);
  });

  it('longest streak can be in the past, independent of the current one', () => {
    const log = {
      '2026-06-01': 1, '2026-06-02': 1, '2026-06-03': 1, '2026-06-04': 1, '2026-06-05': 1,
      '2026-07-10': 1
    };
    const result = computeStreaks(log, NOW);
    expect(result.current).toBe(1);
    expect(result.longest).toBe(5);
  });

  it('current streak is 0 when neither today nor yesterday has activity', () => {
    const log = { '2026-07-01': 1 };
    expect(computeStreaks(log, NOW).current).toBe(0);
  });

  it('a frozen day keeps the streak alive without a real completion', () => {
    // 07-09 missed, but frozen — the streak should bridge across it.
    const log = { '2026-07-08': 1, '2026-07-10': 1 };
    const result = computeStreaks(log, NOW, ['2026-07-09']);
    expect(result.current).toBe(3);
    // longest is untouched by freezes per the issue's explicit scoping —
    // only the real activeDates set feeds it.
    expect(result.longest).toBe(1);
  });

  it('an unfrozen gap still breaks the streak', () => {
    const log = { '2026-07-08': 1, '2026-07-10': 1 };
    const result = computeStreaks(log, NOW, ['2026-07-05']);
    expect(result.current).toBe(1);
  });
});

describe('maybeGrantStreakFreeze', () => {
  it('establishes a baseline lastGrantedAt on first call without granting', () => {
    const result = maybeGrantStreakFreeze({ available: 0, usedDates: [], lastGrantedAt: null }, NOW);
    expect(result).toEqual({ available: 0, usedDates: [], lastGrantedAt: NOW });
  });

  it('does not grant before the interval has elapsed', () => {
    const state = { available: 0, usedDates: [], lastGrantedAt: NOW };
    const result = maybeGrantStreakFreeze(state, NOW + FREEZE_GRANT_INTERVAL_MS - 1);
    expect(result.available).toBe(0);
    expect(result.lastGrantedAt).toBe(NOW);
  });

  it('grants once the interval has elapsed', () => {
    const state = { available: 0, usedDates: [], lastGrantedAt: NOW };
    const grantedAt = NOW + FREEZE_GRANT_INTERVAL_MS;
    const result = maybeGrantStreakFreeze(state, grantedAt);
    expect(result.available).toBe(1);
    expect(result.lastGrantedAt).toBe(grantedAt);
  });

  it('never exceeds MAX_STREAK_FREEZES', () => {
    const state = { available: MAX_STREAK_FREEZES, usedDates: [], lastGrantedAt: NOW };
    const result = maybeGrantStreakFreeze(state, NOW + FREEZE_GRANT_INTERVAL_MS * 2);
    expect(result.available).toBe(MAX_STREAK_FREEZES);
  });
});

describe('maybeAutoApplyStreakFreeze', () => {
  it('spends a freeze on a missed day that would otherwise break an active streak', () => {
    // Streak was active through 07-08 (day before yesterday); 07-09
    // (yesterday) has zero completions.
    const log = { '2026-07-08': 1 };
    const state = { available: 1, usedDates: [], lastGrantedAt: null };
    const result = maybeAutoApplyStreakFreeze(log, state, NOW);
    expect(result.available).toBe(0);
    expect(result.usedDates).toEqual(['2026-07-09']);
  });

  it('does nothing when there is no available freeze', () => {
    const log = { '2026-07-08': 1 };
    const state = { available: 0, usedDates: [], lastGrantedAt: null };
    const result = maybeAutoApplyStreakFreeze(log, state, NOW);
    expect(result).toBe(state);
  });

  it('does nothing when yesterday already has activity', () => {
    const log = { '2026-07-08': 1, '2026-07-09': 1 };
    const state = { available: 1, usedDates: [], lastGrantedAt: null };
    const result = maybeAutoApplyStreakFreeze(log, state, NOW);
    expect(result).toBe(state);
  });

  it('does nothing when there was no streak going into the missed day', () => {
    // Day before yesterday (07-08) also has no activity — nothing to protect.
    const log = {};
    const state = { available: 1, usedDates: [], lastGrantedAt: null };
    const result = maybeAutoApplyStreakFreeze(log, state, NOW);
    expect(result).toBe(state);
  });

  it('does not double-spend on an already-frozen day', () => {
    const log = { '2026-07-08': 1 };
    const state = { available: 1, usedDates: ['2026-07-09'], lastGrantedAt: null };
    const result = maybeAutoApplyStreakFreeze(log, state, NOW);
    expect(result).toBe(state);
  });
});
