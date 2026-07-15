import { describe, it, expect, beforeEach, vi } from 'vitest';
import { createActivityLogStore, pruneOldEntries } from '../../src/services/activityLogStore.js';
import { getStorageAdapter, dbApi } from '../../src/services/storage/adapterFactory.js';
import { KEYS } from '../../src/services/localStorageKeys.js';

// Same fake-adapter approach as tests/integration/dailyTodoStore.test.js —
// getStorageAdapter is itself a vi.fn() so tests can assert on calls.
vi.mock('../../src/services/storage/adapterFactory.js', () => {
  const dbApi = {
    listenActivityLog: vi.fn((_uid, onData) => { onData(null); return () => {}; }),
    saveActivityLog: vi.fn(() => Promise.resolve()),
    listenStreakFreezes: vi.fn((_uid, onData) => { onData(null); return () => {}; }),
    saveStreakFreezes: vi.fn(() => Promise.resolve())
  };
  return { getStorageAdapter: vi.fn(() => dbApi), dbApi };
});

beforeEach(() => {
  localStorage.clear();
  vi.resetAllMocks();
  vi.useRealTimers();
  getStorageAdapter.mockImplementation(() => dbApi);
  dbApi.listenActivityLog.mockImplementation((_uid, onData) => { onData(null); return () => {}; });
  dbApi.saveActivityLog.mockResolvedValue(undefined);
  dbApi.listenStreakFreezes.mockImplementation((_uid, onData) => { onData(null); return () => {}; });
  dbApi.saveStreakFreezes.mockResolvedValue(undefined);
});

describe('subscribe / notify cycle', () => {
  it('calls callback immediately on subscribe', () => {
    const store = createActivityLogStore();
    const snapshots = [];
    const unsub = store.subscribe(s => snapshots.push(s));
    expect(snapshots).toHaveLength(1);
    expect(snapshots[0].entries).toEqual({});
    unsub();
  });
});

describe('recordCompletion / recordUncompletion', () => {
  it('increments the current day on completion', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 6, 4).getTime()); // 2026-07-04
    const store = createActivityLogStore();
    await store.setUser({ uid: 'u1' });

    store.recordCompletion();
    store.recordCompletion();
    expect(store.getSnapshot().entries['2026-07-04']).toBe(2);
    vi.useRealTimers();
  });

  it('decrements on uncompletion, floored at 0', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 6, 4).getTime());
    const store = createActivityLogStore();
    await store.setUser({ uid: 'u1' });

    store.recordCompletion();
    store.recordUncompletion();
    expect(store.getSnapshot().entries['2026-07-04']).toBe(0);

    store.recordUncompletion();
    expect(store.getSnapshot().entries['2026-07-04']).toBe(0);
    vi.useRealTimers();
  });

  it('never mutates a historical day — only ever touches the current day', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 6, 3).getTime());
    const store = createActivityLogStore();
    await store.setUser({ uid: 'u1' });
    store.recordCompletion();
    expect(store.getSnapshot().entries['2026-07-03']).toBe(1);

    vi.setSystemTime(new Date(2026, 6, 4).getTime());
    store.recordCompletion();
    expect(store.getSnapshot().entries['2026-07-03']).toBe(1);
    expect(store.getSnapshot().entries['2026-07-04']).toBe(1);
    vi.useRealTimers();
  });
});

describe('pruneOldEntries', () => {
  it('drops entries older than 365 days', () => {
    const now = new Date(2026, 6, 4).getTime();
    const entries = { '2024-01-01': 3, '2025-07-04': 2, '2026-07-04': 1 };
    const pruned = pruneOldEntries(entries, now);
    // '2025-07-04' is exactly 365 days before '2026-07-04' — the boundary
    // itself is kept (see the boundary test below); only the clearly older
    // '2024-01-01' entry is dropped.
    expect(pruned).toEqual({ '2025-07-04': 2, '2026-07-04': 1 });
  });

  it('keeps entries exactly at the boundary', () => {
    const now = new Date(2026, 6, 4).getTime();
    const cutoff = new Date(2026, 6, 4);
    cutoff.setDate(cutoff.getDate() - 365);
    const cutoffKey = `${cutoff.getFullYear()}-${String(cutoff.getMonth() + 1).padStart(2, '0')}-${String(cutoff.getDate()).padStart(2, '0')}`;
    const pruned = pruneOldEntries({ [cutoffKey]: 5 }, now);
    expect(pruned[cutoffKey]).toBe(5);
  });

  it('is applied on setUser (via local load)', async () => {
    localStorage.setItem(KEYS.ACTIVITY_LOG, JSON.stringify({
      dirty: false,
      entries: { '2020-01-01': 4, '2026-07-04': 1 }
    }));
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 6, 4).getTime());
    const store = createActivityLogStore();
    await store.setUser({ uid: 'u1' });
    expect(store.getSnapshot().entries).toEqual({ '2026-07-04': 1 });
    vi.useRealTimers();
  });
});

describe('persistence', () => {
  it('persists to localStorage under KEYS.ACTIVITY_LOG within the debounce window', async () => {
    vi.useFakeTimers();
    const store = createActivityLogStore();
    await store.setUser({ uid: 'u1' });
    store.recordCompletion();

    const raw = JSON.parse(localStorage.getItem(KEYS.ACTIVITY_LOG));
    expect(raw.dirty).toBe(true);
    expect(Object.values(raw.entries).reduce((a, b) => a + b, 0)).toBe(1);

    await vi.advanceTimersByTimeAsync(600);
    expect(dbApi.saveActivityLog).toHaveBeenCalledTimes(1);
    vi.useRealTimers();
  });
});

describe('sign-out privacy guard', () => {
  it('clears local data on a uid transition', async () => {
    const store = createActivityLogStore();
    await store.setUser({ uid: 'u1' });
    store.recordCompletion();
    expect(Object.keys(store.getSnapshot().entries)).toHaveLength(1);

    await store.setUser({ uid: 'u2' });
    expect(store.getSnapshot().entries).toEqual({});
    expect(localStorage.getItem(KEYS.ACTIVITY_LOG)).toBeNull();
  });

  it('clears local data on sign-out (uid -> null)', async () => {
    const store = createActivityLogStore();
    await store.setUser({ uid: 'u1' });
    store.recordCompletion();

    await store.setUser(null);
    expect(store.getSnapshot().entries).toEqual({});
    expect(localStorage.getItem(KEYS.ACTIVITY_LOG)).toBeNull();
  });

  it('clears streak-freeze local data on a uid transition, same as entries', async () => {
    const store = createActivityLogStore();
    await store.setUser({ uid: 'u1' });
    expect(localStorage.getItem(KEYS.STREAK_FREEZES)).not.toBeNull();

    await store.setUser({ uid: 'u2' });
    // u1's freeze state is gone, not carried over — u2 gets its own fresh
    // baseline (available: 0, a new lastGrantedAt established for u2, same
    // "first sign-in establishes a baseline" behavior every account gets).
    expect(store.getSnapshot().streakFreezes.available).toBe(0);
    expect(store.getSnapshot().streakFreezes.usedDates).toEqual([]);
  });
});

// Issue #179's own testing requirement: freeze state must persist and sync the
// same way other activity/meta data does across a simulated fresh store
// instance for the same uid — not just unit-level pure-function coverage.
describe('streak freezes — persistence and cross-instance sync', () => {
  it('establishes a baseline lastGrantedAt (no freeze yet) on a brand-new account', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 6, 4).getTime());
    const store = createActivityLogStore();
    await store.setUser({ uid: 'u1' });

    const { available, usedDates, lastGrantedAt } = store.getSnapshot().streakFreezes;
    expect(available).toBe(0);
    expect(usedDates).toEqual([]);
    expect(lastGrantedAt).toBe(Date.now());
    vi.useRealTimers();
  });

  it('persists streak-freeze state to localStorage under KEYS.STREAK_FREEZES within the debounce window', async () => {
    vi.useFakeTimers();
    const store = createActivityLogStore();
    await store.setUser({ uid: 'u1' });

    const raw = JSON.parse(localStorage.getItem(KEYS.STREAK_FREEZES));
    expect(raw.streakFreezes).toBeDefined();

    await vi.advanceTimersByTimeAsync(600);
    expect(dbApi.saveStreakFreezes).toHaveBeenCalledTimes(1);
    expect(dbApi.saveStreakFreezes).toHaveBeenCalledWith('u1', expect.objectContaining({ available: 0 }));
    vi.useRealTimers();
  });

  it('syncs a granted freeze to a second store instance for the same uid, via the remote listener', async () => {
    // Store 1: a full 7-day interval elapses since its baseline grant, so a
    // real freeze token is granted and flushed to the (mocked) remote.
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 6, 1).getTime());
    const store1 = createActivityLogStore();
    await store1.setUser({ uid: 'u1' });
    await vi.advanceTimersByTimeAsync(600); // flush the baseline lastGrantedAt

    vi.setSystemTime(new Date(2026, 6, 9).getTime()); // +8 days
    dbApi.saveStreakFreezes.mockClear();
    await store1.setUser({ uid: 'u1' }); // re-resolves streakFreezes with the new `now`
    await vi.advanceTimersByTimeAsync(600);

    const grantedPayload = dbApi.saveStreakFreezes.mock.calls.at(-1)[1];
    expect(grantedPayload.available).toBe(1);

    // Store 2 (a fresh instance, simulating a different device/session for
    // the same uid): its listenStreakFreezes mock now "remotely" returns
    // what store1 just flushed.
    dbApi.listenStreakFreezes.mockImplementation((_uid, onData) => {
      onData(grantedPayload);
      return () => {};
    });
    const store2 = createActivityLogStore();
    await store2.setUser({ uid: 'u1' });

    expect(store2.getSnapshot().streakFreezes.available).toBe(1);
    vi.useRealTimers();
  });
});

describe('Firebase echo guard', () => {
  it('an echo of an unchanged log does not cause a spurious notify with new content', async () => {
    let listenerCallback;
    dbApi.listenActivityLog.mockImplementation((_uid, onData) => {
      listenerCallback = onData;
      onData(null);
      return () => {};
    });

    vi.useFakeTimers();
    const store = createActivityLogStore();
    await store.setUser({ uid: 'u1' });
    store.recordCompletion();
    await vi.advanceTimersByTimeAsync(600);

    const beforeEcho = store.getSnapshot().entries;
    listenerCallback(JSON.parse(JSON.stringify(beforeEcho)));
    expect(store.getSnapshot().entries).toEqual(beforeEcho);
    vi.useRealTimers();
  });

  it('never applies a remote snapshot while a local edit is unflushed', async () => {
    let listenerCallback;
    dbApi.listenActivityLog.mockImplementation((_uid, onData) => {
      listenerCallback = onData;
      onData(null);
      return () => {};
    });

    const store = createActivityLogStore();
    await store.setUser({ uid: 'u1' });
    store.recordCompletion();

    // dirty is true (debounce hasn't fired) — a remote snapshot must be ignored.
    listenerCallback({ '1999-01-01': 9 });

    expect(store.getSnapshot().entries['1999-01-01']).toBeUndefined();
  });
});
