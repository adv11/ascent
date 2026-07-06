import { describe, it, expect, beforeEach, vi } from 'vitest';
import { createRoadmapStore } from '../../src/services/roadmapStore.js';
import { buildSeedItems } from '../../src/data/roadmap.js';
import { dbApi } from '../../src/services/firebase.js';

vi.mock('../../src/services/firebase.js', () => ({
  dbApi: {
    listenRoadmap: vi.fn(() => () => {}),
    saveRoadmap: vi.fn(() => Promise.resolve()),
    getMeta: vi.fn(() => Promise.resolve(null)),
    saveMeta: vi.fn(() => Promise.resolve()),
    getRoadmap: vi.fn(() => Promise.resolve(null)),
    getLegacyRoadmap: vi.fn(() => Promise.resolve(null)),
  },
  firebaseClock: vi.fn(() => null),
}));

beforeEach(() => {
  localStorage.clear();
  // resetAllMocks (not clearAllMocks) so a custom mockImplementation/mockImplementationOnce
  // left over by one test (e.g. a deliberately-unresolved "slow" promise) can never leak
  // into the next test and hang it — every mock's implementation is reset to a no-op
  // before this file re-establishes its own defaults below.
  vi.resetAllMocks();
  vi.useRealTimers();
  dbApi.listenRoadmap.mockImplementation(() => () => {});
  dbApi.saveRoadmap.mockResolvedValue(undefined);
  dbApi.saveMeta.mockResolvedValue(undefined);
  // Default every setUser() call in this file to "already onboarded, on the
  // new (#58) meta shape, single started template java-backend" unless a
  // test overrides it — this matches the steady-state most of these tests
  // (structuralVersion, sign-out guard, echo detection) rely on. Tests that
  // specifically exercise legacy-account migration override this.
  dbApi.getMeta.mockResolvedValue({ onboardingDone: true, activeTemplateId: 'java-backend', startedTemplateIds: ['java-backend'] });
  dbApi.getRoadmap.mockResolvedValue(null);
  dbApi.getLegacyRoadmap.mockResolvedValue(null);
});

describe('subscribe / notify cycle', () => {
  it('calls callback immediately on subscribe', () => {
    const store = createRoadmapStore();
    const snapshots = [];
    const unsub = store.subscribe(s => snapshots.push(s));

    expect(snapshots).toHaveLength(1);
    expect(snapshots[0].items).toBeDefined();
    unsub();
  });

  it('delivers new snapshot when updateItem fires queueSave', () => {
    vi.useFakeTimers();
    const store = createRoadmapStore();
    const snapshots = [];
    const unsub = store.subscribe(s => snapshots.push(s));

    const firstId = Object.keys(store.getSnapshot().allItems)[0];
    store.updateItem(firstId, { done: true });

    // queueSave calls notify({ saveState: 'saving' }) synchronously
    expect(snapshots.length).toBeGreaterThan(1);
    expect(snapshots[snapshots.length - 1].saveState).toBe('saving');
    unsub();
  });

  it('unsubscribe stops future deliveries', () => {
    vi.useFakeTimers();
    const store = createRoadmapStore();
    const snapshots = [];
    const unsub = store.subscribe(s => snapshots.push(s));
    unsub();

    const countAfterUnsub = snapshots.length;
    const firstId = Object.keys(store.getSnapshot().allItems)[0];
    store.updateItem(firstId, { done: true });

    expect(snapshots.length).toBe(countAfterUnsub);
  });
});

describe('structuralVersion contract', () => {
  it('does NOT bump structuralVersion when only done changes', () => {
    vi.useFakeTimers();
    const store = createRoadmapStore();
    const initial = store.getSnapshot().structuralVersion;

    const firstId = Object.keys(store.getSnapshot().allItems)[0];
    store.updateItem(firstId, { done: true });

    expect(store.getSnapshot().structuralVersion).toBe(initial);
  });

  it('bumps structuralVersion when a non-done field changes', () => {
    vi.useFakeTimers();
    const store = createRoadmapStore();
    const initial = store.getSnapshot().structuralVersion;

    const firstId = Object.keys(store.getSnapshot().allItems)[0];
    store.updateItem(firstId, { title: 'Changed Title' });

    expect(store.getSnapshot().structuralVersion).toBe(initial + 1);
  });

  it('bumps structuralVersion when done and another field change together', () => {
    vi.useFakeTimers();
    const store = createRoadmapStore();
    const initial = store.getSnapshot().structuralVersion;

    const firstId = Object.keys(store.getSnapshot().allItems)[0];
    store.updateItem(firstId, { done: true, title: 'New Title' });

    expect(store.getSnapshot().structuralVersion).toBe(initial + 1);
  });

  it('bumps structuralVersion on addItem', () => {
    vi.useFakeTimers();
    const store = createRoadmapStore();
    const initial = store.getSnapshot().structuralVersion;

    store.addItem({ title: 'New Topic', phase: 'Java Core', section: 'Basics', priority: 'high' });

    expect(store.getSnapshot().structuralVersion).toBe(initial + 1);
  });
});

describe('sign-out guard (setUser contract)', () => {
  it('setUser(null) after a non-null uid clears both localStorage keys', async () => {
    const store = createRoadmapStore();
    await store.setUser({ uid: 'user-123' });

    // Manually write data that belongs to the outgoing user
    localStorage.setItem('ascent-roadmaps-v1', JSON.stringify({ 'java-backend': { dirty: false, items: {} } }));
    localStorage.setItem('ascent-ui-v3', JSON.stringify({ expanded: true }));

    await store.setUser(null);

    expect(localStorage.getItem('ascent-roadmaps-v1')).toBeNull();
    expect(localStorage.getItem('ascent-ui-v3')).toBeNull();
  });

  it('setUser(null) resets items to seed data', async () => {
    const store = createRoadmapStore();
    await store.setUser({ uid: 'user-456' });
    await store.setUser(null);

    const snapshot = store.getSnapshot();
    const seedKeys = Object.keys(buildSeedItems());
    const storeKeys = Object.keys(snapshot.allItems);
    expect(storeKeys).toEqual(expect.arrayContaining(seedKeys));
    expect(storeKeys).toHaveLength(seedKeys.length);
  });

  it('setUser(null) on initial boot (uid was null) does NOT clear localStorage', async () => {
    const store = createRoadmapStore();
    // uid starts as null — guard must NOT fire here
    localStorage.setItem('ascent-roadmaps-v1', 'should-remain');

    await store.setUser(null); // uid is still null, no transition

    expect(localStorage.getItem('ascent-roadmaps-v1')).toBe('should-remain');
  });
});

describe('stableStringify — Firebase echo detection', () => {
  it('does not bump structuralVersion when listenRoadmap echoes back the same data', async () => {
    let capturedCallback;
    dbApi.listenRoadmap.mockImplementation((_uid, _templateId, callback) => {
      capturedCallback = callback;
      return () => {};
    });

    const store = createRoadmapStore();
    await store.setUser({ uid: 'echo-test' });

    // flush() sets lastFlushedStr = stableStringify(items)
    await store.flush();

    const versionBeforeEcho = store.getSnapshot().structuralVersion;

    // Simulate Firebase echoing back the same items (same content, potentially sorted keys)
    const currentItems = store.getSnapshot().allItems;
    const echoSnapshot = {
      exists: () => true,
      val: () => ({ version: 3, items: currentItems }),
    };
    capturedCallback(echoSnapshot);

    expect(store.getSnapshot().structuralVersion).toBe(versionBeforeEcho);
  });

  it('DOES bump structuralVersion when listenRoadmap returns genuinely different data', async () => {
    let capturedCallback;
    dbApi.listenRoadmap.mockImplementation((_uid, _templateId, callback) => {
      capturedCallback = callback;
      return () => {};
    });

    const store = createRoadmapStore();
    await store.setUser({ uid: 'diff-data-test' });
    await store.flush();

    const versionBefore = store.getSnapshot().structuralVersion;

    // Different items — one seed item marked done
    const differentItems = { ...store.getSnapshot().allItems };
    const firstId = Object.keys(differentItems)[0];
    differentItems[firstId] = { ...differentItems[firstId], done: true };

    const diffSnapshot = {
      exists: () => true,
      val: () => ({ version: 3, items: differentItems }),
    };
    capturedCallback(diffSnapshot);

    expect(store.getSnapshot().structuralVersion).toBe(versionBefore + 1);
  });
});

// Since issue #58, each template has its own Firebase path
// (users/{uid}/roadmaps/{templateId}) and switching always detaches the
// previous listener before attaching the next one. The listener callback
// additionally closes over the templateId it was attached for and ignores
// any invocation once that no longer matches the active template — this
// replaces the old #51 payload-tag cross-template echo guard with something
// structurally stronger, since paths no longer overlap at all.
describe('stale listener guard (issue #58)', () => {
  it('ignores a callback fired from a listener attached for a template that is no longer active', async () => {
    const capturedCallbacks = [];
    dbApi.listenRoadmap.mockImplementation((_uid, _templateId, callback) => {
      capturedCallbacks.push(callback);
      return () => {};
    });

    const store = createRoadmapStore();
    await store.setUser({ uid: 'stale-listener-test' }); // java-backend, per default mock
    const javaCallback = capturedCallbacks[capturedCallbacks.length - 1];

    await store.switchRoadmap('blank');
    expect(store.getSnapshot().activeTemplateId).toBe('blank');

    // Manually invoke the old (already-detached) java-backend listener's
    // callback, simulating one last queued call slipping through.
    const versionBeforeStaleCallback = store.getSnapshot().structuralVersion;
    javaCallback({
      exists: () => true,
      val: () => ({ version: 3, templateId: 'java-backend', items: { x: { id: 'x', done: true } } }),
    });

    const snapshot = store.getSnapshot();
    expect(snapshot.activeTemplateId).toBe('blank');
    expect(snapshot.allItems).toEqual({});
    expect(snapshot.structuralVersion).toBe(versionBeforeStaleCallback);
  });

  it('still applies a genuine update from the currently active template listener', async () => {
    let capturedCallback;
    dbApi.listenRoadmap.mockImplementation((_uid, _templateId, callback) => {
      capturedCallback = callback;
      return () => {};
    });

    const store = createRoadmapStore();
    await store.setUser({ uid: 'active-listener-test' });
    await store.flush();

    const updatedItems = { ...store.getSnapshot().allItems };
    const firstId = Object.keys(updatedItems)[0];
    updatedItems[firstId] = { ...updatedItems[firstId], done: true };
    const versionBefore = store.getSnapshot().structuralVersion;

    capturedCallback({
      exists: () => true,
      val: () => ({ version: 3, templateId: 'java-backend', items: updatedItems }),
    });

    const snapshot = store.getSnapshot();
    expect(snapshot.structuralVersion).toBe(versionBefore + 1);
    expect(snapshot.allItems[firstId].done).toBe(true);
  });
});

// Firebase can deliver an *older* write's echo after a newer local edit has
// already flushed and moved past it (e.g. a template's initial seed-flush
// arrives late, right after the user has already edited and re-flushed).
// A single "last flushed string" can't recognize that late echo as one of
// our own writes once a newer flush has superseded it, and would otherwise
// misapply it as "genuinely newer" data — silently reverting the newer edit.
// This is sharply more exposed since issue #58, because every not-yet-started
// template switch now repeats the exact "fresh seed + first write" sequence
// that used to happen at most once per account.
describe('out-of-order echo guard — recentFlushedStrs (issue #58 hardening)', () => {
  it('ignores a late echo of an older flush that arrives after a newer flush already completed', async () => {
    let capturedCallback;
    dbApi.listenRoadmap.mockImplementation((_uid, _templateId, callback) => {
      capturedCallback = callback;
      return () => {};
    });

    const store = createRoadmapStore();
    await store.setUser({ uid: 'out-of-order-echo-test' });

    // First flush: the untouched seed.
    const seedItems = { ...store.getSnapshot().allItems };
    await store.flush();

    // Second flush: an edit, superseding the first.
    const firstId = Object.keys(store.getSnapshot().allItems)[0];
    store.updateItem(firstId, { done: true });
    await store.flush();

    const versionBeforeStaleEcho = store.getSnapshot().structuralVersion;

    // The FIRST flush's echo (the stale, unchecked seed) arrives late, after
    // the second flush has already completed and moved local state forward.
    capturedCallback({
      exists: () => true,
      val: () => ({ version: 3, templateId: 'java-backend', items: seedItems }),
    });

    const snapshot = store.getSnapshot();
    expect(snapshot.allItems[firstId].done).toBe(true); // the newer edit must survive
    expect(snapshot.structuralVersion).toBe(versionBeforeStaleEcho); // not misclassified as a structural change
  });

  it('still applies a genuine remote update that was never one of our own recent flushes', async () => {
    let capturedCallback;
    dbApi.listenRoadmap.mockImplementation((_uid, _templateId, callback) => {
      capturedCallback = callback;
      return () => {};
    });

    const store = createRoadmapStore();
    await store.setUser({ uid: 'genuine-remote-update-test' });
    await store.flush();

    const firstId = Object.keys(store.getSnapshot().allItems)[0];
    const fromAnotherDevice = { ...store.getSnapshot().allItems };
    fromAnotherDevice[firstId] = { ...fromAnotherDevice[firstId], done: true };

    capturedCallback({
      exists: () => true,
      val: () => ({ version: 3, templateId: 'java-backend', items: fromAnotherDevice }),
    });

    expect(store.getSnapshot().allItems[firstId].done).toBe(true);
  });
});

// A debounced save queued against the *outgoing* template can still be
// pending when a user switches templates — without an explicit flush before
// reassigning activeTemplateId, the timer would fire after the switch and
// silently attribute the outgoing edit to the wrong Firebase path.
describe('flush-before-switch (issue #58)', () => {
  it('flushes a pending debounced edit on the outgoing template to its own path before switching', async () => {
    const store = createRoadmapStore();
    await store.setUser({ uid: 'flush-before-switch-test' }); // java-backend

    const firstId = Object.keys(store.getSnapshot().allItems)[0];
    store.updateItem(firstId, { done: true }); // queues a 500ms debounced save; dirty=true immediately
    dbApi.saveRoadmap.mockClear();

    await store.switchRoadmap('blank'); // must flush java-backend's edit before switching away

    expect(dbApi.saveRoadmap).toHaveBeenCalledWith(
      'flush-before-switch-test',
      'java-backend',
      expect.objectContaining({
        templateId: 'java-backend',
        items: expect.objectContaining({ [firstId]: expect.objectContaining({ done: true }) })
      })
    );
    expect(store.getSnapshot().activeTemplateId).toBe('blank');
  });

  it('tags every saved payload with the templateId it was written for', async () => {
    const store = createRoadmapStore();
    await store.setUser({ uid: 'payload-tag-test' });
    await store.switchRoadmap('frontend');
    await store.flush();

    expect(dbApi.saveRoadmap).toHaveBeenCalledWith('payload-tag-test', 'frontend', expect.objectContaining({ templateId: 'frontend' }));
  });
});

// Issue #51 (as extended by #58) — a user's Firebase meta (`users/{uid}/meta`)
// records whether they've already picked a starter template and which ones
// they've started, so setUser() knows whether to route to onboarding or
// straight into the active roadmap.
describe('onboarding detection (setUser)', () => {
  it('a brand-new user (no meta, no legacy roadmap, no local data) is not marked onboarded and gets no items yet', async () => {
    dbApi.getMeta.mockResolvedValue(null);
    dbApi.getLegacyRoadmap.mockResolvedValue(null);

    const store = createRoadmapStore();
    await store.setUser({ uid: 'brand-new-user' });

    const snapshot = store.getSnapshot();
    expect(snapshot.onboardingDone).toBe(false);
    expect(snapshot.activeTemplateId).toBeNull();
    expect(snapshot.startedTemplateIds).toEqual([]);
    expect(snapshot.allItems).toEqual({});
    // No point syncing a roadmap that doesn't exist yet — the listener only
    // attaches once a template has been chosen.
    expect(dbApi.listenRoadmap).not.toHaveBeenCalled();
  });

  it('a fresh account with no real progress (only untouched seed data in the legacy path) is still routed to onboarding', async () => {
    dbApi.getMeta.mockResolvedValue(null);
    dbApi.getLegacyRoadmap.mockResolvedValue({ version: 3, items: buildSeedItems() });

    const store = createRoadmapStore();
    await store.setUser({ uid: 'never-touched-anything' });

    expect(store.getSnapshot().onboardingDone).toBe(false);
    expect(dbApi.saveRoadmap).not.toHaveBeenCalled();
  });

  it('a returning user on the new (#58) meta shape loads their saved items directly, no re-seeding, no legacy read', async () => {
    dbApi.getMeta.mockResolvedValue({ onboardingDone: true, activeTemplateId: 'blank', startedTemplateIds: ['blank'] });
    const remoteItems = {
      'custom-1': { id: 'custom-1', title: 'My topic', phase: 'Learn', section: '', priority: 'P1', done: false, custom: true, deleted: false, resources: [] }
    };
    dbApi.getRoadmap.mockResolvedValue({ version: 3, items: remoteItems });

    const store = createRoadmapStore();
    await store.setUser({ uid: 'returning-user' });

    const snapshot = store.getSnapshot();
    expect(snapshot.onboardingDone).toBe(true);
    expect(snapshot.activeTemplateId).toBe('blank');
    expect(snapshot.allItems).toEqual(remoteItems);
    expect(dbApi.getRoadmap).toHaveBeenCalledWith('returning-user', 'blank');
    expect(dbApi.getLegacyRoadmap).not.toHaveBeenCalled();
    expect(dbApi.listenRoadmap).toHaveBeenCalled();
  });

  // Firebase's onAuthStateChanged can fire in quick succession — e.g. deleting an
  // account and immediately signing up again with the same email. If an older,
  // slower setUser() call is still awaiting its network round-trip when a newer
  // one finishes, it must not overwrite the newer (correct) state on arrival.
  it('a slow, superseded setUser() call does not clobber a newer setUser() call that already resolved', async () => {
    let resolveSlowMeta;
    const slowMetaPromise = new Promise(resolve => { resolveSlowMeta = resolve; });

    dbApi.getMeta.mockImplementation(uid => (uid === 'slow-user'
      ? slowMetaPromise
      : Promise.resolve({ onboardingDone: true, activeTemplateId: 'blank', startedTemplateIds: ['blank'] })));
    dbApi.getRoadmap.mockResolvedValue({ version: 3, items: { 'custom-1': { id: 'custom-1', title: 'x', phase: 'Learn', section: '', priority: 'P1', done: false, custom: true, deleted: false, resources: [] } } });

    const store = createRoadmapStore();

    const slowCall = store.setUser({ uid: 'slow-user' });
    const fastCall = store.setUser({ uid: 'fast-user' });
    await fastCall;

    expect(store.getSnapshot().uid).toBe('fast-user');
    expect(store.getSnapshot().onboardingDone).toBe(true);
    expect(store.getSnapshot().activeTemplateId).toBe('blank');

    resolveSlowMeta(null); // let the stale call finish resolving, after the fact
    await slowCall;

    // The stale slow-user resolution must not have overwritten fast-user's state.
    expect(store.getSnapshot().uid).toBe('fast-user');
    expect(store.getSnapshot().onboardingDone).toBe(true);
    expect(store.getSnapshot().activeTemplateId).toBe('blank');
    expect(Object.keys(store.getSnapshot().allItems)).toEqual(['custom-1']);
  });
});

// Issue #58 — accounts created before per-template storage existed have all
// their progress under the old singular `users/{uid}/roadmap` path. On the
// first sign-in after this ships, that data is copied forward into the new
// `users/{uid}/roadmaps/{templateId}` path and the old path is left in place
// untouched as a safety net.
describe('Firebase migration — legacy single-roadmap accounts', () => {
  it('migrates a pre-#58 account (old-shape meta + legacy roadmap) into the new per-template path on sign-in', async () => {
    dbApi.getMeta.mockResolvedValue({ onboardingDone: true, templateId: 'java-backend' }); // old shape — no startedTemplateIds
    const legacyItems = {
      'seed-0-0-0': { id: 'seed-0-0-0', title: 'X', phase: 'Core Java', section: 'Fundamentals', priority: 'P0', done: true, custom: false, deleted: false, resources: [] }
    };
    dbApi.getLegacyRoadmap.mockResolvedValue({ version: 3, items: legacyItems });

    const store = createRoadmapStore();
    await store.setUser({ uid: 'legacy-account' });

    const snapshot = store.getSnapshot();
    expect(snapshot.onboardingDone).toBe(true);
    expect(snapshot.activeTemplateId).toBe('java-backend');
    expect(snapshot.startedTemplateIds).toEqual(['java-backend']);
    expect(snapshot.allItems['seed-0-0-0'].done).toBe(true);

    expect(dbApi.saveRoadmap).toHaveBeenCalledWith('legacy-account', 'java-backend', expect.objectContaining({ templateId: 'java-backend', items: legacyItems }));
    expect(dbApi.saveMeta).toHaveBeenCalledWith('legacy-account', { startedTemplateIds: ['java-backend'], activeTemplateId: 'java-backend', onboardingDone: true });
  });

  it('a pre-existing account with real remote progress but no onboarding meta at all is backfilled and migrated (pre-#51 legacy)', async () => {
    dbApi.getMeta.mockResolvedValue(null);
    const legacyItems = {
      'seed-0-0-0': { id: 'seed-0-0-0', title: 'X', phase: 'Core Java', section: 'Fundamentals', priority: 'P0', done: true, custom: false, deleted: false, resources: [] }
    };
    dbApi.getLegacyRoadmap.mockResolvedValue({ version: 3, items: legacyItems });

    const store = createRoadmapStore();
    await store.setUser({ uid: 'ancient-legacy-user' });

    const snapshot = store.getSnapshot();
    expect(snapshot.onboardingDone).toBe(true);
    expect(snapshot.activeTemplateId).toBe('java-backend');
    expect(dbApi.saveMeta).toHaveBeenCalledWith('ancient-legacy-user', { startedTemplateIds: ['java-backend'], activeTemplateId: 'java-backend', onboardingDone: true });
  });

  it('an account already on the new meta shape is not re-migrated (no legacy read performed)', async () => {
    dbApi.getMeta.mockResolvedValue({ onboardingDone: true, activeTemplateId: 'blank', startedTemplateIds: ['blank'] });

    const store = createRoadmapStore();
    await store.setUser({ uid: 'already-migrated-user' });

    expect(dbApi.getLegacyRoadmap).not.toHaveBeenCalled();
    expect(store.getSnapshot().activeTemplateId).toBe('blank');
  });
});

describe('switchRoadmap — first-time pick (onboardingDone was false)', () => {
  it('seeds items from the chosen template, marks onboarding done, and saves the new meta shape to Firebase', async () => {
    dbApi.getMeta.mockResolvedValue(null);
    dbApi.getLegacyRoadmap.mockResolvedValue(null);

    const store = createRoadmapStore();
    await store.setUser({ uid: 'new-user' });
    expect(store.getSnapshot().onboardingDone).toBe(false);

    await store.switchRoadmap('blank');

    const snapshot = store.getSnapshot();
    expect(snapshot.onboardingDone).toBe(true);
    expect(snapshot.activeTemplateId).toBe('blank');
    expect(snapshot.startedTemplateIds).toEqual(['blank']);
    expect(snapshot.allItems).toEqual({});
    expect(snapshot.phases).toHaveLength(4);
    expect(dbApi.saveMeta).toHaveBeenCalledWith('new-user', { activeTemplateId: 'blank', startedTemplateIds: ['blank'], onboardingDone: true });
    expect(dbApi.listenRoadmap).toHaveBeenCalled();
  });

  it('picking java-backend seeds the same roadmap as the original default (no regression)', async () => {
    dbApi.getMeta.mockResolvedValue(null);
    dbApi.getLegacyRoadmap.mockResolvedValue(null);

    const store = createRoadmapStore();
    await store.setUser({ uid: 'new-user-2' });
    await store.switchRoadmap('java-backend');

    const snapshot = store.getSnapshot();
    expect(Object.keys(snapshot.allItems).length).toBe(Object.keys(buildSeedItems()).length);
  });

  it('without a signed-in uid, still seeds items and persists locally, but never calls Firebase', async () => {
    const store = createRoadmapStore();
    await store.switchRoadmap('frontend');

    const snapshot = store.getSnapshot();
    expect(snapshot.onboardingDone).toBe(true);
    expect(snapshot.activeTemplateId).toBe('frontend');
    expect(dbApi.saveMeta).not.toHaveBeenCalled();
    expect(localStorage.getItem('ascent-roadmaps-v1')).not.toBeNull();
  });
});

// The core regression scenario issue #58 exists to fix: two templates a user
// has started must be able to coexist with fully independent progress, and
// switching between them must never lose or cross-contaminate either one.
describe('switchRoadmap — concurrent progress across templates', () => {
  it('switching between two started templates preserves both templates\' items exactly (no cross-contamination)', async () => {
    // Seed item ids are generated the same way across every template (e.g.
    // "seed-0-0-0"), so the same key can legitimately exist in both templates'
    // item maps with different content — isolation must be verified by
    // comparing full snapshots, not by asserting a key is absent elsewhere.
    const store = createRoadmapStore();
    await store.setUser({ uid: 'multi-roadmap-user' }); // starts on java-backend, per default mock

    await store.switchRoadmap('frontend'); // not yet started -> seeds fresh
    const frontendFirstId = Object.keys(store.getSnapshot().allItems)[0];
    store.updateItem(frontendFirstId, { done: true });
    store.addItem({ title: 'Frontend custom topic', phase: 'Learn', section: 'Basics', priority: 'P1' });
    const frontendItemsAfterEdits = { ...store.getSnapshot().allItems };

    await store.switchRoadmap('data-science'); // not yet started -> independent seed
    expect(store.getSnapshot().allItems).not.toEqual(frontendItemsAfterEdits);
    const dsFirstId = Object.keys(store.getSnapshot().allItems)[0];
    store.updateItem(dsFirstId, { done: true });
    const dataScienceItemsAfterEdits = { ...store.getSnapshot().allItems };

    await store.switchRoadmap('frontend'); // switching back — cache-first, must not re-seed
    expect(store.getSnapshot().allItems).toEqual(frontendItemsAfterEdits);

    await store.switchRoadmap('data-science'); // and back again — data-science's own edit must also be intact
    expect(store.getSnapshot().allItems).toEqual(dataScienceItemsAfterEdits);
  });

  it('switching to a not-yet-started template seeds it fresh without touching any other cached template\'s items', async () => {
    const store = createRoadmapStore();
    await store.setUser({ uid: 'seed-isolation-user' });
    const javaItemsBefore = store.getSnapshot().allItems;

    await store.switchRoadmap('blank');
    expect(store.getSnapshot().allItems).toEqual({});
    expect(store.getSnapshot().startedTemplateIds).toEqual(expect.arrayContaining(['java-backend', 'blank']));

    await store.switchRoadmap('java-backend');
    expect(store.getSnapshot().allItems).toEqual(javaItemsBefore);
  });

  it('is a no-op when switching to the already-active template', async () => {
    const store = createRoadmapStore();
    await store.setUser({ uid: 'noop-user' });
    dbApi.saveMeta.mockClear();

    await store.switchRoadmap('java-backend');

    expect(dbApi.saveMeta).not.toHaveBeenCalled();
  });

  it('stateCallId staleness guard: a slow switchRoadmap() call superseded by a faster one does not clobber its state', async () => {
    dbApi.getMeta.mockResolvedValue({ onboardingDone: true, activeTemplateId: 'java-backend', startedTemplateIds: ['java-backend', 'frontend'] });
    const store = createRoadmapStore();
    await store.setUser({ uid: 'stale-switch-user' });

    // Constructed up front (not inside the mock factory) so resolveSlow is a
    // valid function immediately, regardless of exactly when — or whether, by
    // the time we call it — dbApi.getRoadmap('frontend') has actually run.
    let resolveSlow;
    const slowPromise = new Promise(resolve => { resolveSlow = resolve; });
    dbApi.getRoadmap.mockImplementation((_uid, templateId) => (templateId === 'frontend' ? slowPromise : Promise.resolve(null)));

    const slowSwitch = store.switchRoadmap('frontend'); // already-started, not cached -> awaits the slow dbApi.getRoadmap
    const fastSwitch = store.switchRoadmap('blank'); // not-yet-started -> no Firebase read needed, resolves quickly
    await fastSwitch;

    expect(store.getSnapshot().activeTemplateId).toBe('blank');

    resolveSlow({ items: { 'frontend-x': { id: 'frontend-x', done: true } } });
    await slowSwitch;

    // The stale frontend switch must not have clobbered the newer blank switch.
    expect(store.getSnapshot().activeTemplateId).toBe('blank');
    expect(store.getSnapshot().allItems).toEqual({});
  });
});

// Per-user "hide this template from my picker" preference (Issue #51 follow-up).
// Must never touch the template's content, another user's account, or an
// already-started template's ability to be switched to (Issue #58).
describe('hideTemplate / unhideTemplate', () => {
  it('hiding a template persists it to Firebase meta and the local snapshot, without touching items', async () => {
    const store = createRoadmapStore();
    await store.setUser({ uid: 'hide-user' });
    const itemsBefore = store.getSnapshot().allItems;

    await store.hideTemplate('frontend');

    expect(store.getSnapshot().hiddenTemplateIds).toEqual(['frontend']);
    expect(dbApi.saveMeta).toHaveBeenCalledWith('hide-user', { hiddenTemplateIds: ['frontend'] });
    expect(store.getSnapshot().allItems).toBe(itemsBefore);
  });

  it('hiding "blank" is a no-op — it can never be hidden', async () => {
    const store = createRoadmapStore();
    await store.setUser({ uid: 'hide-user-2' });

    await store.hideTemplate('blank');

    expect(store.getSnapshot().hiddenTemplateIds).toEqual([]);
    expect(dbApi.saveMeta).not.toHaveBeenCalled();
  });

  it('unhiding removes it from hiddenTemplateIds and re-persists the shorter list', async () => {
    const store = createRoadmapStore();
    await store.setUser({ uid: 'hide-user-3' });

    await store.hideTemplate('frontend');
    await store.hideTemplate('piano');
    await store.unhideTemplate('frontend');

    expect(store.getSnapshot().hiddenTemplateIds).toEqual(['piano']);
    expect(dbApi.saveMeta).toHaveBeenLastCalledWith('hide-user-3', { hiddenTemplateIds: ['piano'] });
  });

  it('a hidden-template preference set on a previous session is loaded back from Firebase meta on the next sign-in', async () => {
    dbApi.getMeta.mockResolvedValue({ onboardingDone: true, activeTemplateId: 'java-backend', startedTemplateIds: ['java-backend'], hiddenTemplateIds: ['frontend', 'data-science'] });

    const store = createRoadmapStore();
    await store.setUser({ uid: 'returning-hide-user' });

    expect(store.getSnapshot().hiddenTemplateIds).toEqual(['frontend', 'data-science']);
  });

  it('hiding is scoped per-user — one account\'s hidden list is never visible to another', async () => {
    // A per-uid-aware fake of the Firebase meta store, so hiding on user-a's
    // account is verifiably absent when user-b signs in — not just an artifact
    // of two separate in-memory store instances never talking to each other.
    const fakeMetaByUid = { 'user-a': { onboardingDone: true, activeTemplateId: 'java-backend', startedTemplateIds: ['java-backend'] } };
    dbApi.getMeta.mockImplementation(uid => Promise.resolve(fakeMetaByUid[uid] || { onboardingDone: true, activeTemplateId: 'java-backend', startedTemplateIds: ['java-backend'] }));
    dbApi.saveMeta.mockImplementation((uid, patch) => {
      fakeMetaByUid[uid] = { ...fakeMetaByUid[uid], ...patch };
      return Promise.resolve();
    });

    const storeA = createRoadmapStore();
    await storeA.setUser({ uid: 'user-a' });
    await storeA.hideTemplate('marketing');
    expect(storeA.getSnapshot().hiddenTemplateIds).toEqual(['marketing']);
    expect(fakeMetaByUid['user-a'].hiddenTemplateIds).toEqual(['marketing']);

    // Simulate user-b on a different device (no shared localStorage) — only
    // Firebase meta, scoped by uid, can carry a hidden-template preference
    // across devices, and user-b's uid has none recorded.
    localStorage.clear();
    const storeB = createRoadmapStore();
    await storeB.setUser({ uid: 'user-b' });
    expect(storeB.getSnapshot().hiddenTemplateIds).toEqual([]);
    expect(fakeMetaByUid['user-b']).toBeUndefined();
  });

  it('hiding a started template does not remove it from startedTemplateIds or block switching back to it', async () => {
    dbApi.getMeta.mockResolvedValue({ onboardingDone: true, activeTemplateId: 'java-backend', startedTemplateIds: ['java-backend', 'frontend'] });
    const store = createRoadmapStore();
    await store.setUser({ uid: 'hide-started-user' });

    await store.hideTemplate('frontend');

    expect(store.getSnapshot().hiddenTemplateIds).toEqual(['frontend']);
    expect(store.getSnapshot().startedTemplateIds).toEqual(['java-backend', 'frontend']);

    await store.switchRoadmap('frontend');
    expect(store.getSnapshot().activeTemplateId).toBe('frontend');
  });
});
