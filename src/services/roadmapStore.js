import { ROADMAP_VERSION, buildSeedItems, PHASES } from '../data/roadmap.js';
import { buildSeedItems as buildTemplateSeedItems, getTemplatePhases, getLegacyBlankTemplateData } from '../data/templates/index.js';
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

function mergeWithSeed(savedItems = {}, baseItems = {}) {
  return {
    ...baseItems,
    ...savedItems
  };
}

// Firebase Realtime Database only returns a genuine JS array from a snapshot
// when the child keys are dense integers starting at 0 — a sparse or
// non-array shape (e.g. after removing a middle element some other way)
// comes back as a plain object instead, so this normalizes either shape.
function normalizeStringArray(value) {
  if (Array.isArray(value)) return value;
  if (value && typeof value === 'object') return Object.values(value);
  return null;
}

function readLocalRoadmaps() {
  try {
    const raw = JSON.parse(localStorage.getItem(KEYS.ROADMAPS) || '{}');
    return raw && typeof raw === 'object' ? raw : {};
  } catch {
    return {};
  }
}

// A user-created roadmap (issue #4) gets a generated id in this shape instead
// of one of the fixed built-in template ids from src/data/templates/index.js —
// this is the only thing that distinguishes the two, everywhere in this file.
// Deliberately NOT the same prefix as addItem()'s `custom-` item ids below —
// those live in a completely different id namespace (item.id, not
// templateId) but a shared prefix would be a confusing coincidence to debug.
function isCustomRoadmapId(id) {
  return typeof id === 'string' && id.startsWith('croadmap-');
}

function genId(prefix) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function readLocalCustomRoadmaps() {
  try {
    const raw = JSON.parse(localStorage.getItem(KEYS.CUSTOM_ROADMAPS) || '[]');
    return Array.isArray(raw) ? raw : [];
  } catch {
    return [];
  }
}

// One-time migration (issue #58): before per-template storage existed, every
// account had exactly one roadmap under the old singular KEYS.ROADMAP blob.
// Wraps it as { [templateId]: oldBlob } under the new keyed KEYS.ROADMAPS
// shape. The old key is left in place untouched, same precedent as
// migration.js's switchprep-* -> ascent-* rename.
function migrateLocalRoadmapsShape() {
  if (localStorage.getItem(KEYS.ROADMAPS) !== null) return;
  const legacyRaw = localStorage.getItem(LOCAL_KEY);
  if (legacyRaw === null) return;
  try {
    const legacy = JSON.parse(legacyRaw);
    if (!legacy?.items) return;
    const legacyTemplateId = localStorage.getItem(KEYS.TEMPLATE_ID) || 'java-backend';
    localStorage.setItem(KEYS.ROADMAPS, JSON.stringify({
      [legacyTemplateId]: {
        version: legacy.version || ROADMAP_VERSION,
        dirty: !!legacy.dirty,
        items: legacy.items
      }
    }));
  } catch {
    // Malformed legacy blob — nothing usable to migrate.
  }
}

export function createRoadmapStore() {
  let uid = null;
  let unsubscribeRoadmap = null;
  let items = buildSeedItems();
  let activeTemplateId = 'java-backend';
  let templatePhases = PHASES;
  let onboardingDone = null;
  let hiddenTemplateIds = [];
  // { id, title, description, createdAt } per roadmap the user built manually
  // (issue #4) — a subset of startedTemplateIds, tracked separately only so
  // the onboarding picker can render a name/description for them (built-in
  // templates get theirs from src/data/templates/index.js instead).
  let customRoadmaps = [];
  // One-shot seed content for a custom roadmap not yet activated (issue #4
  // AI-import): createCustomRoadmap() stashes { phases, items } here, keyed
  // by the freshly generated id, right before calling switchRoadmap(id) —
  // fetchTemplateData() consumes (and deletes) it instead of the usual empty
  // seed. Never touched for a manually-created (non-import) custom roadmap,
  // which simply has no entry here and falls back to the empty seed.
  let pendingCustomSeeds = {};
  // Every templateId this account has ever started — each one has its own
  // Firebase node (users/{uid}/roadmaps/{templateId}) and/or local blob.
  let startedTemplateIds = [];
  // In-memory cache of already-loaded templates this session, keyed by
  // templateId: { items, phases, dirty }. Makes switching back to a
  // previously-visited template instant (no network round trip) — see
  // resolveRoadmapItems(). Only ever holds full item maps for templates the
  // user has actually visited in this session, not every started template.
  let roadmapCache = {};
  let dirty = false;
  let saveTimer = null;
  let structuralVersion = 0;
  // Content strings of our own recent flushes (most recent last, capped),
  // used to recognize an echo of *any* write we made recently — not just the
  // latest one. A single `lastFlushedStr` isn't enough: Firebase can deliver
  // an older write's echo *after* a newer local edit has already flushed and
  // moved lastFlushedStr forward, which would make the stale echo fail the
  // match and get misapplied as "genuinely newer" data, clobbering the more
  // recent edit. This is most exposed right when a not-yet-started template
  // is first seeded and flushed (issue #58) and then edited again within the
  // next flush cycle, before that first echo has necessarily arrived.
  let recentFlushedStrs = [];
  const MAX_RECENT_FLUSHES = 8;
  // Bumped at the start of every setUser()/switchRoadmap() call. Firebase's
  // onAuthStateChanged can fire in quick succession (e.g. delete-account
  // followed immediately by a fresh sign-up with the same email), and a user
  // can also switch templates while a sign-in is still resolving — without
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
      activeTemplateId,
      startedTemplateIds,
      onboardingDone,
      phases: templatePhases,
      hiddenTemplateIds,
      customRoadmaps,
      ...meta
    };
  }

  function loadLocal() {
    const localActiveId = localStorage.getItem(KEYS.TEMPLATE_ID) || 'java-backend';
    const blob = readLocalRoadmaps()[localActiveId];
    if (blob?.items) {
      activeTemplateId = localActiveId;
      items = mergeWithSeed(blob.items, buildSeedItems());
      dirty = !!blob.dirty;
    }
  }

  function persistLocalRoadmap(templateId, blob) {
    if (!templateId) return;
    const all = readLocalRoadmaps();
    all[templateId] = { version: ROADMAP_VERSION, ...blob };
    localStorage.setItem(KEYS.ROADMAPS, JSON.stringify(all));
  }

  function persistLocal() {
    persistLocalRoadmap(activeTemplateId, { dirty, items, phases: templatePhases });
  }

  function persistLocalCustomRoadmaps() {
    localStorage.setItem(KEYS.CUSTOM_ROADMAPS, JSON.stringify(customRoadmaps));
  }

  // Only ever persists a positive onboarding state — its absence already means
  // "not done", so there is nothing useful to write on the false path.
  function persistLocalOnboarding() {
    if (!onboardingDone) return;
    localStorage.setItem(KEYS.ONBOARDING_DONE, 'true');
    if (activeTemplateId) localStorage.setItem(KEYS.TEMPLATE_ID, activeTemplateId);
  }

  function readLocalHiddenTemplates() {
    try {
      const raw = JSON.parse(localStorage.getItem(KEYS.HIDDEN_TEMPLATES) || '[]');
      return Array.isArray(raw) ? raw : [];
    } catch {
      return [];
    }
  }

  function persistLocalHiddenTemplates() {
    localStorage.setItem(KEYS.HIDDEN_TEMPLATES, JSON.stringify(hiddenTemplateIds));
  }

  // Wipes all local state for the outgoing user — both roadmap data and UI prefs.
  // Called whenever the active uid changes so the next user always starts clean.
  function clearLocal() {
    localStorage.removeItem(LOCAL_KEY);
    localStorage.removeItem(KEYS.ROADMAPS);
    localStorage.removeItem(UI_KEY);
    localStorage.removeItem(KEYS.ONBOARDING_DONE);
    localStorage.removeItem(KEYS.TEMPLATE_ID);
    localStorage.removeItem(KEYS.HIDDEN_TEMPLATES);
    localStorage.removeItem(KEYS.CUSTOM_ROADMAPS);
  }

  function attachRoadmapListener(listenerTemplateId) {
    if (unsubscribeRoadmap) return;
    unsubscribeRoadmap = dbApi.listenRoadmap(uid, listenerTemplateId, snapshot => {
      // Switching always detaches the previous listener before attaching the
      // next one, but if a callback for this (now-stale) listener was already
      // queued in the event loop before detachment took effect, this closure
      // comparison drops it instead of applying data for a template that's no
      // longer active — stronger than comparing a payload tag, since it can't
      // be fooled by timing.
      if (listenerTemplateId !== activeTemplateId) return;
      if (dirty) {
        // A local edit is queued or in flight and hasn't been confirmed by our
        // own flush yet — by definition it's newer than anything this snapshot
        // can be echoing, whether it's a delayed echo of an older write of ours
        // or a genuine external update. Applying it here would silently revert
        // the pending edit. Once our own flush completes (dirty becomes false),
        // the next snapshot is free to sync normally.
        notify({ saveState: 'synced' });
        return;
      }
      const remote = snapshot.exists() ? snapshot.val() : null;
      if (remote?.items) {
        // Phases are folded into the same echo/structural comparison as items
        // (rather than a separate check) so a custom roadmap's user-added
        // phases/sections get the exact same echo-guard and multi-device sync
        // guarantees as items — built-in templates never have differing
        // phases here, so this is a no-op for them.
        const remotePhases = normalizeStringArray(remote.phases) || templatePhases;
        const remoteStr = stableStringify({ items: remote.items, phases: remotePhases });
        if (recentFlushedStrs.includes(remoteStr)) {
          // Confirmed echo of one of our own recent writes (possibly not the
          // latest one, if it arrived out of order) — skip the redundant
          // overwrite and structuralVersion bump.
          notify({ saveState: 'synced' });
          return;
        }
        if (remoteStr !== stableStringify({ items, phases: templatePhases })) structuralVersion += 1;
        items = remote.items;
        templatePhases = remotePhases;
        dirty = false;
        persistLocal();
        roadmapCache[activeTemplateId] = { items, phases: templatePhases, dirty: false };
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
    const templateId = activeTemplateId;
    const flushedStr = stableStringify({ items, phases: templatePhases });
    const payload = {
      version: ROADMAP_VERSION,
      updatedAt: firebaseClock(),
      templateId,
      items,
      phases: templatePhases
    };
    await dbApi.saveRoadmap(uid, templateId, payload);
    recentFlushedStrs.push(flushedStr);
    if (recentFlushedStrs.length > MAX_RECENT_FLUSHES) recentFlushedStrs.shift();
    dirty = false;
    persistLocal();
    roadmapCache[templateId] = { items, phases: templatePhases, dirty: false };
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

  // A custom roadmap (issue #4) has no template module to load — it starts
  // with zero items and zero phases; whatever the user has actually added is
  // entirely stored in its own Firebase/local roadmap payload, resolved below
  // by resolveRoadmapItems just like a built-in template's saved progress is.
  async function fetchTemplateData(templateId) {
    if (isCustomRoadmapId(templateId)) {
      const seed = pendingCustomSeeds[templateId];
      if (seed) {
        delete pendingCustomSeeds[templateId];
        return { baseItems: seed.items, phases: seed.phases };
      }
      return { baseItems: {}, phases: [] };
    }
    const [baseItems, phases] = await Promise.all([
      buildTemplateSeedItems(templateId),
      getTemplatePhases(templateId)
    ]);
    return { baseItems, phases };
  }

  // Cache-first resolution for a template that has already been started:
  // in-memory roadmapCache (instant, same session) -> Firebase (if signed
  // in) -> local blob -> bare seed. Never reads Firebase for a template that
  // isn't started yet — that path always seeds fresh instead (see
  // switchRoadmap). Also resolves `phases`: for a built-in template this is
  // always just `basePhases` (its static PHASES never differ from what's
  // stored), but for a custom roadmap the persisted phases ARE the only
  // record of the phases/sections the user has added.
  async function resolveRoadmapItems(templateId, baseItems, basePhases) {
    const cached = roadmapCache[templateId];
    if (cached) return { items: cached.items, phases: cached.phases || basePhases, dirty: !!cached.dirty };

    const localBlob = readLocalRoadmaps()[templateId];
    let remote = null;
    if (uid) {
      try {
        remote = await dbApi.getRoadmap(uid, templateId);
      } catch (error) {
        console.error('Failed to load roadmap from Firebase', error);
      }
    }
    if (remote?.items) {
      return {
        items: mergeWithSeed(remote.items, baseItems),
        phases: normalizeStringArray(remote.phases) || basePhases,
        dirty: false
      };
    }
    if (localBlob?.items) {
      return {
        items: mergeWithSeed(localBlob.items, baseItems),
        phases: normalizeStringArray(localBlob.phases) || basePhases,
        dirty: !!localBlob.dirty
      };
    }
    return { items: baseItems, phases: basePhases, dirty: false };
  }

  // Determines, once per sign-in, whether this user has already picked a starter
  // template (Issue #51) and which templates they've started (Issue #58). New
  // accounts are routed to /onboarding by main.js; everyone else (including every
  // account that predates the template system) is treated as already onboarded —
  // see docs/architecture.md for the detection order and the migration this performs.
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
      activeTemplateId = 'java-backend';
      templatePhases = PHASES;
      onboardingDone = null;
      hiddenTemplateIds = [];
      customRoadmaps = [];
      startedTemplateIds = [];
      roadmapCache = {};
      pendingCustomSeeds = {};
      dirty = false;
      recentFlushedStrs = [];
      structuralVersion += 1;
    }

    if (unsubscribeRoadmap) unsubscribeRoadmap();
    unsubscribeRoadmap = null;
    uid = nextUid;

    if (!uid) {
      onboardingDone = null;
      notify({ saveState: 'idle' });
      return;
    }

    const localRoadmaps = readLocalRoadmaps();
    const localOnboardingDone = localStorage.getItem(KEYS.ONBOARDING_DONE) === 'true';
    const localActiveTemplateId = localStorage.getItem(KEYS.TEMPLATE_ID);
    const localStartedTemplateIds = Object.keys(localRoadmaps);

    let remoteMeta = null;
    try {
      remoteMeta = await dbApi.getMeta(uid);
    } catch (error) {
      console.error('Failed to load roadmap meta from Firebase', error);
    }

    // A newer setUser() call (e.g. the very next auth state change) has already
    // taken over — applying this now-stale result would clobber correct state.
    if (isStale()) return;

    hiddenTemplateIds = normalizeStringArray(remoteMeta?.hiddenTemplateIds) || readLocalHiddenTemplates();
    persistLocalHiddenTemplates();
    customRoadmaps = normalizeStringArray(remoteMeta?.customRoadmaps) || readLocalCustomRoadmaps();
    persistLocalCustomRoadmaps();

    // Set only when this call just migrated a legacy roadmap forward — lets the
    // load step below seed roadmapCache directly from it instead of re-reading
    // Firebase, which would otherwise race the fire-and-forget saveRoadmap() call.
    let migratedLegacyItems = null;

    if (remoteMeta?.startedTemplateIds?.length) {
      // Already on the new (issue #58) meta shape — no migration needed.
      onboardingDone = true;
      startedTemplateIds = remoteMeta.startedTemplateIds;
      activeTemplateId = remoteMeta.activeTemplateId || startedTemplateIds[0];
    } else {
      // Either a brand-new account, or one that predates issue #58 (and possibly
      // predates issue #51 too). Check the legacy singular roadmap path once to
      // decide, and migrate it forward if this account turns out to already be
      // onboarded.
      let legacyRoadmap = null;
      try {
        legacyRoadmap = await dbApi.getLegacyRoadmap(uid);
      } catch (error) {
        console.error('Failed to load legacy roadmap from Firebase', error);
      }
      if (isStale()) return;

      const legacyTemplateId = remoteMeta?.templateId || localActiveTemplateId || 'java-backend';
      const alreadyOnboarded = !!remoteMeta?.onboardingDone
        || localOnboardingDone
        || hasRealProgress(legacyRoadmap?.items)
        || hasRealProgress(localRoadmaps[legacyTemplateId]?.items);

      if (alreadyOnboarded) {
        onboardingDone = true;
        activeTemplateId = legacyTemplateId;
        startedTemplateIds = localStartedTemplateIds.includes(legacyTemplateId)
          ? localStartedTemplateIds
          : [...localStartedTemplateIds, legacyTemplateId];

        if (legacyRoadmap) {
          migratedLegacyItems = legacyRoadmap.items;
          // Copy-forward, never delete the old path — it stays as a safety net.
          dbApi.saveRoadmap(uid, legacyTemplateId, { ...legacyRoadmap, templateId: legacyTemplateId }).catch(error => {
            console.error('Failed to migrate legacy roadmap', error);
          });
        }
        dbApi.saveMeta(uid, { startedTemplateIds, activeTemplateId, onboardingDone: true }).catch(error => {
          console.error('Failed to backfill onboarding meta', error);
        });
      } else {
        onboardingDone = false;
        activeTemplateId = null;
        startedTemplateIds = [];
      }
    }

    // One-time migration for the now-retired 'blank' template (issue #4
    // follow-up): once manual CRUD (PR #60) and AI import (this PR) both
    // existed, 'blank' became a strict subset of "Create your own roadmap" —
    // fixed Learn/Practice/Build/Review phases versus fully editable ones —
    // so it's no longer offered in TEMPLATES. Anyone who already started it
    // keeps their content: migrated forward into a real custom roadmap
    // instead of losing access. Never deletes the old
    // users/{uid}/roadmaps/blank node — same never-delete-just-stop-reading
    // precedent as every other legacy path in this file. Runs before
    // fetchTemplateData(activeTemplateId) below, which would otherwise be
    // called with 'blank' — no longer a valid built-in id (removed from
    // TEMPLATES) or custom id (doesn't match the croadmap- prefix) — and
    // silently resolve to the wrong (fallback) template content.
    if (onboardingDone && (activeTemplateId === 'blank' || startedTemplateIds.includes('blank'))) {
      let storedBlank = null;
      if (uid) {
        try {
          storedBlank = await dbApi.getRoadmap(uid, 'blank');
        } catch (error) {
          console.error('Failed to load blank roadmap for migration', error);
        }
      }
      if (isStale()) return;

      if (!storedBlank?.items) {
        const localBlob = readLocalRoadmaps().blank;
        if (localBlob?.items) storedBlank = localBlob;
      }

      let migratedItems = storedBlank?.items;
      let migratedPhases = normalizeStringArray(storedBlank?.phases);
      if (!migratedItems || !migratedPhases) {
        // Pre-dates PR #60 always persisting `phases` — fall back to blank.js's
        // own fixed skeleton/empty seed for whichever half is missing.
        const legacy = await getLegacyBlankTemplateData();
        if (isStale()) return;
        migratedItems = migratedItems || legacy.baseItems;
        migratedPhases = migratedPhases || legacy.phases;
      }

      const migratedId = genId('croadmap');
      customRoadmaps = [...customRoadmaps, { id: migratedId, title: 'My roadmap', description: '', createdAt: Date.now() }];
      persistLocalCustomRoadmaps();
      persistLocalRoadmap(migratedId, { dirty: false, items: migratedItems, phases: migratedPhases });
      roadmapCache[migratedId] = { items: migratedItems, phases: migratedPhases, dirty: false };

      if (activeTemplateId === 'blank') activeTemplateId = migratedId;
      startedTemplateIds = startedTemplateIds.map(id => (id === 'blank' ? migratedId : id));

      if (uid) {
        dbApi.saveRoadmap(uid, migratedId, {
          version: ROADMAP_VERSION,
          updatedAt: firebaseClock(),
          templateId: migratedId,
          items: migratedItems,
          phases: migratedPhases
        }).catch(error => {
          console.error('Failed to migrate blank roadmap content', error);
        });
        dbApi.saveMeta(uid, { activeTemplateId, startedTemplateIds, customRoadmaps, onboardingDone: true }).catch(error => {
          console.error('Failed to save meta after blank-template migration', error);
        });
      }
    }

    persistLocalOnboarding();

    if (!onboardingDone) {
      items = {};
      templatePhases = [];
      roadmapCache = {};
      notify({ saveState: 'idle' });
      return;
    }

    const { baseItems, phases } = await fetchTemplateData(activeTemplateId);
    if (isStale()) return;

    if (migratedLegacyItems && !roadmapCache[activeTemplateId]) {
      roadmapCache[activeTemplateId] = { items: mergeWithSeed(migratedLegacyItems, baseItems), phases, dirty: false };
    }

    const resolved = await resolveRoadmapItems(activeTemplateId, baseItems, phases);
    if (isStale()) return;

    items = resolved.items;
    templatePhases = resolved.phases;
    dirty = resolved.dirty;
    recentFlushedStrs = [];
    persistLocal();
    roadmapCache[activeTemplateId] = { items, phases: templatePhases, dirty };

    attachRoadmapListener(activeTemplateId);
    if (dirty) queueSave();
    notify({ saveState: 'synced' });
  }

  // Called by the onboarding picker (src/ui/pages/onboarding.js), both for a
  // first-time pick and for switching to a different template later — the two
  // cases share the same logic: an already-started template is loaded
  // (cache-first, never re-seeded), a not-yet-started one is seeded fresh.
  // Neither path ever touches any other template's stored items (issue #58).
  async function switchRoadmap(requestedTemplateId) {
    if (requestedTemplateId === activeTemplateId) return;

    const callId = ++stateCallId;
    const isStale = () => callId !== stateCallId;

    const alreadyStarted = startedTemplateIds.includes(requestedTemplateId);

    const { baseItems, phases } = await fetchTemplateData(requestedTemplateId);
    if (isStale()) return;

    let resolved = { items: baseItems, phases, dirty: true };
    if (alreadyStarted) {
      resolved = await resolveRoadmapItems(requestedTemplateId, baseItems, phases);
      if (isStale()) return;
    }

    // Flush any pending debounced edit on the *outgoing* template before
    // switching. Without this, once the debounce timer fired after the
    // switch, flush() would run using the by-then-reassigned
    // activeTemplateId/items — silently attributing the outgoing template's
    // edit to the new template's Firebase path and dropping it from the path
    // it actually belongs to.
    if (activeTemplateId && dirty) {
      clearTimeout(saveTimer);
      saveTimer = null;
      try {
        await flush();
      } catch (error) {
        console.error('Failed to flush before switching roadmap', error);
      }
      if (isStale()) return;
    }

    if (unsubscribeRoadmap) unsubscribeRoadmap();
    unsubscribeRoadmap = null;
    if (activeTemplateId) roadmapCache[activeTemplateId] = { items, phases: templatePhases, dirty };

    if (!alreadyStarted) startedTemplateIds = [...startedTemplateIds, requestedTemplateId];

    activeTemplateId = requestedTemplateId;
    templatePhases = resolved.phases;
    items = resolved.items;
    dirty = resolved.dirty;
    recentFlushedStrs = [];
    onboardingDone = true;
    roadmapCache[activeTemplateId] = { items, phases: templatePhases, dirty };
    structuralVersion += 1;

    persistLocal();
    persistLocalOnboarding();
    notify({ saveState: 'saving' });

    if (uid) {
      try {
        await dbApi.saveMeta(uid, { activeTemplateId, startedTemplateIds, onboardingDone: true });
      } catch (error) {
        console.error('Failed to save roadmap-switch meta', error);
      }
      attachRoadmapListener(activeTemplateId);
      if (!alreadyStarted) {
        queueSave();
      } else {
        notify({ saveState: 'synced' });
      }
    } else {
      notify({ saveState: 'local' });
    }
  }

  // Hiding/unhiding is a per-user preference for which template cards show on
  // *this* user's onboarding picker — it never touches the template's content
  // or any other user's account, and never affects startedTemplateIds or the
  // ability to switch to an already-started template (issue #58).
  async function setHiddenTemplateIds(nextHiddenIds) {
    hiddenTemplateIds = nextHiddenIds;
    persistLocalHiddenTemplates();
    notify();
    if (uid) {
      try {
        await dbApi.saveMeta(uid, { hiddenTemplateIds });
      } catch (error) {
        console.error('Failed to save hidden template preference', error);
      }
    }
  }

  function hideTemplate(idToHide) {
    if (hiddenTemplateIds.includes(idToHide)) return Promise.resolve();
    return setHiddenTemplateIds([...hiddenTemplateIds, idToHide]);
  }

  function unhideTemplate(idToUnhide) {
    if (!hiddenTemplateIds.includes(idToUnhide)) return Promise.resolve();
    return setHiddenTemplateIds(hiddenTemplateIds.filter(id => id !== idToUnhide));
  }

  // Creates a brand-new user-authored roadmap (issue #4): generates an id,
  // records its title/description in customRoadmaps (a per-user list, not a
  // template registry entry), then activates it through the exact same
  // switchRoadmap() path a built-in template uses — it seeds empty (zero
  // phases, zero items) since fetchTemplateData short-circuits for a custom
  // id, and the user builds it up from there with addPhase/addSection/addItem.
  // `phases`/`items` are optional (issue #4 AI-import): omitted, this seeds
  // a truly empty roadmap for the user to build manually via
  // addPhase/addSection/addItem — passed, the roadmap activates already
  // populated with the imported content (see schemaAdapter.js for the shape
  // producing them). Either way it's the exact same activation path.
  async function createCustomRoadmap({ title, description, phases: seedPhases, items: seedItems }) {
    const trimmedTitle = (title || '').trim();
    if (!trimmedTitle) throw new Error('Title is required');
    const id = genId('croadmap');
    if (seedPhases || seedItems) {
      pendingCustomSeeds[id] = { phases: seedPhases || [], items: seedItems || {} };
    }
    const meta = { id, title: trimmedTitle, description: (description || '').trim(), createdAt: Date.now() };
    customRoadmaps = [...customRoadmaps, meta];
    persistLocalCustomRoadmaps();
    if (uid) {
      try {
        await dbApi.saveMeta(uid, { customRoadmaps });
      } catch (error) {
        console.error('Failed to save custom roadmap meta', error);
      }
    }
    await switchRoadmap(id);
    return id;
  }

  // Permanently removes a user-authored roadmap and its stored data. Never
  // usable on a built-in template id (guarded by isCustomRoadmapId) — those
  // are never deleted, only hidden (see hideTemplate). If the roadmap being
  // deleted is the active one, switches to the default built-in template
  // first so the app is never left without an active roadmap.
  async function deleteCustomRoadmap(idToDelete) {
    if (!isCustomRoadmapId(idToDelete)) return;
    if (idToDelete === activeTemplateId) {
      await switchRoadmap('java-backend');
    }
    customRoadmaps = customRoadmaps.filter(r => r.id !== idToDelete);
    startedTemplateIds = startedTemplateIds.filter(id => id !== idToDelete);
    delete roadmapCache[idToDelete];
    persistLocalCustomRoadmaps();
    const localAll = readLocalRoadmaps();
    delete localAll[idToDelete];
    localStorage.setItem(KEYS.ROADMAPS, JSON.stringify(localAll));
    notify();
    if (uid) {
      try {
        await dbApi.saveMeta(uid, { customRoadmaps, startedTemplateIds });
        await dbApi.deleteRoadmap(uid, idToDelete);
      } catch (error) {
        console.error('Failed to delete custom roadmap', error);
      }
    }
  }

  function findPhase(phaseId) {
    return templatePhases.find(p => p.id === phaseId);
  }

  // Phase/section structural mutations (issue #4) only ever apply to a custom
  // roadmap — a built-in template's PHASES skeleton is fixed content, never
  // user-editable, so every one of these is a silent no-op when
  // activeTemplateId isn't a custom id.
  function addPhase(title) {
    if (!isCustomRoadmapId(activeTemplateId)) return;
    const trimmed = (title || '').trim();
    if (!trimmed) return;
    templatePhases = [...templatePhases, { id: genId('phase'), title: trimmed, priority: 'P2', resourceKey: null, sections: [] }];
    structuralVersion += 1;
    queueSave();
  }

  // Renaming a phase updates every item filed under its old title so they
  // stay grouped under the renamed phase instead of becoming orphaned.
  function renamePhase(phaseId, newTitle) {
    if (!isCustomRoadmapId(activeTemplateId)) return;
    const trimmed = (newTitle || '').trim();
    const phase = findPhase(phaseId);
    if (!phase || !trimmed || phase.title === trimmed) return;
    const oldTitle = phase.title;
    templatePhases = templatePhases.map(p => (p.id === phaseId ? { ...p, title: trimmed } : p));
    Object.keys(items).forEach(id => {
      if (items[id].phase === oldTitle) items[id] = { ...items[id], phase: trimmed, updatedAt: Date.now() };
    });
    structuralVersion += 1;
    queueSave();
  }

  // Removing a phase soft-deletes every item filed under it — there is no
  // phase for them to render under anymore, so leaving them live would make
  // them permanently invisible without actually freeing up their titles.
  function removePhase(phaseId) {
    if (!isCustomRoadmapId(activeTemplateId)) return;
    const phase = findPhase(phaseId);
    if (!phase) return;
    templatePhases = templatePhases.filter(p => p.id !== phaseId);
    Object.keys(items).forEach(id => {
      if (items[id].phase === phase.title) items[id] = { ...items[id], deleted: true, updatedAt: Date.now() };
    });
    structuralVersion += 1;
    queueSave();
  }

  function addSection(phaseId, title) {
    if (!isCustomRoadmapId(activeTemplateId)) return;
    const trimmed = (title || '').trim();
    const phase = findPhase(phaseId);
    if (!phase || !trimmed) return;
    templatePhases = templatePhases.map(p => (p.id === phaseId
      ? { ...p, sections: [...p.sections, { id: genId('section'), title: trimmed }] }
      : p));
    structuralVersion += 1;
    queueSave();
  }

  function renameSection(phaseId, sectionId, newTitle) {
    if (!isCustomRoadmapId(activeTemplateId)) return;
    const trimmed = (newTitle || '').trim();
    const phase = findPhase(phaseId);
    const section = phase?.sections.find(s => s.id === sectionId);
    if (!phase || !section || !trimmed || section.title === trimmed) return;
    const oldTitle = section.title;
    templatePhases = templatePhases.map(p => (p.id === phaseId
      ? { ...p, sections: p.sections.map(s => (s.id === sectionId ? { ...s, title: trimmed } : s)) }
      : p));
    Object.keys(items).forEach(id => {
      if (items[id].phase === phase.title && items[id].section === oldTitle) {
        items[id] = { ...items[id], section: trimmed, updatedAt: Date.now() };
      }
    });
    structuralVersion += 1;
    queueSave();
  }

  function removeSection(phaseId, sectionId) {
    if (!isCustomRoadmapId(activeTemplateId)) return;
    const phase = findPhase(phaseId);
    const section = phase?.sections.find(s => s.id === sectionId);
    if (!phase || !section) return;
    templatePhases = templatePhases.map(p => (p.id === phaseId
      ? { ...p, sections: p.sections.filter(s => s.id !== sectionId) }
      : p));
    Object.keys(items).forEach(id => {
      if (items[id].phase === phase.title && items[id].section === section.title) {
        items[id] = { ...items[id], deleted: true, updatedAt: Date.now() };
      }
    });
    structuralVersion += 1;
    queueSave();
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

  migrateLocalRoadmapsShape();
  loadLocal();

  return {
    subscribe(callback) {
      subscribers.add(callback);
      callback(getSnapshot());
      return () => subscribers.delete(callback);
    },
    setUser,
    switchRoadmap,
    hideTemplate,
    unhideTemplate,
    isCustomRoadmapId,
    createCustomRoadmap,
    deleteCustomRoadmap,
    addPhase,
    renamePhase,
    removePhase,
    addSection,
    renameSection,
    removeSection,
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
