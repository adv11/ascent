// Pure roadmap-comparison computation (issue #285) — no DOM/store access, same
// discipline as src/core/analytics/*.js and reviewSchedule.js: given two topic
// sets (id/title/phase/section/done shape, the same shape roadmapStore.js's
// `items` map already uses), produce the diff/overlap between them. Reused for
// both comparison modes the issue asks for — "active roadmap vs. its original
// starter template" and "two of the user's own roadmaps side by side" — since
// both are just "compare set A's topics against set B's topics" once the
// caller has resolved each side's items map; this module has no idea which
// mode produced its inputs.
//
// Topics are matched across the two sets by a normalized (phase, title) key,
// not by item id — a template's fresh seed items and a user's since-edited
// roadmap never share ids reliably (a re-seeded template regenerates
// `seed-...` ids from scratch, and a custom roadmap's items were never seeded
// from a template at all), but phase+title is the closest thing to a stable
// "this is conceptually the same topic" identity available across two
// unrelated item maps. A duplicate (phase, title) pair within the same set is
// deliberately collapsed to its first occurrence rather than erroring — this
// is a best-effort visual diff, not a strict schema validator.

function normalizeKeyPart(value) {
  return (value || '').trim().toLowerCase();
}

// Exported so a caller building its own lookup (or a test) can derive the
// exact same key this module uses internally.
export function comparisonKey(item) {
  return `${normalizeKeyPart(item?.phase)}::${normalizeKeyPart(item?.title)}`;
}

function toComparableList(items) {
  return Object.values(items || {}).filter(item => item && !item.deleted);
}

function matchStatus(aDone, bDone) {
  if (aDone && bDone) return 'both-done';
  if (aDone && !bDone) return 'a-only-done';
  if (!aDone && bDone) return 'b-only-done';
  return 'neither-done';
}

function toComparisonRow(item, extra) {
  return {
    key: comparisonKey(item),
    title: item.title || '',
    phase: item.phase || '',
    section: item.section || '',
    ...extra
  };
}

// The core diff — everything downstream (grouping, summary counts) is derived
// from this one call's output, never recomputed from the raw items maps again.
export function compareRoadmapTopics(itemsA, itemsB) {
  const listA = toComparableList(itemsA);
  const listB = toComparableList(itemsB);

  const mapB = new Map();
  listB.forEach(item => {
    const key = comparisonKey(item);
    if (!mapB.has(key)) mapB.set(key, item);
  });

  const matched = [];
  const onlyInA = [];
  const seenAKeys = new Set();
  const seenBKeys = new Set();

  listA.forEach(item => {
    const key = comparisonKey(item);
    if (seenAKeys.has(key)) return;
    seenAKeys.add(key);
    const other = mapB.get(key);
    if (other) {
      seenBKeys.add(key);
      matched.push(toComparisonRow(item, {
        aDone: !!item.done,
        bDone: !!other.done,
        status: matchStatus(!!item.done, !!other.done)
      }));
    } else {
      onlyInA.push(toComparisonRow(item, { done: !!item.done }));
    }
  });

  const onlyInB = [];
  const seenOnlyInBKeys = new Set();
  listB.forEach(item => {
    const key = comparisonKey(item);
    if (seenBKeys.has(key) || seenOnlyInBKeys.has(key)) return;
    seenOnlyInBKeys.add(key);
    onlyInB.push(toComparisonRow(item, { done: !!item.done }));
  });

  return { matched, onlyInA, onlyInB, summary: buildComparisonSummary(matched, onlyInA, onlyInB) };
}

function buildComparisonSummary(matched, onlyInA, onlyInB) {
  return {
    matchedCount: matched.length,
    bothDone: matched.filter(row => row.status === 'both-done').length,
    aOnlyDone: matched.filter(row => row.status === 'a-only-done').length,
    bOnlyDone: matched.filter(row => row.status === 'b-only-done').length,
    neitherDone: matched.filter(row => row.status === 'neither-done').length,
    onlyInACount: onlyInA.length,
    onlyInBCount: onlyInB.length,
    totalTopics: matched.length + onlyInA.length + onlyInB.length
  };
}

// Phase-by-phase rollup of an already-computed comparison — the shape
// roadmapComparisonModal.js actually renders (one section per phase, rather
// than three flat lists a user has to cross-reference by eye). A missing
// phase collapses to the same 'Untitled phase' label progress.js's own
// phase-breakdown already uses for a phase-less item, for consistency.
export function groupComparisonByPhase(comparison) {
  const byPhase = new Map();
  function bucketFor(phase) {
    const label = phase || 'Untitled phase';
    if (!byPhase.has(label)) byPhase.set(label, { phase: label, matched: [], onlyInA: [], onlyInB: [] });
    return byPhase.get(label);
  }
  comparison.matched.forEach(row => bucketFor(row.phase).matched.push(row));
  comparison.onlyInA.forEach(row => bucketFor(row.phase).onlyInA.push(row));
  comparison.onlyInB.forEach(row => bucketFor(row.phase).onlyInB.push(row));
  return Array.from(byPhase.values());
}
