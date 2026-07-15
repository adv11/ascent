import { computeOverview, computePhaseBreakdown } from '../analytics/analyticsEngine.js';

// Derived, not persisted — matches how phase/roadmap progress percentages
// already work elsewhere (dashboard.js's countStats, progressRing usage).
// A roadmap with zero items is never "complete" (nothing to celebrate).
export function isRoadmapComplete(items = []) {
  return items.length > 0 && computeOverview(items).pct === 100;
}

// Titles of phases that are fully done. Phase identity is the title string
// (computePhaseBreakdown has no stable id), matching how callers already key
// off phase titles elsewhere in the codebase.
export function getCompletedPhaseTitles(items = []) {
  return computePhaseBreakdown(items)
    .filter(phase => phase.total > 0 && phase.pct === 100)
    .map(phase => phase.phase)
    .filter(Boolean);
}
