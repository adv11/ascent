import { describe, it, expect, beforeEach, vi } from 'vitest';
import { createRoadmapStore, applyRemoteSnapshot } from '../../src/services/roadmapStore.js';
import { buildSeedItems } from '../../src/data/roadmap.js';
import { dbApi, getStorageAdapter } from '../../src/services/storage/adapterFactory.js';
import { MAX_TITLE_LENGTH, MAX_RESOURCE_LABEL_LENGTH, MAX_RESOURCE_URL_LENGTH, MAX_CUSTOM_ROADMAP_TITLE_LENGTH, MAX_CUSTOM_ROADMAP_DESCRIPTION_LENGTH, MAX_CUSTOM_ROADMAPS } from '../../src/core/roadmap/limits.js';

// Mocks the adapter roadmapStore.js gets from getStorageAdapter() (issue #5) —
// still named/shaped like the old `dbApi` fake so the 60+ tests below that
// call `dbApi.<method>.mockResolvedValue(...)` don't need to change.
// `getStorageAdapter` is itself a vi.fn() (not a plain function) so the
// "adapter reselection per sign-in" tests below can temporarily override its
// implementation to return a different fake for a specific user.
vi.mock('../../src/services/storage/adapterFactory.js', () => {
  const dbApi = {
    listenRoadmap: vi.fn(() => () => {}),
    saveRoadmap: vi.fn(() => Promise.resolve()),
    getMeta: vi.fn(() => Promise.resolve(null)),
    saveMeta: vi.fn(() => Promise.resolve()),
    getRoadmap: vi.fn(() => Promise.resolve(null)),
    getLegacyRoadmap: vi.fn(() => Promise.resolve(null)),
    deleteRoadmap: vi.fn(() => Promise.resolve()),
    updateRoadmapItemFields: vi.fn(() => Promise.resolve(null)),
    now: vi.fn(() => null),
  };
  return { getStorageAdapter: vi.fn(() => dbApi), dbApi };
});

beforeEach(() => {
  localStorage.clear();
  // resetAllMocks (not clearAllMocks) so a custom mockImplementation/mockImplementationOnce
  // left over by one test (e.g. a deliberately-unresolved "slow" promise) can never leak
  // into the next test and hang it — every mock's implementation is reset to a no-op
  // before this file re-establishes its own defaults below.
  vi.resetAllMocks();
  vi.useRealTimers();
  getStorageAdapter.mockImplementation(() => dbApi);
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
  dbApi.deleteRoadmap.mockResolvedValue(undefined);
  dbApi.updateRoadmapItemFields.mockResolvedValue(null);
  dbApi.now.mockReturnValue(null);
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

  // Issue #15 — a notes patch is NOT cosmetic (the notes indicator badge on
  // the row needs structuralVersion to bump so it re-renders). Never add
  // 'notes' to the cosmetic-check in updateItem.
  it('bumps structuralVersion when a notes patch is applied', () => {
    vi.useFakeTimers();
    const store = createRoadmapStore();
    const initial = store.getSnapshot().structuralVersion;

    const firstId = Object.keys(store.getSnapshot().allItems)[0];
    store.updateItem(firstId, { notes: 'Some personal notes' });

    expect(store.getSnapshot().structuralVersion).toBe(initial + 1);
    expect(store.getSnapshot().allItems[firstId].notes).toBe('Some personal notes');
  });

  it('an item without a notes field reads as empty string, with no crash', () => {
    vi.useFakeTimers();
    const store = createRoadmapStore();
    const firstId = Object.keys(store.getSnapshot().allItems)[0];

    // Seed items never carry a `notes` field (backward compat) — the field
    // is only ever added once a user actually writes a note.
    expect(store.getSnapshot().allItems[firstId].notes).toBeUndefined();
    expect(store.getSnapshot().allItems[firstId].notes || '').toBe('');
  });
});

// Issue #18 — completedAt is a prerequisite for #8's progress analytics.
// Set once on a false -> true transition, cleared on true -> false, and a
// plain `{ done }` toggle stays cosmetic (no structuralVersion bump) even
// though completedAt is folded into the same in-memory patch internally.
describe('completedAt (issue #18)', () => {
  it('sets completedAt when done flips false -> true', () => {
    vi.useFakeTimers();
    vi.setSystemTime(1700000000000);
    const store = createRoadmapStore();
    const firstId = Object.keys(store.getSnapshot().allItems)[0];

    store.updateItem(firstId, { done: true });

    expect(store.getSnapshot().allItems[firstId].completedAt).toBe(1700000000000);
  });

  it('clears completedAt when done flips true -> false', () => {
    vi.useFakeTimers();
    const store = createRoadmapStore();
    const firstId = Object.keys(store.getSnapshot().allItems)[0];

    store.updateItem(firstId, { done: true });
    store.updateItem(firstId, { done: false });

    expect(store.getSnapshot().allItems[firstId].completedAt).toBeNull();
  });

  it('does not re-stamp completedAt on a redundant done:true patch', () => {
    vi.useFakeTimers();
    vi.setSystemTime(1700000000000);
    const store = createRoadmapStore();
    const firstId = Object.keys(store.getSnapshot().allItems)[0];

    store.updateItem(firstId, { done: true });
    vi.setSystemTime(1700000099999);
    store.updateItem(firstId, { done: true, notes: 'still working through this' });

    expect(store.getSnapshot().allItems[firstId].completedAt).toBe(1700000000000);
  });

  it('cycling done true -> false -> true stays cosmetic and never bumps structuralVersion', () => {
    vi.useFakeTimers();
    const store = createRoadmapStore();
    const firstId = Object.keys(store.getSnapshot().allItems)[0];
    const initial = store.getSnapshot().structuralVersion;

    store.updateItem(firstId, { done: true });
    store.updateItem(firstId, { done: false });
    store.updateItem(firstId, { done: true });

    expect(store.getSnapshot().structuralVersion).toBe(initial);
    expect(store.getSnapshot().allItems[firstId].completedAt).not.toBeNull();
  });

  it('a fresh item from addItem starts with completedAt: null', () => {
    vi.useFakeTimers();
    const store = createRoadmapStore();
    store.addItem({ title: 'New Topic', phase: 'Java Core', section: 'Basics', priority: 'P2' });
    const added = Object.values(store.getSnapshot().allItems).find(item => item.title === 'New Topic');

    expect(added.completedAt).toBeNull();
  });
});

describe('timeSpentSeconds (issue #180) — persists through updateItem like any other field', () => {
  it('accepts a timeSpentSeconds patch and stores it on the item', () => {
    const store = createRoadmapStore();
    const firstId = Object.keys(store.getSnapshot().allItems)[0];

    expect(store.updateItem(firstId, { timeSpentSeconds: 90 })).toBe(true);
    expect(store.getSnapshot().allItems[firstId].timeSpentSeconds).toBe(90);
  });

  it('overwrites (not adds to) the prior value — callers own the accumulation math', () => {
    const store = createRoadmapStore();
    const firstId = Object.keys(store.getSnapshot().allItems)[0];

    store.updateItem(firstId, { timeSpentSeconds: 60 });
    store.updateItem(firstId, { timeSpentSeconds: 60 + 45 });

    expect(store.getSnapshot().allItems[firstId].timeSpentSeconds).toBe(105);
  });

  it('is not cosmetic — a timeSpentSeconds-only patch bumps structuralVersion', () => {
    const store = createRoadmapStore();
    const firstId = Object.keys(store.getSnapshot().allItems)[0];
    const initial = store.getSnapshot().structuralVersion;

    store.updateItem(firstId, { timeSpentSeconds: 90 });

    expect(store.getSnapshot().structuralVersion).toBe(initial + 1);
  });

  it('persists through the same debounced save path as every other item field', async () => {
    const store = createRoadmapStore();
    await store.setUser({ uid: 'u1' });
    const firstId = Object.keys(store.getSnapshot().allItems)[0];

    vi.useFakeTimers();
    store.updateItem(firstId, { timeSpentSeconds: 120 });
    await vi.advanceTimersByTimeAsync(600);

    expect(dbApi.saveRoadmap).toHaveBeenCalled();
    const lastPayload = dbApi.saveRoadmap.mock.calls.at(-1)[2];
    expect(lastPayload.items[firstId].timeSpentSeconds).toBe(120);
    vi.useRealTimers();
  });
});

// onCompletionToggle (issue #8) — the injected hook main.js wires to
// activityLogStore.recordCompletion/recordUncompletion. Fires exactly once
// per genuine done-transition, from updateItem() directly and, indirectly,
// from setItemDoneInTemplate()'s three branches below.
describe('onCompletionToggle (issue #8)', () => {
  it('fires with +1 on a false -> true transition via updateItem', () => {
    const onCompletionToggle = vi.fn();
    const store = createRoadmapStore({ onCompletionToggle });
    const firstId = Object.keys(store.getSnapshot().allItems)[0];

    store.updateItem(firstId, { done: true });

    expect(onCompletionToggle).toHaveBeenCalledTimes(1);
    expect(onCompletionToggle).toHaveBeenCalledWith(1);
  });

  it('fires with -1 on a true -> false transition via updateItem', () => {
    const onCompletionToggle = vi.fn();
    const store = createRoadmapStore({ onCompletionToggle });
    const firstId = Object.keys(store.getSnapshot().allItems)[0];

    store.updateItem(firstId, { done: true });
    onCompletionToggle.mockClear();
    store.updateItem(firstId, { done: false });

    expect(onCompletionToggle).toHaveBeenCalledTimes(1);
    expect(onCompletionToggle).toHaveBeenCalledWith(-1);
  });

  it('does not fire on a non-done patch', () => {
    const onCompletionToggle = vi.fn();
    const store = createRoadmapStore({ onCompletionToggle });
    const firstId = Object.keys(store.getSnapshot().allItems)[0];

    store.updateItem(firstId, { notes: 'just a note' });

    expect(onCompletionToggle).not.toHaveBeenCalled();
  });

  it('does not fire on a redundant done:true patch (already done)', () => {
    const onCompletionToggle = vi.fn();
    const store = createRoadmapStore({ onCompletionToggle });
    const firstId = Object.keys(store.getSnapshot().allItems)[0];

    store.updateItem(firstId, { done: true });
    onCompletionToggle.mockClear();
    store.updateItem(firstId, { done: true, notes: 'still working through this' });

    expect(onCompletionToggle).not.toHaveBeenCalled();
  });

  it('does not fire on a redundant done:false patch (already not done)', () => {
    const onCompletionToggle = vi.fn();
    const store = createRoadmapStore({ onCompletionToggle });
    const firstId = Object.keys(store.getSnapshot().allItems)[0];

    store.updateItem(firstId, { done: false });

    expect(onCompletionToggle).not.toHaveBeenCalled();
  });

  it('does not fire on addItem seeding', () => {
    const onCompletionToggle = vi.fn();
    const store = createRoadmapStore({ onCompletionToggle });

    store.addItem({ title: 'New Topic', phase: 'Java Core', section: 'Basics', priority: 'P2' });

    expect(onCompletionToggle).not.toHaveBeenCalled();
  });

  it('defaults to a no-op when omitted — createRoadmapStore() with no args still works', () => {
    const store = createRoadmapStore();
    const firstId = Object.keys(store.getSnapshot().allItems)[0];
    expect(() => store.updateItem(firstId, { done: true })).not.toThrow();
  });

  it('fires exactly once via setItemDoneInTemplate on the active template (delegates to updateItem)', async () => {
    const onCompletionToggle = vi.fn();
    const store = createRoadmapStore({ onCompletionToggle });
    await store.setUser({ uid: 'u1' });
    const firstId = Object.keys(store.getSnapshot().allItems)[0];

    const result = await store.setItemDoneInTemplate('java-backend', firstId, true);

    expect(result.ok).toBe(true);
    expect(onCompletionToggle).toHaveBeenCalledTimes(1);
    expect(onCompletionToggle).toHaveBeenCalledWith(1);
  });

  it('fires via setItemDoneInTemplate on a cached (non-active) template', async () => {
    const onCompletionToggle = vi.fn();
    // 'frontend' must already be a started template *before* setUser resolves
    // so switchRoadmap('frontend') below takes the resolveRoadmapItems path
    // (which honors the getRoadmap mock) instead of seeding a fresh template.
    dbApi.getMeta.mockResolvedValue({ onboardingDone: true, activeTemplateId: 'java-backend', startedTemplateIds: ['java-backend', 'frontend'] });
    dbApi.getRoadmap.mockResolvedValue({
      version: 1,
      items: { 'other-item': { id: 'other-item', title: 'Other', done: false, deleted: false } }
    });
    const store = createRoadmapStore({ onCompletionToggle });
    await store.setUser({ uid: 'u1' });

    await store.switchRoadmap('frontend');
    await store.switchRoadmap('java-backend');

    const result = await store.setItemDoneInTemplate('frontend', 'other-item', true);

    expect(result.ok).toBe(true);
    expect(onCompletionToggle).toHaveBeenCalledWith(1);
  });

  it('fires via setItemDoneInTemplate on a cold (never-visited-this-session) template', async () => {
    const onCompletionToggle = vi.fn();
    const store = createRoadmapStore({ onCompletionToggle });
    await store.setUser({ uid: 'u1' });
    dbApi.getMeta.mockResolvedValue({ onboardingDone: true, activeTemplateId: 'java-backend', startedTemplateIds: ['java-backend', 'frontend'] });
    dbApi.getRoadmap.mockResolvedValue({
      version: 1,
      items: { 'cold-item': { id: 'cold-item', title: 'Cold', done: false, deleted: false } }
    });

    const result = await store.setItemDoneInTemplate('frontend', 'cold-item', true);

    expect(result.ok).toBe(true);
    expect(onCompletionToggle).toHaveBeenCalledWith(1);
  });

  it('two concurrent setItemDoneInTemplate calls for different items on a cold, uncached roadmap both persist via scoped per-item writes instead of racing a full items overwrite (issue #184)', async () => {
    const onCompletionToggle = vi.fn();
    const store = createRoadmapStore({ onCompletionToggle });
    await store.setUser({ uid: 'u1' });
    dbApi.getMeta.mockResolvedValue({ onboardingDone: true, activeTemplateId: 'java-backend', startedTemplateIds: ['java-backend', 'frontend'] });
    dbApi.getRoadmap.mockResolvedValue({
      version: 1,
      items: {
        'item-a': { id: 'item-a', title: 'A', done: false, deleted: false },
        'item-b': { id: 'item-b', title: 'B', done: false, deleted: false }
      }
    });
    // Simulates the race: updateRoadmapItemFields resolves after an artificial
    // delay so both calls' scoped writes are genuinely in flight at once —
    // against the old code (a full saveRoadmap({ items: nextItems }) built from
    // a stale read) whichever call's write landed last would silently drop the
    // other item's completion.
    dbApi.updateRoadmapItemFields.mockImplementation((uid, templateId, itemId, fields) =>
      new Promise(resolve => setTimeout(() => resolve({ id: itemId, ...fields }), 5))
    );

    const [resultA, resultB] = await Promise.all([
      store.setItemDoneInTemplate('frontend', 'item-a', true),
      store.setItemDoneInTemplate('frontend', 'item-b', true)
    ]);

    expect(resultA.ok).toBe(true);
    expect(resultB.ok).toBe(true);
    // Neither completion goes through a full items-map overwrite — each is a
    // scoped write to its own item path, so one call can never clobber the
    // other's completion via a stale saveRoadmap() snapshot.
    expect(dbApi.saveRoadmap).not.toHaveBeenCalled();
    expect(dbApi.updateRoadmapItemFields).toHaveBeenCalledWith('u1', 'frontend', 'item-a', expect.objectContaining({ done: true }));
    expect(dbApi.updateRoadmapItemFields).toHaveBeenCalledWith('u1', 'frontend', 'item-b', expect.objectContaining({ done: true }));
    expect(onCompletionToggle).toHaveBeenCalledWith(1);
    expect(onCompletionToggle).toHaveBeenCalledTimes(2);
  });

  it('does not fire when setItemDoneInTemplate fails to find the item', async () => {
    const onCompletionToggle = vi.fn();
    const store = createRoadmapStore({ onCompletionToggle });
    await store.setUser({ uid: 'u1' });
    dbApi.getRoadmap.mockResolvedValue(null);

    const result = await store.setItemDoneInTemplate('never-started', 'missing-item', true);

    expect(result.ok).toBe(false);
    expect(onCompletionToggle).not.toHaveBeenCalled();
  });
});

// Issue #18 Phase B — restoring a JSON backup goes through this one store
// method rather than ever mutating `items` directly, same contract addItem/
// updateItem already give every other caller.
describe('importBackupItems (issue #18)', () => {
  function backupItem(overrides = {}) {
    return {
      title: 'Imported topic',
      phase: 'Java Core',
      section: 'Basics',
      priority: 'P2',
      done: false,
      completedAt: null,
      resources: [],
      notes: '',
      ...overrides
    };
  }

  it('adds a brand-new id as a new item and bumps structuralVersion', () => {
    vi.useFakeTimers();
    const store = createRoadmapStore();
    const initial = store.getSnapshot().structuralVersion;

    const outcome = store.importBackupItems({ 'brand-new-id': backupItem() });

    expect(outcome).toEqual({ added: 1, updated: 0, skipped: 0 });
    expect(store.getSnapshot().allItems['brand-new-id'].title).toBe('Imported topic');
    expect(store.getSnapshot().structuralVersion).toBe(initial + 1);
  });

  it('merges onto a matching existing id instead of duplicating it', () => {
    vi.useFakeTimers();
    const store = createRoadmapStore();
    const firstId = Object.keys(store.getSnapshot().allItems)[0];
    const originalTitle = store.getSnapshot().allItems[firstId].title;

    const outcome = store.importBackupItems({
      [firstId]: backupItem({ title: 'Restored title', done: true, completedAt: 1700000000000 })
    });

    expect(outcome).toEqual({ added: 0, updated: 1, skipped: 0 });
    const restored = store.getSnapshot().allItems[firstId];
    expect(restored.title).toBe('Restored title');
    expect(restored.title).not.toBe(originalTitle);
    expect(restored.done).toBe(true);
    expect(restored.completedAt).toBe(1700000000000);
  });

  it('un-deletes a soft-deleted item it matches by id', () => {
    vi.useFakeTimers();
    const store = createRoadmapStore();
    const firstId = Object.keys(store.getSnapshot().allItems)[0];
    store.removeItem(firstId);
    expect(store.getSnapshot().allItems[firstId].deleted).toBe(true);

    store.importBackupItems({ [firstId]: backupItem() });

    expect(store.getSnapshot().allItems[firstId].deleted).toBe(false);
  });

  it('skips an item missing a required field without touching anything else', () => {
    vi.useFakeTimers();
    const store = createRoadmapStore();

    const outcome = store.importBackupItems({ 'bad-id': backupItem({ title: '' }) });

    expect(outcome).toEqual({ added: 0, updated: 0, skipped: 1 });
    expect(store.getSnapshot().allItems['bad-id']).toBeUndefined();
  });

  it('drops a resource that fails isValidResource', () => {
    vi.useFakeTimers();
    const store = createRoadmapStore();

    store.importBackupItems({
      'brand-new-id': backupItem({
        resources: [
          { label: 'Good link', url: 'https://example.com' },
          { label: 'x'.repeat(MAX_RESOURCE_LABEL_LENGTH + 1), url: 'https://example.com' }
        ]
      })
    });

    expect(store.getSnapshot().allItems['brand-new-id'].resources).toEqual([
      { label: 'Good link', url: 'https://example.com' }
    ]);
  });

  it('never exceeds the per-roadmap item cap for genuinely new items', () => {
    vi.useFakeTimers();
    const store = createRoadmapStore();
    const startingCount = store.getSnapshot().items.length;
    const backupItems = {};
    for (let i = 0; i < 900 - startingCount; i += 1) {
      backupItems[`overflow-${i}`] = backupItem({ title: `Overflow ${i}` });
    }

    const outcome = store.importBackupItems(backupItems);

    expect(outcome.skipped).toBeGreaterThan(0);
    expect(store.getSnapshot().items.length).toBeLessThanOrEqual(800);
  });

  it('is a no-op that never bumps structuralVersion when everything is skipped', () => {
    vi.useFakeTimers();
    const store = createRoadmapStore();
    const initial = store.getSnapshot().structuralVersion;

    const outcome = store.importBackupItems({ 'bad-id': backupItem({ phase: '' }) });

    expect(outcome).toEqual({ added: 0, updated: 0, skipped: 1 });
    expect(store.getSnapshot().structuralVersion).toBe(initial);
  });

  // Items never carry a uid — importing a backup exported from a different
  // account (or the same one) restores identically either way, since
  // ownership is scoped by which store/account instance you call this on,
  // never by anything inside the item payload itself.
  it('ignores any extraneous fields (like a uid) on the incoming item', () => {
    vi.useFakeTimers();
    const store = createRoadmapStore();

    store.importBackupItems({
      'brand-new-id': backupItem({ uid: 'someone-elses-uid', exportedByUid: 'someone-elses-uid' })
    });

    const imported = store.getSnapshot().allItems['brand-new-id'];
    expect(imported.uid).toBeUndefined();
    expect(imported.exportedByUid).toBeUndefined();
  });
});

// Issue #24 — Firebase rules can't count a map's children, so a per-roadmap
// item cap is enforced client-side, in the one place items are created.
// Lowered from 1,000 to 800 in issue #53 (no real roadmap organically
// approaches even 800 topics; the tighter cap shrinks the accidental-storage-
// runaway window on the free tier without costing legitimate users anything).
describe('addItem — per-roadmap item cap (issues #24, #53)', () => {
  it('rejects a new item once the roadmap already holds 800 active items', () => {
    vi.useFakeTimers();
    const store = createRoadmapStore();
    const initialCount = Object.values(store.getSnapshot().allItems).filter(i => !i.deleted).length;

    for (let i = 0; i < 800 - initialCount; i++) {
      const ok = store.addItem({ title: `Topic ${i}`, phase: 'Java Core', section: 'Basics', priority: 'high' });
      expect(ok).toBe(true);
    }

    const before = store.getSnapshot().structuralVersion;
    const rejected = store.addItem({ title: 'One too many', phase: 'Java Core', section: 'Basics', priority: 'high' });

    expect(rejected).toBe(false);
    expect(store.getSnapshot().structuralVersion).toBe(before);
    expect(Object.values(store.getSnapshot().allItems).filter(i => !i.deleted)).toHaveLength(800);
  });

  it('a soft-deleted item does not count toward the cap', () => {
    vi.useFakeTimers();
    const store = createRoadmapStore();
    const initialCount = Object.values(store.getSnapshot().allItems).filter(i => !i.deleted).length;

    for (let i = 0; i < 800 - initialCount; i++) {
      store.addItem({ title: `Topic ${i}`, phase: 'Java Core', section: 'Basics', priority: 'high' });
    }
    const customIds = Object.keys(store.getSnapshot().allItems).filter(id => id.startsWith('custom-'));
    store.removeItem(customIds[0]);

    const ok = store.addItem({ title: 'Room again', phase: 'Java Core', section: 'Basics', priority: 'high' });

    expect(ok).toBe(true);
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

// getStorageAdapter() is re-invoked on every setUser() rather than the store
// fixing an adapter once at creation time, so a future second backend (or a
// mid-session sign-out/sign-in-as-a-different-user) always gets re-resolved
// instead of sticking with whatever was picked at store creation.
describe('adapter reselection per sign-in', () => {
  it('calls getStorageAdapter with the signed-in user on every setUser()', async () => {
    const store = createRoadmapStore();
    await store.setUser({ uid: 'user-1' });

    expect(getStorageAdapter).toHaveBeenCalledWith({ uid: 'user-1' });
  });

  it('actually uses the adapter getStorageAdapter returns for that sign-in, not a stale one', async () => {
    const otherFakeAdapter = {
      listenRoadmap: vi.fn(() => () => {}),
      saveRoadmap: vi.fn(() => Promise.resolve()),
      getMeta: vi.fn(() => Promise.resolve({ onboardingDone: true, activeTemplateId: 'java-backend', startedTemplateIds: ['java-backend'] })),
      saveMeta: vi.fn(() => Promise.resolve()),
      getRoadmap: vi.fn(() => Promise.resolve(null)),
      getLegacyRoadmap: vi.fn(() => Promise.resolve(null)),
      deleteRoadmap: vi.fn(() => Promise.resolve()),
      now: vi.fn(() => 'iso-timestamp'),
    };
    getStorageAdapter.mockImplementation(user => (
      user?.uid === 'other-user' ? otherFakeAdapter : dbApi
    ));

    const store = createRoadmapStore();
    await store.setUser({ uid: 'other-user' });

    expect(otherFakeAdapter.getMeta).toHaveBeenCalledWith('other-user');
    expect(dbApi.getMeta).not.toHaveBeenCalled();

    // A later sign-in as a different user must switch to whichever adapter
    // getStorageAdapter now resolves, not keep using the previous session's.
    await store.setUser({ uid: 'email-user', providerData: [{ providerId: 'password' }] });
    expect(dbApi.getMeta).toHaveBeenCalledWith('email-user');
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

    // Simulate the adapter echoing back the same items (same content, potentially sorted keys)
    const currentItems = store.getSnapshot().allItems;
    capturedCallback({ version: 3, items: currentItems });

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

    capturedCallback({ version: 3, items: differentItems });

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

    await store.switchRoadmap('piano');
    expect(store.getSnapshot().activeTemplateId).toBe('piano');
    const pianoItemsBeforeStaleCallback = store.getSnapshot().allItems;

    // Manually invoke the old (already-detached) java-backend listener's
    // callback, simulating one last queued call slipping through.
    const versionBeforeStaleCallback = store.getSnapshot().structuralVersion;
    javaCallback({ version: 3, templateId: 'java-backend', items: { x: { id: 'x', done: true } } });

    const snapshot = store.getSnapshot();
    expect(snapshot.activeTemplateId).toBe('piano');
    expect(snapshot.allItems).toEqual(pianoItemsBeforeStaleCallback);
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

    capturedCallback({ version: 3, templateId: 'java-backend', items: updatedItems });

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
    capturedCallback({ version: 3, templateId: 'java-backend', items: seedItems });

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

    capturedCallback({ version: 3, templateId: 'java-backend', items: fromAnotherDevice });

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

    await store.switchRoadmap('piano'); // must flush java-backend's edit before switching away

    expect(dbApi.saveRoadmap).toHaveBeenCalledWith(
      'flush-before-switch-test',
      'java-backend',
      expect.objectContaining({
        templateId: 'java-backend',
        items: expect.objectContaining({ [firstId]: expect.objectContaining({ done: true }) })
      })
    );
    expect(store.getSnapshot().activeTemplateId).toBe('piano');
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
    dbApi.getMeta.mockResolvedValue({ onboardingDone: true, activeTemplateId: 'piano', startedTemplateIds: ['piano'] });
    const remoteItems = {
      'custom-1': { id: 'custom-1', title: 'My topic', phase: 'Learn', section: '', priority: 'P1', done: false, custom: true, deleted: false, resources: [] }
    };
    dbApi.getRoadmap.mockResolvedValue({ version: 3, items: remoteItems });

    const store = createRoadmapStore();
    await store.setUser({ uid: 'returning-user' });

    const snapshot = store.getSnapshot();
    expect(snapshot.onboardingDone).toBe(true);
    expect(snapshot.activeTemplateId).toBe('piano');
    expect(snapshot.allItems).toMatchObject(remoteItems);
    expect(dbApi.getRoadmap).toHaveBeenCalledWith('returning-user', 'piano');
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
      : Promise.resolve({ onboardingDone: true, activeTemplateId: 'piano', startedTemplateIds: ['piano'] })));
    dbApi.getRoadmap.mockResolvedValue({ version: 3, items: { 'custom-1': { id: 'custom-1', title: 'x', phase: 'Learn', section: '', priority: 'P1', done: false, custom: true, deleted: false, resources: [] } } });

    const store = createRoadmapStore();

    const slowCall = store.setUser({ uid: 'slow-user' });
    const fastCall = store.setUser({ uid: 'fast-user' });
    await fastCall;

    expect(store.getSnapshot().uid).toBe('fast-user');
    expect(store.getSnapshot().onboardingDone).toBe(true);
    expect(store.getSnapshot().activeTemplateId).toBe('piano');

    resolveSlowMeta(null); // let the stale call finish resolving, after the fact
    await slowCall;

    // The stale slow-user resolution must not have overwritten fast-user's state.
    expect(store.getSnapshot().uid).toBe('fast-user');
    expect(store.getSnapshot().onboardingDone).toBe(true);
    expect(store.getSnapshot().activeTemplateId).toBe('piano');
    expect(store.getSnapshot().allItems['custom-1']).toBeTruthy();
  });
});

// Issue #67 — a page reload/close can interrupt the debounced Firebase write
// for an edit before it lands, leaving Firebase holding stale data while the
// local blob (written synchronously by queueSave) already has the edit and is
// marked dirty. resolveRoadmapItems must prefer that dirty local blob over a
// stale remote read on the very next load, mirroring the guard
// attachRoadmapListener already has for the realtime-listener path.
describe('resolveRoadmapItems — dirty local blob outranks stale remote (issue #67)', () => {
  it('prefers a dirty local blob over a stale remote read on initial load', async () => {
    dbApi.getMeta.mockResolvedValue({ onboardingDone: true, activeTemplateId: 'piano', startedTemplateIds: ['piano'] });
    dbApi.getRoadmap.mockResolvedValue({
      version: 3,
      items: { 'custom-1': { id: 'custom-1', title: 'Stale remote title', phase: 'Learn', section: '', priority: 'P1', done: false, custom: true, deleted: false, resources: [] } }
    });
    localStorage.setItem('ascent-roadmaps-v1', JSON.stringify({
      piano: {
        version: 3,
        dirty: true,
        items: { 'custom-1': { id: 'custom-1', title: 'Newer local title', phase: 'Learn', section: '', priority: 'P1', done: false, custom: true, deleted: false, resources: [] } }
      }
    }));

    const store = createRoadmapStore();
    await store.setUser({ uid: 'reload-user' });

    const snapshot = store.getSnapshot();
    expect(snapshot.allItems['custom-1'].title).toBe('Newer local title');
    expect(snapshot.dirty).toBe(true);
    expect(dbApi.getRoadmap).not.toHaveBeenCalled();
  });

  it('re-queues a save for the recovered dirty edit so the interrupted write completes', async () => {
    vi.useFakeTimers();
    dbApi.getMeta.mockResolvedValue({ onboardingDone: true, activeTemplateId: 'piano', startedTemplateIds: ['piano'] });
    localStorage.setItem('ascent-roadmaps-v1', JSON.stringify({
      piano: {
        version: 3,
        dirty: true,
        items: { 'custom-1': { id: 'custom-1', title: 'x', phase: 'Learn', section: '', priority: 'P1', done: false, custom: true, deleted: false, resources: [] } }
      }
    }));

    const store = createRoadmapStore();
    await store.setUser({ uid: 'reload-user' });

    await vi.advanceTimersByTimeAsync(500);
    expect(dbApi.saveRoadmap).toHaveBeenCalled();
  });

  it('an already-cached (non-dirty) template still reads from remote as before', async () => {
    dbApi.getMeta.mockResolvedValue({ onboardingDone: true, activeTemplateId: 'piano', startedTemplateIds: ['piano'] });
    const remoteItems = {
      'custom-1': { id: 'custom-1', title: 'Remote title', phase: 'Learn', section: '', priority: 'P1', done: false, custom: true, deleted: false, resources: [] }
    };
    dbApi.getRoadmap.mockResolvedValue({ version: 3, items: remoteItems });
    localStorage.setItem('ascent-roadmaps-v1', JSON.stringify({
      piano: { version: 3, dirty: false, items: {} }
    }));

    const store = createRoadmapStore();
    await store.setUser({ uid: 'clean-user' });

    const snapshot = store.getSnapshot();
    expect(snapshot.allItems['custom-1'].title).toBe('Remote title');
    expect(snapshot.dirty).toBe(false);
    expect(dbApi.getRoadmap).toHaveBeenCalledWith('clean-user', 'piano');
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
    dbApi.getMeta.mockResolvedValue({ onboardingDone: true, activeTemplateId: 'piano', startedTemplateIds: ['piano'] });

    const store = createRoadmapStore();
    await store.setUser({ uid: 'already-migrated-user' });

    expect(dbApi.getLegacyRoadmap).not.toHaveBeenCalled();
    expect(store.getSnapshot().activeTemplateId).toBe('piano');
  });
});

describe('switchRoadmap — first-time pick (onboardingDone was false)', () => {
  it('seeds items from the chosen template, marks onboarding done, and saves the new meta shape to Firebase', async () => {
    dbApi.getMeta.mockResolvedValue(null);
    dbApi.getLegacyRoadmap.mockResolvedValue(null);

    const store = createRoadmapStore();
    await store.setUser({ uid: 'new-user' });
    expect(store.getSnapshot().onboardingDone).toBe(false);

    await store.switchRoadmap('piano');

    const snapshot = store.getSnapshot();
    expect(snapshot.onboardingDone).toBe(true);
    expect(snapshot.activeTemplateId).toBe('piano');
    expect(snapshot.startedTemplateIds).toEqual(['piano']);
    expect(Object.keys(snapshot.allItems).length).toBeGreaterThan(0);
    expect(snapshot.phases.length).toBeGreaterThan(0);
    expect(dbApi.saveMeta).toHaveBeenCalledWith('new-user', { activeTemplateId: 'piano', startedTemplateIds: ['piano'], onboardingDone: true });
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

    await store.switchRoadmap('piano');
    expect(store.getSnapshot().allItems).not.toEqual(javaItemsBefore);
    expect(store.getSnapshot().startedTemplateIds).toEqual(expect.arrayContaining(['java-backend', 'piano']));

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

  // Regression test for a real production bug: picking the first template
  // (java-backend, TEMPLATES[0]) before a brand-new sign-in's own setUser()
  // call has resolved used to be a false-positive no-op, since
  // `activeTemplateId` defaults to the placeholder 'java-backend' at module
  // init (before any sign-in). switchRoadmap('java-backend') would see
  // requestedTemplateId === activeTemplateId and return immediately —
  // seeding nothing and never setting onboardingDone — so the UI would
  // navigate to the dashboard on an unseeded, not-actually-onboarded store,
  // then bounce straight back to /onboarding once the slow setUser() call
  // finally resolved with the real (onboardingDone: false) state. Users hit
  // this as "clicking a roadmap does nothing and the app seems to hang."
  it('switchRoadmap(\'java-backend\') actually seeds and onboards, even when called before a slow setUser() resolves', async () => {
    dbApi.getMeta.mockResolvedValue(null); // brand-new account, no meta yet
    dbApi.getLegacyRoadmap.mockResolvedValue(null);

    let resolveMeta;
    dbApi.getMeta.mockImplementation(() => new Promise(resolve => { resolveMeta = resolve; }));

    const store = createRoadmapStore();
    const setUserPromise = store.setUser({ uid: 'race-user' }); // intentionally not awaited yet

    // At this point activeTemplateId is still the module-init placeholder
    // ('java-backend') and onboardingDone is still its initial null — exactly
    // the state a real /onboarding page render would see before setUser()
    // resolves.
    expect(store.getSnapshot().activeTemplateId).toBe('java-backend');
    expect(store.getSnapshot().onboardingDone).toBeFalsy();

    await store.switchRoadmap('java-backend');

    const afterSwitch = store.getSnapshot();
    expect(afterSwitch.onboardingDone).toBe(true);
    expect(afterSwitch.activeTemplateId).toBe('java-backend');
    expect(afterSwitch.startedTemplateIds).toEqual(['java-backend']);
    expect(Object.keys(afterSwitch.allItems).length).toBeGreaterThan(0);

    // The slow setUser() call resolving afterward must not clobber the
    // freshly-switched, genuinely-onboarded state (the pre-existing
    // stateCallId staleness guard handles this once switchRoadmap actually
    // participates instead of no-op'ing past it).
    resolveMeta(null);
    await setUserPromise;

    const final = store.getSnapshot();
    expect(final.onboardingDone).toBe(true);
    expect(final.activeTemplateId).toBe('java-backend');
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
    const fastSwitch = store.switchRoadmap('piano'); // not-yet-started -> no Firebase read needed, resolves quickly
    await fastSwitch;

    expect(store.getSnapshot().activeTemplateId).toBe('piano');
    const pianoItems = store.getSnapshot().allItems;

    resolveSlow({ items: { 'frontend-x': { id: 'frontend-x', done: true } } });
    await slowSwitch;

    // The stale frontend switch must not have clobbered the newer piano switch.
    expect(store.getSnapshot().activeTemplateId).toBe('piano');
    expect(store.getSnapshot().allItems).toEqual(pianoItems);
  });
});

// Issue #143 investigation follow-up: flushOutgoingRoadmap() swallows its own
// failure (by design — a stalled Firebase write must not block the switch
// itself), which correctly leaves roadmapCache[outgoingId].dirty as `true`.
// But switchRoadmap()'s own end used to only call queueSave() for a
// not-yet-started template, never for an already-started one loaded from
// that dirty cache entry — so switching back into it left `dirty: true` in
// memory with no timer ever queued to actually flush it, silently
// abandoning the edit until some unrelated mutation happened to call
// queueSave() again.
describe('switchRoadmap — re-queues a save for a template left dirty by a failed outgoing flush (issue #143)', () => {
  it('switching back into an already-started template that a prior failed outgoing flush left dirty re-queues its save', async () => {
    vi.useFakeTimers();
    const store = createRoadmapStore();
    await store.setUser({ uid: 'dirty-switch-back-user' }); // starts on java-backend

    const firstId = Object.keys(store.getSnapshot().allItems)[0];
    store.updateItem(firstId, { done: true }); // dirty=true, 500ms debounce queued

    // The outgoing flush triggered by switching away fails once (e.g. a
    // stalled connection) — flushOutgoingRoadmap() swallows this internally
    // so the switch itself still succeeds, but java-backend's roadmapCache
    // entry must be left dirty:true, not silently marked clean.
    dbApi.saveRoadmap.mockRejectedValueOnce(new Error('network error'));
    await store.switchRoadmap('piano'); // not yet started -> seeds fresh
    expect(store.getSnapshot().activeTemplateId).toBe('piano');

    dbApi.saveRoadmap.mockClear();
    dbApi.saveRoadmap.mockResolvedValue(undefined); // every save succeeds from here on

    await store.switchRoadmap('java-backend'); // already-started -> cache-first read

    expect(store.getSnapshot().dirty).toBe(true);
    await vi.advanceTimersByTimeAsync(500);
    expect(dbApi.saveRoadmap).toHaveBeenCalledWith(
      'dirty-switch-back-user',
      'java-backend',
      expect.objectContaining({ items: expect.objectContaining({ [firstId]: expect.objectContaining({ done: true }) }) })
    );
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

  // 'blank' is retired (issue #4 follow-up) — it's no longer special-cased,
  // so hiding it behaves like hiding any other id (harmless, since it's not
  // rendered as a card anymore either way).
  it('hiding "blank" is no longer special-cased — behaves like any other id', async () => {
    const store = createRoadmapStore();
    await store.setUser({ uid: 'hide-user-2' });

    await store.hideTemplate('blank');

    expect(store.getSnapshot().hiddenTemplateIds).toEqual(['blank']);
    expect(dbApi.saveMeta).toHaveBeenCalledWith('hide-user-2', { hiddenTemplateIds: ['blank'] });
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

// Favorite roadmaps (issue #177) — up to 3 ids (built-in or custom, no
// distinction), synced through the same meta path hiddenTemplateIds/
// customRoadmaps already use, so it gets the same multi-device sync
// guarantees for free.
describe('toggleFavoriteRoadmap (issue #177)', () => {
  it('favoriting persists to Firebase meta and the local snapshot', async () => {
    const store = createRoadmapStore();
    await store.setUser({ uid: 'fav-user' });

    const result = await store.toggleFavoriteRoadmap('frontend');

    expect(result).toEqual({ ok: true, capped: false });
    expect(store.getSnapshot().favoriteRoadmapIds).toEqual(['frontend']);
    expect(dbApi.saveMeta).toHaveBeenCalledWith('fav-user', { favoriteRoadmapIds: ['frontend'] });
  });

  it('toggling an already-favorited id removes it', async () => {
    const store = createRoadmapStore();
    await store.setUser({ uid: 'fav-user-2' });

    await store.toggleFavoriteRoadmap('frontend');
    const result = await store.toggleFavoriteRoadmap('frontend');

    expect(result).toEqual({ ok: true, capped: false });
    expect(store.getSnapshot().favoriteRoadmapIds).toEqual([]);
    expect(dbApi.saveMeta).toHaveBeenLastCalledWith('fav-user-2', { favoriteRoadmapIds: [] });
  });

  it('adds up to 3 and rejects a 4th as a no-op, without touching the existing 3', async () => {
    const store = createRoadmapStore();
    await store.setUser({ uid: 'fav-user-3' });

    await store.toggleFavoriteRoadmap('frontend');
    await store.toggleFavoriteRoadmap('data-science');
    await store.toggleFavoriteRoadmap('piano');
    const result = await store.toggleFavoriteRoadmap('marketing');

    expect(result).toEqual({ ok: false, capped: true });
    expect(store.getSnapshot().favoriteRoadmapIds).toEqual(['frontend', 'data-science', 'piano']);
  });

  it('works identically for a custom roadmap id — no distinction from a built-in template id', async () => {
    const store = createRoadmapStore();
    await store.setUser({ uid: 'fav-user-4' });

    const result = await store.toggleFavoriteRoadmap('croadmap-123-abc');

    expect(result).toEqual({ ok: true, capped: false });
    expect(store.getSnapshot().favoriteRoadmapIds).toEqual(['croadmap-123-abc']);
  });

  it('a favorite marked on one simulated device is readable from a fresh store instance pointed at the same uid (multi-device sync)', async () => {
    const fakeMetaByUid = { 'user-a': { onboardingDone: true, activeTemplateId: 'java-backend', startedTemplateIds: ['java-backend'] } };
    dbApi.getMeta.mockImplementation(uid => Promise.resolve(fakeMetaByUid[uid] || { onboardingDone: true, activeTemplateId: 'java-backend', startedTemplateIds: ['java-backend'] }));
    dbApi.saveMeta.mockImplementation((uid, patch) => {
      fakeMetaByUid[uid] = { ...fakeMetaByUid[uid], ...patch };
      return Promise.resolve();
    });

    const deviceOne = createRoadmapStore();
    await deviceOne.setUser({ uid: 'user-a' });
    await deviceOne.toggleFavoriteRoadmap('frontend');
    expect(fakeMetaByUid['user-a'].favoriteRoadmapIds).toEqual(['frontend']);

    // A fresh store instance, no shared localStorage — only Firebase meta,
    // scoped by uid, can carry the favorite across devices.
    localStorage.clear();
    const deviceTwo = createRoadmapStore();
    await deviceTwo.setUser({ uid: 'user-a' });
    expect(deviceTwo.getSnapshot().favoriteRoadmapIds).toEqual(['frontend']);
  });

  it('deleting a favorited custom roadmap also drops it from favoriteRoadmapIds', async () => {
    dbApi.saveRoadmap.mockResolvedValue(undefined);
    const store = createRoadmapStore();
    await store.setUser({ uid: 'fav-user-5' });
    const id = await store.createCustomRoadmap({ title: 'My roadmap' });

    await store.toggleFavoriteRoadmap(id);
    expect(store.getSnapshot().favoriteRoadmapIds).toEqual([id]);

    await store.deleteCustomRoadmap(id);
    expect(store.getSnapshot().favoriteRoadmapIds).toEqual([]);
  });
});

describe('tourDone / completeTour / resetTour (issue #17)', () => {
  it('a fresh account picking a template for the first time keeps tourDone false — no backfill, real auto-start signal', async () => {
    dbApi.getMeta.mockResolvedValue(null);
    const store = createRoadmapStore();
    await store.setUser({ uid: 'fresh-tour-user' });
    expect(store.getSnapshot().onboardingDone).toBe(false);

    await store.switchRoadmap('java-backend');

    expect(store.getSnapshot().tourDone).toBe(false);
  });

  it('an existing account with real progress and no tourDone field is backfilled to true — never auto-starts', async () => {
    dbApi.getMeta.mockResolvedValue({ onboardingDone: true, activeTemplateId: 'java-backend', startedTemplateIds: ['java-backend'] });
    dbApi.getRoadmap.mockResolvedValue({
      version: 3,
      items: { 'custom-1': { id: 'custom-1', title: 'Done thing', phase: 'Learn', section: '', priority: 'P1', done: true, custom: false, deleted: false, resources: [] } }
    });

    const store = createRoadmapStore();
    await store.setUser({ uid: 'existing-progress-user' });

    expect(store.getSnapshot().tourDone).toBe(true);
    expect(dbApi.saveMeta).toHaveBeenCalledWith('existing-progress-user', { tourDone: true });
  });

  it('an account onboarded via legacy migration is backfilled to true even with zero real progress', async () => {
    dbApi.getMeta.mockResolvedValue(null);
    dbApi.getLegacyRoadmap.mockResolvedValue({ version: 3, items: { a: { done: true } } });

    const store = createRoadmapStore();
    await store.setUser({ uid: 'legacy-migrated-user' });

    expect(store.getSnapshot().onboardingDone).toBe(true);
    expect(store.getSnapshot().tourDone).toBe(true);
  });

  it('an account with no real progress and a fresh (non-migrated) onboardingDone keeps tourDone false', async () => {
    dbApi.getMeta.mockResolvedValue({ onboardingDone: true, activeTemplateId: 'java-backend', startedTemplateIds: ['java-backend'] });
    dbApi.getRoadmap.mockResolvedValue({ version: 3, items: {} });

    const store = createRoadmapStore();
    await store.setUser({ uid: 'no-progress-user' });

    expect(store.getSnapshot().tourDone).toBe(false);
    expect(dbApi.saveMeta).not.toHaveBeenCalled();
  });

  it('remote tourDone: true always wins, regardless of local progress', async () => {
    dbApi.getMeta.mockResolvedValue({ onboardingDone: true, activeTemplateId: 'java-backend', startedTemplateIds: ['java-backend'], tourDone: true });
    dbApi.getRoadmap.mockResolvedValue({ version: 3, items: {} });

    const store = createRoadmapStore();
    await store.setUser({ uid: 'remote-tour-done-user' });

    expect(store.getSnapshot().tourDone).toBe(true);
  });

  it('completeTour() persists locally and remotely', async () => {
    const store = createRoadmapStore();
    await store.setUser({ uid: 'complete-tour-user' });
    expect(store.getSnapshot().tourDone).toBe(false);

    await store.completeTour();

    expect(store.getSnapshot().tourDone).toBe(true);
    expect(dbApi.saveMeta).toHaveBeenCalledWith('complete-tour-user', { tourDone: true });
  });

  it('resetTour() is in-memory only — no Firebase write until the tour is skipped/completed again', async () => {
    const store = createRoadmapStore();
    await store.setUser({ uid: 'reset-tour-user' });
    await store.completeTour();
    dbApi.saveMeta.mockClear();

    store.resetTour();

    expect(store.getSnapshot().tourDone).toBe(false);
    expect(dbApi.saveMeta).not.toHaveBeenCalled();
  });
});

// Manual roadmap creation (issue #4) — a user-authored roadmap has a
// generated `croadmap-...` id instead of a built-in template id, starts with
// zero phases/items, and its phase/section skeleton is fully mutable
// (unlike a built-in template's fixed PHASES).
describe('custom roadmaps — creation and identity (issue #4)', () => {
  it('isCustomRoadmapId distinguishes generated roadmap ids from built-in template ids', () => {
    const store = createRoadmapStore();
    expect(store.isCustomRoadmapId('java-backend')).toBe(false);
    expect(store.isCustomRoadmapId('blank')).toBe(false);
    expect(store.isCustomRoadmapId('croadmap-123-abc')).toBe(true);
  });

  it('createCustomRoadmap seeds an empty roadmap, activates it, and persists its meta to Firebase', async () => {
    const store = createRoadmapStore();
    await store.setUser({ uid: 'creator-user' });

    const id = await store.createCustomRoadmap({ title: '  My Roadmap  ', description: ' A description ' });

    expect(store.isCustomRoadmapId(id)).toBe(true);
    expect(store.getSnapshot().activeTemplateId).toBe(id);
    expect(store.getSnapshot().items).toEqual([]);
    expect(store.getSnapshot().phases).toEqual([]);
    expect(store.getSnapshot().customRoadmaps).toEqual([
      { id, title: 'My Roadmap', description: 'A description', createdAt: expect.any(Number) }
    ]);
    expect(store.getSnapshot().startedTemplateIds).toContain(id);
    // customRoadmaps is folded into switchRoadmap's own single meta write
    // (one round trip, not two — see switchRoadmap's "why extraMeta" note).
    expect(dbApi.saveMeta).toHaveBeenCalledWith('creator-user', {
      customRoadmaps: store.getSnapshot().customRoadmaps,
      activeTemplateId: id,
      startedTemplateIds: store.getSnapshot().startedTemplateIds,
      onboardingDone: true
    });
    expect(dbApi.saveMeta).toHaveBeenCalledTimes(1);
  });

  it('createCustomRoadmap rejects an empty title without mutating state', async () => {
    const store = createRoadmapStore();
    await store.setUser({ uid: 'creator-user-2' });
    const before = store.getSnapshot().customRoadmaps;

    await expect(store.createCustomRoadmap({ title: '   ' })).rejects.toThrow();
    expect(store.getSnapshot().customRoadmaps).toBe(before);
  });

  // Issue #324 — createCustomRoadmap() previously had no cap at all on how
  // many custom roadmaps one account could create.
  it('createCustomRoadmap rejects once MAX_CUSTOM_ROADMAPS is reached, tagging the error "capped"', async () => {
    const store = createRoadmapStore();
    await store.setUser({ uid: 'creator-user-cap' });

    for (let i = 0; i < MAX_CUSTOM_ROADMAPS; i++) {
      await store.createCustomRoadmap({ title: `Roadmap ${i}` });
    }
    expect(store.getSnapshot().customRoadmaps).toHaveLength(MAX_CUSTOM_ROADMAPS);

    const before = store.getSnapshot().customRoadmaps;
    let caught;
    try {
      await store.createCustomRoadmap({ title: 'One too many' });
    } catch (error) {
      caught = error;
    }
    expect(caught?.code).toBe('capped');
    expect(store.getSnapshot().customRoadmaps).toBe(before);
  });

  // Issue #324 — the cap must count only user-created custom roadmaps, never
  // the fixed set of built-in starter templates a user may have started.
  it('createCustomRoadmap\'s cap ignores started built-in templates entirely', async () => {
    const store = createRoadmapStore();
    await store.setUser({ uid: 'creator-user-builtin' });
    await store.switchRoadmap('frontend');
    await store.switchRoadmap('data-science');

    expect(store.getSnapshot().startedTemplateIds.length).toBeGreaterThanOrEqual(2);
    await expect(store.createCustomRoadmap({ title: 'Still allowed' })).resolves.toBeDefined();
  });

  // Issue #122 — firebase/database.rules.json now caps meta.customRoadmaps'
  // title/description server-side; this clamp (not a rejection) guarantees
  // createCustomRoadmap() can never produce a write that new rule rejects,
  // since a custom roadmap's title/description usually comes from
  // AI-generated import content rather than something a user typed.
  it('createCustomRoadmap clamps an oversized title/description to the server-side rule caps', async () => {
    const store = createRoadmapStore();
    await store.setUser({ uid: 'creator-user-clamp' });

    const id = await store.createCustomRoadmap({
      title: 'a'.repeat(MAX_CUSTOM_ROADMAP_TITLE_LENGTH + 50),
      description: 'b'.repeat(MAX_CUSTOM_ROADMAP_DESCRIPTION_LENGTH + 50)
    });

    const meta = store.getSnapshot().customRoadmaps.find(r => r.id === id);
    expect(meta.title).toHaveLength(MAX_CUSTOM_ROADMAP_TITLE_LENGTH);
    expect(meta.description).toHaveLength(MAX_CUSTOM_ROADMAP_DESCRIPTION_LENGTH);
  });

  it('a previously created custom roadmap is loaded back (not re-seeded) from Firebase meta on the next sign-in', async () => {
    dbApi.getMeta.mockResolvedValue({
      onboardingDone: true,
      activeTemplateId: 'croadmap-1-xyz',
      startedTemplateIds: ['java-backend', 'croadmap-1-xyz'],
      customRoadmaps: [{ id: 'croadmap-1-xyz', title: 'Existing', description: '', createdAt: 1 }]
    });
    dbApi.getRoadmap.mockImplementation((_uid, templateId) => (
      templateId === 'croadmap-1-xyz'
        ? Promise.resolve({ items: { a: { id: 'a', title: 'Topic', phase: 'P1', section: 'S1' } }, phases: [{ id: 'phase-1', title: 'P1', priority: 'P2', sections: [{ id: 'section-1', title: 'S1' }] }] })
        : Promise.resolve(null)
    ));

    const store = createRoadmapStore();
    await store.setUser({ uid: 'returning-creator' });

    expect(store.getSnapshot().activeTemplateId).toBe('croadmap-1-xyz');
    expect(store.getSnapshot().customRoadmaps).toEqual([{ id: 'croadmap-1-xyz', title: 'Existing', description: '', createdAt: 1 }]);
    expect(store.getSnapshot().phases).toEqual([{ id: 'phase-1', title: 'P1', priority: 'P2', sections: [{ id: 'section-1', title: 'S1' }] }]);
    expect(store.getSnapshot().items.map(i => i.id)).toEqual(['a']);
  });
});

describe('custom roadmaps — phase/section CRUD (issue #4)', () => {
  async function setupCustomRoadmap(uid) {
    const store = createRoadmapStore();
    await store.setUser({ uid });
    await store.createCustomRoadmap({ title: 'CRUD roadmap' });
    return store;
  }

  it('addPhase appends a phase with a stable id and bumps structuralVersion', async () => {
    vi.useFakeTimers();
    const store = await setupCustomRoadmap('phase-user');
    const before = store.getSnapshot().structuralVersion;

    store.addPhase('  Phase One  ');

    const phases = store.getSnapshot().phases;
    expect(phases).toHaveLength(1);
    expect(phases[0]).toMatchObject({ title: 'Phase One', priority: 'P2', sections: [] });
    expect(phases[0].id).toEqual(expect.any(String));
    expect(store.getSnapshot().structuralVersion).toBe(before + 1);
  });

  it('addPhase/addSection are a no-op on a built-in template', async () => {
    const store = createRoadmapStore();
    await store.setUser({ uid: 'builtin-guard-user' }); // active = java-backend, per default mock
    const phasesBefore = store.getSnapshot().phases;

    store.addPhase('Should not be added');

    expect(store.getSnapshot().phases).toBe(phasesBefore);
  });

  it('addSection appends a section under the given phase', async () => {
    vi.useFakeTimers();
    const store = await setupCustomRoadmap('section-user');
    store.addPhase('Phase One');
    const phaseId = store.getSnapshot().phases[0].id;

    store.addSection(phaseId, '  Section One  ');

    const sections = store.getSnapshot().phases[0].sections;
    expect(sections).toHaveLength(1);
    expect(sections[0]).toMatchObject({ title: 'Section One' });
  });

  it('renamePhase updates the phase title and re-files every item under the new title', async () => {
    vi.useFakeTimers();
    const store = await setupCustomRoadmap('rename-phase-user');
    store.addPhase('Old Name');
    const phaseId = store.getSnapshot().phases[0].id;
    store.addSection(phaseId, 'Section');
    store.addItem({ title: 'Topic', phase: 'Old Name', section: 'Section', priority: 'P2' });

    store.renamePhase(phaseId, 'New Name');

    expect(store.getSnapshot().phases[0].title).toBe('New Name');
    expect(store.getSnapshot().items[0].phase).toBe('New Name');
  });

  it('removePhase deletes the phase and soft-deletes every item filed under it', async () => {
    vi.useFakeTimers();
    const store = await setupCustomRoadmap('remove-phase-user');
    store.addPhase('Doomed Phase');
    const phaseId = store.getSnapshot().phases[0].id;
    store.addSection(phaseId, 'Section');
    store.addItem({ title: 'Topic', phase: 'Doomed Phase', section: 'Section', priority: 'P2' });
    const itemId = store.getSnapshot().items[0].id;

    store.removePhase(phaseId);

    expect(store.getSnapshot().phases).toEqual([]);
    expect(store.getSnapshot().items).toEqual([]); // soft-deleted items are filtered out of the visible snapshot
    expect(store.getSnapshot().allItems[itemId].deleted).toBe(true);
  });

  it('renameSection re-files items under a phase+section pair to the new section title', async () => {
    vi.useFakeTimers();
    const store = await setupCustomRoadmap('rename-section-user');
    store.addPhase('Phase');
    const phaseId = store.getSnapshot().phases[0].id;
    store.addSection(phaseId, 'Old Section');
    const sectionId = store.getSnapshot().phases[0].sections[0].id;
    store.addItem({ title: 'Topic', phase: 'Phase', section: 'Old Section', priority: 'P2' });

    store.renameSection(phaseId, sectionId, 'New Section');

    expect(store.getSnapshot().phases[0].sections[0].title).toBe('New Section');
    expect(store.getSnapshot().items[0].section).toBe('New Section');
  });

  it('removeSection deletes the section and soft-deletes every item filed under it, leaving sibling sections intact', async () => {
    vi.useFakeTimers();
    const store = await setupCustomRoadmap('remove-section-user');
    store.addPhase('Phase');
    const phaseId = store.getSnapshot().phases[0].id;
    store.addSection(phaseId, 'Keep');
    store.addSection(phaseId, 'Doomed');
    const doomedSectionId = store.getSnapshot().phases[0].sections[1].id;
    store.addItem({ title: 'Topic', phase: 'Phase', section: 'Doomed', priority: 'P2' });

    store.removeSection(phaseId, doomedSectionId);

    expect(store.getSnapshot().phases[0].sections).toHaveLength(1);
    expect(store.getSnapshot().phases[0].sections[0].title).toBe('Keep');
    expect(store.getSnapshot().items).toEqual([]);
  });
});

describe('deleteCustomRoadmap (issue #4)', () => {
  it('removes the roadmap from customRoadmaps/startedTemplateIds and deletes its Firebase node', async () => {
    const store = createRoadmapStore();
    await store.setUser({ uid: 'delete-user' });
    const id = await store.createCustomRoadmap({ title: 'To delete' });
    await store.switchRoadmap('java-backend'); // make it inactive first

    await store.deleteCustomRoadmap(id);

    expect(store.getSnapshot().customRoadmaps).toEqual([]);
    expect(store.getSnapshot().startedTemplateIds).not.toContain(id);
    expect(dbApi.deleteRoadmap).toHaveBeenCalledWith('delete-user', id);
  });

  it('deleting the currently-active custom roadmap switches to the default built-in template first', async () => {
    const store = createRoadmapStore();
    await store.setUser({ uid: 'delete-active-user' });
    const id = await store.createCustomRoadmap({ title: 'Active one' });
    expect(store.getSnapshot().activeTemplateId).toBe(id);

    await store.deleteCustomRoadmap(id);

    expect(store.getSnapshot().activeTemplateId).toBe('java-backend');
    expect(store.getSnapshot().customRoadmaps).toEqual([]);
  });

  it('is a no-op on a built-in template id', async () => {
    const store = createRoadmapStore();
    await store.setUser({ uid: 'delete-guard-user' });

    await store.deleteCustomRoadmap('java-backend');

    expect(dbApi.deleteRoadmap).not.toHaveBeenCalled();
    expect(store.getSnapshot().activeTemplateId).toBe('java-backend');
  });
});

// AI-assisted import (issue #4): createCustomRoadmap's optional phases/items
// seed the roadmap already populated instead of empty — everything else
// (activation, Firebase path, cache-first resolution) is identical to the
// manual-creation path already covered above.
describe('custom roadmaps — AI-import seeding (issue #4)', () => {
  function importedSeed() {
    return {
      phases: [{ id: 'phase-import-1', title: 'Phase One', priority: 'P1', resourceKey: null, sections: [{ id: 'section-import-1', title: 'Section One' }] }],
      items: {
        'custom-import-1': { id: 'custom-import-1', title: 'Imported Topic', phase: 'Phase One', section: 'Section One', priority: 'P0', done: false, custom: true, deleted: false, resources: [], createdAt: 1 }
      }
    };
  }

  it('activates the new roadmap already populated with the given phases/items', async () => {
    const store = createRoadmapStore();
    await store.setUser({ uid: 'import-user' });
    const { phases: seedPhases, items: seedItems } = importedSeed();

    const id = await store.createCustomRoadmap({ title: 'Imported Roadmap', phases: seedPhases, items: seedItems });

    expect(store.getSnapshot().activeTemplateId).toBe(id);
    expect(store.getSnapshot().phases).toEqual(seedPhases);
    expect(store.getSnapshot().items.map(i => i.id)).toEqual(['custom-import-1']);
  });

  it('persists the seeded phases/items to Firebase once the debounced flush fires', async () => {
    vi.useFakeTimers();
    const store = createRoadmapStore();
    await store.setUser({ uid: 'import-flush-user' });
    const { phases: seedPhases, items: seedItems } = importedSeed();

    await store.createCustomRoadmap({ title: 'Imported Roadmap', phases: seedPhases, items: seedItems });
    await vi.advanceTimersByTimeAsync(600);

    expect(dbApi.saveRoadmap).toHaveBeenCalledWith(
      'import-flush-user',
      store.getSnapshot().activeTemplateId,
      expect.objectContaining({ phases: seedPhases, items: seedItems })
    );
    vi.useRealTimers();
  });

  it('omitting phases/items still seeds a truly empty roadmap (manual-creation path is unaffected)', async () => {
    const store = createRoadmapStore();
    await store.setUser({ uid: 'manual-still-empty-user' });

    await store.createCustomRoadmap({ title: 'Manual Roadmap' });

    expect(store.getSnapshot().phases).toEqual([]);
    expect(store.getSnapshot().items).toEqual([]);
  });

  it('the seed is consumed exactly once — switching away and back reloads from the cache/Firebase, not the original seed object', async () => {
    const store = createRoadmapStore();
    await store.setUser({ uid: 'import-reswitch-user' });
    const { phases: seedPhases, items: seedItems } = importedSeed();
    const id = await store.createCustomRoadmap({ title: 'Imported Roadmap', phases: seedPhases, items: seedItems });

    await store.switchRoadmap('java-backend');
    await store.switchRoadmap(id); // already started -> cache-first resolution, not the seed path again

    expect(store.getSnapshot().phases).toEqual(seedPhases);
    expect(store.getSnapshot().items.map(i => i.id)).toEqual(['custom-import-1']);
  });
});

// "blank" was retired (issue #4 follow-up) — once manual CRUD (PR #60) and AI
// import (this PR) both existed, it became a strict subset of "Create your
// own roadmap" (fixed Learn/Practice/Build/Review vs. fully editable). Anyone
// who already started it before this shipped is migrated forward into a
// real custom roadmap on their next sign-in instead of losing access to it.
describe('blank-template migration (issue #4 follow-up)', () => {
  it('migrates an active "blank" roadmap into a real custom roadmap, preserving its items and phases', async () => {
    dbApi.getMeta.mockResolvedValue({ onboardingDone: true, activeTemplateId: 'blank', startedTemplateIds: ['blank'] });
    const storedItems = { 'custom-1': { id: 'custom-1', title: 'My topic', phase: 'Learn', section: '', priority: 'P1', done: false, custom: true, deleted: false, resources: [] } };
    const storedPhases = [{ id: 'phase-x', title: 'Learn', priority: 'P1', resourceKey: null, sections: [{ id: 'section-x', title: '' }] }];
    dbApi.getRoadmap.mockImplementation((_uid, templateId) => (
      templateId === 'blank' ? Promise.resolve({ version: 3, items: storedItems, phases: storedPhases }) : Promise.resolve(null)
    ));

    const store = createRoadmapStore();
    await store.setUser({ uid: 'blank-user' });

    const snapshot = store.getSnapshot();
    expect(snapshot.activeTemplateId).not.toBe('blank');
    expect(store.isCustomRoadmapId(snapshot.activeTemplateId)).toBe(true);
    expect(snapshot.startedTemplateIds).not.toContain('blank');
    expect(snapshot.startedTemplateIds).toContain(snapshot.activeTemplateId);
    expect(snapshot.allItems).toEqual(storedItems);
    expect(snapshot.phases).toEqual(storedPhases);
    expect(snapshot.customRoadmaps).toEqual([
      { id: snapshot.activeTemplateId, title: 'My roadmap', description: '', createdAt: expect.any(Number) }
    ]);

    // The old path is preserved, never deleted.
    expect(dbApi.deleteRoadmap).not.toHaveBeenCalled();
    // The corrected pointers are persisted so the next sign-in doesn't re-migrate.
    expect(dbApi.saveMeta).toHaveBeenCalledWith('blank-user', expect.objectContaining({
      activeTemplateId: snapshot.activeTemplateId,
      startedTemplateIds: [snapshot.activeTemplateId],
      onboardingDone: true
    }));
    expect(dbApi.saveRoadmap).toHaveBeenCalledWith(
      'blank-user',
      snapshot.activeTemplateId,
      expect.objectContaining({ items: storedItems, phases: storedPhases })
    );
  });

  it('migrates a started-but-not-active "blank" without switching the currently active roadmap', async () => {
    dbApi.getMeta.mockResolvedValue({ onboardingDone: true, activeTemplateId: 'java-backend', startedTemplateIds: ['java-backend', 'blank'] });
    dbApi.getRoadmap.mockImplementation((_uid, templateId) => (
      templateId === 'blank' ? Promise.resolve({ version: 3, items: {}, phases: [] }) : Promise.resolve(null)
    ));

    const store = createRoadmapStore();
    await store.setUser({ uid: 'started-not-active-user' });

    const snapshot = store.getSnapshot();
    expect(snapshot.activeTemplateId).toBe('java-backend');
    expect(snapshot.startedTemplateIds).not.toContain('blank');
    expect(snapshot.startedTemplateIds).toContain('java-backend');
    expect(snapshot.customRoadmaps).toHaveLength(1);
    expect(store.isCustomRoadmapId(snapshot.customRoadmaps[0].id)).toBe(true);
  });

  it("falls back to blank.js's own 4 fixed phases when the stored roadmap predates persisted phases (pre-PR-#60)", async () => {
    dbApi.getMeta.mockResolvedValue({ onboardingDone: true, activeTemplateId: 'blank', startedTemplateIds: ['blank'] });
    const storedItems = { 'custom-1': { id: 'custom-1', title: 'Old topic', phase: 'Learn', section: '', priority: 'P1', done: false, custom: true, deleted: false, resources: [] } };
    dbApi.getRoadmap.mockImplementation((_uid, templateId) => (
      templateId === 'blank' ? Promise.resolve({ version: 1, items: storedItems }) : Promise.resolve(null) // no `phases` field
    ));

    const store = createRoadmapStore();
    await store.setUser({ uid: 'pre-60-blank-user' });

    const snapshot = store.getSnapshot();
    expect(snapshot.allItems).toEqual(storedItems);
    expect(snapshot.phases).toHaveLength(4);
    expect(snapshot.phases.map(p => p.title)).toEqual(['Learn', 'Practice', 'Build', 'Review']);
  });

  it('falls back to a fully empty seed when nothing was ever stored for "blank" (picked but never flushed)', async () => {
    dbApi.getMeta.mockResolvedValue({ onboardingDone: true, activeTemplateId: 'blank', startedTemplateIds: ['blank'] });
    dbApi.getRoadmap.mockResolvedValue(null);

    const store = createRoadmapStore();
    await store.setUser({ uid: 'never-flushed-blank-user' });

    const snapshot = store.getSnapshot();
    expect(snapshot.allItems).toEqual({});
    expect(snapshot.phases).toHaveLength(4);
  });

  it('does not re-migrate (or duplicate the custom roadmap) on a later sign-in once meta has been corrected', async () => {
    dbApi.getMeta.mockResolvedValue({ onboardingDone: true, activeTemplateId: 'blank', startedTemplateIds: ['blank'] });
    dbApi.getRoadmap.mockImplementation((_uid, templateId) => (
      templateId === 'blank' ? Promise.resolve({ version: 3, items: {}, phases: [] }) : Promise.resolve(null)
    ));

    const store = createRoadmapStore();
    await store.setUser({ uid: 'resign-in-user' });
    const migratedId = store.getSnapshot().activeTemplateId;
    expect(store.getSnapshot().customRoadmaps).toHaveLength(1);

    // Simulate the corrected meta this migration itself just persisted, on a fresh sign-in.
    dbApi.getMeta.mockResolvedValue({
      onboardingDone: true,
      activeTemplateId: migratedId,
      startedTemplateIds: [migratedId],
      customRoadmaps: store.getSnapshot().customRoadmaps
    });

    const store2 = createRoadmapStore();
    await store2.setUser({ uid: 'resign-in-user' });

    expect(store2.getSnapshot().activeTemplateId).toBe(migratedId);
    expect(store2.getSnapshot().customRoadmaps).toHaveLength(1); // not duplicated
  });
});

// Extracted from inside attachRoadmapListener's onValue callback (issue #53) —
// a pure function so the remote-merge decision (echo detection, structural
// version bump) can be unit-tested without a real Firebase listener.
describe('applyRemoteSnapshot (issue #53)', () => {
  it('returns null when the remote payload has no items', () => {
    expect(applyRemoteSnapshot({}, {}, [], [])).toBeNull();
    expect(applyRemoteSnapshot(null, {}, [], [])).toBeNull();
  });

  // Mirrors roadmapStore.js's internal stableStringify (key-order-independent,
  // since Realtime Database returns keys sorted) so this test can construct a
  // string that matches what applyRemoteSnapshot computes internally.
  function stableStringify(value) {
    if (Array.isArray(value)) return `[${value.map(stableStringify).join(',')}]`;
    if (value && typeof value === 'object') {
      return `{${Object.keys(value).sort().map(key => `${JSON.stringify(key)}:${stableStringify(value[key])}`).join(',')}}`;
    }
    return JSON.stringify(value);
  }

  it('returns null (a no-op) when the remote payload matches a recent flush of our own', () => {
    const items = { a: { id: 'a', title: 'A' } };
    const phases = [{ id: 'p1', title: 'Phase 1' }];
    const flushedStr = stableStringify({ items, phases });
    const result = applyRemoteSnapshot({ items, phases }, {}, [], [flushedStr]);
    expect(result).toBeNull();
  });

  it('flags structuralVersionBumped when remote items differ from current items', () => {
    const currentItems = { a: { id: 'a', title: 'A', done: false } };
    const remote = { items: { a: { id: 'a', title: 'A', done: true } } };
    const result = applyRemoteSnapshot(remote, currentItems, [], []);
    expect(result).not.toBeNull();
    expect(result.structuralVersionBumped).toBe(true);
    expect(result.items).toEqual(remote.items);
  });

  it('does not flag structuralVersionBumped when remote items are identical to current items', () => {
    const currentItems = { a: { id: 'a', title: 'A', done: false } };
    const remote = { items: { a: { id: 'a', title: 'A', done: false } } };
    const result = applyRemoteSnapshot(remote, currentItems, [], []);
    expect(result).not.toBeNull();
    expect(result.structuralVersionBumped).toBe(false);
  });

  it('falls back to the current phases when the remote payload omits phases', () => {
    const currentPhases = [{ id: 'p1', title: 'Phase 1' }];
    const remote = { items: { a: { id: 'a' } } };
    const result = applyRemoteSnapshot(remote, {}, currentPhases, []);
    expect(result.phases).toBe(currentPhases);
  });
});

// Client-side length caps (issue #53) — the client half of issue #24's
// server-side Firebase rules validation.
describe('client-side length caps (issue #53)', () => {
  function firstItemId(store) {
    return Object.keys(store.getSnapshot().allItems)[0];
  }

  it('addItem() rejects a title over the max length', () => {
    vi.useFakeTimers();
    const store = createRoadmapStore();
    const before = store.getSnapshot().structuralVersion;
    const ok = store.addItem({
      title: 'x'.repeat(MAX_TITLE_LENGTH + 1),
      phase: 'Java Core',
      section: 'Basics',
      priority: 'high'
    });
    expect(ok).toBe(false);
    expect(store.getSnapshot().structuralVersion).toBe(before);
  });

  it('addItem() accepts a title at exactly the max length', () => {
    vi.useFakeTimers();
    const store = createRoadmapStore();
    const ok = store.addItem({
      title: 'x'.repeat(MAX_TITLE_LENGTH),
      phase: 'Java Core',
      section: 'Basics',
      priority: 'high'
    });
    expect(ok).toBe(true);
  });

  it('updateItem() rejects a title patch over the max length', () => {
    vi.useFakeTimers();
    const store = createRoadmapStore();
    const id = firstItemId(store);
    const originalTitle = store.getSnapshot().allItems[id].title;
    const ok = store.updateItem(id, { title: 'x'.repeat(MAX_TITLE_LENGTH + 1) });
    expect(ok).toBe(false);
    expect(store.getSnapshot().allItems[id].title).toBe(originalTitle);
  });

  it('updateItem() rejects an empty title patch', () => {
    vi.useFakeTimers();
    const store = createRoadmapStore();
    const id = firstItemId(store);
    const ok = store.updateItem(id, { title: '   ' });
    expect(ok).toBe(false);
  });

  it('updateItem() rejects a resource with an over-length label', () => {
    vi.useFakeTimers();
    const store = createRoadmapStore();
    const id = firstItemId(store);
    const originalResources = store.getSnapshot().allItems[id].resources;
    const ok = store.updateItem(id, {
      resources: [{ label: 'x'.repeat(MAX_RESOURCE_LABEL_LENGTH + 1), url: 'https://example.com' }]
    });
    expect(ok).toBe(false);
    expect(store.getSnapshot().allItems[id].resources).toBe(originalResources);
  });

  it('updateItem() rejects a resource with an over-length url', () => {
    vi.useFakeTimers();
    const store = createRoadmapStore();
    const id = firstItemId(store);
    const ok = store.updateItem(id, {
      resources: [{ label: 'Docs', url: `https://example.com/${'x'.repeat(MAX_RESOURCE_URL_LENGTH)}` }]
    });
    expect(ok).toBe(false);
  });

  it('updateItem() accepts resources within the length caps', () => {
    vi.useFakeTimers();
    const store = createRoadmapStore();
    const id = firstItemId(store);
    const ok = store.updateItem(id, { resources: [{ label: 'Docs', url: 'https://example.com' }] });
    expect(ok).toBe(true);
    expect(store.getSnapshot().allItems[id].resources).toHaveLength(1);
  });

  it('addResource() rejects an over-length resource and does not mutate the item', () => {
    vi.useFakeTimers();
    const store = createRoadmapStore();
    store.addItem({ title: 'Fresh topic', phase: 'Java Core', section: 'Basics', priority: 'high' });
    const id = Object.keys(store.getSnapshot().allItems).find(itemId => itemId.startsWith('custom-'));
    const ok = store.addResource(id, { label: 'x'.repeat(MAX_RESOURCE_LABEL_LENGTH + 1), url: 'https://example.com' });
    expect(ok).toBe(false);
    expect(store.getSnapshot().allItems[id].resources).toHaveLength(0);
  });

  it('updateResource() rejects an over-length replacement resource', () => {
    vi.useFakeTimers();
    const store = createRoadmapStore();
    store.addItem({ title: 'Fresh topic', phase: 'Java Core', section: 'Basics', priority: 'high' });
    const id = Object.keys(store.getSnapshot().allItems).find(itemId => itemId.startsWith('custom-'));
    store.addResource(id, { label: 'Docs', url: 'https://example.com' });
    const ok = store.updateResource(id, 0, { label: 'Docs', url: `https://example.com/${'x'.repeat(MAX_RESOURCE_URL_LENGTH)}` });
    expect(ok).toBe(false);
    expect(store.getSnapshot().allItems[id].resources[0].url).toBe('https://example.com');
  });
});

// issue #56 follow-up: a Daily Todo linked to a roadmap topic must be able
// to mark that topic done/not-done regardless of which template the user
// currently has open — see the extraction comment above
// setItemDoneInTemplate's definition in roadmapStore.js for the three cases
// (active / cached / cold-read) this covers.
describe('setItemDoneInTemplate — issue #56 follow-up', () => {
  it('active template: behaves like updateItem, bumps structuralVersion, and reports the item title', async () => {
    vi.useFakeTimers();
    const store = createRoadmapStore();
    await store.setUser({ uid: 'u1' });
    const id = Object.keys(store.getSnapshot().allItems)[0];
    const titleBefore = store.getSnapshot().allItems[id].title;
    const versionBefore = store.getSnapshot().structuralVersion;

    const result = await store.setItemDoneInTemplate('java-backend', id, true);

    expect(result).toEqual({ ok: true, title: titleBefore });
    expect(store.getSnapshot().allItems[id].done).toBe(true);
    expect(store.getSnapshot().allItems[id].completedViaTodoAt).toEqual(expect.any(Number));
    expect(store.getSnapshot().structuralVersion).toBeGreaterThan(versionBefore);
  });

  it('active template: unsetting clears completedViaTodoAt', async () => {
    vi.useFakeTimers();
    const store = createRoadmapStore();
    await store.setUser({ uid: 'u1' });
    const id = Object.keys(store.getSnapshot().allItems)[0];
    await store.setItemDoneInTemplate('java-backend', id, true);

    await store.setItemDoneInTemplate('java-backend', id, false);
    expect(store.getSnapshot().allItems[id].done).toBe(false);
    expect(store.getSnapshot().allItems[id].completedViaTodoAt).toBeNull();
  });

  it("active template: resolves ok:false for an id that doesn't exist", async () => {
    vi.useFakeTimers();
    const store = createRoadmapStore();
    await store.setUser({ uid: 'u1' });
    const result = await store.setItemDoneInTemplate('java-backend', 'nonexistent', true);
    expect(result).toEqual({ ok: false, title: null });
  });

  it('cached (visited this session, not active): patches roadmapCache and saves directly to that template\'s Firebase path, without touching the active template', async () => {
    vi.useFakeTimers();
    dbApi.getMeta.mockResolvedValue({ onboardingDone: true, activeTemplateId: 'java-backend', startedTemplateIds: ['java-backend', 'frontend'] });
    const store = createRoadmapStore();
    await store.setUser({ uid: 'u1' });

    await store.switchRoadmap('frontend'); // now cached
    const frontendId = Object.keys(store.getSnapshot().allItems)[0];
    await store.switchRoadmap('java-backend'); // frontend is cached but no longer active
    dbApi.saveRoadmap.mockClear();

    const activeVersionBefore = store.getSnapshot().structuralVersion;
    const result = await store.setItemDoneInTemplate('frontend', frontendId, true);

    expect(result.ok).toBe(true);
    expect(store.getSnapshot().activeTemplateId).toBe('java-backend'); // never switched
    expect(store.getSnapshot().structuralVersion).toBe(activeVersionBefore); // the on-screen template is untouched
    expect(dbApi.saveRoadmap).toHaveBeenCalledWith('u1', 'frontend', expect.objectContaining({
      templateId: 'frontend',
      items: expect.objectContaining({ [frontendId]: expect.objectContaining({ done: true }) })
    }));

    // Switching back to frontend picks up the cached, already-patched item —
    // never re-reads Firebase for a template visited this session.
    dbApi.getRoadmap.mockClear();
    await store.switchRoadmap('frontend');
    expect(store.getSnapshot().allItems[frontendId].done).toBe(true);
    expect(dbApi.getRoadmap).not.toHaveBeenCalled();
  });

  it('two concurrent setItemDoneInTemplate calls for different items on a cached (visited this session, not active) roadmap both persist via scoped per-item writes instead of racing a full items overwrite (issue #232)', async () => {
    dbApi.getMeta.mockResolvedValue({ onboardingDone: true, activeTemplateId: 'java-backend', startedTemplateIds: ['java-backend', 'frontend'] });
    const store = createRoadmapStore();
    await store.setUser({ uid: 'u1' });

    await store.switchRoadmap('frontend'); // caches frontend
    const ids = Object.keys(store.getSnapshot().allItems);
    const [itemA, itemB] = ids;
    await store.switchRoadmap('java-backend'); // frontend cached but no longer active
    dbApi.saveRoadmap.mockClear();

    // Simulates the race: updateRoadmapItemFields resolves on a later
    // microtask tick (not a real timer — a stray real setTimeout here can
    // collide with an unrelated test's leftover 500ms queueSave debounce
    // firing mid-assertion) so both calls' scoped writes are genuinely in
    // flight at once — against the old code (a full saveRoadmap({ items:
    // nextItems }) built from the shared cached.items snapshot) whichever
    // call's write landed last would silently drop the other item's completion.
    dbApi.updateRoadmapItemFields.mockImplementation((uid, templateId, itemId, fields) =>
      Promise.resolve().then(() => Promise.resolve()).then(() => ({ id: itemId, ...fields }))
    );

    const [resultA, resultB] = await Promise.all([
      store.setItemDoneInTemplate('frontend', itemA, true),
      store.setItemDoneInTemplate('frontend', itemB, true)
    ]);

    expect(resultA.ok).toBe(true);
    expect(resultB.ok).toBe(true);
    expect(dbApi.saveRoadmap).not.toHaveBeenCalled();
    expect(dbApi.updateRoadmapItemFields).toHaveBeenCalledWith('u1', 'frontend', itemA, expect.objectContaining({ done: true }));
    expect(dbApi.updateRoadmapItemFields).toHaveBeenCalledWith('u1', 'frontend', itemB, expect.objectContaining({ done: true }));

    // Both items retain their done:true state after the race resolves.
    dbApi.getRoadmap.mockClear();
    await store.switchRoadmap('frontend');
    expect(store.getSnapshot().allItems[itemA].done).toBe(true);
    expect(store.getSnapshot().allItems[itemB].done).toBe(true);
    expect(dbApi.getRoadmap).not.toHaveBeenCalled();
  });

  it('cold (never visited this session): one-shot reads Firebase, patches, and saves back', async () => {
    vi.useFakeTimers();
    dbApi.getRoadmap.mockImplementation((_uid, templateId) => (templateId === 'piano'
      ? Promise.resolve({ items: { 'piano-1': { id: 'piano-1', title: 'Scales', done: false } }, phases: [] })
      : Promise.resolve(null)));
    const store = createRoadmapStore();
    await store.setUser({ uid: 'u1' });

    const result = await store.setItemDoneInTemplate('piano', 'piano-1', true);

    expect(result).toEqual({ ok: true, title: 'Scales' });
    expect(dbApi.getRoadmap).toHaveBeenCalledWith('u1', 'piano');
    expect(dbApi.saveRoadmap).toHaveBeenCalledWith('u1', 'piano', expect.objectContaining({
      templateId: 'piano',
      items: expect.objectContaining({ 'piano-1': expect.objectContaining({ done: true }) })
    }));
    expect(store.getSnapshot().activeTemplateId).toBe('java-backend'); // never switched
  });

  it('cold: resolves ok:false when neither Firebase nor a local blob has the item (source topic/roadmap gone)', async () => {
    vi.useFakeTimers();
    dbApi.getRoadmap.mockResolvedValue(null);
    const store = createRoadmapStore();
    await store.setUser({ uid: 'u1' });

    const result = await store.setItemDoneInTemplate('piano', 'piano-1', true);
    expect(result).toEqual({ ok: false, title: null });
    expect(dbApi.saveRoadmap).not.toHaveBeenCalledWith('u1', 'piano', expect.anything());
  });

  // A soft-deleted item (removeItem()) still physically exists in the map —
  // just never rendered again — so without an explicit check it would look
  // "found" to every branch below and silently succeed with no visible
  // effect. See the linked-todo case: dailyTodoPanel.js's confirm dialog
  // says "This will also mark this topic done" — that must not become a
  // false promise for a topic the user removed after linking a todo to it.
  it('active template: resolves ok:false for a soft-deleted item', async () => {
    vi.useFakeTimers();
    const store = createRoadmapStore();
    await store.setUser({ uid: 'u1' });
    const id = Object.keys(store.getSnapshot().allItems)[0];
    store.removeItem(id);

    const result = await store.setItemDoneInTemplate('java-backend', id, true);
    expect(result).toEqual({ ok: false, title: null });
  });

  it('cached: resolves ok:false for a soft-deleted item, without a redundant Firebase read', async () => {
    vi.useFakeTimers();
    dbApi.getMeta.mockResolvedValue({ onboardingDone: true, activeTemplateId: 'java-backend', startedTemplateIds: ['java-backend', 'frontend'] });
    const store = createRoadmapStore();
    await store.setUser({ uid: 'u1' });

    await store.switchRoadmap('frontend');
    const frontendId = Object.keys(store.getSnapshot().allItems)[0];
    store.removeItem(frontendId);
    await store.switchRoadmap('java-backend');
    dbApi.getRoadmap.mockClear();

    const result = await store.setItemDoneInTemplate('frontend', frontendId, true);
    expect(result).toEqual({ ok: false, title: null });
    expect(dbApi.getRoadmap).not.toHaveBeenCalled(); // never falls through to a cold read
  });

  it('cold: resolves ok:false for a soft-deleted item read from Firebase', async () => {
    vi.useFakeTimers();
    dbApi.getRoadmap.mockImplementation((_uid, templateId) => (templateId === 'piano'
      ? Promise.resolve({ items: { 'piano-1': { id: 'piano-1', title: 'Scales', done: false, deleted: true } }, phases: [] })
      : Promise.resolve(null)));
    const store = createRoadmapStore();
    await store.setUser({ uid: 'u1' });

    const result = await store.setItemDoneInTemplate('piano', 'piano-1', true);
    expect(result).toEqual({ ok: false, title: null });
    expect(dbApi.saveRoadmap).not.toHaveBeenCalledWith('u1', 'piano', expect.anything());
  });
});

describe('lastReviewedAt — "Mark reviewed" store contract (issue #134)', () => {
  it('updateItem({ lastReviewedAt }) bumps structuralVersion, removes the item from getReviewDueItems(), and never touches done/completedAt', async () => {
    const store = createRoadmapStore();
    const firstId = Object.keys(store.getSnapshot().allItems)[0];
    const now = Date.now();
    const twentyDaysAgo = now - 20 * 24 * 60 * 60 * 1000;

    store.updateItem(firstId, { done: true });
    store.updateItem(firstId, { completedAt: twentyDaysAgo });
    const beforeVersion = store.getSnapshot().structuralVersion;

    const { getReviewDueItems } = await import('../../src/core/roadmap/reviewSchedule.js');
    expect(getReviewDueItems(store.getSnapshot().items, now).map(i => i.id)).toContain(firstId);

    const ok = store.updateItem(firstId, { lastReviewedAt: now });
    expect(ok).toBe(true);

    const snapshot = store.getSnapshot();
    expect(snapshot.structuralVersion).toBeGreaterThan(beforeVersion);
    expect(snapshot.items.find(i => i.id === firstId).lastReviewedAt).toBe(now);
    expect(snapshot.items.find(i => i.id === firstId).done).toBe(true);
    expect(snapshot.items.find(i => i.id === firstId).completedAt).toBe(twentyDaysAgo);
    expect(getReviewDueItems(snapshot.items, now).map(i => i.id)).not.toContain(firstId);
  });
});

describe('tags — item field store contract (issue #182)', () => {
  it('updateItem({ tags }) persists like notes and bumps structuralVersion', async () => {
    const store = createRoadmapStore();
    const firstId = Object.keys(store.getSnapshot().allItems)[0];
    const beforeVersion = store.getSnapshot().structuralVersion;

    const ok = store.updateItem(firstId, { tags: ['two-pointer', 'sliding-window'] });
    expect(ok).toBe(true);

    const snapshot = store.getSnapshot();
    expect(snapshot.structuralVersion).toBeGreaterThan(beforeVersion);
    expect(snapshot.items.find(i => i.id === firstId).tags).toEqual(['two-pointer', 'sliding-window']);
  });

  it('rejects a patch with more than MAX_TAGS_PER_ITEM tags, mutating nothing', async () => {
    const store = createRoadmapStore();
    const firstId = Object.keys(store.getSnapshot().allItems)[0];
    const before = store.getSnapshot().items.find(i => i.id === firstId).tags;

    const ok = store.updateItem(firstId, { tags: ['a', 'b', 'c', 'd', 'e', 'f'] });
    expect(ok).toBe(false);
    expect(store.getSnapshot().items.find(i => i.id === firstId).tags).toEqual(before);
  });

  it('rejects a tag over MAX_TAG_LENGTH characters', async () => {
    const store = createRoadmapStore();
    const firstId = Object.keys(store.getSnapshot().allItems)[0];
    const ok = store.updateItem(firstId, { tags: ['x'.repeat(31)] });
    expect(ok).toBe(false);
  });
});

// Issue #153 root cause #1 — two switchRoadmap()/createCustomRoadmap()/
// deleteCustomRoadmap() calls racing in back-to-back (the reported repro:
// importing two custom roadmaps within a few seconds) used to each compute
// `nextStartedTemplateIds` from the shared `startedTemplateIds` before
// either call had reassigned it — whichever call's saveMeta() write landed
// on Firebase last would silently erase the other's id via Realtime
// Database's whole-array `update()` replace. serializeMetaMutation() fixes
// this by chaining every meta-array mutation behind a single in-module
// queue; these tests fail against the pre-fix code (verified locally by
// reverting the serializeMetaMutation change and confirming saveMeta's
// second call reports only its own id) and pass against the fix.
// dbApi is a single module-level mock shared by every test in this file —
// filtering its .mock.calls by the uid under test (rather than asserting a
// raw, file-wide toHaveBeenCalledTimes()) keeps these assertions accurate
// regardless of call volume from any other store instance in this suite.
function callsForUid(mockFn, uid) {
  return mockFn.mock.calls.filter(args => args[0] === uid);
}

describe('lost-update race on startedTemplateIds/customRoadmaps — issue #153', () => {
  it('two overlapping createCustomRoadmap() calls both end up in startedTemplateIds and customRoadmaps, even when the first call\'s saveMeta() write is the slow one', async () => {
    const store = createRoadmapStore();
    await store.setUser({ uid: 'race-user' });

    let resolveFirstSaveMeta;
    let sawFirstCall = false;
    const saveMetaCalls = [];
    dbApi.saveMeta.mockImplementation((_uid, patch) => {
      saveMetaCalls.push(patch);
      if (!sawFirstCall) {
        sawFirstCall = true;
        return new Promise(resolve => { resolveFirstSaveMeta = resolve; });
      }
      return Promise.resolve();
    });

    const createA = store.createCustomRoadmap({ title: 'Roadmap A' });
    const createB = store.createCustomRoadmap({ title: 'Roadmap B' });

    // Give both calls' synchronous prefixes a chance to run and enqueue
    // their meta mutation before we let the first (slow) write settle —
    // this is exactly the "import two roadmaps back-to-back" repro shape.
    await Promise.resolve();
    await Promise.resolve();
    // Only one saveMeta call should have fired so far — the second call's
    // mutation is queued behind the first and must not have started yet.
    expect(saveMetaCalls.length).toBe(1);
    resolveFirstSaveMeta();

    const [idA, idB] = await Promise.all([createA, createB]);

    expect(store.getSnapshot().startedTemplateIds).toEqual(expect.arrayContaining([idA, idB]));
    expect(store.getSnapshot().customRoadmaps.map(r => r.id)).toEqual(expect.arrayContaining([idA, idB]));
    // The second (later-queued) saveMeta call is the one that actually
    // lands last, and it must carry both ids — never a stale subset.
    const lastCall = saveMetaCalls[saveMetaCalls.length - 1];
    expect(lastCall.startedTemplateIds).toEqual(expect.arrayContaining([idA, idB]));
  });

  it('a deleteCustomRoadmap() overlapping a createCustomRoadmap() never loses the created roadmap\'s id', async () => {
    const store = createRoadmapStore();
    await store.setUser({ uid: 'race-delete-user' });
    const existingId = await store.createCustomRoadmap({ title: 'Existing' });
    await store.switchRoadmap('java-backend'); // make it inactive so delete doesn't also switch

    let resolveFirstSaveMeta;
    let sawFirstCall = false;
    dbApi.saveMeta.mockImplementation(() => {
      if (!sawFirstCall) {
        sawFirstCall = true;
        return new Promise(resolve => { resolveFirstSaveMeta = resolve; });
      }
      return Promise.resolve();
    });

    const deleteExisting = store.deleteCustomRoadmap(existingId);
    const createNew = store.createCustomRoadmap({ title: 'New one' });

    await Promise.resolve();
    await Promise.resolve();
    resolveFirstSaveMeta();

    const newId = await createNew;
    await deleteExisting;

    expect(store.getSnapshot().customRoadmaps.map(r => r.id)).toEqual([newId]);
    expect(store.getSnapshot().startedTemplateIds).toContain(newId);
    expect(store.getSnapshot().startedTemplateIds).not.toContain(existingId);
  });
});

// Issue #153 root cause #3 — flush() used to read the shared
// items/templatePhases/activeTemplateId/dirty variables again *after* its
// own await adapter.saveRoadmap() — if a switchRoadmap() to a different
// template resolved while an earlier, slower flush() was still in flight,
// this stamped the NEW template's live data into the OLD template's
// roadmapCache slot, mislabeled dirty:false.
describe('flush() post-await state capture — issue #153 root cause #3', () => {
  it('a switchRoadmap() that completes while an earlier flush() is still in-flight never corrupts the outgoing template\'s roadmapCache entry', async () => {
    vi.useFakeTimers();
    const store = createRoadmapStore();
    await store.setUser({ uid: 'flush-capture-user' }); // java-backend

    const javaFirstId = Object.keys(store.getSnapshot().allItems)[0];

    let resolveSlowSave;
    dbApi.saveRoadmap.mockImplementation(() => new Promise(resolve => { resolveSlowSave = resolve; }));

    store.updateItem(javaFirstId, { done: true }); // dirty=true; schedules a debounced timer we never advance
    const slowFlush = store.flush(); // starts the slow write for java-backend, capturing done:true

    // Switch to a different template while the flush above is still awaiting
    // adapter.saveRoadmap() — this reassigns the shared items/templatePhases/
    // activeTemplateId/dirty before the flush's own await resolves.
    dbApi.saveRoadmap.mockImplementation(() => Promise.resolve());
    await store.switchRoadmap('piano');
    const pianoItems = { ...store.getSnapshot().allItems };

    resolveSlowSave();
    await slowFlush;

    // The write itself must have carried java-backend's own edit, not piano's data.
    const javaWrites = callsForUid(dbApi.saveRoadmap, 'flush-capture-user').filter(args => args[1] === 'java-backend');
    expect(javaWrites.length).toBeGreaterThan(0);
    expect(javaWrites[0][2]).toEqual(expect.objectContaining({
      items: expect.objectContaining({ [javaFirstId]: expect.objectContaining({ done: true }) })
    }));

    // Switching back to java-backend must load the real edit, not piano's data.
    await store.switchRoadmap('java-backend');
    expect(store.getSnapshot().allItems[javaFirstId].done).toBe(true);
    expect(store.getSnapshot().allItems).not.toEqual(pianoItems);

    // And piano's own state was never touched by the stale flush either.
    await store.switchRoadmap('piano');
    expect(store.getSnapshot().allItems).toEqual(pianoItems);
    // updateItem() above queued a debounced save timer that was never
    // advanced (deliberately, so it wouldn't interfere with the manual
    // flush() call this test drives directly) — clear it explicitly rather
    // than leaving it pending, or a later test's own advanceTimersByTimeAsync
    // could inadvertently fire this store's leftover callback too.
    vi.clearAllTimers();
    vi.useRealTimers();
  });
});

// Issue #153 root cause #2 — a failed flush() used to be a dead end: nothing
// ever re-queued a save, even though dashboard.js's badge claimed "Save
// failed — retrying…". scheduleSaveRetry() (roadmapStore.js) now backs that
// claim with real exponential-backoff retries.
describe('automatic save retry with backoff — issue #153 root cause #2', () => {
  it('a failed debounced save is automatically retried, and eventually succeeds once the failure clears', async () => {
    vi.useFakeTimers();
    const store = createRoadmapStore();
    await store.setUser({ uid: 'retry-user' });

    let lastSnapshot = null;
    store.subscribe(snapshot => { lastSnapshot = snapshot; });

    // Scoped to this test's own uid (not a shared .mockRejectedValueOnce()
    // FIFO queue on the module-level dbApi mock) so an unrelated store
    // instance elsewhere in this suite calling the same mock can never
    // consume the "fail once" behavior meant for this call.
    let failedOnce = false;
    dbApi.saveRoadmap.mockImplementation(uid => {
      if (uid !== 'retry-user') return Promise.resolve();
      if (!failedOnce) {
        failedOnce = true;
        return Promise.reject(new Error('network error'));
      }
      return Promise.resolve();
    });

    const firstId = Object.keys(store.getSnapshot().allItems)[0];
    store.updateItem(firstId, { done: true });

    await vi.advanceTimersByTimeAsync(500); // debounce fires, first attempt fails
    expect(lastSnapshot.saveState).toBe('error');
    expect(lastSnapshot.retryAttempt).toBe(1);
    expect(callsForUid(dbApi.saveRoadmap, 'retry-user').length).toBe(1);

    await vi.advanceTimersByTimeAsync(2000); // first retry backoff (2s)
    expect(callsForUid(dbApi.saveRoadmap, 'retry-user').length).toBe(2);
    expect(lastSnapshot.saveState).toBe('saved');

    vi.clearAllTimers();
    vi.useRealTimers();
  });

  it('retrySaveNow() forces an immediate retry instead of waiting out the backoff delay', async () => {
    vi.useFakeTimers();
    const store = createRoadmapStore();
    await store.setUser({ uid: 'retry-now-user' });

    let lastSnapshot = null;
    store.subscribe(snapshot => { lastSnapshot = snapshot; });

    let failedOnce = false;
    dbApi.saveRoadmap.mockImplementation(uid => {
      if (uid !== 'retry-now-user') return Promise.resolve();
      if (!failedOnce) {
        failedOnce = true;
        return Promise.reject(new Error('network error'));
      }
      return Promise.resolve();
    });

    const firstId = Object.keys(store.getSnapshot().allItems)[0];
    store.updateItem(firstId, { done: true });
    await vi.advanceTimersByTimeAsync(500);
    expect(lastSnapshot.saveState).toBe('error');

    // Still under fake timers here, deliberately — retrySaveNow() itself
    // clearTimeout()s the pending backoff timer synchronously, so calling it
    // while that timer still belongs to the active fake clock actually
    // cancels it. Switching to real timers first would leave that fake
    // timer dangling (clearTimeout on a since-uninstalled fake id is a
    // no-op), which a later test's own advanceTimersByTimeAsync could then
    // inadvertently fire.
    await store.retrySaveNow();
    vi.clearAllTimers();
    vi.useRealTimers();

    expect(callsForUid(dbApi.saveRoadmap, 'retry-now-user').length).toBe(2);
    expect(lastSnapshot.saveState).toBe('saved');
  });
});
