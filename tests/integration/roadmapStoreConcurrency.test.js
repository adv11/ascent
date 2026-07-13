import { describe, it, expect, beforeEach, vi } from 'vitest';

// Issue #121 item 6: fetchTemplateData() — a dynamic import() for a built-in
// template — used to be awaited in full before resolveRoadmapItems() even
// started its own, independent Firebase read (adapter.getRoadmap), stacking
// the import's latency in front of the network round trip instead of letting
// the two overlap. A dedicated file (not tests/integration/roadmapStore.test.js)
// specifically because it needs to control src/data/templates/index.js's own
// timing, which the main suite deliberately exercises with real template
// content instead of mocking.
vi.mock('../../src/services/storage/adapterFactory.js', () => {
  const dbApi = {
    listenRoadmap: vi.fn(() => () => {}),
    saveRoadmap: vi.fn(() => Promise.resolve()),
    getMeta: vi.fn(() => Promise.resolve(null)),
    saveMeta: vi.fn(() => Promise.resolve()),
    getRoadmap: vi.fn(() => Promise.resolve(null)),
    getLegacyRoadmap: vi.fn(() => Promise.resolve(null)),
    deleteRoadmap: vi.fn(() => Promise.resolve()),
    now: vi.fn(() => null),
  };
  return { getStorageAdapter: vi.fn(() => dbApi), dbApi };
});

vi.mock('../../src/data/templates/index.js', () => ({
  buildSeedItems: vi.fn(),
  getTemplatePhases: vi.fn(),
  getLegacyBlankTemplateData: vi.fn(() => Promise.resolve({ baseItems: {}, phases: [] })),
}));

import { createRoadmapStore } from '../../src/services/roadmapStore.js';
import { dbApi, getStorageAdapter } from '../../src/services/storage/adapterFactory.js';
import { buildSeedItems, getTemplatePhases } from '../../src/data/templates/index.js';

function deferred() {
  let resolve;
  const promise = new Promise(r => { resolve = r; });
  return { promise, resolve };
}

beforeEach(() => {
  vi.resetAllMocks();
  localStorage.clear();
  getStorageAdapter.mockImplementation(() => dbApi);
  dbApi.listenRoadmap.mockImplementation(() => () => {});
  dbApi.saveRoadmap.mockResolvedValue(undefined);
  dbApi.saveMeta.mockResolvedValue(undefined);
  dbApi.getLegacyRoadmap.mockResolvedValue(null);
  dbApi.deleteRoadmap.mockResolvedValue(undefined);
  dbApi.now.mockReturnValue(null);
});

describe('switchRoadmap()/setUser() run the template-data fetch and the Firebase read concurrently (issue #121 item 6)', () => {
  it('switchRoadmap(): the Firebase read for an already-started template starts before a slow template-data fetch resolves', async () => {
    dbApi.getMeta.mockResolvedValue({ onboardingDone: true, activeTemplateId: 'java-backend', startedTemplateIds: ['java-backend', 'frontend'] });
    buildSeedItems.mockResolvedValue({});
    getTemplatePhases.mockResolvedValue([]);
    dbApi.getRoadmap.mockResolvedValue(null);

    const store = createRoadmapStore();
    await store.setUser({ uid: 'concurrency-user' });

    // Now make the template-data fetch for 'frontend' slow, while getRoadmap
    // resolves as soon as it's called. If the old sequential bug were still
    // present, getRoadmap would never be called until the slow template
    // fetch resolves — this asserts the opposite.
    const slowTemplateData = deferred();
    buildSeedItems.mockReturnValue(slowTemplateData.promise.then(() => ({})));
    getTemplatePhases.mockReturnValue(slowTemplateData.promise.then(() => []));
    dbApi.getRoadmap.mockClear();
    dbApi.getRoadmap.mockResolvedValue({ items: { x: { id: 'x', title: 'X', phase: 'P', section: 'S', priority: 'P1', done: true, custom: true, deleted: false, resources: [] } } });

    const switchPromise = store.switchRoadmap('frontend');

    // Flush several microtask ticks without ever resolving the slow
    // template-data promise — the old sequential code could not have called
    // getRoadmap yet at this point.
    for (let i = 0; i < 5; i += 1) await Promise.resolve();

    expect(dbApi.getRoadmap).toHaveBeenCalledWith('concurrency-user', 'frontend');

    slowTemplateData.resolve();
    await switchPromise;

    expect(store.getSnapshot().activeTemplateId).toBe('frontend');
    expect(store.getSnapshot().allItems.x.done).toBe(true);
  });

  it('setUser(): the Firebase read for the active template starts before a slow template-data fetch resolves', async () => {
    dbApi.getMeta.mockResolvedValue({ onboardingDone: true, activeTemplateId: 'frontend', startedTemplateIds: ['frontend'] });

    const slowTemplateData = deferred();
    buildSeedItems.mockReturnValue(slowTemplateData.promise.then(() => ({})));
    getTemplatePhases.mockReturnValue(slowTemplateData.promise.then(() => []));
    dbApi.getRoadmap.mockResolvedValue({ items: { x: { id: 'x', title: 'X', phase: 'P', section: 'S', priority: 'P1', done: true, custom: true, deleted: false, resources: [] } } });

    const store = createRoadmapStore();
    const setUserPromise = store.setUser({ uid: 'concurrency-user-2' });

    for (let i = 0; i < 5; i += 1) await Promise.resolve();

    expect(dbApi.getRoadmap).toHaveBeenCalledWith('concurrency-user-2', 'frontend');

    slowTemplateData.resolve();
    await setUserPromise;

    expect(store.getSnapshot().allItems.x.done).toBe(true);
  });
});
