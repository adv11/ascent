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
  },
  firebaseClock: vi.fn(() => null),
}));

beforeEach(() => {
  localStorage.clear();
  vi.clearAllMocks();
  vi.useRealTimers();
  dbApi.listenRoadmap.mockImplementation(() => () => {});
  dbApi.saveRoadmap.mockResolvedValue(undefined);
  dbApi.saveMeta.mockResolvedValue(undefined);
  // Default every setUser() call in this file to "already onboarded, java-backend"
  // unless a test overrides it — this matches the pre-Issue-#51 behavior that most
  // of these tests (structuralVersion, sign-out guard, echo detection) rely on.
  dbApi.getMeta.mockResolvedValue({ onboardingDone: true, templateId: 'java-backend' });
  dbApi.getRoadmap.mockResolvedValue(null);
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
    localStorage.setItem('ascent-roadmap-v3', JSON.stringify({ dirty: false, items: {} }));
    localStorage.setItem('ascent-ui-v3', JSON.stringify({ expanded: true }));

    await store.setUser(null);

    expect(localStorage.getItem('ascent-roadmap-v3')).toBeNull();
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
    localStorage.setItem('ascent-roadmap-v3', 'should-remain');

    await store.setUser(null); // uid is still null, no transition

    expect(localStorage.getItem('ascent-roadmap-v3')).toBe('should-remain');
  });
});

describe('stableStringify — Firebase echo detection', () => {
  it('does not bump structuralVersion when listenRoadmap echoes back the same data', async () => {
    let capturedCallback;
    dbApi.listenRoadmap.mockImplementation((_uid, callback) => {
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
    dbApi.listenRoadmap.mockImplementation((_uid, callback) => {
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

// Issue #51 — a user's Firebase meta (`users/{uid}/meta`) records whether they've
// already picked a starter template, so setUser() knows whether to route them to
// the onboarding picker or straight into their existing roadmap.
describe('onboarding detection (setUser)', () => {
  it('a brand-new user (no meta, no remote or local data) is not marked onboarded and gets no items yet', async () => {
    dbApi.getMeta.mockResolvedValue(null);
    dbApi.getRoadmap.mockResolvedValue(null);

    const store = createRoadmapStore();
    await store.setUser({ uid: 'brand-new-user' });

    const snapshot = store.getSnapshot();
    expect(snapshot.onboardingDone).toBe(false);
    expect(snapshot.templateId).toBeNull();
    expect(snapshot.allItems).toEqual({});
    // No point syncing a roadmap that doesn't exist yet — the listener only
    // attaches once a template has been chosen.
    expect(dbApi.listenRoadmap).not.toHaveBeenCalled();
  });

  it('a pre-existing account with real remote progress but no meta flag is backfilled as already onboarded', async () => {
    const remoteItems = {
      'seed-0-0-0': { id: 'seed-0-0-0', title: 'X', phase: 'Core Java', section: 'Fundamentals', priority: 'P0', done: true, custom: false, deleted: false, resources: [] }
    };
    dbApi.getMeta.mockResolvedValue(null);
    dbApi.getRoadmap.mockResolvedValue({ version: 3, items: remoteItems });

    const store = createRoadmapStore();
    await store.setUser({ uid: 'legacy-user' });

    const snapshot = store.getSnapshot();
    expect(snapshot.onboardingDone).toBe(true);
    expect(snapshot.templateId).toBe('java-backend');
    expect(snapshot.allItems['seed-0-0-0'].done).toBe(true);
    expect(dbApi.saveMeta).toHaveBeenCalledWith('legacy-user', { onboardingDone: true, templateId: 'java-backend' });
  });

  it('a fresh account with no real progress (only untouched seed data) is still routed to onboarding', async () => {
    dbApi.getMeta.mockResolvedValue(null);
    dbApi.getRoadmap.mockResolvedValue({ version: 3, items: buildSeedItems() });

    const store = createRoadmapStore();
    await store.setUser({ uid: 'never-touched-anything' });

    expect(store.getSnapshot().onboardingDone).toBe(false);
  });

  it('a user whose Firebase meta already has onboardingDone loads their saved items directly (no re-seeding)', async () => {
    const remoteItems = {
      'custom-1': { id: 'custom-1', title: 'My topic', phase: 'Learn', section: '', priority: 'P1', done: false, custom: true, deleted: false, resources: [] }
    };
    dbApi.getMeta.mockResolvedValue({ onboardingDone: true, templateId: 'blank' });
    dbApi.getRoadmap.mockResolvedValue({ version: 3, items: remoteItems });

    const store = createRoadmapStore();
    await store.setUser({ uid: 'returning-user' });

    const snapshot = store.getSnapshot();
    expect(snapshot.onboardingDone).toBe(true);
    expect(snapshot.templateId).toBe('blank');
    expect(snapshot.allItems).toEqual(remoteItems);
    expect(dbApi.listenRoadmap).toHaveBeenCalled();
  });
});

describe('initFromTemplate', () => {
  it('seeds items from the chosen template, marks onboarding done, and saves templateId to Firebase meta', async () => {
    dbApi.getMeta.mockResolvedValue(null);
    dbApi.getRoadmap.mockResolvedValue(null);

    const store = createRoadmapStore();
    await store.setUser({ uid: 'new-user' });
    expect(store.getSnapshot().onboardingDone).toBe(false);

    await store.initFromTemplate('blank');

    const snapshot = store.getSnapshot();
    expect(snapshot.onboardingDone).toBe(true);
    expect(snapshot.templateId).toBe('blank');
    expect(snapshot.allItems).toEqual({});
    expect(snapshot.phases).toHaveLength(4);
    expect(dbApi.saveMeta).toHaveBeenCalledWith('new-user', { templateId: 'blank', onboardingDone: true });
    expect(dbApi.listenRoadmap).toHaveBeenCalled();
  });

  it('picking java-backend seeds the same roadmap as the original default (no regression)', async () => {
    dbApi.getMeta.mockResolvedValue(null);
    dbApi.getRoadmap.mockResolvedValue(null);

    const store = createRoadmapStore();
    await store.setUser({ uid: 'new-user-2' });
    await store.initFromTemplate('java-backend');

    const snapshot = store.getSnapshot();
    expect(Object.keys(snapshot.allItems).length).toBe(Object.keys(buildSeedItems()).length);
  });

  it('without a signed-in uid, still seeds items and persists locally, but never calls Firebase', async () => {
    const store = createRoadmapStore();
    await store.initFromTemplate('frontend');

    const snapshot = store.getSnapshot();
    expect(snapshot.onboardingDone).toBe(true);
    expect(snapshot.templateId).toBe('frontend');
    expect(dbApi.saveMeta).not.toHaveBeenCalled();
    expect(localStorage.getItem('ascent-roadmap-v3')).not.toBeNull();
  });
});
