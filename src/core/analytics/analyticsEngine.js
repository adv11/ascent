import { dateKey } from './dateKey.js';
import { computeStreaks } from './streaks.js';
import { computeVelocity } from './velocity.js';
import { computeHeatmap } from './heatmapData.js';
import { computeProjection } from './projection.js';

// Backfill (issue #8's Part A1 compat note): an item with `done: true` but
// no `completedAt` predates issue #18 (which introduced the field) — treat
// its `updatedAt` as a reasonable stand-in for computation purposes only.
// Never written back to the store (roadmapStore.js's own item stays
// untouched) — this is purely a read-time fallback.
export function effectiveCompletedAt(item) {
  if (item.completedAt != null) return item.completedAt;
  if (item.done) return item.updatedAt ?? null;
  return null;
}

function buildDerivedLogFromItems(items) {
  const derived = {};
  items.forEach(item => {
    const completedAt = effectiveCompletedAt(item);
    if (completedAt == null) return;
    const key = dateKey(completedAt);
    derived[key] = (derived[key] || 0) + 1;
  });
  return derived;
}

// activityLog (Part A2) only starts recording from the moment this feature
// shipped — someone who completed 200 items over the prior six months would
// otherwise open the Progress page to an empty heatmap and a 0-day streak
// despite having real history. This merges a log derived from items'
// completedAt underneath the real activityLog: the real log always wins for
// any day it has an entry for (even an explicit 0, e.g. a same-day
// check-then-uncheck), so an item completed and later unchecked is never
// double-counted or resurrected — activityLog survives unchecks, item
// completedAt does not (see docs/adr/ADR-009-analytics-data-model.md). Only
// a day with genuinely no activityLog entry at all falls back to the
// items-derived count, which in practice means only pre-feature history.
export function buildEffectiveActivityLog(items = [], activityLog = {}) {
  const merged = buildDerivedLogFromItems(items);
  Object.keys(activityLog || {}).forEach(date => {
    merged[date] = activityLog[date];
  });
  return merged;
}

export function computeOverview(items = []) {
  const total = items.length;
  const done = items.filter(item => item.done).length;
  const pct = total > 0 ? Math.round((done / total) * 100) : 0;
  return { total, done, pct };
}

// Sorted ascending by completion percentage (least complete first) — issue
// #8's B6 spec: "shows what still needs work" at the top.
export function computePhaseBreakdown(items = []) {
  const byPhase = new Map();
  items.forEach(item => {
    const key = item.phase || '';
    if (!byPhase.has(key)) byPhase.set(key, { phase: key, done: 0, total: 0 });
    const bucket = byPhase.get(key);
    bucket.total += 1;
    if (item.done) bucket.done += 1;
  });
  return Array.from(byPhase.values())
    .map(bucket => ({ ...bucket, pct: bucket.total > 0 ? Math.round((bucket.done / bucket.total) * 100) : 0 }))
    .sort((a, b) => a.pct - b.pct);
}

const PRIORITIES = ['P0', 'P1', 'P2', 'P3'];

// One row per phase, cross-tabbed done/total by priority (issue #8's B7 spec).
export function computePriorityBreakdown(items = []) {
  const byPhase = new Map();
  items.forEach(item => {
    const phaseKey = item.phase || '';
    if (!byPhase.has(phaseKey)) {
      byPhase.set(phaseKey, Object.fromEntries(PRIORITIES.map(priority => [priority, { done: 0, total: 0 }])));
    }
    const row = byPhase.get(phaseKey);
    const priority = PRIORITIES.includes(item.priority) ? item.priority : 'P2';
    row[priority].total += 1;
    if (item.done) row[priority].done += 1;
  });
  return Array.from(byPhase.entries()).map(([phase, priorities]) => ({ phase, priorities }));
}

// Computes every analytics metric from a snapshot of items + activityLog.
// Pure — no DOM, no store access, no side effects — safe to unit test with
// any data. `items` is a roadmap snapshot's non-deleted item list
// (store.getSnapshot().items); `activityLog` is activityLogStore's raw
// entries map (store.getSnapshot().entries). `streakFreezes` (issue #179) is
// activityLogStore's `{ available, usedDates, lastGrantedAt }` state —
// `usedDates` feeds computeStreaks() as frozen days, `available` is passed
// straight through in the result for the /progress stat card to display.
export function computeAnalytics(items = [], activityLog = {}, now = Date.now(), streakFreezes = { available: 0, usedDates: [] }) {
  const effectiveLog = buildEffectiveActivityLog(items, activityLog);
  return {
    overview: computeOverview(items),
    streaks: computeStreaks(effectiveLog, now, streakFreezes.usedDates),
    streakFreezesAvailable: streakFreezes.available || 0,
    velocity: computeVelocity(effectiveLog, now),
    phaseBreakdown: computePhaseBreakdown(items),
    priorityBreakdown: computePriorityBreakdown(items),
    heatmapData: computeHeatmap(effectiveLog, now),
    projection: computeProjection(items, effectiveLog, now)
  };
}
