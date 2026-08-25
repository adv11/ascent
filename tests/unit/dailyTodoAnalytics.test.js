import { describe, it, expect } from 'vitest';
import { computeDailyTodoStats } from '../../src/core/analytics/dailyTodoAnalytics.js';
import { dateKey } from '../../src/core/analytics/dateKey.js';

const NOW = new Date(2024, 5, 15, 12, 0, 0).getTime();

function makeTodo(overrides = {}) {
  return {
    id: 't1',
    title: 'Task',
    createdAt: NOW - 60000,
    expiresAt: NOW + 60000,
    done: false,
    doneAt: null,
    startedAt: null,
    ...overrides
  };
}

describe('computeDailyTodoStats', () => {
  it('returns all-zero/null stats for an empty list', () => {
    const stats = computeDailyTodoStats([], NOW);
    expect(stats.totalCount).toBe(0);
    expect(stats.doneCount).toBe(0);
    expect(stats.missedCount).toBe(0);
    expect(stats.activeCount).toBe(0);
    expect(stats.completionRatePct).toBeNull();
    expect(stats.avgTimeSpentSeconds).toBeNull();
    expect(stats.avgTurnaroundMs).toBeNull();
    expect(stats.dailyBuckets).toHaveLength(30);
  });

  it('buckets a mix of done/missed/active todos into the right counts', () => {
    const todos = [
      makeTodo({ id: 'a', done: true, doneAt: NOW - 1000, createdAt: NOW - 5000 }),
      makeTodo({ id: 'b', done: false, expiresAt: NOW - 1000 }), // missed
      makeTodo({ id: 'c', done: false, expiresAt: NOW + 60000 }) // active
    ];
    const stats = computeDailyTodoStats(todos, NOW);
    expect(stats.totalCount).toBe(3);
    expect(stats.doneCount).toBe(1);
    expect(stats.missedCount).toBe(1);
    expect(stats.activeCount).toBe(1);
    expect(stats.completionRatePct).toBe(50); // 1 done / (1 done + 1 missed)
  });

  it('completion rate ignores still-active todos entirely', () => {
    const todos = [makeTodo({ id: 'a', done: false, expiresAt: NOW + 60000 })];
    expect(computeDailyTodoStats(todos, NOW).completionRatePct).toBeNull();
  });

  it('averages timeSpentSeconds only across todos that actually tracked time', () => {
    const todos = [
      makeTodo({ id: 'a', timeSpentSeconds: 100 }),
      makeTodo({ id: 'b', timeSpentSeconds: 200 }),
      makeTodo({ id: 'c' }) // never tracked — excluded, not treated as 0
    ];
    expect(computeDailyTodoStats(todos, NOW).avgTimeSpentSeconds).toBe(150);
  });

  it('averages turnaround (doneAt - createdAt) only across done todos', () => {
    const todos = [
      makeTodo({ id: 'a', done: true, createdAt: NOW - 10000, doneAt: NOW - 5000 }), // 5000ms
      makeTodo({ id: 'b', done: true, createdAt: NOW - 20000, doneAt: NOW - 5000 }), // 15000ms
      makeTodo({ id: 'c', done: false })
    ];
    expect(computeDailyTodoStats(todos, NOW).avgTurnaroundMs).toBe(10000);
  });

  it('a missed todo well outside the 48h visibility window still counts toward missedCount', () => {
    const longAgo = NOW - 10 * 24 * 60 * 60 * 1000;
    const todos = [makeTodo({ id: 'a', done: false, expiresAt: longAgo })];
    const stats = computeDailyTodoStats(todos, NOW);
    expect(stats.missedCount).toBe(1);
  });

  it('dailyBuckets counts a done todo on its doneAt day and a missed one on its expiresAt day', () => {
    const todos = [
      makeTodo({ id: 'a', done: true, doneAt: NOW, createdAt: NOW }),
      makeTodo({ id: 'b', done: false, expiresAt: NOW - 1, createdAt: NOW })
    ];
    const stats = computeDailyTodoStats(todos, NOW);
    const today = stats.dailyBuckets.find(b => b.date === dateKey(NOW));
    expect(today.done).toBe(1);
    expect(today.missed).toBe(1);
    expect(today.created).toBe(2);
  });

  it('dailyBuckets is a 30-day window ending today, oldest first', () => {
    const stats = computeDailyTodoStats([], NOW);
    expect(stats.dailyBuckets[stats.dailyBuckets.length - 1].date).toBe(dateKey(NOW));
    expect(stats.dailyBuckets[0].date).not.toBe(dateKey(NOW));
  });
});
