import { ROADMAP_VERSION, buildSeedItems, PHASES } from '../data/roadmap.js';
import { buildSeedItems as buildTemplateSeedItems, getTemplatePhases } from '../data/templates/index.js';
import { dbApi, firebaseClock } from './firebase.js';
import { KEYS } from './localStorageKeys.js';

const LOCAL_KEY = KEYS.ROADMAP;
const UI_KEY = KEYS.UI_STATE;

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

function hasRealProgress(itemsMap) {
  return !!itemsMap && Object.values(itemsMap).some(item => item.custom || item.done);
}

export function createRoadmapStore() {
  let uid = null;
  let unsubscribe = null;
  let items = buildSeedItems();
  let templateId = 'java-backend';
  let templatePhases = PHASES;
  let onboardingDone = null;
  let dirty = false;
  let saveTimer = null;
  let structuralVersion = 0;
  let lastFlushedStr = null;
  // Bumped at the start of every setUser()/initFromTemplate() call. Firebase's
  // onAuthStateChanged can fire in quick succession (e.g. delete-account
  // followed immediately by a fresh sign-up with the same email) — without
  // this, a slower, now-stale call could still be awaiting its network
  // round-trip when a newer one finishes, and would then clobber the correct
  // state on arrival.
  let stateCallId = 0;
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
      templateId,
      onboardingDone,
      phases: templatePhases,
      ...meta
    };
  }

  function readLocalRoadmap() {
    try {
      return JSON.parse(localStorage.getItem(LOCAL_KEY) || 'null');
    } catch {
      return null;
    }
  }

  function loadLocal() {
    const local = readLocalRoadmap();
    if (local?.items) {
      items = mergeWithSeed(local.items, buildSeedItems());
      dirty = !!local.dirty;
    }
  }

  function persistLocal() {
    localStorage.setItem(LOCAL_KEY, JSON.stringify({
      version: ROADMAP_VERSION,
      dirty,
      items
    }));
  }

  // Only ever persists a positive onboarding state — its absence already means
  // "not done", so there is nothing useful to write on the false path.
  function persistLocalOnboarding() {
    if (!onboardingDone) return;
    localStorage.setItem(KEYS.ONBOARDING_DONE, 'true');
    if (templateId) localStorage.setItem(KEYS.TEMPLATE_ID, templateId);
  }

  // Wipes all local state for the outgoing user — both roadmap data and UI prefs.
  // Called whenever the active uid changes so the next user always starts clean.
  function clearLocal() {
    localStorage.removeItem(LOCAL_KEY);
    localStorage.removeItem(UI_KEY);
    localStorage.removeItem(KEYS.ONBOARDING_DONE);
    localStorage.removeItem(KEYS.TEMPLATE_ID);
  }

  function mergeWithSeed(savedItems = {}, baseItems = {}) {
    return {
      ...baseItems,
      ...savedItems
    };
  }

  function attachRoadmapListener() {
    if (unsubscribe) return;
    unsubscribe = dbApi.listenRoadmap(uid, snapshot => {
      const remote = snapshot.exists() ? snapshot.val() : null;
      if (remote?.items) {
        const remoteStr = stableStringify(remote.items);
        if (remoteStr === lastFlushedStr) {
          // Confirmed echo of our own last write — local state may be newer; skip overwrite
          notify({ saveState: 'synced' });
          return;
        }
        if (remoteStr !== stableStringify(items)) structuralVersion += 1;
        items = remote.items;
        dirty = false;
        persistLocal();
      }
      notify({ saveState: 'synced' });
    }, error => {
      console.error('Roadmap listener failed', error);
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

  // Determines, once per sign-in, whether this user has already picked a starter
  // template (Issue #51). New accounts are routed to /onboarding by main.js;
  // everyone else (including every account that predates the template system)
  // is treated as already onboarded — see docs/architecture.md §5.4 for the
  // detection order and the Part 5 backfill this performs.
  async function setUser(nextUser) {
    const nextUid = nextUser?.uid || null;
    const callId = ++stateCallId;
    const isStale = () => callId !== stateCallId;

    // Whenever the active uid changes (sign-out, sign-in as a different user),
    // wipe local storage so the incoming user never sees the outgoing user's data.
    // The initial boot call has uid=null, so this guard is skipped on first load.
    if (uid !== null && uid !== nextUid) {
      clearTimeout(saveTimer);
      saveTimer = null;
      clearLocal();
      items = buildSeedItems();
      templateId = 'java-backend';
      templatePhases = PHASES;
      onboardingDone = null;
      dirty = false;
      lastFlushedStr = null;
      structuralVersion += 1;
    }

    if (unsubscribe) unsubscribe();
    unsubscribe = null;
    uid = nextUid;

    if (!uid) {
      onboardingDone = null;
      notify({ saveState: 'idle' });
      return;
    }

    const localRaw = readLocalRoadmap();
    const localOnboardingDone = localStorage.getItem(KEYS.ONBOARDING_DONE) === 'true';
    const localTemplateId = localStorage.getItem(KEYS.TEMPLATE_ID);

    let remoteMeta = null;
    let remoteRoadmap = null;
    try {
      [remoteMeta, remoteRoadmap] = await Promise.all([dbApi.getMeta(uid), dbApi.getRoadmap(uid)]);
    } catch (error) {
      console.error('Failed to load roadmap/meta from Firebase', error);
    }

    // A newer setUser() call (e.g. the very next auth state change) has already
    // taken over — applying this now-stale result would clobber correct state.
    if (isStale()) return;

    if (remoteMeta?.onboardingDone) {
      onboardingDone = true;
      templateId = remoteMeta.templateId || 'java-backend';
    } else if (localOnboardingDone) {
      onboardingDone = true;
      templateId = localTemplateId || 'java-backend';
    } else if (hasRealProgress(remoteRoadmap?.items) || hasRealProgress(localRaw?.items)) {
      // Pre-existing account from before the template system — backfill the
      // flag lazily instead of forcing a migration step (Issue #51, Part 5).
      onboardingDone = true;
      templateId = remoteMeta?.templateId || localTemplateId || 'java-backend';
      dbApi.saveMeta(uid, { onboardingDone: true, templateId }).catch(error => {
        console.error('Failed to backfill onboarding meta', error);
      });
    } else {
      onboardingDone = false;
      templateId = null;
    }

    persistLocalOnboarding();

    if (!onboardingDone) {
      items = {};
      templatePhases = [];
      notify({ saveState: 'idle' });
      return;
    }

    const baseItems = await buildTemplateSeedItems(templateId);
    const nextTemplatePhases = await getTemplatePhases(templateId);

    if (isStale()) return;
    templatePhases = nextTemplatePhases;

    if (remoteRoadmap?.items) {
      items = mergeWithSeed(remoteRoadmap.items, baseItems);
      dirty = false;
      persistLocal();
    } else if (localRaw?.items) {
      items = mergeWithSeed(localRaw.items, baseItems);
      dirty = !!localRaw.dirty;
      queueSave();
    } else {
      items = baseItems;
      dirty = false;
    }

    attachRoadmapListener();
    notify({ saveState: 'synced' });
  }

  // Called once by the onboarding picker (src/ui/pages/onboarding.js) after the
  // user chooses a starter template. Persists the choice both locally and (once
  // authenticated) to Firebase meta, then starts syncing like any other session.
  async function initFromTemplate(chosenTemplateId) {
    const callId = ++stateCallId;

    const [nextItems, nextPhases] = await Promise.all([
      buildTemplateSeedItems(chosenTemplateId),
      getTemplatePhases(chosenTemplateId)
    ]);

    // A setUser() call (e.g. a concurrent auth state change) has taken over —
    // don't stomp on whatever state it has already established.
    if (callId !== stateCallId) return;

    items = nextItems;
    templatePhases = nextPhases;
    templateId = chosenTemplateId;
    onboardingDone = true;
    dirty = true;
    lastFlushedStr = null;
    structuralVersion += 1;

    persistLocal();
    persistLocalOnboarding();
    notify({ saveState: 'saving' });

    if (uid) {
      try {
        await dbApi.saveMeta(uid, { templateId: chosenTemplateId, onboardingDone: true });
      } catch (error) {
        console.error('Failed to save onboarding meta', error);
      }
      attachRoadmapListener();
      queueSave();
    } else {
      notify({ saveState: 'local' });
    }
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
    initFromTemplate,
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
