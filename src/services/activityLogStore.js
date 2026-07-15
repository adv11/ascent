import { getStorageAdapter } from './storage/adapterFactory.js';
import { KEYS } from './localStorageKeys.js';
import { dateKey } from '../core/analytics/dateKey.js';
import { maybeGrantStreakFreeze, maybeAutoApplyStreakFreeze } from '../core/analytics/streaks.js';

// A third store alongside roadmapStore.js/dailyTodoStore.js (issue #8) — a
// flat { [dateString]: count } map of items completed per day, kept
// separately from roadmap items specifically so it survives an item later
// being unchecked (item.completedAt is cleared on uncheck; this isn't —
// see docs/adr/ADR-009-analytics-data-model.md). Follows the exact "Store
// pattern" documented in .claude/rules/roadmap-store.md — mutable map,
// subscribe/notify, debounced queueSave persisting to localStorage
// immediately and the storage adapter after the debounce, Firebase-echo
// guard, sign-out privacy guard — same template dailyTodoStore.js already
// is for roadmapStore.js. No structuralVersion: this is a flat date->count
// map with no expensive re-render to protect, same reasoning
// dailyTodoStore.js gives for omitting it.

// Same key-order-independent comparison roadmapStore.js/dailyTodoStore.js use
// for their Firebase-echo guard — duplicated rather than imported, per the
// "reuse or extract — implementer's call" precedent (.claude/rules/roadmap-store.md).
function stableStringify(value) {
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(',')}]`;
  if (value && typeof value === 'object') {
    return `{${Object.keys(value).sort().map(key => `${JSON.stringify(key)}:${stableStringify(value[key])}`).join(',')}}`;
  }
  return JSON.stringify(value);
}

const PRUNE_AFTER_DAYS = 365;

// Drops entries older than `maxAgeDays` (default 365 — see the "Data
// retention policy" in issue #8) — a rolling window is enough for the
// heatmap (364 cells) and every streak/velocity calculation, which never
// look further back than a year. Pure: exported for direct unit testing.
// String comparison is safe here because dateKey() always zero-pads to a
// fixed-width YYYY-MM-DD, which sorts identically to chronological order.
export function pruneOldEntries(entries, now = Date.now(), maxAgeDays = PRUNE_AFTER_DAYS) {
  const cutoff = new Date(now);
  cutoff.setDate(cutoff.getDate() - maxAgeDays);
  const cutoffKey = dateKey(cutoff.getTime());
  const pruned = {};
  Object.entries(entries || {}).forEach(([date, count]) => {
    if (date >= cutoffKey) pruned[date] = count;
  });
  return pruned;
}

function readLocalLog() {
  try {
    const raw = JSON.parse(localStorage.getItem(KEYS.ACTIVITY_LOG) || '{}');
    return raw && typeof raw === 'object' ? raw : {};
  } catch {
    return {};
  }
}

const DEFAULT_STREAK_FREEZES = { available: 0, usedDates: [], lastGrantedAt: null };

function readLocalStreakFreezes() {
  try {
    const raw = JSON.parse(localStorage.getItem(KEYS.STREAK_FREEZES) || '{}');
    return raw && typeof raw === 'object' ? raw : {};
  } catch {
    return {};
  }
}

export function createActivityLogStore() {
  let adapter = getStorageAdapter(null);
  let uid = null;
  let unsubscribeLog = null;
  let unsubscribeFreezes = null;
  let entries = {};
  let dirty = false;
  let saveTimer = null;
  let recentFlushedStrs = [];
  const MAX_RECENT_FLUSHES = 8;
  // Streak freeze / grace day (issue #179) — see .claude/rules/roadmap-store.md.
  // Same debounced-save shape as `entries`/`dirty`/`saveTimer` above, kept as
  // its own independent pair since it lives on a separate Firebase path
  // (`users/{uid}/streakFreezes`, not `activityLog`) and changes far less
  // often (a grant every 7 days, a spend on a missed day) than entries do.
  let streakFreezes = { ...DEFAULT_STREAK_FREEZES };
  let freezesDirty = false;
  let freezesSaveTimer = null;
  let recentFlushedFreezeStrs = [];
  // Set to the just-frozen date whenever maybeAutoApplyStreakFreeze() spends
  // a token during this setUser() call, so the UI (progress.js) can show a
  // one-shot toast confirming it happened. Consumed once via
  // consumeJustAppliedFreeze() — never re-surfaced on a later render/reload.
  let justAppliedFreezeDate = null;
  // Same stale-call guard as roadmapStore's/dailyTodoStore's setUser.
  let stateCallId = 0;
  const subscribers = new Set();

  function notify(meta = {}) {
    subscribers.forEach(callback => callback(getSnapshot(meta)));
  }

  function getSnapshot(meta = {}) {
    return { uid, entries, dirty, streakFreezes, ...meta };
  }

  function persistLocal() {
    localStorage.setItem(KEYS.ACTIVITY_LOG, JSON.stringify({ dirty, entries }));
  }

  function persistLocalFreezes() {
    localStorage.setItem(KEYS.STREAK_FREEZES, JSON.stringify({ dirty: freezesDirty, streakFreezes }));
  }

  function clearLocal() {
    localStorage.removeItem(KEYS.ACTIVITY_LOG);
    localStorage.removeItem(KEYS.STREAK_FREEZES);
  }

  function attachListener() {
    if (unsubscribeLog) return;
    unsubscribeLog = adapter.listenActivityLog(uid, remote => {
      if (dirty) {
        // A local edit is queued/in-flight and by definition newer than
        // anything this snapshot can be echoing — same guard roadmapStore.js
        // applies in attachRoadmapListener, for the same reason.
        notify({ saveState: 'synced' });
        return;
      }
      const remoteEntries = remote || {};
      const remoteStr = stableStringify(remoteEntries);
      if (recentFlushedStrs.includes(remoteStr)) {
        notify({ saveState: 'synced' });
        return;
      }
      if (remoteStr !== stableStringify(entries)) {
        entries = remoteEntries;
        dirty = false;
        persistLocal();
      }
      notify({ saveState: 'synced' });
    }, error => {
      console.error('Activity log listener failed', error);
      notify({ saveState: 'error', error });
    });
  }

  function attachFreezesListener() {
    if (unsubscribeFreezes) return;
    unsubscribeFreezes = adapter.listenStreakFreezes(uid, remote => {
      if (freezesDirty) {
        notify({ saveState: 'synced' });
        return;
      }
      const remoteFreezes = remote || { ...DEFAULT_STREAK_FREEZES };
      const remoteStr = stableStringify(remoteFreezes);
      if (recentFlushedFreezeStrs.includes(remoteStr)) {
        notify({ saveState: 'synced' });
        return;
      }
      if (remoteStr !== stableStringify(streakFreezes)) {
        streakFreezes = remoteFreezes;
        freezesDirty = false;
        persistLocalFreezes();
      }
      notify({ saveState: 'synced' });
    }, error => {
      console.error('Streak freezes listener failed', error);
      notify({ saveState: 'error', error });
    });
  }

  async function flush() {
    persistLocal();
    if (!uid) {
      notify({ saveState: 'local' });
      return;
    }
    const flushedStr = stableStringify(entries);
    await adapter.saveActivityLog(uid, entries);
    recentFlushedStrs.push(flushedStr);
    if (recentFlushedStrs.length > MAX_RECENT_FLUSHES) recentFlushedStrs.shift();
    dirty = false;
    persistLocal();
    notify({ saveState: 'saved' });
  }

  async function flushFreezes() {
    persistLocalFreezes();
    if (!uid) {
      notify({ saveState: 'local' });
      return;
    }
    const flushedStr = stableStringify(streakFreezes);
    await adapter.saveStreakFreezes(uid, streakFreezes);
    recentFlushedFreezeStrs.push(flushedStr);
    if (recentFlushedFreezeStrs.length > MAX_RECENT_FLUSHES) recentFlushedFreezeStrs.shift();
    freezesDirty = false;
    persistLocalFreezes();
    notify({ saveState: 'saved' });
  }

  function queueSave() {
    dirty = true;
    persistLocal();
    notify({ saveState: 'saving' });
    clearTimeout(saveTimer);
    saveTimer = setTimeout(() => {
      flush().catch(error => {
        console.error('Activity log save failed', error);
        notify({ saveState: 'error', error });
      });
    }, 500);
  }

  function queueSaveFreezes() {
    freezesDirty = true;
    persistLocalFreezes();
    notify({ saveState: 'saving' });
    clearTimeout(freezesSaveTimer);
    freezesSaveTimer = setTimeout(() => {
      flushFreezes().catch(error => {
        console.error('Streak freezes save failed', error);
        notify({ saveState: 'error', error });
      });
    }, 500);
  }

  // Loads streakFreezes' local fallback, runs the grant/auto-apply pure
  // functions (src/core/analytics/streaks.js), and queues a save if either
  // changed anything — called once per setUser() call, mirroring how
  // pruneOldEntries() is applied to entries below. Extracted out of setUser
  // to keep that function's own complexity down.
  function resolveStreakFreezes(localBlob, now) {
    let next = (localBlob.streakFreezes && localBlob.dirty)
      ? localBlob.streakFreezes
      : (localBlob.streakFreezes || { ...DEFAULT_STREAK_FREEZES });
    const wasDirtyLocally = !!(localBlob.streakFreezes && localBlob.dirty);

    const granted = maybeGrantStreakFreeze(next, now);
    const applied = maybeAutoApplyStreakFreeze(entries, granted, now);
    if (applied !== granted) {
      justAppliedFreezeDate = applied.usedDates[applied.usedDates.length - 1];
    }
    next = applied;

    const changed = wasDirtyLocally || stableStringify(next) !== stableStringify(localBlob.streakFreezes || DEFAULT_STREAK_FREEZES);
    return { next, changed };
  }

  // Sign-out privacy guard — same contract roadmapStore.js/dailyTodoStore.js
  // enforce (.claude/rules/roadmap-store.md "Sign-out contract"): never load
  // one user's localStorage into another user's session.
  async function setUser(nextUser) {
    const nextUid = nextUser?.uid || null;
    const callId = ++stateCallId;
    const isStale = () => callId !== stateCallId;

    if (uid !== null && uid !== nextUid) {
      clearTimeout(saveTimer);
      saveTimer = null;
      clearTimeout(freezesSaveTimer);
      freezesSaveTimer = null;
      clearLocal();
      entries = {};
      dirty = false;
      recentFlushedStrs = [];
      streakFreezes = { ...DEFAULT_STREAK_FREEZES };
      freezesDirty = false;
      recentFlushedFreezeStrs = [];
    }

    if (unsubscribeLog) unsubscribeLog();
    unsubscribeLog = null;
    if (unsubscribeFreezes) unsubscribeFreezes();
    unsubscribeFreezes = null;
    uid = nextUid;
    adapter = getStorageAdapter(nextUser);

    if (!uid) {
      notify({ saveState: 'idle' });
      return;
    }

    const localBlob = readLocalLog();
    if (localBlob.entries && localBlob.dirty) {
      // A queued-or-in-flight local edit from a previous session never got
      // confirmed — at least as new as anything remote can offer, same
      // reasoning as roadmapStore's resolveRoadmapItems dirty-local guard.
      entries = localBlob.entries;
      dirty = true;
    } else if (localBlob.entries) {
      entries = localBlob.entries;
      dirty = false;
    }

    // If pruning actually dropped anything, this load is now genuinely ahead
    // of whatever's remote (which may still carry the pruned-out entries) —
    // force dirty so it flushes forward instead of just living in memory,
    // and so the listener's "never apply remote while dirty" guard (below)
    // doesn't let a stale, un-pruned remote snapshot silently resurrect what
    // was just pruned.
    const prunedEntries = pruneOldEntries(entries, Date.now());
    if (Object.keys(prunedEntries).length !== Object.keys(entries).length) dirty = true;
    entries = prunedEntries;

    justAppliedFreezeDate = null;
    const localFreezeBlob = readLocalStreakFreezes();
    const resolvedFreezes = resolveStreakFreezes(localFreezeBlob, Date.now());
    streakFreezes = resolvedFreezes.next;
    if (resolvedFreezes.changed) freezesDirty = true;

    if (isStale()) return;

    recentFlushedStrs = [];
    recentFlushedFreezeStrs = [];
    attachListener();
    attachFreezesListener();
    if (dirty) queueSave();
    if (freezesDirty) queueSaveFreezes();
    notify({ saveState: 'synced' });
  }

  // Called once, with `now`, per completion/uncompletion — never mutates a
  // day other than the current one ("activityLog is append-only past days"
  // per issue #8), so an item completed today and unchecked tomorrow still
  // leaves today's count intact.
  function recordCompletion(now = Date.now()) {
    const key = dateKey(now);
    entries = { ...entries, [key]: (entries[key] || 0) + 1 };
    queueSave();
  }

  function recordUncompletion(now = Date.now()) {
    const key = dateKey(now);
    const current = entries[key] || 0;
    entries = { ...entries, [key]: Math.max(0, current - 1) };
    queueSave();
  }

  // One-shot read of the date a freeze was just auto-applied this session
  // (or null) — the UI calls this once per mount to decide whether to show a
  // confirmation toast, then it's cleared so a later re-render/reload never
  // re-shows it.
  function consumeJustAppliedFreeze() {
    const date = justAppliedFreezeDate;
    justAppliedFreezeDate = null;
    return date;
  }

  return {
    subscribe(callback) {
      subscribers.add(callback);
      callback(getSnapshot());
      return () => subscribers.delete(callback);
    },
    setUser,
    getSnapshot,
    recordCompletion,
    recordUncompletion,
    consumeJustAppliedFreeze,
    flush
  };
}
