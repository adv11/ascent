import { describe, it, expect, beforeEach, vi } from 'vitest';
import { createDailyTodoStore } from '../../src/services/dailyTodoStore.js';
import { getStorageAdapter, dbApi } from '../../src/services/storage/adapterFactory.js';
import { KEYS } from '../../src/services/localStorageKeys.js';
import { MAX_TODO_TITLE_LENGTH, MAX_ACTIVE_TODOS, MIN_DURATION_MS } from '../../src/core/dailyTodo/limits.js';

// Same fake-adapter approach as tests/integration/roadmapStore.test.js —
// getStorageAdapter is itself a vi.fn() so tests can assert on calls.
vi.mock('../../src/services/storage/adapterFactory.js', () => {
  const dbApi = {
    listenDailyTodos: vi.fn((_uid, onData) => { onData(null); return () => {}; }),
    saveDailyTodos: vi.fn(() => Promise.resolve())
  };
  return { getStorageAdapter: vi.fn(() => dbApi), dbApi };
});

beforeEach(() => {
  localStorage.clear();
  vi.resetAllMocks();
  vi.useRealTimers();
  getStorageAdapter.mockImplementation(() => dbApi);
  dbApi.listenDailyTodos.mockImplementation((_uid, onData) => { onData(null); return () => {}; });
  dbApi.saveDailyTodos.mockResolvedValue(undefined);
});

describe('subscribe / notify cycle', () => {
  it('calls callback immediately on subscribe', () => {
    const store = createDailyTodoStore();
    const snapshots = [];
    const unsub = store.subscribe(s => snapshots.push(s));
    expect(snapshots).toHaveLength(1);
    expect(snapshots[0].todos).toEqual([]);
    unsub();
  });
});

describe('addTodo', () => {
  it('adds a todo with an expiresAt computed from the chosen duration', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(1_000_000);
    const store = createDailyTodoStore();
    await store.setUser({ uid: 'u1' });

    const durationMs = 3 * 60 * 60 * 1000;
    const added = store.addTodo({ title: 'Finish mock interview', durationMs });
    expect(added).toBe(true);

    const todo = store.getSnapshot().todos[0];
    expect(todo.title).toBe('Finish mock interview');
    expect(todo.createdAt).toBe(1_000_000);
    expect(todo.expiresAt).toBe(1_000_000 + durationMs);
    expect(todo.done).toBe(false);
    vi.useRealTimers();
  });

  it('clamps a too-short custom duration to the minimum', async () => {
    const store = createDailyTodoStore();
    await store.setUser({ uid: 'u1' });
    store.addTodo({ title: 'Quick task', durationMs: 1000 });
    const todo = store.getSnapshot().todos[0];
    expect(todo.expiresAt - todo.createdAt).toBe(MIN_DURATION_MS);
  });

  it('rejects an empty title', async () => {
    const store = createDailyTodoStore();
    await store.setUser({ uid: 'u1' });
    expect(store.addTodo({ title: '   ', durationMs: 60000 * 60 })).toBe(false);
    expect(store.getSnapshot().todos).toHaveLength(0);
  });

  it('rejects a title over the max length', async () => {
    const store = createDailyTodoStore();
    await store.setUser({ uid: 'u1' });
    const longTitle = 'x'.repeat(MAX_TODO_TITLE_LENGTH + 1);
    expect(store.addTodo({ title: longTitle, durationMs: 60000 * 60 })).toBe(false);
  });

  it('rejects a non-finite duration', async () => {
    const store = createDailyTodoStore();
    await store.setUser({ uid: 'u1' });
    expect(store.addTodo({ title: 'Task', durationMs: NaN })).toBe(false);
  });

  it('caps active todos at MAX_ACTIVE_TODOS', async () => {
    const store = createDailyTodoStore();
    await store.setUser({ uid: 'u1' });
    for (let i = 0; i < MAX_ACTIVE_TODOS; i++) {
      expect(store.addTodo({ title: `Task ${i}`, durationMs: 60000 * 60 })).toBe(true);
    }
    expect(store.addTodo({ title: 'One too many', durationMs: 60000 * 60 })).toBe(false);
    expect(store.getSnapshot().todos).toHaveLength(MAX_ACTIVE_TODOS);
  });
});

describe('setDone', () => {
  it('marks a todo done and stamps doneAt', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(5000);
    const store = createDailyTodoStore();
    await store.setUser({ uid: 'u1' });
    store.addTodo({ title: 'Task', durationMs: 60000 * 60 });
    const id = store.getSnapshot().todos[0].id;

    store.setDone(id, true);
    const todo = store.getSnapshot().todos[0];
    expect(todo.done).toBe(true);
    expect(todo.doneAt).toBe(5000);

    store.setDone(id, false);
    expect(store.getSnapshot().todos[0].doneAt).toBeNull();
    vi.useRealTimers();
  });
});

describe('persistence', () => {
  it('persists to localStorage under KEYS.DAILY_TODOS within the debounce window', async () => {
    vi.useFakeTimers();
    const store = createDailyTodoStore();
    await store.setUser({ uid: 'u1' });
    store.addTodo({ title: 'Task', durationMs: 60000 * 60 });

    // Immediate persist happens synchronously in queueSave, before the debounce.
    const raw = JSON.parse(localStorage.getItem(KEYS.DAILY_TODOS));
    expect(Object.keys(raw.items)).toHaveLength(1);
    expect(raw.dirty).toBe(true);

    await vi.advanceTimersByTimeAsync(600);
    expect(dbApi.saveDailyTodos).toHaveBeenCalledTimes(1);
    vi.useRealTimers();
  });
});

describe('sign-out privacy guard', () => {
  it('clears local data on a uid transition', async () => {
    const store = createDailyTodoStore();
    await store.setUser({ uid: 'u1' });
    store.addTodo({ title: 'User 1 task', durationMs: 60000 * 60 });
    expect(store.getSnapshot().todos).toHaveLength(1);

    await store.setUser({ uid: 'u2' });
    expect(store.getSnapshot().todos).toHaveLength(0);
    expect(localStorage.getItem(KEYS.DAILY_TODOS)).toBeNull();
  });

  it('clears local data on sign-out (uid -> null)', async () => {
    const store = createDailyTodoStore();
    await store.setUser({ uid: 'u1' });
    store.addTodo({ title: 'Task', durationMs: 60000 * 60 });

    await store.setUser(null);
    expect(store.getSnapshot().todos).toHaveLength(0);
    expect(localStorage.getItem(KEYS.DAILY_TODOS)).toBeNull();
  });
});

describe('Firebase echo guard', () => {
  it('an echo of an unchanged list does not cause a spurious notify with new content', async () => {
    let listenerCallback;
    dbApi.listenDailyTodos.mockImplementation((_uid, onData) => {
      listenerCallback = onData;
      onData(null);
      return () => {};
    });

    vi.useFakeTimers();
    const store = createDailyTodoStore();
    await store.setUser({ uid: 'u1' });
    store.addTodo({ title: 'Task', durationMs: 60000 * 60 });
    await vi.advanceTimersByTimeAsync(600);

    const beforeEcho = store.getSnapshot().todos;
    listenerCallback(JSON.parse(JSON.stringify(store.getSnapshot().todos.reduce((acc, t) => ({ ...acc, [t.id]: t }), {}))));
    expect(store.getSnapshot().todos).toEqual(beforeEcho);
    vi.useRealTimers();
  });

  it('never applies a remote snapshot while a local edit is unflushed', async () => {
    let listenerCallback;
    dbApi.listenDailyTodos.mockImplementation((_uid, onData) => {
      listenerCallback = onData;
      onData(null);
      return () => {};
    });

    const store = createDailyTodoStore();
    await store.setUser({ uid: 'u1' });
    store.addTodo({ title: 'Local edit', durationMs: 60000 * 60 });

    // dirty is true (debounce hasn't fired) — a remote snapshot must be ignored.
    listenerCallback({ 'other-id': { id: 'other-id', title: 'Remote', createdAt: 1, expiresAt: 2, done: false, doneAt: null } });

    expect(store.getSnapshot().todos).toHaveLength(1);
    expect(store.getSnapshot().todos[0].title).toBe('Local edit');
  });
});
