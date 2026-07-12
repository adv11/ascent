import { ROADMAP_VERSION, buildSeedItems, PHASES } from '../data/roadmap.js';
import { buildSeedItems as buildTemplateSeedItems, getTemplatePhases, getLegacyBlankTemplateData } from '../data/templates/index.js';
import { getStorageAdapter } from './storage/adapterFactory.js';
import { KEYS } from './localStorageKeys.js';
import { MAX_TITLE_LENGTH, isValidResource } from '../core/roadmap/limits.js';

const LOCAL_KEY = KEYS.ROADMAP;
const UI_KEY = KEYS.UI_STATE;

// Firebase rules can't count a map's children directly, so the per-roadmap item
// cap is enforced here — the one place every new item is created. Lowered from
// 1,000 (issue #24) to 800 (issue #53): no real roadmap organically approaches
// even 800 topics, so the tighter cap costs no legitimate user anything while
// shrinking the accidental-storage-runaway window on the free tier.
const MAX_ITEMS_PER_ROADMAP = 800;

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

// Extracted from inside attachRoadmapListener's onValue callback (issue #53) —
// the remote-data merge decision (stableStringify compare, structuralVersion
// bump, echo detection) is a distinct responsibility that was buried three
// levels deep and impossible to unit-test without a real Firebase listener.
// Pure: takes the incoming remote payload plus the current in-memory state and
// returns either `null` (nothing to apply — no items, or a confirmed echo of
// one of our own recent flushes) or the resolved `{ items, phases,
// structuralVersionBumped }` for the caller to assign onto its own state.
export function applyRemoteSnapshot(remote, currentItems, currentPhases, recentFlushedStrs) {
  if (!remote?.items) return null;
  // Phases are folded into the same echo/structural comparison as items
  // (rather than checked separately) so a custom roadmap's user-added
  // phases/sections get the exact same echo-guard and multi-device sync
  // guarantees as items — built-in templates never have differing phases
  // here, so this is a no-op for them.
  const remotePhases = normalizeStringArray(remote.phases) || currentPhases;
  const remoteStr = stableStringify({ items: remote.items, phases: remotePhases });
  if (recentFlushedStrs.includes(remoteStr)) {
    // Confirmed echo of one of our own recent writes (possibly not the latest
    // one, if it arrived out of order) — nothing new to apply.
    return null;
  }
  const structuralVersionBumped = remoteStr !== stableStringify({ items: currentItems, phases: currentPhases });
  return { items: remote.items, phases: remotePhases, structuralVersionBumped };
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

// completedAt (issue #18, prerequisite for #8's analytics): set once when
// `done` flips false -> true, cleared when it flips back. A missing field
// means "never completed" (backward compat, same precedent as `item.notes`).
// Extracted out of updateItem() so that function's own complexity stays
// under the eslint `complexity` gate (root CLAUDE.md).
function withDerivedCompletedAt(patch, wasDone) {
  if (patch.done === true && !wasDone) return { ...patch, completedAt: Date.now() };
  if (patch.done === false) return { ...patch, completedAt: null };
  return patch;
}

// The activityLog side effect (issue #8) rides the same done-transition
// withDerivedCompletedAt() already detects — +1 on a genuine false->true
// flip, -1 on a genuine true->false flip, 0 for anything else (a redundant
// `{ done: false }` patch on an already-not-done item must not decrement).
function completionDelta(patch, wasDone) {
  if (patch.done === true && !wasDone) return 1;
  if (patch.done === false && wasDone) return -1;
  return 0;
}

// Shared by setItemDoneInTemplate()'s cached/cold cross-roadmap paths below —
// its active-template path goes through updateItem()/withDerivedCompletedAt()
// instead, so this only needs to cover the two paths that build a patched
// item object directly. Extracted to keep setItemDoneInTemplate's own
// complexity from growing further (root CLAUDE.md's eslint gate).
function todoCompletionFields(done) {
  const timestamp = done ? Date.now() : null;
  return { completedViaTodoAt: timestamp, completedAt: timestamp };
}

function nonEmptyString(value) {
  return typeof value === 'string' && value.trim() ? value : '';
}

// A backup item's own `title`/`phase`/`section` strings, or `null` if any
// fails the same shape/length check addItem()/updateItem() enforce.
// Extracted out of normalizeBackupItem() to keep its complexity down.
function normalizeBackupFields(incoming) {
  const title = nonEmptyString(incoming?.title).trim();
  const phase = nonEmptyString(incoming?.phase);
  const section = nonEmptyString(incoming?.section);
  const titleOk = title && title.length <= MAX_TITLE_LENGTH;
  return (titleOk && phase && section) ? { title, phase, section } : null;
}

function backupCompletedAt(incoming, done) {
  if (!done) return null;
  return Number.isFinite(incoming.completedAt) ? incoming.completedAt : Date.now();
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

// onCompletionToggle(delta) — issue #8: fired once, with +1 or -1, exactly
// when a done-transition is detected (see completionDelta() above), so
// main.js can record it into activityLogStore without roadmapStore.js
// importing that store directly (keeps this module independently testable
// with no args, same as every existing call site/unit test already does —
// defaults to a no-op).
export function createRoadmapStore({ onCompletionToggle = () => {} } = {}) {
  // Reselected per sign-in (see setUser) via the single getStorageAdapter()
  // seam, so a future second backend never needs a call-site change here.
  let adapter = getStorageAdapter(null);
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
    unsubscribeRoadmap = adapter.listenRoadmap(uid, listenerTemplateId, remote => {
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
      const applied = applyRemoteSnapshot(remote, items, templatePhases, recentFlushedStrs);
      if (applied) {
        if (applied.structuralVersionBumped) structuralVersion += 1;
        items = applied.items;
        templatePhases = applied.phases;
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
      updatedAt: adapter.now(),
      templateId,
      items,
      phases: templatePhases
    };
    await adapter.saveRoadmap(uid, templateId, payload);
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
    // A dirty local blob means a queued-or-in-flight write from a previous
    // session never got confirmed (e.g. the page reloaded/closed before the
    // debounced flush() completed) — by definition it's at least as new as
    // anything remote can offer, so it must never be silently overwritten by
    // a stale remote read here. Same principle as attachRoadmapListener's
    // "never apply a remote snapshot while a local edit is unflushed" guard
    // (issue #58 hardening) — that guard only covered the realtime listener,
    // this initial-load path needed it too (issue #67).
    if (localBlob?.items && localBlob.dirty) {
      return {
        items: mergeWithSeed(localBlob.items, baseItems),
        phases: normalizeStringArray(localBlob.phases) || basePhases,
        dirty: true
      };
    }

    let remote = null;
    if (uid) {
      try {
        remote = await adapter.getRoadmap(uid, templateId);
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
    // Re-select the backend for this sign-in. Must happen before any of this
    // function's own adapter calls below.
    adapter = getStorageAdapter(nextUser);

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
      remoteMeta = await adapter.getMeta(uid);
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
        legacyRoadmap = await adapter.getLegacyRoadmap(uid);
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
          adapter.saveRoadmap(uid, legacyTemplateId, { ...legacyRoadmap, templateId: legacyTemplateId }).catch(error => {
            console.error('Failed to migrate legacy roadmap', error);
          });
        }
        adapter.saveMeta(uid, { startedTemplateIds, activeTemplateId, onboardingDone: true }).catch(error => {
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
          storedBlank = await adapter.getRoadmap(uid, 'blank');
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
        adapter.saveRoadmap(uid, migratedId, {
          version: ROADMAP_VERSION,
          updatedAt: adapter.now(),
          templateId: migratedId,
          items: migratedItems,
          phases: migratedPhases
        }).catch(error => {
          console.error('Failed to migrate blank roadmap content', error);
        });
        adapter.saveMeta(uid, { activeTemplateId, startedTemplateIds, customRoadmaps, onboardingDone: true }).catch(error => {
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

  // Flush any pending debounced edit on the *outgoing* template before
  // switching. Without this, once the debounce timer fired after the
  // switch, flush() would run using the by-then-reassigned
  // activeTemplateId/items — silently attributing the outgoing template's
  // edit to the new template's Firebase path and dropping it from the path
  // it actually belongs to. Extracted out of switchRoadmap (below) so that
  // function's own complexity stays under the ESLint gate.
  async function flushOutgoingRoadmap() {
    clearTimeout(saveTimer);
    saveTimer = null;
    try {
      await flush();
    } catch (error) {
      console.error('Failed to flush before switching roadmap', error);
    }
  }

  // The meta write a roadmap switch always needs — extracted for the same
  // complexity reason as flushOutgoingRoadmap above. `extraMeta` lets
  // createCustomRoadmap fold its own `customRoadmaps` patch into this same
  // round trip instead of paying for a separate one first.
  function saveSwitchMeta(requestedTemplateId, nextStartedTemplateIds, extraMeta) {
    if (!uid) return Promise.resolve();
    return adapter.saveMeta(uid, {
      activeTemplateId: requestedTemplateId,
      startedTemplateIds: nextStartedTemplateIds,
      onboardingDone: true,
      ...extraMeta
    }).catch(error => {
      console.error('Failed to save roadmap-switch meta', error);
    });
  }

  // Called by the onboarding picker (src/ui/pages/onboarding.js), both for a
  // first-time pick and for switching to a different template later — the two
  // cases share the same logic: an already-started template is loaded
  // (cache-first, never re-seeded), a not-yet-started one is seeded fresh.
  // Neither path ever touches any other template's stored items (issue #58).
  // `extraMeta` (optional) lets a caller that's already mutated local meta
  // state fold its own saveMeta patch into the single meta write below
  // instead of paying for a separate round trip first — see
  // createCustomRoadmap's `customRoadmaps` usage.
  async function switchRoadmap(requestedTemplateId, extraMeta) {
    // `&& onboardingDone` matters: `activeTemplateId` defaults to the
    // placeholder 'java-backend' before any sign-in's setUser() has resolved
    // (module init, above). If a user reaches /onboarding and picks the
    // first template (also 'java-backend', TEMPLATES[0]) before their
    // still-in-flight setUser() call finishes, this would otherwise be a
    // false-positive no-op — never seeding data or setting onboardingDone —
    // and the dashboard would briefly render, then bounce straight back to
    // /onboarding once the slow setUser() call resolves and correctly
    // determines onboardingDone is actually false. See the "switchRoadmap —
    // false-positive no-op before setUser() resolves" test below.
    if (requestedTemplateId === activeTemplateId && onboardingDone) return;

    const callId = ++stateCallId;
    const isStale = () => callId !== stateCallId;

    const alreadyStarted = startedTemplateIds.includes(requestedTemplateId);
    const nextStartedTemplateIds = alreadyStarted
      ? startedTemplateIds
      : [...startedTemplateIds, requestedTemplateId];

    const { baseItems, phases } = await fetchTemplateData(requestedTemplateId);
    if (isStale()) return;

    notify({ saveState: 'saving' });

    // A real, reported slowness bug: opening an already-started roadmap (or
    // creating a new one) used to pay for up to three sequential Firebase
    // round trips — flushing the outgoing template's pending edit, reading
    // the incoming template's saved progress, then writing the switch's own
    // meta patch — one after another, even though they touch three
    // independent Firebase paths and none of their inputs depends on
    // another's result. Running them concurrently is what actually makes
    // this fast, not just perceived-fast (see onboarding.js's picking
    // overlay / importRoadmapModal's loader for the perceived-fast half).
    const outgoingFlush = (activeTemplateId && dirty) ? flushOutgoingRoadmap() : Promise.resolve();

    const resolvedPromise = alreadyStarted
      ? resolveRoadmapItems(requestedTemplateId, baseItems, phases)
      : Promise.resolve({ items: baseItems, phases, dirty: true });

    const metaSave = saveSwitchMeta(requestedTemplateId, nextStartedTemplateIds, extraMeta);

    const [, resolved] = await Promise.all([outgoingFlush, resolvedPromise, metaSave]);
    if (isStale()) return;

    if (unsubscribeRoadmap) unsubscribeRoadmap();
    unsubscribeRoadmap = null;
    if (activeTemplateId) roadmapCache[activeTemplateId] = { items, phases: templatePhases, dirty };

    startedTemplateIds = nextStartedTemplateIds;
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

    if (uid) {
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
        await adapter.saveMeta(uid, { hiddenTemplateIds });
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
    // customRoadmaps is folded into switchRoadmap's own single meta write
    // (via extraMeta) instead of its own separate saveMeta round trip first —
    // see switchRoadmap's comment on why this matters for speed.
    await switchRoadmap(id, { customRoadmaps });
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
        await adapter.saveMeta(uid, { customRoadmaps, startedTemplateIds });
        await adapter.deleteRoadmap(uid, idToDelete);
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

  // Returns false (mutating nothing) when the patch fails a length cap (issue
  // #53) — callers must check this return value instead of assuming success,
  // same convention as addItem()'s item-count cap.
  function updateItem(id, patch) {
    if (!items[id]) return false;
    if (typeof patch.title === 'string' && (!patch.title.trim() || patch.title.length > MAX_TITLE_LENGTH)) return false;
    if (Array.isArray(patch.resources) && !patch.resources.every(isValidResource)) return false;
    // Only a `done` toggle is cosmetic (see docs/architecture.md §5.1). A
    // `notes` patch (issue #15) must NOT be added here — the notes indicator
    // badge on the row needs structuralVersion to bump so it re-renders. The
    // cosmetic check runs against the caller's own patch keys, before
    // `completedAt` (below) is folded in — `completedAt` is a derived,
    // internal side effect of a `done` toggle, not something callers set
    // directly, so a plain `{ done }` toggle from dashboard.js stays cosmetic
    // exactly like it always has (issue #18).
    const isCosmetic = Object.keys(patch).every(key => key === 'done');
    if (!isCosmetic) structuralVersion += 1;
    const delta = completionDelta(patch, items[id].done);
    items[id] = {
      ...items[id],
      ...withDerivedCompletedAt(patch, items[id].done),
      updatedAt: Date.now()
    };
    queueSave();
    if (delta !== 0) onCompletionToggle(delta);
    return true;
  }

  // Marks an item done/not-done in ANY template — not just the currently
  // active one (issue #56 follow-up: completing a Daily Todo linked to a
  // roadmap topic must work regardless of which roadmap the user happens to
  // be viewing right now, without silently switching their active roadmap
  // out from under them). Three cases, cheapest first:
  //   1. templateId is the active template — items are already in memory,
  //      so this is just updateItem() with completedViaTodoAt folded into
  //      the same patch (which also makes the patch non-cosmetic, so the
  //      row's badge gets structuralVersion's re-render, same as `notes`).
  //   2. templateId is cached (visited this session, not active right now)
  //      — patch roadmapCache in place and persist (local + Firebase)
  //      directly, without touching activeTemplateId/items/dirty/
  //      structuralVersion, since this template isn't on screen right now.
  //   3. templateId is cold (never touched this session) — one-shot read
  //      (Firebase first, falling back to the local blob), patch, persist
  //      the same way. Never seeds a not-yet-started template — a linked
  //      todo can only point at an item that already exists somewhere.
  // Resolves `{ ok: false }` if the item can't be found anywhere (e.g. the
  // source topic or its whole roadmap was deleted after the todo was linked
  // to it) — callers must check `ok` and surface that gracefully rather
  // than assuming success.
  async function setItemDoneInTemplate(templateId, itemId, done) {
    if (templateId === activeTemplateId) {
      // A soft-deleted item (removeItem()) still exists in the map — never
      // rendered again, but present — so without this check updateItem()
      // would happily "succeed" on it: a linked todo could be completed
      // against a topic the user can no longer see or interact with,
      // reporting ok:true for an update with zero visible effect. Treat it
      // the same as genuinely missing.
      if (!items[itemId] || items[itemId].deleted) return { ok: false, title: null };
      const patch = { done, completedViaTodoAt: done ? Date.now() : null };
      const ok = updateItem(itemId, patch);
      return { ok, title: ok ? items[itemId].title : null };
    }

    const cached = roadmapCache[templateId];
    if (cached?.items) {
      if (!cached.items[itemId] || cached.items[itemId].deleted) return { ok: false, title: null };
      const wasDone = cached.items[itemId].done;
      const patchedItem = {
        ...cached.items[itemId],
        done,
        ...todoCompletionFields(done),
        updatedAt: Date.now()
      };
      const nextItems = { ...cached.items, [itemId]: patchedItem };
      cached.items = nextItems;
      persistLocalRoadmap(templateId, { dirty: false, items: nextItems, phases: cached.phases });
      if (uid) {
        try {
          await adapter.saveRoadmap(uid, templateId, {
            version: ROADMAP_VERSION,
            updatedAt: adapter.now(),
            templateId,
            items: nextItems,
            phases: cached.phases
          });
        } catch (error) {
          console.error('Failed to save cross-roadmap item update', error);
          return { ok: false, title: null };
        }
      }
      const delta = completionDelta({ done }, wasDone);
      if (delta !== 0) onCompletionToggle(delta);
      return { ok: true, title: patchedItem.title };
    }

    let remote = null;
    if (uid) {
      try {
        remote = await adapter.getRoadmap(uid, templateId);
      } catch (error) {
        console.error('Failed to load roadmap for cross-roadmap item update', error);
      }
    }
    const localBlob = readLocalRoadmaps()[templateId];
    const baseItems = remote?.items || localBlob?.items;
    if (!baseItems?.[itemId] || baseItems[itemId].deleted) return { ok: false, title: null };
    const wasDone = baseItems[itemId].done;
    const basePhases = normalizeStringArray(remote?.phases) || normalizeStringArray(localBlob?.phases) || [];
    const patchedItem = {
      ...baseItems[itemId],
      done,
      ...todoCompletionFields(done),
      updatedAt: Date.now()
    };
    const nextItems = { ...baseItems, [itemId]: patchedItem };
    persistLocalRoadmap(templateId, { dirty: false, items: nextItems, phases: basePhases });
    if (uid) {
      try {
        await adapter.saveRoadmap(uid, templateId, {
          version: ROADMAP_VERSION,
          updatedAt: adapter.now(),
          templateId,
          items: nextItems,
          phases: basePhases
        });
      } catch (error) {
        console.error('Failed to save cross-roadmap item update', error);
        return { ok: false, title: null };
      }
    }
    const delta = completionDelta({ done }, wasDone);
    if (delta !== 0) onCompletionToggle(delta);
    return { ok: true, title: patchedItem.title };
  }

  function addItem({ title, phase, section, priority }) {
    const trimmedTitle = (title || '').trim();
    if (!trimmedTitle || trimmedTitle.length > MAX_TITLE_LENGTH) return false;
    const activeCount = Object.values(items).filter(item => !item.deleted).length;
    if (activeCount >= MAX_ITEMS_PER_ROADMAP) return false;
    const id = `custom-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    structuralVersion += 1;
    items[id] = {
      id,
      title: trimmedTitle,
      phase,
      section,
      priority,
      done: false,
      completedAt: null,
      custom: true,
      deleted: false,
      resources: [],
      notes: '',
      createdAt: Date.now()
    };
    queueSave();
    return true;
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
    if (!item) return false;
    const next = [...(item.resources || []), resource];
    return updateItem(id, { resources: next });
  }

  function updateResource(id, index, resource) {
    const item = items[id];
    if (!item) return false;
    const next = [...(item.resources || [])];
    next[index] = resource;
    return updateItem(id, { resources: next });
  }

  function removeResource(id, index) {
    const item = items[id];
    if (!item) return;
    const next = [...(item.resources || [])];
    next.splice(index, 1);
    updateItem(id, { resources: next });
  }

  const VALID_PRIORITIES = ['P0', 'P1', 'P2', 'P3'];

  // Normalizes one backup-file item into this store's own field shape, or
  // returns `null` if it fails the same per-field caps addItem/updateItem
  // enforce. Extracted out of importBackupItems() so that function's own
  // complexity stays under the eslint `complexity` gate (root CLAUDE.md).
  function normalizeBackupItem(incoming) {
    const fields = normalizeBackupFields(incoming);
    if (!fields) return null;

    const done = !!incoming.done;
    return {
      ...fields,
      priority: VALID_PRIORITIES.includes(incoming.priority) ? incoming.priority : 'P2',
      done,
      completedAt: backupCompletedAt(incoming, done),
      resources: Array.isArray(incoming.resources) ? incoming.resources.filter(isValidResource) : [],
      notes: typeof incoming.notes === 'string' ? incoming.notes.slice(0, 5000) : ''
    };
  }

  // Restores items from a validated JSON backup (issue #18) into the
  // currently active roadmap. This is the store's own equivalent of
  // addItem()/updateItem() for a whole batch at once — UI call sites (the
  // import modal) go through this single method rather than ever touching
  // `items` directly, same "no direct items mutation" contract addItem/
  // updateItem already give every other caller. `backupItems` is the
  // already-schema-validated `items` map from a backup payload (see
  // src/core/roadmap/backupValidator.js) — this function re-checks the same
  // per-field caps addItem/updateItem enforce (title length, resource
  // label/url length, the per-roadmap item-count cap) since a backup file is
  // untrusted input, not just re-trusting the validator.
  //
  // Deliberately preserves each backup item's own id rather than generating a
  // fresh one like addItem() does: restoring the same export back into the
  // same account needs to recognize "this item already exists" by id so a
  // repeated import is idempotent (merges instead of duplicating), and the
  // diff-summary UI (diffBackupItems) counts new-vs-existing the same way.
  // Restoring into a different account just means every id is unrecognized
  // and everything imports as new — there is no uid stored on an item to
  // "strip", so cross-account import is naturally safe with no extra step.
  function importBackupItems(backupItems) {
    if (!backupItems || typeof backupItems !== 'object') return { added: 0, updated: 0, skipped: 0 };
    let added = 0;
    let updated = 0;
    let skipped = 0;

    Object.entries(backupItems).forEach(([id, incoming]) => {
      const normalized = normalizeBackupItem(incoming);
      if (!normalized) {
        skipped += 1;
        return;
      }

      if (items[id]) {
        items[id] = {
          ...items[id],
          ...normalized,
          deleted: false,
          updatedAt: Date.now()
        };
        updated += 1;
        return;
      }

      const activeCount = Object.values(items).filter(item => !item.deleted).length;
      if (activeCount >= MAX_ITEMS_PER_ROADMAP) {
        skipped += 1;
        return;
      }
      items[id] = {
        id,
        ...normalized,
        custom: true,
        deleted: false,
        createdAt: Date.now()
      };
      added += 1;
    });

    if (added || updated) {
      structuralVersion += 1;
      queueSave();
    }
    return { added, updated, skipped };
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
    setItemDoneInTemplate,
    addItem,
    removeItem,
    addResource,
    updateResource,
    removeResource,
    importBackupItems,
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
