import { ROADMAP_VERSION, buildSeedItems, PHASES } from '../data/roadmap.js';
import { buildSeedItems as buildTemplateSeedItems, getTemplatePhases, getLegacyBlankTemplateData, getTemplate } from '../data/templates/index.js';
import { getStorageAdapter } from './storage/adapterFactory.js';
import { KEYS } from './localStorageKeys.js';
import { MAX_TITLE_LENGTH, isValidResource, isValidTags, MAX_FAVORITE_ROADMAPS, MAX_CUSTOM_ROADMAP_TITLE_LENGTH, MAX_CUSTOM_ROADMAP_DESCRIPTION_LENGTH, MAX_CUSTOM_ROADMAPS } from '../core/roadmap/limits.js';

export { MAX_FAVORITE_ROADMAPS, MAX_CUSTOM_ROADMAPS };

const LOCAL_KEY = KEYS.ROADMAP;
const UI_KEY = KEYS.UI_STATE;

// Firebase rules can't count a map's children directly, so the per-roadmap item
// cap is enforced here — the one place every new item is created. Lowered from
// 1,000 (issue #24) to 800 (issue #53): no real roadmap organically approaches
// even 800 topics, so the tighter cap costs no legitimate user anything while
// shrinking the accidental-storage-runaway window on the free tier.
const MAX_ITEMS_PER_ROADMAP = 800;

// MAX_FAVORITE_ROADMAPS (issue #177) lives in core/roadmap/limits.js and is
// re-exported above — a user may mark at most that many roadmaps (built-in
// or custom, no distinction) as favorites, sorted before all others on the
// onboarding picker. Enforced here (toggleFavoriteRoadmap) and server-side
// (firebase/database.rules.json's numChildren() <= 3 check).

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

// Shared by setItemDoneInTemplate()'s cached/cold branches (issue #276 —
// extracted to bring that function's cyclomatic complexity down from 33).
// Returns the item if it's present and not soft-deleted (removeItem()) —
// null in either case, matching the "treat a soft-deleted item as missing"
// guard documented above todoCompletionFields().
function findLiveTemplateItem(itemsMap, itemId) {
  const item = itemsMap?.[itemId];
  if (!item || item.deleted) return null;
  return item;
}

// The done/not-done patch shape shared by the cached and cold branches —
// the active-template branch instead folds completedViaTodoAt into
// updateItem()'s own patch, so it doesn't use this helper.
function buildCrossRoadmapDonePatch(done) {
  return { done, ...todoCompletionFields(done), updatedAt: Date.now() };
}

// Merges `patch` into `itemsMap[itemId]`, returning both the patched item
// and the new items map — the cached/cold branches each need both: the
// patched item's title for the resolved `{ ok, title }`, and the new map to
// persist locally/remotely.
function applyCrossRoadmapPatch(itemsMap, itemId, patch) {
  const patchedItem = { ...itemsMap[itemId], ...patch };
  const nextItems = { ...itemsMap, [itemId]: patchedItem };
  return { patchedItem, nextItems };
}

// Tries a scoped per-item Firebase write first (issue #232/#184's
// lost-update race fix — see .claude/rules/roadmap-store.md), falling back
// to a full saveRoadmap() only when there's no existing remote node to
// merge fields into. `attemptScoped` lets the cold branch skip the scoped
// call entirely when it already knows (from its own remote read) that the
// item was never synced to Firebase for this roadmap — same behavior the
// original inline ternary had. Throws on failure so the caller's own
// try/catch can log and resolve `{ ok: false }` — this function never
// swallows an error itself.
async function writeCrossRoadmapPatch(adapter, { uid, templateId, itemId, patch, nextItems, phases, attemptScoped }) {
  const scoped = attemptScoped ? await adapter.updateRoadmapItemFields(uid, templateId, itemId, patch) : null;
  if (!scoped) {
    await adapter.saveRoadmap(uid, templateId, {
      version: ROADMAP_VERSION,
      updatedAt: adapter.now(),
      templateId,
      items: nextItems,
      phases
    });
  }
}

// Fires onCompletionToggle exactly once per genuine done-transition — the
// same completionDelta() computation the cached/cold branches each repeated
// inline.
function applyCrossRoadmapCompletionDelta(onCompletionToggle, done, wasDone) {
  const delta = completionDelta({ done }, wasDone);
  if (delta !== 0) onCompletionToggle(delta);
}

// The cold branch's one-shot read: Firebase first (best-effort — a failed
// read just falls through to the local blob, same as before), then the
// local blob for whichever of items/phases the remote read didn't provide.
// Extracted out of setColdTemplateItemDone() to keep its own complexity
// under the eslint `complexity` gate (root CLAUDE.md, issue #276).
async function fetchColdTemplateBase(adapter, uid, templateId) {
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
  const basePhases = normalizeStringArray(remote?.phases) || normalizeStringArray(localBlob?.phases) || [];
  return { remote, baseItems, basePhases };
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

function readLocalHiddenTemplates() {
  try {
    const raw = JSON.parse(localStorage.getItem(KEYS.HIDDEN_TEMPLATES) || '[]');
    return Array.isArray(raw) ? raw : [];
  } catch {
    return [];
  }
}

function readLocalFavoriteRoadmaps() {
  try {
    const raw = JSON.parse(localStorage.getItem(KEYS.FAVORITE_ROADMAPS) || '[]');
    return Array.isArray(raw) ? raw : [];
  } catch {
    return [];
  }
}

function readLocalTourDone() {
  return localStorage.getItem(KEYS.TOUR_DONE) === 'true';
}

function readLocalOnboardingTourDone() {
  return localStorage.getItem(KEYS.ONBOARDING_TOUR_DONE) === 'true';
}

// Sentinel returned by every onboarding-detection helper below to mean "a
// newer setUser() call has already taken over — abort without applying this
// result." Distinct from `null`/`undefined` (both legitimate "no migration
// needed" results) so callers can't mistake staleness for "nothing to do".
export const STALE = Symbol('stale');

// setUser() phase 1 — the uid-transition privacy wipe (roadmap-store.md's
// "Sign-out contract"). Pure: no localStorage access (that's clearLocal(),
// called separately by the caller) and no dependency on any in-progress
// store instance, so the fresh-state shape can be asserted on directly in a
// unit test without constructing a whole store.
export function freshStateForNewUid() {
  return {
    items: buildSeedItems(),
    activeTemplateId: 'java-backend',
    templatePhases: PHASES,
    onboardingDone: null,
    hiddenTemplateIds: [],
    customRoadmaps: [],
    startedTemplateIds: [],
    favoriteRoadmapIds: [],
    tourDone: null,
    onboardingTourDone: null,
    roadmapCache: {},
    pendingCustomSeeds: {},
    dirty: false,
    recentFlushedStrs: []
  };
}

// setUser() phase 3 — local fallback state read once per sign-in, before the
// remote meta fetch, so the legacy-detection phase below has every local
// signal available up front.
export function readOnboardingLocalFallback() {
  const localRoadmaps = readLocalRoadmaps();
  return {
    localRoadmaps,
    localOnboardingDone: localStorage.getItem(KEYS.ONBOARDING_DONE) === 'true',
    localActiveTemplateId: localStorage.getItem(KEYS.TEMPLATE_ID),
    localStartedTemplateIds: Object.keys(localRoadmaps)
  };
}

// setUser() phase 4 — the remote meta fetch, isolated so the try/catch
// itself doesn't add to setUser's own complexity count.
async function fetchRemoteMetaSafely(uid, adapter) {
  try {
    return await adapter.getMeta(uid);
  } catch (error) {
    console.error('Failed to load roadmap meta from Firebase', error);
    return null;
  }
}

// setUser() phase 5 — hidden-templates/custom-roadmaps resolution: remote
// meta wins when present, otherwise fall back to whatever's stored locally.
export function resolveMetaExtras(remoteMeta) {
  return {
    hiddenTemplateIds: normalizeStringArray(remoteMeta?.hiddenTemplateIds) || readLocalHiddenTemplates(),
    customRoadmaps: normalizeStringArray(remoteMeta?.customRoadmaps) || readLocalCustomRoadmaps(),
    favoriteRoadmapIds: normalizeStringArray(remoteMeta?.favoriteRoadmapIds) || readLocalFavoriteRoadmaps(),
    // Only ever true or false — remote wins the moment it's ever been set
    // true (this only ever gets backfilled/completed forward, never reset
    // remotely), otherwise fall back to this device's own local flag.
    tourDone: remoteMeta?.tourDone === true || readLocalTourDone(),
    // Issue #293 — same shape as tourDone above, its own independent flag.
    onboardingTourDone: remoteMeta?.onboardingTourDone === true || readLocalOnboardingTourDone()
  };
}

// setUser() phase 6 — the startedTemplateIds-present vs. legacy-migration
// branch (roadmap-store.md's "Onboarding detection order"), the single
// biggest source of setUser's original complexity. Pure aside from the
// adapter calls it's explicitly handed: takes uid/adapter/remoteMeta/
// localFallback and an isStale() check (still tied to the calling setUser's
// own stateCallId, since staleness is inherently per-call) and returns
// either STALE or `{ onboardingDone, activeTemplateId, startedTemplateIds,
// migratedLegacyItems }` for the caller to assign onto its own state.
async function fetchLegacyRoadmapSafely(uid, adapter) {
  try {
    return await adapter.getLegacyRoadmap(uid);
  } catch (error) {
    console.error('Failed to load legacy roadmap from Firebase', error);
    return null;
  }
}

// Pure: whether a pre-issue-#58 (or pre-#51) account should be treated as
// already onboarded, per every legacy signal available.
function isAlreadyOnboardedLegacy(remoteMeta, legacyRoadmap, legacyTemplateId, localFallback) {
  const { localOnboardingDone, localRoadmaps } = localFallback;
  return !!remoteMeta?.onboardingDone
    || localOnboardingDone
    || hasRealProgress(legacyRoadmap?.items)
    || hasRealProgress(localRoadmaps[legacyTemplateId]?.items);
}

// Fire-and-forget backfill of the new (issue #58) meta shape for a legacy
// account that just got detected as already onboarded — copies the legacy
// roadmap forward (never deleting the old path, a safety net) and writes
// the new meta fields so this account isn't re-detected as legacy again.
function backfillLegacyOnboardingMeta({ uid, adapter, legacyRoadmap, legacyTemplateId, startedTemplateIds }) {
  if (legacyRoadmap) {
    adapter.saveRoadmap(uid, legacyTemplateId, { ...legacyRoadmap, templateId: legacyTemplateId }).catch(error => {
      console.error('Failed to migrate legacy roadmap', error);
    });
  }
  adapter.saveMeta(uid, { startedTemplateIds, activeTemplateId: legacyTemplateId, onboardingDone: true }).catch(error => {
    console.error('Failed to backfill onboarding meta', error);
  });
}

// Already on the new (issue #58) meta shape — no migration needed. Split out
// of resolveOnboardingState to keep that function's own complexity under
// the ESLint gate (root CLAUDE.md).
function newShapeOnboardingState(remoteMeta) {
  const startedTemplateIds = remoteMeta.startedTemplateIds;
  return {
    onboardingDone: true,
    activeTemplateId: remoteMeta.activeTemplateId || startedTemplateIds[0],
    startedTemplateIds,
    migratedLegacyItems: null
  };
}

// Either a brand-new account, or one that predates issue #58 (and possibly
// predates issue #51 too). Checks the legacy singular roadmap path once to
// decide, and migrates it forward if this account turns out to already be
// onboarded. Split out of resolveOnboardingState for the same complexity
// reason as newShapeOnboardingState above.
async function resolveLegacyOnboardingState({ uid, adapter, remoteMeta, localFallback, isStale }) {
  const legacyRoadmap = await fetchLegacyRoadmapSafely(uid, adapter);
  if (isStale()) return STALE;

  const { localActiveTemplateId, localStartedTemplateIds } = localFallback;
  const legacyTemplateId = remoteMeta?.templateId || localActiveTemplateId || 'java-backend';

  if (!isAlreadyOnboardedLegacy(remoteMeta, legacyRoadmap, legacyTemplateId, localFallback)) {
    return { onboardingDone: false, activeTemplateId: null, startedTemplateIds: [], migratedLegacyItems: null };
  }

  const startedTemplateIds = localStartedTemplateIds.includes(legacyTemplateId)
    ? localStartedTemplateIds
    : [...localStartedTemplateIds, legacyTemplateId];

  backfillLegacyOnboardingMeta({ uid, adapter, legacyRoadmap, legacyTemplateId, startedTemplateIds });

  return {
    onboardingDone: true,
    activeTemplateId: legacyTemplateId,
    startedTemplateIds,
    migratedLegacyItems: legacyRoadmap ? legacyRoadmap.items : null
  };
}

export async function resolveOnboardingState({ uid, adapter, remoteMeta, localFallback, isStale }) {
  if (remoteMeta?.startedTemplateIds?.length) {
    return newShapeOnboardingState(remoteMeta);
  }
  return resolveLegacyOnboardingState({ uid, adapter, remoteMeta, localFallback, isStale });
}

// One-time migration for the now-retired 'blank' template (issue #4
// follow-up, extracted out of setUser as phase 6's continuation) — see
// roadmap-store.md's "'blank' template retirement" for the full history.
// Returns STALE, or `null` when no migration is needed, or the resolved
// `{ activeTemplateId, startedTemplateIds, customRoadmaps, migratedId,
// migratedItems, migratedPhases }` for the caller to assign/persist.
async function fetchStoredBlankRoadmap(uid, adapter) {
  let storedBlank = null;
  if (uid) {
    try {
      storedBlank = await adapter.getRoadmap(uid, 'blank');
    } catch (error) {
      console.error('Failed to load blank roadmap for migration', error);
    }
  }
  if (!storedBlank?.items) {
    const localBlob = readLocalRoadmaps().blank;
    if (localBlob?.items) storedBlank = localBlob;
  }
  return storedBlank;
}

// Pre-dates PR #60 always persisting `phases` — falls back to blank.js's own
// fixed skeleton/empty seed for whichever half (items or phases) is missing.
async function resolveBlankMigrationContent(storedBlank, isStale) {
  let migratedItems = storedBlank?.items;
  let migratedPhases = normalizeStringArray(storedBlank?.phases);
  if (migratedItems && migratedPhases) return { migratedItems, migratedPhases };

  const legacy = await getLegacyBlankTemplateData();
  if (isStale()) return STALE;
  return {
    migratedItems: migratedItems || legacy.baseItems,
    migratedPhases: migratedPhases || legacy.phases
  };
}

// Fire-and-forget persistence of the migrated content to Firebase, mirroring
// backfillLegacyOnboardingMeta()'s pattern above.
function persistBlankMigrationToFirebase({ uid, adapter, migratedId, migratedItems, migratedPhases, nextActiveTemplateId, nextStartedTemplateIds, nextCustomRoadmaps }) {
  if (!uid) return;
  adapter.saveRoadmap(uid, migratedId, {
    version: ROADMAP_VERSION,
    updatedAt: adapter.now(),
    templateId: migratedId,
    items: migratedItems,
    phases: migratedPhases
  }).catch(error => {
    console.error('Failed to migrate blank roadmap content', error);
  });
  adapter.saveMeta(uid, {
    activeTemplateId: nextActiveTemplateId,
    startedTemplateIds: nextStartedTemplateIds,
    customRoadmaps: nextCustomRoadmaps,
    onboardingDone: true
  }).catch(error => {
    console.error('Failed to save meta after blank-template migration', error);
  });
}

export async function migrateLegacyBlankTemplateIfNeeded({ uid, adapter, activeTemplateId, startedTemplateIds, customRoadmaps, isStale }) {
  if (!(activeTemplateId === 'blank' || startedTemplateIds.includes('blank'))) return null;

  const storedBlank = await fetchStoredBlankRoadmap(uid, adapter);
  if (isStale()) return STALE;

  const content = await resolveBlankMigrationContent(storedBlank, isStale);
  if (content === STALE) return STALE;
  const { migratedItems, migratedPhases } = content;

  const migratedId = genId('croadmap');
  const nextCustomRoadmaps = [...customRoadmaps, { id: migratedId, title: 'My roadmap', description: '', createdAt: Date.now() }];
  const nextActiveTemplateId = activeTemplateId === 'blank' ? migratedId : activeTemplateId;
  const nextStartedTemplateIds = startedTemplateIds.map(id => (id === 'blank' ? migratedId : id));

  persistBlankMigrationToFirebase({ uid, adapter, migratedId, migratedItems, migratedPhases, nextActiveTemplateId, nextStartedTemplateIds, nextCustomRoadmaps });

  return {
    activeTemplateId: nextActiveTemplateId,
    startedTemplateIds: nextStartedTemplateIds,
    customRoadmaps: nextCustomRoadmaps,
    migratedId,
    migratedItems,
    migratedPhases
  };
}

// setUser() phase 6, combined — orchestrates resolveOnboardingState() and
// migrateLegacyBlankTemplateIfNeeded() so setUser itself only has to check
// one STALE result and one "did a blank migration happen" branch instead of
// two of each. Returns STALE or `{ onboardingDone, activeTemplateId,
// startedTemplateIds, customRoadmaps, migratedLegacyItems, blankMigration }`
// (`blankMigration` is `null` when no migration ran).
export async function determineOnboardingAndActiveRoadmap({ uid, adapter, remoteMeta, localFallback, customRoadmaps, isStale }) {
  const base = await resolveOnboardingState({ uid, adapter, remoteMeta, localFallback, isStale });
  if (base === STALE) return STALE;
  if (!base.onboardingDone) return { ...base, customRoadmaps, blankMigration: null };

  const blankMigration = await migrateLegacyBlankTemplateIfNeeded({
    uid,
    adapter,
    activeTemplateId: base.activeTemplateId,
    startedTemplateIds: base.startedTemplateIds,
    customRoadmaps,
    isStale
  });
  if (blankMigration === STALE) return STALE;
  if (!blankMigration) return { ...base, customRoadmaps, blankMigration: null };

  return {
    onboardingDone: true,
    activeTemplateId: blankMigration.activeTemplateId,
    startedTemplateIds: blankMigration.startedTemplateIds,
    customRoadmaps: blankMigration.customRoadmaps,
    migratedLegacyItems: base.migratedLegacyItems,
    blankMigration
  };
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
  // At most MAX_FAVORITE_ROADMAPS ids (built-in or custom, no distinction —
  // issue #177), sorted before all others on the onboarding picker.
  let favoriteRoadmapIds = [];
  // First-time feature tour (issue #17) — null until the first setUser()
  // resolves it (mirrors onboardingDone's null-while-loading convention),
  // then true/false. Reset back to null on a uid transition (sign-out) below.
  let tourDone = null;
  // Second, onboarding-page-specific tour (issue #293) — same null-while-
  // loading/true/false shape as tourDone, its own independent flag.
  let onboardingTourDone = null;
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

  // Issue #153 — serializes the "compute the latest startedTemplateIds/
  // customRoadmaps/favoriteRoadmapIds snapshot, then saveMeta it" critical
  // section across overlapping switchRoadmap()/createCustomRoadmap()/
  // deleteCustomRoadmap() calls. Without this, two calls racing in back-to-
  // back (e.g. importing two custom roadmaps within a few seconds) could each
  // read `startedTemplateIds` before either had reassigned it, so whichever
  // call's whole-array saveMeta() write happened to land on Firebase last
  // would silently erase the other's id — Realtime Database's `update()` has
  // no array-diffing, it fully replaces the field. Chaining every meta
  // mutation behind this single in-module promise guarantees each one
  // computes its snapshot only after every previously *queued* mutation has
  // both applied its in-memory change and had its own saveMeta() settle —
  // so a later write can never be a stale subset of an earlier one, and the
  // two can never race each other for last-write-wins. This only serializes
  // the array-field computation+write itself; the other legs of a
  // switchRoadmap() call (the outgoing flush, the incoming template's read)
  // are unaffected and still run concurrently (issue #121 item 6).
  let metaMutationQueue = Promise.resolve();
  function serializeMetaMutation(run) {
    const settled = metaMutationQueue.then(run, run);
    metaMutationQueue = settled.then(() => {}, () => {});
    return settled;
  }

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
      favoriteRoadmapIds,
      tourDone,
      onboardingTourDone,
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

  function persistLocalHiddenTemplates() {
    localStorage.setItem(KEYS.HIDDEN_TEMPLATES, JSON.stringify(hiddenTemplateIds));
  }

  function persistLocalFavoriteRoadmaps() {
    localStorage.setItem(KEYS.FAVORITE_ROADMAPS, JSON.stringify(favoriteRoadmapIds));
  }

  // Only ever persists a positive tour state — same "nothing useful to write
  // on the false path" precedent as persistLocalOnboarding above.
  function persistLocalTourDone() {
    if (!tourDone) return;
    localStorage.setItem(KEYS.TOUR_DONE, 'true');
  }

  // Same "only ever persist a positive state" precedent as persistLocalTourDone.
  function persistLocalOnboardingTourDone() {
    if (!onboardingTourDone) return;
    localStorage.setItem(KEYS.ONBOARDING_TOUR_DONE, 'true');
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
    localStorage.removeItem(KEYS.FAVORITE_ROADMAPS);
    localStorage.removeItem(KEYS.TOUR_DONE);
    localStorage.removeItem(KEYS.ONBOARDING_TOUR_DONE);
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
    // Captured by reference here, synchronously, before the only await below
    // — issue #153 root cause #3. A switchRoadmap() to a *different* template
    // can reassign the shared `items`/`templatePhases`/`activeTemplateId`/
    // `dirty` variables while this flush's own adapter.saveRoadmap() await is
    // still in flight; reading those shared variables again afterward (as
    // this used to) could stamp a different template's live data into this
    // template's roadmapCache slot, mislabeled dirty:false. Using these local
    // captures for every post-await read makes that impossible — the actual
    // network write already used them too, so this changes no on-the-wire
    // behavior, only what the post-await bookkeeping reads.
    const flushedItems = items;
    const flushedPhases = templatePhases;
    const flushedStr = stableStringify({ items: flushedItems, phases: flushedPhases });
    const payload = {
      version: ROADMAP_VERSION,
      updatedAt: adapter.now(),
      templateId,
      items: flushedItems,
      phases: flushedPhases
    };
    await adapter.saveRoadmap(uid, templateId, payload);
    recentFlushedStrs.push(flushedStr);
    if (recentFlushedStrs.length > MAX_RECENT_FLUSHES) recentFlushedStrs.shift();
    // Only touch the live in-memory state if we're still flushing the
    // currently-active template — if a switch happened mid-flight, the live
    // `items`/`dirty` now belong to a different template and must be left
    // alone; the cache slot below still gets stamped for the template this
    // flush actually wrote, using the captured (not live) content.
    if (activeTemplateId === templateId) {
      dirty = false;
      persistLocal();
    }
    roadmapCache[templateId] = { items: flushedItems, phases: flushedPhases, dirty: false };
    notify({ saveState: 'saved' });
  }

  // Issue #153 root cause #2 — a failed flush used to be a dead end: nothing
  // ever re-queued a save after the debounced flush().catch() fired, even
  // though dashboard.js's save badge claimed "retrying…". These two module
  // vars back real exponential-backoff retry so that claim is actually true.
  let saveRetryTimer = null;
  let saveRetryAttempt = 0;
  const SAVE_RETRY_BASE_MS = 2000;
  const SAVE_RETRY_MAX_MS = 30000;

  function clearSaveRetry() {
    clearTimeout(saveRetryTimer);
    saveRetryTimer = null;
    saveRetryAttempt = 0;
  }

  function attemptFlushWithRetry() {
    flush().then(() => {
      clearSaveRetry();
    }).catch(error => {
      console.error('Roadmap save failed', error);
      scheduleSaveRetry(error);
    });
  }

  function scheduleSaveRetry(error) {
    clearTimeout(saveRetryTimer);
    saveRetryAttempt += 1;
    const delayMs = Math.min(SAVE_RETRY_BASE_MS * 2 ** (saveRetryAttempt - 1), SAVE_RETRY_MAX_MS);
    notify({ saveState: 'error', error, retryAttempt: saveRetryAttempt, retryInMs: delayMs });
    saveRetryTimer = setTimeout(attemptFlushWithRetry, delayMs);
  }

  // Exposed so a UI (dashboard.js's "Retry now" action) can force an
  // immediate retry instead of waiting out the current backoff delay.
  function retrySaveNow() {
    if (!dirty) return;
    clearTimeout(saveRetryTimer);
    saveRetryTimer = null;
    notify({ saveState: 'saving' });
    attemptFlushWithRetry();
  }

  function queueSave() {
    dirty = true;
    persistLocal();
    notify({ saveState: 'saving' });
    clearTimeout(saveTimer);
    clearSaveRetry();
    saveTimer = setTimeout(attemptFlushWithRetry, 500);
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
  //
  // Takes `templateDataPromise` (fetchTemplateData()'s *unresolved* promise,
  // not its already-awaited value) — issue #121 item 6: fetchTemplateData()
  // is a dynamic import() for a built-in template, which can take real time
  // on a slow connection or a cold module cache, and it has no dependency on
  // this function's own Firebase read (only the final merge step needs
  // baseItems/basePhases). Every caller used to `await fetchTemplateData(...)`
  // in full before calling this function at all, so that import's latency
  // was pure added time stacked in front of the Firebase round trip instead
  // of overlapping it. Passing the promise through lets the two run
  // concurrently — `await`ed here only where a branch actually needs the
  // result, and skipped entirely for a cache hit with its own phases already
  // populated (the common, already-fast case), so a fast cache hit never
  // pays for the import either.
  // Merges a resolved source's items/phases against the template's base
  // seed — shared by every branch below that returns a merged result, so
  // resolveRoadmapItems itself only has to decide *which* source to merge,
  // not repeat the merge/normalize logic three times. Extracted to keep that
  // function's own complexity under the ESLint gate (root CLAUDE.md).
  function buildMergedResolution({ sourceItems, sourcePhases, baseItems, basePhases, dirty }) {
    return {
      items: mergeWithSeed(sourceItems, baseItems),
      phases: normalizeStringArray(sourcePhases) || basePhases,
      dirty
    };
  }

  // Neither of these depends on the other's result — running them
  // concurrently (rather than awaiting the template-data fetch first) is the
  // actual fix for issue #121 item 6.
  function fetchRemoteRoadmapSafely(templateId) {
    if (!uid) return Promise.resolve(null);
    return adapter.getRoadmap(uid, templateId).catch(error => {
      console.error('Failed to load roadmap from Firebase', error);
      return null;
    });
  }

  async function resolveRoadmapItems(templateId, templateDataPromise) {
    const cached = roadmapCache[templateId];
    if (cached) {
      const phases = cached.phases || (await templateDataPromise).phases;
      return { items: cached.items, phases, dirty: !!cached.dirty };
    }

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
      const { baseItems, phases: basePhases } = await templateDataPromise;
      return buildMergedResolution({ sourceItems: localBlob.items, sourcePhases: localBlob.phases, baseItems, basePhases, dirty: true });
    }

    const [remote, { baseItems, phases: basePhases }] = await Promise.all([
      fetchRemoteRoadmapSafely(templateId),
      templateDataPromise
    ]);

    if (remote?.items) {
      return buildMergedResolution({ sourceItems: remote.items, sourcePhases: remote.phases, baseItems, basePhases, dirty: false });
    }
    if (localBlob?.items) {
      return buildMergedResolution({ sourceItems: localBlob.items, sourcePhases: localBlob.phases, baseItems, basePhases, dirty: !!localBlob.dirty });
    }
    return { items: baseItems, phases: basePhases, dirty: false };
  }

  // Cross-roadmap topic search (issue #283) — resolves every started roadmap's
  // (built-in + custom) items so `commandPalette.js`'s global topic search can scan
  // across all of them, not just the active one. Deliberately read-only: reuses
  // fetchTemplateData()/resolveRoadmapItems() exactly like switchRoadmap() does (cache
  // -> Firebase -> local blob -> seed), but never writes to roadmapCache or any other
  // store state — opening the command palette must never mutate a roadmap the user
  // hasn't actually switched to. Runs concurrently across every roadmap (same
  // Promise.all discipline as switchRoadmap()'s own network calls, issue #121 item 6)
  // rather than sequentially, since none of these reads depend on each other.
  async function getAllRoadmapsForSearch() {
    return Promise.all(startedTemplateIds.map(async id => {
      const templateDataPromise = fetchTemplateData(id);
      const { items, phases } = await resolveRoadmapItems(id, templateDataPromise);
      const title = isCustomRoadmapId(id)
        ? (customRoadmaps.find(r => r.id === id)?.title || 'Untitled roadmap')
        : (getTemplate(id)?.name || id);
      return { id, title, items, phases };
    }));
  }

  // Read-only snapshot of *any* started roadmap's items/phases (issue #285's
  // comparison view) — reuses the exact same cache -> Firebase -> local blob
  // -> seed resolution order resolveRoadmapItems() already applies to every
  // roadmap load, but never touches activeTemplateId/items/roadmapCache/dirty
  // and never attaches a listener. Safe to call for a roadmap that's already
  // cached (an instant cache hit, same as switching to it would be) or one
  // that's never been visited this session (a one-shot read, same network
  // path fetchTemplateData()/resolveRoadmapItems() already take) — either way
  // this is purely additive reading, not a second copy of the load logic.
  async function getRoadmapSnapshotForComparison(templateId) {
    if (!templateId) return { items: {}, phases: [] };
    const { items: resolvedItems, phases } = await resolveRoadmapItems(templateId, fetchTemplateData(templateId));
    return { items: resolvedItems, phases };
  }

  // setUser()'s final phase, once onboardingDone is known true — loads the
  // active template's items/phases (cache -> Firebase -> local blob -> seed,
  // see resolveRoadmapItems) and seeds roadmapCache from a just-migrated
  // legacy roadmap when one exists. Stays a factory closure (like
  // flushOutgoingRoadmap/saveSwitchMeta below) rather than a pure module
  // function, since it delegates straight to fetchTemplateData/
  // resolveRoadmapItems, which are themselves closures over adapter/uid/
  // roadmapCache.
  async function loadActiveRoadmap(migratedLegacyItems, isStale) {
    // Not awaited here — issue #121 item 6: this is a dynamic import() for a
    // built-in template, which has no dependency on resolveRoadmapItems()'s
    // own Firebase read below. Handing it the still-pending promise lets the
    // two run concurrently instead of paying for the import's latency before
    // the Firebase round trip even starts (see resolveRoadmapItems()'s own
    // comment for the full reasoning).
    const templateDataPromise = fetchTemplateData(activeTemplateId);

    if (migratedLegacyItems && !roadmapCache[activeTemplateId]) {
      const { baseItems, phases } = await templateDataPromise;
      if (isStale()) return STALE;
      roadmapCache[activeTemplateId] = { items: mergeWithSeed(migratedLegacyItems, baseItems), phases, dirty: false };
    }

    const resolved = await resolveRoadmapItems(activeTemplateId, templateDataPromise);
    if (isStale()) return STALE;
    return resolved;
  }

  // Issue #17 — backfill for accounts that already existed before the tour
  // shipped: without this, every current account gets tourDone defaulted to
  // false and the tour would auto-fire for long-time users who never asked
  // for it. Called once per sign-in, right after the active roadmap's items
  // have loaded (mirrors the timing hasRealProgress() needs). An account
  // counts as "already past onboarding" — no forced tour — if it either (a)
  // already has real progress (a custom or done item) in the roadmap that
  // just loaded, or (b) reached onboardingDone via a legacy migration path
  // (blank-template retirement or the pre-#58 singular-roadmap migration)
  // rather than a fresh template pick made from here forward. Only an
  // account that both starts with zero real progress AND reached
  // onboardingDone via a genuine fresh pick keeps tourDone's real `false`
  // default, so only it gets the auto-start.
  function backfillTourDoneIfNeeded(onboarding) {
    if (tourDone) return;
    const reachedViaMigration = !!(onboarding.migratedLegacyItems || onboarding.blankMigration);
    if (!reachedViaMigration && !hasRealProgress(items)) return;
    tourDone = true;
    persistLocalTourDone();
    if (uid) {
      adapter.saveMeta(uid, { tourDone: true }).catch(error => {
        console.error('Failed to backfill tour state', error);
      });
    }
  }

  // Issue #293 — identical backfill reasoning to backfillTourDoneIfNeeded
  // above, applied to the second, onboarding-page tour: an account that
  // already has real progress (or reached onboardingDone via a legacy
  // migration) predates this feature and should never see it auto-fire —
  // only a genuinely fresh account, working through the dashboard tour for
  // the first time, keeps onboardingTourDone's real `false` default.
  function backfillOnboardingTourDoneIfNeeded(onboarding) {
    if (onboardingTourDone) return;
    const reachedViaMigration = !!(onboarding.migratedLegacyItems || onboarding.blankMigration);
    if (!reachedViaMigration && !hasRealProgress(items)) return;
    onboardingTourDone = true;
    persistLocalOnboardingTourDone();
    if (uid) {
      adapter.saveMeta(uid, { onboardingTourDone: true }).catch(error => {
        console.error('Failed to backfill onboarding tour state', error);
      });
    }
  }

  // Determines, once per sign-in, whether this user has already picked a starter
  // template (Issue #51) and which templates they've started (Issue #58). New
  // accounts are routed to /onboarding by main.js; everyone else (including every
  // account that predates the template system) is treated as already onboarded —
  // see roadmap-store.md's "Onboarding detection order" for the detection order
  // and the migration this performs, and for what each extracted phase function
  // above (freshStateForNewUid/readOnboardingLocalFallback/resolveMetaExtras/
  // determineOnboardingAndActiveRoadmap/loadActiveRoadmap) covers.
  // Whenever the active uid changes (sign-out, sign-in as a different user),
  // wipe local storage so the incoming user never sees the outgoing user's
  // data. The initial boot call has uid=null, so this guard is skipped on
  // first load. Extracted out of setUser (including its own `if` test) to
  // keep that function's own complexity under the ESLint gate (root
  // CLAUDE.md) — the uid-transition condition now lives entirely here.
  function maybeResetForNewUid(nextUid) {
    if (uid === null || uid === nextUid) return;
    clearTimeout(saveTimer);
    saveTimer = null;
    clearLocal();
    const fresh = freshStateForNewUid();
    items = fresh.items;
    activeTemplateId = fresh.activeTemplateId;
    templatePhases = fresh.templatePhases;
    onboardingDone = fresh.onboardingDone;
    hiddenTemplateIds = fresh.hiddenTemplateIds;
    customRoadmaps = fresh.customRoadmaps;
    startedTemplateIds = fresh.startedTemplateIds;
    favoriteRoadmapIds = fresh.favoriteRoadmapIds;
    tourDone = fresh.tourDone;
    onboardingTourDone = fresh.onboardingTourDone;
    roadmapCache = fresh.roadmapCache;
    pendingCustomSeeds = fresh.pendingCustomSeeds;
    dirty = fresh.dirty;
    recentFlushedStrs = fresh.recentFlushedStrs;
    structuralVersion += 1;
  }

  // Applies a blank-template migration's result to local persistence/cache,
  // when setUser's onboarding-detection phase actually performed one —
  // extracted out of setUser (including its own `if` test) for the same
  // complexity reason as maybeResetForNewUid above.
  function applyBlankMigrationIfNeeded(onboarding) {
    if (!onboarding.blankMigration) return;
    const { migratedId, migratedItems, migratedPhases } = onboarding.blankMigration;
    persistLocalRoadmap(migratedId, { dirty: false, items: migratedItems, phases: migratedPhases });
    roadmapCache[migratedId] = { items: migratedItems, phases: migratedPhases, dirty: false };
  }

  async function setUser(nextUser) {
    const nextUid = nextUser?.uid || null;
    const callId = ++stateCallId;
    const isStale = () => callId !== stateCallId;

    maybeResetForNewUid(nextUid);

    if (unsubscribeRoadmap) unsubscribeRoadmap();
    unsubscribeRoadmap = null;
    uid = nextUid;
    // Re-select the backend for this sign-in. Must happen before any of this
    // function's own adapter calls below.
    adapter = getStorageAdapter(nextUser);

    if (!uid) {
      onboardingDone = null;
      tourDone = null;
      onboardingTourDone = null;
      notify({ saveState: 'idle' });
      return;
    }

    const localFallback = readOnboardingLocalFallback();
    const remoteMeta = await fetchRemoteMetaSafely(uid, adapter);

    // A newer setUser() call (e.g. the very next auth state change) has already
    // taken over — applying this now-stale result would clobber correct state.
    if (isStale()) return;

    const metaExtras = resolveMetaExtras(remoteMeta);
    hiddenTemplateIds = metaExtras.hiddenTemplateIds;
    persistLocalHiddenTemplates();
    customRoadmaps = metaExtras.customRoadmaps;
    persistLocalCustomRoadmaps();
    favoriteRoadmapIds = metaExtras.favoriteRoadmapIds;
    persistLocalFavoriteRoadmaps();
    tourDone = metaExtras.tourDone;
    persistLocalTourDone();
    onboardingTourDone = metaExtras.onboardingTourDone;
    persistLocalOnboardingTourDone();

    const onboarding = await determineOnboardingAndActiveRoadmap({ uid, adapter, remoteMeta, localFallback, customRoadmaps, isStale });
    if (onboarding === STALE) return;

    onboardingDone = onboarding.onboardingDone;
    activeTemplateId = onboarding.activeTemplateId;
    startedTemplateIds = onboarding.startedTemplateIds;
    customRoadmaps = onboarding.customRoadmaps;
    persistLocalCustomRoadmaps();
    applyBlankMigrationIfNeeded(onboarding);

    persistLocalOnboarding();

    if (!onboardingDone) {
      items = {};
      templatePhases = [];
      roadmapCache = {};
      notify({ saveState: 'idle' });
      return;
    }

    const resolved = await loadActiveRoadmap(onboarding.migratedLegacyItems, isStale);
    if (resolved === STALE) return;

    items = resolved.items;
    templatePhases = resolved.phases;
    dirty = resolved.dirty;
    recentFlushedStrs = [];
    persistLocal();
    roadmapCache[activeTemplateId] = { items, phases: templatePhases, dirty };

    backfillTourDoneIfNeeded(onboarding);
    backfillOnboardingTourDoneIfNeeded(onboarding);

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

    // Best-effort snapshot for picking a fetch strategy (seed vs. load) below
    // — if this races another call that's also about to start
    // requestedTemplateId for the first time, both correctly take the
    // fresh-seed branch; the actual `startedTemplateIds` array persisted to
    // Firebase is computed fresh, inside the serialized closure below, never
    // from this snapshot (issue #153).
    const alreadyStarted = startedTemplateIds.includes(requestedTemplateId);

    // Not awaited here — issue #121 item 6 (continued below): fetchTemplateData()
    // is a dynamic import() for a built-in template, and used to be awaited in
    // full before any of the three independent operations below even started,
    // stacking its own latency in front of theirs instead of overlapping it.
    // Handing the still-pending promise to resolveRoadmapItems() (and to the
    // fresh-seed branch below) lets it run concurrently with everything else.
    const templateDataPromise = fetchTemplateData(requestedTemplateId);

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
      ? resolveRoadmapItems(requestedTemplateId, templateDataPromise)
      : templateDataPromise.then(({ baseItems, phases }) => ({ items: baseItems, phases, dirty: true }));

    // Issue #153 root cause #1 — computing the array to persist and actually
    // persisting it must happen inside serializeMetaMutation's queue, not
    // from the `alreadyStarted`/`nextStartedTemplateIds` snapshot taken
    // above: two overlapping switchRoadmap()/createCustomRoadmap() calls used
    // to each read the shared `startedTemplateIds` before either had
    // reassigned it, so whichever call's saveMeta() write landed last would
    // silently erase the other's id via Realtime Database's whole-array
    // `update()` replace. Reassigning `startedTemplateIds` synchronously
    // *inside* the queued closure, before its own await, means a
    // concurrently-queued mutation always computes from this call's
    // already-applied result.
    const metaSave = serializeMetaMutation(() => {
      const nextStartedTemplateIds = startedTemplateIds.includes(requestedTemplateId)
        ? startedTemplateIds
        : [...startedTemplateIds, requestedTemplateId];
      startedTemplateIds = nextStartedTemplateIds;
      return saveSwitchMeta(requestedTemplateId, nextStartedTemplateIds, extraMeta);
    });

    const [, resolved] = await Promise.all([outgoingFlush, resolvedPromise, metaSave]);
    if (isStale()) return;

    detachAndCacheOutgoingRoadmap();

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

    attachIncomingRoadmapAndNotify();
  }

  // Detaches the outgoing template's Firebase listener and caches its
  // just-superseded items/phases/dirty state before switchRoadmap
  // reassigns activeTemplateId — extracted out of switchRoadmap to keep its
  // own complexity under the ESLint gate (root CLAUDE.md).
  function detachAndCacheOutgoingRoadmap() {
    if (unsubscribeRoadmap) unsubscribeRoadmap();
    unsubscribeRoadmap = null;
    if (activeTemplateId) roadmapCache[activeTemplateId] = { items, phases: templatePhases, dirty };
  }

  // Attaches the incoming template's listener and settles switchRoadmap's
  // final saveState — extracted out of switchRoadmap for the same
  // complexity reason as detachAndCacheOutgoingRoadmap above.
  function attachIncomingRoadmapAndNotify() {
    if (!uid) {
      notify({ saveState: 'local' });
      return;
    }
    attachRoadmapListener(activeTemplateId);
    // Not just `!alreadyStarted` (which is always dirty:true from the
    // fresh-seed branch in switchRoadmap): resolveRoadmapItems() can also
    // return dirty:true for an ALREADY-started template, e.g. its
    // roadmapCache entry was left dirty:true by a previous
    // flushOutgoingRoadmap() failure (see that function's comment) or a
    // dirty local blob from an interrupted session. Without this, switching
    // into that template left the in-memory `dirty` flag true with no timer
    // ever queued to actually flush it — the edit would silently sit
    // unflushed until some other mutation happened to call queueSave()
    // again (found during the issue #143 investigation).
    if (dirty) {
      queueSave();
    } else {
      notify({ saveState: 'synced' });
    }
  }

  // Hiding/unhiding is a per-user preference for which template cards show on
  // *this* user's onboarding picker — it never touches the template's content
  // or any other user's account, and never affects startedTemplateIds or the
  // ability to switch to an already-started template (issue #58).
  // Issue #350 — routed through serializeMetaMutation() the same way
  // switchRoadmap()/deleteCustomRoadmap() are. `computeNextIds` receives the
  // *current* `hiddenTemplateIds` and must return the next array — it's
  // called, and `hiddenTemplateIds` reassigned, inside the queued closure,
  // not by the caller beforehand. Two overlapping hideTemplate()/
  // unhideTemplate() calls (hiding one template, then another, in quick
  // succession) used to each compute their own "append/remove my id" array
  // from the shared `hiddenTemplateIds` before either had reassigned it, so
  // whichever call's whole-array saveMeta() write landed last would silently
  // erase the other's change — this guarantees a later call always computes
  // from the earlier call's already-applied result, same as
  // toggleFavoriteRoadmap()'s in-queue computation.
  async function setHiddenTemplateIds(computeNextIds) {
    return serializeMetaMutation(async () => {
      hiddenTemplateIds = computeNextIds(hiddenTemplateIds);
      persistLocalHiddenTemplates();
      notify();
      if (uid) {
        try {
          await adapter.saveMeta(uid, { hiddenTemplateIds });
        } catch (error) {
          console.error('Failed to save hidden template preference', error);
        }
      }
    });
  }

  // Toggles a roadmap's favorite state (issue #177) — applies uniformly to a
  // built-in template id or a custom `croadmap-...` id, matching how
  // `startedTemplateIds` already treats them uniformly. Adds if under the
  // MAX_FAVORITE_ROADMAPS cap, removes if already favorited, and is a no-op
  // (returning `{ ok: false, capped: true }`) if adding a 4th would exceed
  // it — callers must check the return value and surface that themselves
  // (the onboarding picker shows a toast), same convention as every other
  // capped mutation in this file (addItem, addTodo).
  // Issue #350 — the cap check below is a read against current in-memory
  // state, synchronous, no race risk (same "best-effort snapshot" precedent
  // as switchRoadmap()'s `alreadyStarted` check) and can stay outside the
  // queue. The mutate-then-save portion, though, must run inside
  // serializeMetaMutation(): two overlapping toggleFavoriteRoadmap() calls
  // for different ids used to each compute their own "add/remove my id"
  // array from the shared `favoriteRoadmapIds` before either had reassigned
  // it, so whichever call's whole-array saveMeta() write landed last would
  // silently erase the other's change. Recomputing `isFavorite`/the next
  // array *inside* the queued closure guarantees a later call always
  // computes from the earlier call's already-applied result.
  async function toggleFavoriteRoadmap(id) {
    const isFavoriteNow = favoriteRoadmapIds.includes(id);
    if (!isFavoriteNow && favoriteRoadmapIds.length >= MAX_FAVORITE_ROADMAPS) {
      return { ok: false, capped: true };
    }
    return serializeMetaMutation(async () => {
      const isFavorite = favoriteRoadmapIds.includes(id);
      favoriteRoadmapIds = isFavorite
        ? favoriteRoadmapIds.filter(favId => favId !== id)
        : [...favoriteRoadmapIds, id];
      persistLocalFavoriteRoadmaps();
      notify();
      if (uid) {
        try {
          await adapter.saveMeta(uid, { favoriteRoadmapIds });
        } catch (error) {
          console.error('Failed to save favorite roadmap preference', error);
        }
      }
      return { ok: true, capped: false };
    });
  }

  // Issue #17 — persists local + remote, same setHiddenTemplateIds()/
  // toggleFavoriteRoadmap() shape: mutate in-memory, persist locally, notify,
  // then best-effort sync to Firebase for a signed-in user.
  async function setTourDone(value) {
    tourDone = value;
    persistLocalTourDone();
    notify();
    if (uid) {
      try {
        await adapter.saveMeta(uid, { tourDone: value });
      } catch (error) {
        console.error('Failed to save tour state', error);
      }
    }
  }

  function completeTour() {
    return setTourDone(true);
  }

  // Manual "Take a tour" replay — in-memory only, per the issue's own spec:
  // does not persist until the tour is skipped/completed again, so a reload
  // mid-replay (before the user finishes or skips) doesn't leave tourDone
  // stuck false for an account that had already genuinely completed it.
  function resetTour() {
    tourDone = false;
    notify();
  }

  // Issue #293 — same setTourDone()/completeTour()/resetTour() shape,
  // applied to the second, onboarding-page tour's own independent flag.
  async function setOnboardingTourDone(value) {
    onboardingTourDone = value;
    persistLocalOnboardingTourDone();
    notify();
    if (uid) {
      try {
        await adapter.saveMeta(uid, { onboardingTourDone: value });
      } catch (error) {
        console.error('Failed to save onboarding tour state', error);
      }
    }
  }

  function completeOnboardingTour() {
    return setOnboardingTourDone(true);
  }

  // Manual "Take a tour" replay — in-memory only, same reasoning as resetTour().
  function resetOnboardingTour() {
    onboardingTourDone = false;
    notify();
  }

  function hideTemplate(idToHide) {
    if (hiddenTemplateIds.includes(idToHide)) return Promise.resolve();
    return setHiddenTemplateIds(current => (current.includes(idToHide) ? current : [...current, idToHide]));
  }

  function unhideTemplate(idToUnhide) {
    if (!hiddenTemplateIds.includes(idToUnhide)) return Promise.resolve();
    return setHiddenTemplateIds(current => current.filter(id => id !== idToUnhide));
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
    // Clamped, not rejected — matching firebase/database.rules.json's
    // meta.customRoadmaps server-side length caps (issue #122) means a
    // write can never exceed them, without introducing a new "title too
    // long" error path for what would in practice always be an
    // AI-generated title, never something the user typed and would expect
    // rejected outright.
    const trimmedTitle = (title || '').trim().slice(0, MAX_CUSTOM_ROADMAP_TITLE_LENGTH);
    if (!trimmedTitle) throw new Error('Title is required');

    // Issue #324 — createCustomRoadmap() previously had no upper bound on
    // how many custom roadmaps a single account could create; the only
    // other limit was database.rules.json's index-shape rule, which allows
    // up to 1,000 — a shape constraint against stray keys, never a
    // deliberate product cap. Throws a tagged Error (`error.code = 'capped'`)
    // rather than returning `{ ok: false }` so the existing "throws on
    // invalid input" contract (see the empty-title check above) stays
    // consistent, and callers that don't care about the distinction can keep
    // treating this like any other rejected creation.
    //
    // The cap is checked against `customRoadmaps.length` specifically, never
    // `startedTemplateIds.length` — the 7 built-in starter templates
    // (java-backend, frontend, data-science, genai-agentic-ai, math-grade12,
    // piano, marketing) are never added to `customRoadmaps` and must never
    // count toward this limit; a user who has started every built-in
    // template plus zero custom ones is nowhere near the cap. Deliberately
    // no additional creation-rate cooldown alongside this count cap — two
    // legitimate custom roadmaps created back-to-back is already a real,
    // tested scenario (issue #153's overlapping-create race-condition fix),
    // and a cooldown would reject the second one outright instead of just
    // handling it correctly.
    if (customRoadmaps.length >= MAX_CUSTOM_ROADMAPS) {
      const error = new Error(`You've reached the limit of ${MAX_CUSTOM_ROADMAPS} custom roadmaps (this doesn't count the built-in starter templates). Delete an older or unused custom roadmap before creating another.`);
      error.code = 'capped';
      throw error;
    }

    const id = genId('croadmap');
    if (seedPhases || seedItems) {
      pendingCustomSeeds[id] = { phases: seedPhases || [], items: seedItems || {} };
    }
    const meta = { id, title: trimmedTitle, description: (description || '').trim().slice(0, MAX_CUSTOM_ROADMAP_DESCRIPTION_LENGTH), createdAt: Date.now() };
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
    delete roadmapCache[idToDelete];
    const localAll = readLocalRoadmaps();
    delete localAll[idToDelete];
    localStorage.setItem(KEYS.ROADMAPS, JSON.stringify(localAll));

    // Issue #153 — same lost-update race as switchRoadmap()'s
    // startedTemplateIds, and the same fix: the filter + the saveMeta() write
    // both happen inside serializeMetaMutation's queue, computed from
    // whatever the shared arrays are at the moment this closure actually
    // runs (i.e. after every previously queued create/switch/delete has
    // both applied and settled), never from a snapshot taken before an
    // overlapping call could have changed them.
    await serializeMetaMutation(() => {
      customRoadmaps = customRoadmaps.filter(r => r.id !== idToDelete);
      startedTemplateIds = startedTemplateIds.filter(id => id !== idToDelete);
      favoriteRoadmapIds = favoriteRoadmapIds.filter(id => id !== idToDelete);
      persistLocalCustomRoadmaps();
      persistLocalFavoriteRoadmaps();
      notify();
      if (!uid) return Promise.resolve();
      return adapter.saveMeta(uid, { customRoadmaps, startedTemplateIds, favoriteRoadmapIds })
        .then(() => adapter.deleteRoadmap(uid, idToDelete))
        .catch(error => {
          console.error('Failed to delete custom roadmap', error);
        });
    });
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

  // Every one of updateItem's length/shape caps (issue #53's title cap, plus
  // the resource/tag shape checks) — extracted out of updateItem to keep its
  // own complexity under the ESLint gate (root CLAUDE.md). A missing field
  // on the patch is always valid (nothing to check), matching updateItem's
  // existing "only validate keys the caller actually sent" behavior.
  function isValidItemPatch(patch) {
    if (typeof patch.title === 'string' && (!patch.title.trim() || patch.title.length > MAX_TITLE_LENGTH)) return false;
    if (Array.isArray(patch.resources) && !patch.resources.every(isValidResource)) return false;
    if (Array.isArray(patch.tags) && !isValidTags(patch.tags)) return false;
    return true;
  }

  // Returns false (mutating nothing) when the patch fails a length cap (issue
  // #53) — callers must check this return value instead of assuming success,
  // same convention as addItem()'s item-count cap.
  function updateItem(id, patch) {
    if (!items[id]) return false;
    if (!isValidItemPatch(patch)) return false;
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
  // Case 1 (see setItemDoneInTemplate's own comment below): items are
  // already in memory, so this is just updateItem() with completedViaTodoAt
  // folded into the same patch.
  function setActiveTemplateItemDone(itemId, done) {
    // A soft-deleted item (removeItem()) still exists in the map — never
    // rendered again, but present — so without this check updateItem()
    // would happily "succeed" on it: a linked todo could be completed
    // against a topic the user can no longer see or interact with,
    // reporting ok:true for an update with zero visible effect. Treat it
    // the same as genuinely missing.
    if (!findLiveTemplateItem(items, itemId)) return { ok: false, title: null };
    const patch = { done, completedViaTodoAt: done ? Date.now() : null };
    const ok = updateItem(itemId, patch);
    return { ok, title: ok ? items[itemId].title : null };
  }

  // Case 2: patch roadmapCache in place and persist (local + Firebase)
  // directly, without touching activeTemplateId/items/dirty/
  // structuralVersion, since this template isn't on screen right now.
  async function setCachedTemplateItemDone(templateId, cached, itemId, done) {
    if (!findLiveTemplateItem(cached.items, itemId)) return { ok: false, title: null };
    const wasDone = cached.items[itemId].done;
    const patch = buildCrossRoadmapDonePatch(done);
    const { patchedItem, nextItems } = applyCrossRoadmapPatch(cached.items, itemId, patch);
    cached.items = nextItems;
    persistLocalRoadmap(templateId, { dirty: false, items: nextItems, phases: cached.phases });
    if (uid) {
      try {
        // Scoped per-item write (issue #232, same fix #184 applied to the
        // cold branch below) — a full saveRoadmap({ items: nextItems })
        // here would race with a concurrent update to a *different* itemId
        // in the same cached-but-not-active roadmap, silently reverting
        // whichever write lands second. writeCrossRoadmapPatch() falls back
        // to a full write only when the item has never been synced to
        // Firebase for this roadmap at all — no existing remote node to
        // merge into.
        await writeCrossRoadmapPatch(adapter, { uid, templateId, itemId, patch, nextItems, phases: cached.phases, attemptScoped: true });
      } catch (error) {
        console.error('Failed to save cross-roadmap item update', error);
        return { ok: false, title: null };
      }
    }
    applyCrossRoadmapCompletionDelta(onCompletionToggle, done, wasDone);
    return { ok: true, title: patchedItem.title };
  }

  // Case 3: one-shot read (Firebase first, falling back to the local blob),
  // patch, persist the same way as the cached case. Never seeds a
  // not-yet-started template — a linked todo can only point at an item that
  // already exists somewhere.
  async function setColdTemplateItemDone(templateId, itemId, done) {
    const { remote, baseItems, basePhases } = await fetchColdTemplateBase(adapter, uid, templateId);
    if (!findLiveTemplateItem(baseItems, itemId)) return { ok: false, title: null };
    const wasDone = baseItems[itemId].done;
    const patch = buildCrossRoadmapDonePatch(done);
    const { patchedItem, nextItems } = applyCrossRoadmapPatch(baseItems, itemId, patch);
    persistLocalRoadmap(templateId, { dirty: false, items: nextItems, phases: basePhases });
    if (uid) {
      try {
        // Targeted, per-item write (issue #184) — unlike a full
        // saveRoadmap({ items: nextItems }), this only touches itemId's own
        // path, so two concurrent calls for different itemIds on the same
        // not-yet-cached roadmap can no longer clobber each other's
        // completion. Only attempted when the remote read actually found
        // this item (there's otherwise no existing remote node to merge
        // fields into) — writeCrossRoadmapPatch() falls back to a full write
        // in that case, same as the cached branch above.
        await writeCrossRoadmapPatch(adapter, { uid, templateId, itemId, patch, nextItems, phases: basePhases, attemptScoped: !!remote?.items?.[itemId] });
      } catch (error) {
        console.error('Failed to save cross-roadmap item update', error);
        return { ok: false, title: null };
      }
    }
    applyCrossRoadmapCompletionDelta(onCompletionToggle, done, wasDone);
    return { ok: true, title: patchedItem.title };
  }

  // Marks an item done/not-done in ANY template — not just the currently
  // active one (issue #56 follow-up: completing a Daily Todo linked to a
  // roadmap topic must work regardless of which roadmap the user happens to
  // be viewing right now, without silently switching their active roadmap
  // out from under them). Three cases, cheapest first, each its own helper
  // above (issue #276 — this dispatcher used to inline all three, at a
  // cyclomatic complexity of 33):
  //   1. templateId is the active template — setActiveTemplateItemDone().
  //   2. templateId is cached (visited this session, not active right now)
  //      — setCachedTemplateItemDone().
  //   3. templateId is cold (never touched this session) — one-shot read,
  //      then setColdTemplateItemDone().
  // Resolves `{ ok: false }` if the item can't be found anywhere (e.g. the
  // source topic or its whole roadmap was deleted after the todo was linked
  // to it) — callers must check `ok` and surface that gracefully rather
  // than assuming success.
  async function setItemDoneInTemplate(templateId, itemId, done) {
    if (templateId === activeTemplateId) return setActiveTemplateItemDone(itemId, done);
    const cached = roadmapCache[templateId];
    if (cached?.items) return setCachedTemplateItemDone(templateId, cached, itemId, done);
    return setColdTemplateItemDone(templateId, itemId, done);
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
      tags: [],
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
      notes: typeof incoming.notes === 'string' ? incoming.notes.slice(0, 5000) : '',
      tags: isValidTags(incoming.tags) ? incoming.tags : []
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
    toggleFavoriteRoadmap,
    completeTour,
    resetTour,
    completeOnboardingTour,
    resetOnboardingTour,
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
    getAllRoadmapsForSearch,
    getRoadmapSnapshotForComparison,
    flush,
    retrySaveNow,
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
