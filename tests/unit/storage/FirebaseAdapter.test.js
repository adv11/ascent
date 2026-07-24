import { describe, it, expect, beforeEach, vi } from 'vitest';

// FirebaseAdapter.js imports the Firebase SDK from a CDN URL (both directly
// and via firebase.js) — the default ESM loader can't resolve that in tests,
// so both are stubbed the same way adapterFactory.test.js already does. Each
// mocked SDK function is a vi.fn() so individual tests can assert on how
// FirebaseAdapter called it (path shape, single-path vs. multi-path, etc.).
const ref = vi.fn((_db, path) => ({ path }));
const onValue = vi.fn();
const off = vi.fn();
const set = vi.fn(() => Promise.resolve());
const update = vi.fn(() => Promise.resolve());
const get = vi.fn();
const remove = vi.fn(() => Promise.resolve());

vi.mock('https://www.gstatic.com/firebasejs/10.12.5/firebase-database.js', () => ({
  ref, onValue, off, set, update, get, remove
}));
vi.mock('../../../src/services/firebase.js', () => ({
  database: {},
  firebaseClock: () => 1700000000000
}));

const { FirebaseAdapter } = await import('../../../src/services/storage/FirebaseAdapter.js');

function snapshotFor(value) {
  return { exists: () => value !== null && value !== undefined, val: () => value };
}

beforeEach(() => {
  ref.mockClear();
  onValue.mockClear();
  off.mockClear();
  set.mockClear();
  update.mockClear();
  get.mockClear();
  remove.mockClear();
});

describe('FirebaseAdapter — updateRoadmapItemFields (issue #184 fix)', () => {
  it('issues a scoped multi-path update() keyed by items/{itemId}/{field}, never a full-map write', async () => {
    const adapter = new FirebaseAdapter();
    const existingItem = { id: 'item-1', title: 'Old title', done: false };
    get.mockResolvedValueOnce(snapshotFor(existingItem));

    const result = await adapter.updateRoadmapItemFields('uid-1', 'java-backend', 'item-1', { done: true, title: 'New title' });

    expect(update).toHaveBeenCalledTimes(1);
    const [, updates] = update.mock.calls[0];
    expect(updates).toEqual({
      'users/uid-1/roadmaps/java-backend/updatedAt': 1700000000000,
      'users/uid-1/roadmaps/java-backend/items/item-1/done': true,
      'users/uid-1/roadmaps/java-backend/items/item-1/title': 'New title'
    });
    // Never a full items-map key or a plain saveRoadmap-shaped write.
    expect(Object.keys(updates).some(key => key === 'users/uid-1/roadmaps/java-backend/items')).toBe(false);
    expect(set).not.toHaveBeenCalled();
    expect(result).toEqual({ ...existingItem, done: true, title: 'New title' });
  });

  it('resolves null and writes nothing when the item does not exist remotely yet', async () => {
    const adapter = new FirebaseAdapter();
    get.mockResolvedValueOnce(snapshotFor(null));

    const result = await adapter.updateRoadmapItemFields('uid-1', 'java-backend', 'missing-item', { done: true });

    expect(result).toBeNull();
    expect(update).not.toHaveBeenCalled();
  });

  it('two concurrent calls for different itemIds write to entirely separate paths', async () => {
    const adapter = new FirebaseAdapter();
    get.mockResolvedValue(snapshotFor({ id: 'irrelevant' }));

    await Promise.all([
      adapter.updateRoadmapItemFields('uid-1', 'java-backend', 'item-a', { done: true }),
      adapter.updateRoadmapItemFields('uid-1', 'java-backend', 'item-b', { done: true })
    ]);

    expect(update).toHaveBeenCalledTimes(2);
    const paths = update.mock.calls.map(([, updates]) => Object.keys(updates).find(key => key.includes('/items/')));
    expect(paths).toContain('users/uid-1/roadmaps/java-backend/items/item-a/done');
    expect(paths).toContain('users/uid-1/roadmaps/java-backend/items/item-b/done');
  });
});

describe('FirebaseAdapter — getRoadmapItem/roadmapItemRef', () => {
  it('reads a single item from its own scoped path', async () => {
    const adapter = new FirebaseAdapter();
    get.mockResolvedValueOnce(snapshotFor({ id: 'item-1', title: 'Hi' }));

    const result = await adapter.getRoadmapItem('uid-1', 'java-backend', 'item-1');

    expect(result).toEqual({ id: 'item-1', title: 'Hi' });
    expect(ref).toHaveBeenCalledWith({}, 'users/uid-1/roadmaps/java-backend/items/item-1');
  });

  it('returns null for a missing item', async () => {
    const adapter = new FirebaseAdapter();
    get.mockResolvedValueOnce(snapshotFor(null));
    await expect(adapter.getRoadmapItem('uid-1', 'java-backend', 'missing')).resolves.toBeNull();
  });
});

describe('FirebaseAdapter — saveRoadmap/getRoadmap/deleteRoadmap', () => {
  it('saveRoadmap writes the full payload to the roadmap path', async () => {
    const adapter = new FirebaseAdapter();
    await adapter.saveRoadmap('uid-1', 'java-backend', { items: {} });
    expect(set).toHaveBeenCalledWith({ path: 'users/uid-1/roadmaps/java-backend' }, { items: {} });
  });

  it('getRoadmap resolves null when nothing exists at that path', async () => {
    const adapter = new FirebaseAdapter();
    get.mockResolvedValueOnce(snapshotFor(null));
    await expect(adapter.getRoadmap('uid-1', 'java-backend')).resolves.toBeNull();
  });

  it('deleteRoadmap removes the roadmap path', async () => {
    const adapter = new FirebaseAdapter();
    await adapter.deleteRoadmap('uid-1', 'java-backend');
    expect(remove).toHaveBeenCalledWith({ path: 'users/uid-1/roadmaps/java-backend' });
  });
});

describe('FirebaseAdapter — now()', () => {
  it('delegates to firebaseClock', () => {
    const adapter = new FirebaseAdapter();
    expect(adapter.now()).toBe(1700000000000);
  });
});
