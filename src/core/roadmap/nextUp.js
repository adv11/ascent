// "Next up" card (issue #491) — pure selection logic, no DOM/store access.
// Picks up to 3 unfinished topics for a dashboard card that resumes a user
// where they last worked, instead of opening on a bare percentage.
export const NEXT_UP_LIMIT = 3;

// Must do (P0) before Should do (P1) before Later (P2/P3) — matches
// priorityLabels.js's canonical mapping. P2/P3 share one tier; ties within a
// tier fall back to source order (the order `items` was given in).
const PRIORITY_RANK = { P0: 0, P1: 1, P2: 2, P3: 2 };

function priorityRank(priority) {
  return PRIORITY_RANK[priority] ?? 2;
}

// Picks the phase title to draw candidates from: the phase containing the
// most recently completed topic, if that phase still has unfinished topics;
// otherwise the first phase (in template order) that has any unfinished
// topic at all.
function pickTargetPhase(items, unfinishedByPhase, phases) {
  const mostRecentlyCompleted = items
    .filter(item => item.done && Number.isFinite(item.completedAt))
    .reduce((latest, item) => (!latest || item.completedAt > latest.completedAt ? item : latest), null);

  if (mostRecentlyCompleted && unfinishedByPhase.has(mostRecentlyCompleted.phase)) {
    return mostRecentlyCompleted.phase;
  }

  const orderedPhaseTitles = phases.length
    ? phases.map(phase => phase.title)
    : [...unfinishedByPhase.keys()];
  return orderedPhaseTitles.find(title => unfinishedByPhase.has(title)) || null;
}

// `items`: the roadmap's non-deleted items (source order preserved).
// `phases`: the template's phase skeleton (for phase ordering) — optional;
// falls back to the order phases are first encountered in `items`.
// `excludeIds`: topic ids to leave out of this selection (the dashboard's
// "Not today" control, session-only — never persisted, never marks a topic
// done). Returns `{ topics, complete }` — `complete` is true once every
// topic is done, in which case `topics` is always empty (an excluded-but-
// still-unfinished roadmap is never reported as complete).
export function selectNextUpTopics(items, phases = [], { limit = NEXT_UP_LIMIT, excludeIds = null } = {}) {
  const allUnfinished = items.filter(item => !item.done);
  if (allUnfinished.length === 0) return { topics: [], complete: true };

  const unfinished = excludeIds ? allUnfinished.filter(item => !excludeIds.has(item.id)) : allUnfinished;
  if (unfinished.length === 0) return { topics: [], complete: false };

  const unfinishedByPhase = new Map();
  unfinished.forEach(item => {
    if (!unfinishedByPhase.has(item.phase)) unfinishedByPhase.set(item.phase, []);
    unfinishedByPhase.get(item.phase).push(item);
  });

  const targetPhase = pickTargetPhase(items, unfinishedByPhase, phases);
  const candidates = targetPhase ? unfinishedByPhase.get(targetPhase) || [] : [];

  const sorted = candidates
    .map((item, sourceIndex) => ({ item, sourceIndex }))
    .sort((a, b) => priorityRank(a.item.priority) - priorityRank(b.item.priority) || a.sourceIndex - b.sourceIndex)
    .map(entry => entry.item);

  return { topics: sorted.slice(0, limit), complete: false };
}
