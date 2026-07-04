import { ROADMAP_VERSION, buildSeedItems } from '../data/roadmap.js';
import { dbApi, firebaseClock } from './firebase.js';

const LOCAL_KEY = 'switchprep-roadmap-v3';
const UI_KEY = 'switchprep-ui-v3';

// Firebase's onValue listener fires on every write to the path, including the
// echo of writes this same client just made. Comparing with JSON.stringify
// alone isn't enough because Realtime Database returns object keys sorted,
// while our in-memory `items` map is in insertion order — this sorts keys at
// every level first so an echo of unchanged data compares equal.
function stableStringify(value) {
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(',')}]`;
  if (value && typeof value === 'object') {
    return `{${Object.keys(value).sort().map(key => `${JSON.stringify(key)}:${stableStringify(value[key])}`).join(',')}}`;
  }
  return JSON.stringify(value);
}

export function createRoadmapStore() {
  let uid = null;
  let unsubscribe = null;
  let items = buildSeedItems();
  let dirty = false;
  let saveTimer = null;
  let structuralVersion = 0;
  let lastFlushedStr = null;
  const subscribers = new Set();

  function notify(meta = {}) {
    subscribers.forEach(callback => callback(getSnapshot(meta)));
  }

  function getSnapshot(meta = {}) {
    return {
      uid,
      items: Object.values(items).filter(item => !item.deleted),
      allItems: items,
      dirty,
      structuralVersion,
      ...meta
    };
  }

  function loadLocal() {
    try {
      const local = JSON.parse(localStorage.getItem(LOCAL_KEY) || 'null');
      if (local?.items) {
        items = mergeWithSeed(local.items);
        dirty = !!local.dirty;
      }
    } catch {
      items = buildSeedItems();
    }
  }

  function persistLocal() {
    localStorage.setItem(LOCAL_KEY, JSON.stringify({
      version: ROADMAP_VERSION,
      dirty,
      items
    }));
  }

  function mergeWithSeed(savedItems = {}) {
    return {
      ...buildSeedItems(),
      ...savedItems
    };
  }

  async function flush() {
    persistLocal();
    if (!uid) {
      notify({ saveState: 'local' });
      return;
    }
    const flushedStr = stableStringify(items);
    const payload = {
      version: ROADMAP_VERSION,
      updatedAt: firebaseClock(),
      items
    };
    await dbApi.saveRoadmap(uid, payload);
    lastFlushedStr = flushedStr;
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
        console.error('Roadmap save failed', error);
        notify({ saveState: 'error', error });
      });
    }, 500);
  }

  function setUser(nextUser) {
    if (unsubscribe) unsubscribe();
    uid = nextUser?.uid || null;
    loadLocal();

    if (!uid) {
      notify({ saveState: dirty ? 'local' : 'idle' });
      return;
    }

    unsubscribe = dbApi.listenRoadmap(uid, snapshot => {
      const remote = snapshot.exists() ? snapshot.val() : null;
      if (remote?.items) {
        const merged = mergeWithSeed(remote.items);
        const remoteStr = stableStringify(merged);
        if (remoteStr === lastFlushedStr) {
          // Confirmed echo of our own last write — local state may be newer; skip overwrite
          notify({ saveState: 'synced' });
          return;
        }
        if (remoteStr !== stableStringify(items)) structuralVersion += 1;
        items = merged;
        dirty = false;
        persistLocal();
      } else {
        items = mergeWithSeed(items);
        structuralVersion += 1;
        queueSave();
      }
      notify({ saveState: 'synced' });
    }, error => {
      console.error('Roadmap listener failed', error);
      notify({ saveState: 'error', error });
    });
  }

  function updateItem(id, patch) {
    if (!items[id]) return;
    const isCosmetic = Object.keys(patch).every(key => key === 'done');
    if (!isCosmetic) structuralVersion += 1;
    items[id] = {
      ...items[id],
      ...patch,
      updatedAt: Date.now()
    };
    queueSave();
  }

  function addItem({ title, phase, section, priority }) {
    const id = `custom-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    structuralVersion += 1;
    items[id] = {
      id,
      title: title.trim(),
      phase,
      section,
      priority,
      done: false,
      custom: true,
      deleted: false,
      resources: [],
      createdAt: Date.now()
    };
    queueSave();
  }

  function removeItem(id) {
    if (!items[id]) return;
    structuralVersion += 1;
    items[id] = {
      ...items[id],
      deleted: true,
      updatedAt: Date.now()
    };
    queueSave();
  }

  function addResource(id, resource) {
    const item = items[id];
    if (!item) return;
    const next = [...(item.resources || []), resource];
    updateItem(id, { resources: next });
  }

  function updateResource(id, index, resource) {
    const item = items[id];
    if (!item) return;
    const next = [...(item.resources || [])];
    next[index] = resource;
    updateItem(id, { resources: next });
  }

  function removeResource(id, index) {
    const item = items[id];
    if (!item) return;
    const next = [...(item.resources || [])];
    next.splice(index, 1);
    updateItem(id, { resources: next });
  }

  loadLocal();

  return {
    subscribe(callback) {
      subscribers.add(callback);
      callback(getSnapshot());
      return () => subscribers.delete(callback);
    },
    setUser,
    getSnapshot,
    updateItem,
    addItem,
    removeItem,
    addResource,
    updateResource,
    removeResource,
    flush,
    getUiState() {
      try {
        return JSON.parse(localStorage.getItem(UI_KEY) || '{}');
      } catch {
        return {};
      }
    },
    setUiState(state) {
      localStorage.setItem(UI_KEY, JSON.stringify(state));
    }
  };
}
