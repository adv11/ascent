import { getStorageAdapter } from './storage/adapterFactory.js';
import { KEYS } from './localStorageKeys.js';
import { MAX_TODO_TITLE_LENGTH, MAX_ACTIVE_TODOS, clampDurationMs } from '../core/dailyTodo/limits.js';
import { isExpired } from '../ui/utils/dailyTodo.js';

// Second store alongside roadmapStore.js (issue #56) — a genuinely different
// rhythm (time-boxed vs. untimed, flat list vs. phased hierarchy, ephemeral
// vs. durable), so it gets its own store instead of being bolted onto
// roadmapStore.js. Follows the exact "Store pattern" documented in
// CLAUDE.md for roadmapStore.js — mutable map, subscribe/notify,
// debounced queueSave persisting to localStorage immediately and the
// storage adapter after the debounce — but deliberately does NOT carry
// roadmapStore's `structuralVersion` optimization: that exists specifically
// to avoid tearing down/rebuilding every phase-card on a `done` toggle, and
// this list is flat, small (<=20 active items), with no equivalent
// expensive re-render to protect.

// Same key-order-independent comparison roadmapStore.js uses for its
// Firebase-echo guard (stableStringify) — duplicated rather than imported
// from roadmapStore.js to keep the two stores independent, per issue #56's
// "reuse or extract — implementer's call".
function stableStringify(value) {
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(',')}]`;
  if (value && typeof value === 'object') {
    return `{${Object.keys(value).sort().map(key => `${JSON.stringify(key)}:${stableStringify(value[key])}`).join(',')}}`;
  }
  return JSON.stringify(value);
}

function genId() {
  return `todo-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function readLocalTodos() {
  try {
    const raw = JSON.parse(localStorage.getItem(KEYS.DAILY_TODOS) || '{}');
    return raw && typeof raw === 'object' ? raw : {};
  } catch {
    return {};
  }
}

export function createDailyTodoStore() {
  let adapter = getStorageAdapter(null);
  let uid = null;
  let unsubscribeTodos = null;
  let items = {};
  let dirty = false;
  let saveTimer = null;
  let recentFlushedStrs = [];
  const MAX_RECENT_FLUSHES = 8;
  // Same stale-call guard as roadmapStore's setUser — a quick sign-out
  // followed by a fresh sign-in must never let the older call's result
  // clobber the newer one after it resolves.
  let stateCallId = 0;
  const subscribers = new Set();

  function notify(meta = {}) {
    subscribers.forEach(callback => callback(getSnapshot(meta)));
  }

  function getSnapshot(meta = {}) {
    return {
      uid,
      todos: Object.values(items),
      dirty,
      ...meta
    };
  }

  function persistLocal() {
    localStorage.setItem(KEYS.DAILY_TODOS, JSON.stringify({ dirty, items }));
  }

  function clearLocal() {
    localStorage.removeItem(KEYS.DAILY_TODOS);
  }

  function attachListener() {
    if (unsubscribeTodos) return;
    unsubscribeTodos = adapter.listenDailyTodos(uid, remote => {
      if (dirty) {
        // A local edit is queued/in-flight and by definition newer than
        // anything this snapshot can be echoing — same guard roadmapStore.js
        // applies in attachRoadmapListener, for the same reason.
        notify({ saveState: 'synced' });
        return;
      }
      const remoteItems = remote || {};
      const remoteStr = stableStringify(remoteItems);
      if (recentFlushedStrs.includes(remoteStr)) {
        notify({ saveState: 'synced' });
        return;
      }
      if (remoteStr !== stableStringify(items)) {
        items = remoteItems;
        dirty = false;
        persistLocal();
      }
      notify({ saveState: 'synced' });
    }, error => {
      console.error('Daily todos listener failed', error);
      notify({ saveState: 'error', error });
    });
  }

  async function flush() {
    persistLocal();
    if (!uid) {
      notify({ saveState: 'local' });
      return;
    }
    const flushedStr = stableStringify(items);
    await adapter.saveDailyTodos(uid, items);
    recentFlushedStrs.push(flushedStr);
    if (recentFlushedStrs.length > MAX_RECENT_FLUSHES) recentFlushedStrs.shift();
    dirty = false;
    persistLocal();
    notify({ saveState: 'saved' });
  }

  function queueSave() {
    dirty = true;
    persistLocal();
    notify({ saveState: 'saving' });
    clearTimeout(saveTimer);
    saveTimer = setTimeout(() => {
      flush().catch(error => {
        console.error('Daily todos save failed', error);
        notify({ saveState: 'error', error });
      });
    }, 500);
  }

  // Sign-out/uid-transition privacy wipe — same contract roadmapStore.js's
  // setUser enforces (CLAUDE.md "Sign-out contract"): never load one user's
  // localStorage into another user's session. Extracted out of setUser to
  // keep its own complexity down.
  function freshStateForNewUid() {
    clearTimeout(saveTimer);
    saveTimer = null;
    clearLocal();
    items = {};
    dirty = false;
    recentFlushedStrs = [];
  }

  // Resolves what `items`/`dirty` should become from the local fallback blob
  // read at the top of setUser() — pure, no closure state. A dirty local
  // blob is at least as new as anything remote can offer (same reasoning as
  // roadmapStore's resolveRoadmapItems dirty-local guard); an absent one
  // leaves the caller's current items/dirty untouched.
  function resolveLocalItems(localBlob, currentItems, currentDirty) {
    if (localBlob.items && localBlob.dirty) return { items: localBlob.items, dirty: true };
    if (localBlob.items) return { items: localBlob.items, dirty: false };
    return { items: currentItems, dirty: currentDirty };
  }

  async function setUser(nextUser) {
    const nextUid = nextUser?.uid || null;
    const callId = ++stateCallId;
    const isStale = () => callId !== stateCallId;

    if (uid !== null && uid !== nextUid) freshStateForNewUid();

    if (unsubscribeTodos) unsubscribeTodos();
    unsubscribeTodos = null;
    uid = nextUid;
    adapter = getStorageAdapter(nextUser);

    if (!uid) {
      notify({ saveState: 'idle' });
      return;
    }

    const localBlob = readLocalTodos();
    ({ items, dirty } = resolveLocalItems(localBlob, items, dirty));

    if (isStale()) return;

    recentFlushedStrs = [];
    attachListener();
    if (dirty) queueSave();
    notify({ saveState: 'synced' });
  }

  // Returns false (mutating nothing) on an invalid title or once the active
  // (not-done, not-expired) count already reached MAX_ACTIVE_TODOS — callers
  // must check the return value, same convention as roadmapStore's addItem.
  // `linkedTemplateId`/`linkedItemId` (issue #56 follow-up) let a todo be
  // created from a roadmap topic ("add this topic to Today's Todos") rather
  // than typed from scratch — both are required together to identify the
  // item unambiguously, since the same topic title can exist in more than
  // one roadmap and only the (templateId, itemId) pair pins down which one.
  // `linkedItemTitle` is a display-time snapshot only (survives the source
  // item being renamed or deleted later) — never used to resolve the link.
  // Trims/length-checks the title and clamps the duration — returns null if
  // either is invalid, or `{ trimmedTitle, clampedDuration }` once both are
  // sound. Extracted out of addTodo to keep its own complexity under the
  // ESLint gate (root CLAUDE.md).
  function validateTodoInput(title, durationMs) {
    const trimmedTitle = (title || '').trim();
    if (!trimmedTitle || trimmedTitle.length > MAX_TODO_TITLE_LENGTH) return null;
    const clampedDuration = clampDurationMs(durationMs);
    if (clampedDuration === null) return null;
    return { trimmedTitle, clampedDuration };
  }

  // Builds the new todo record — pulled out mainly for the linked-item
  // ternaries (see the doc comment above addTodo for why all three only
  // apply together).
  function buildTodoRecord({ id, trimmedTitle, clampedDuration, now, linkedTemplateId, linkedItemId, linkedItemTitle }) {
    const isLinked = !!(linkedTemplateId && linkedItemId);
    return {
      id,
      title: trimmedTitle,
      createdAt: now,
      expiresAt: now + clampedDuration,
      done: false,
      doneAt: null,
      linkedTemplateId: isLinked ? linkedTemplateId : null,
      linkedItemId: isLinked ? linkedItemId : null,
      linkedItemTitle: isLinked ? (linkedItemTitle || trimmedTitle) : null
    };
  }

  function addTodo({ title, durationMs, linkedTemplateId = null, linkedItemId = null, linkedItemTitle = null }) {
    const validated = validateTodoInput(title, durationMs);
    if (!validated) return false;
    const { trimmedTitle, clampedDuration } = validated;

    const now = Date.now();
    const activeCount = Object.values(items).filter(t => !t.done && !isExpired(t, now)).length;
    if (activeCount >= MAX_ACTIVE_TODOS) return false;

    const id = genId();
    items[id] = buildTodoRecord({ id, trimmedTitle, clampedDuration, now, linkedTemplateId, linkedItemId, linkedItemTitle });
    queueSave();
    return true;
  }

  // Marking done is low-stakes and reversible — no confirmation, matches the
  // rest of the app's convention for cosmetic checklist toggles.
  function setDone(id, done) {
    const todo = items[id];
    if (!todo) return;
    items[id] = { ...todo, done, doneAt: done ? Date.now() : null };
    queueSave();
  }

  // Adds elapsed session seconds to a todo's cumulative timeSpentSeconds
  // (issue #180) — mirrors roadmapStore.updateItem's patch-and-persist
  // shape, but as a dedicated adder rather than a generic patch function
  // since a running timer's session is local-only UI state (dailyTodoPanel.js)
  // and only ever wants to add elapsed time, never overwrite the total.
  // Returns false (mutating nothing) for a missing todo or a non-positive
  // seconds value, same "callers must check the return value" convention as
  // addTodo/removeTodo.
  function addTimeSpent(id, seconds) {
    const todo = items[id];
    if (!todo || !Number.isFinite(seconds) || seconds <= 0) return false;
    const current = Number.isFinite(todo.timeSpentSeconds) ? todo.timeSpentSeconds : 0;
    items[id] = { ...todo, timeSpentSeconds: current + Math.floor(seconds) };
    queueSave();
    return true;
  }

  // Permanently removes a todo — unlike the roadmap's soft-delete pattern,
  // done/missed todos have no "undo" affordance and no bearing on
  // MAX_ACTIVE_TODOS, so there's no reason to keep them around forever once
  // the user is done with them. Callers (the UI) are responsible for
  // confirming this with the user first — same convention as
  // deleteCustomRoadmap/removePhase in roadmapStore.js.
  function removeTodo(id) {
    if (!items[id]) return;
    delete items[id];
    queueSave();
  }

  return {
    subscribe(callback) {
      subscribers.add(callback);
      callback(getSnapshot());
      return () => subscribers.delete(callback);
    },
    setUser,
    getSnapshot,
    removeTodo,
    addTodo,
    setDone,
    addTimeSpent,
    flush
  };
}
