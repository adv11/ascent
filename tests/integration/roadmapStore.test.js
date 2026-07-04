import { describe, it, expect, beforeEach, vi } from 'vitest';
import { createRoadmapStore } from '../../src/services/roadmapStore.js';
import { buildSeedItems } from '../../src/data/roadmap.js';
import { dbApi } from '../../src/services/firebase.js';

vi.mock('../../src/services/firebase.js', () => ({
  dbApi: {
    listenRoadmap: vi.fn(() => () => {}),
    saveRoadmap: vi.fn(() => Promise.resolve()),
  },
  firebaseClock: vi.fn(() => null),
}));

beforeEach(() => {
  localStorage.clear();
  vi.clearAllMocks();
  vi.useRealTimers();
  dbApi.listenRoadmap.mockImplementation(() => () => {});
  dbApi.saveRoadmap.mockResolvedValue(undefined);
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
  it('setUser(null) after a non-null uid clears both localStorage keys', () => {
    const store = createRoadmapStore();
    store.setUser({ uid: 'user-123' });

    // Manually write data that belongs to the outgoing user
    localStorage.setItem('switchprep-roadmap-v3', JSON.stringify({ dirty: false, items: {} }));
    localStorage.setItem('switchprep-ui-v3', JSON.stringify({ expanded: true }));

    store.setUser(null);

    expect(localStorage.getItem('switchprep-roadmap-v3')).toBeNull();
    expect(localStorage.getItem('switchprep-ui-v3')).toBeNull();
  });

  it('setUser(null) resets items to seed data', () => {
    const store = createRoadmapStore();
    store.setUser({ uid: 'user-456' });
    store.setUser(null);

    const snapshot = store.getSnapshot();
    const seedKeys = Object.keys(buildSeedItems());
    const storeKeys = Object.keys(snapshot.allItems);
    expect(storeKeys).toEqual(expect.arrayContaining(seedKeys));
    expect(storeKeys).toHaveLength(seedKeys.length);
  });

  it('setUser(null) on initial boot (uid was null) does NOT clear localStorage', () => {
    const store = createRoadmapStore();
    // uid starts as null — guard must NOT fire here
    localStorage.setItem('switchprep-roadmap-v3', 'should-remain');

    store.setUser(null); // uid is still null, no transition

    expect(localStorage.getItem('switchprep-roadmap-v3')).toBe('should-remain');
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
    store.setUser({ uid: 'echo-test' });

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
    store.setUser({ uid: 'diff-data-test' });
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
