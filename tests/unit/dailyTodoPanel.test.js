import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createDailyTodoPanel } from '../../src/ui/components/dailyTodoPanel.js';
import { MAX_ACTIVE_TODOS } from '../../src/core/dailyTodo/limits.js';
import { KEYS } from '../../src/services/localStorageKeys.js';

// A minimal fake store — the panel only depends on subscribe/getSnapshot/addTodo/setDone,
// not on the real dailyTodoStore's Firebase-backed persistence.
function createFakeStore(initialTodos = []) {
  let todos = initialTodos;
  const subscribers = new Set();
  const notify = () => subscribers.forEach(cb => cb());
  return {
    subscribe(cb) {
      subscribers.add(cb);
      cb();
      return () => subscribers.delete(cb);
    },
    getSnapshot() {
      return { todos };
    },
    addTodo({ title, durationMs }) {
      if (!title.trim()) return false;
      if (!Number.isFinite(durationMs)) return false;
      if (todos.filter(t => !t.done).length >= MAX_ACTIVE_TODOS) return false;
      const now = Date.now();
      todos = [...todos, { id: `t${todos.length}`, title, createdAt: now, expiresAt: now + durationMs, done: false, doneAt: null }];
      notify();
      return true;
    },
    setDone(id, done) {
      todos = todos.map(t => (t.id === id ? { ...t, done, doneAt: done ? Date.now() : null } : t));
      notify();
    },
    removeTodo(id) {
      todos = todos.filter(t => t.id !== id);
      notify();
    }
  };
}

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(1_700_000_000_000);
  // Only clear stray modal overlays a previous test left open — toast.js
  // caches its `.toast-stack` root at module scope (no vi.resetModules()
  // here, since this file statically imports createDailyTodoPanel), so a
  // blanket document.body.innerHTML reset would detach that cached root
  // from the document without toast.js ever knowing to recreate it.
  document.querySelectorAll('.modal-overlay').forEach(el => el.remove());
  // The collapse toggle (issue #83) persists to localStorage — clear it so
  // one test's collapse/expand doesn't leak into the next.
  localStorage.removeItem(KEYS.DAILY_TODOS_COLLAPSED);
});

afterEach(() => {
  vi.useRealTimers();
});

describe('createDailyTodoPanel', () => {
  it('renders the empty state with no todos', () => {
    const node = createDailyTodoPanel(createFakeStore());
    expect(node.querySelector('.daily-todo-empty')).toBeTruthy();
    node._cleanup();
  });

  it('adding a todo via Enter calls store.addTodo and renders it', () => {
    const store = createFakeStore();
    const node = createDailyTodoPanel(store);
    const input = node.querySelector('.daily-todo-add-row .inline-add');
    input.value = 'Finish DSA mock interview';
    input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter' }));

    expect(node.querySelector('.daily-todo-item .daily-todo-title').textContent).toBe('Finish DSA mock interview');
    expect(input.value).toBe('');
    node._cleanup();
  });

  it('checking the box marks it done, strikes it through, and swaps its countdown for a fixed "Done" status', () => {
    const store = createFakeStore();
    store.addTodo({ title: 'Task', durationMs: 60 * 60 * 1000 });
    const node = createDailyTodoPanel(store);

    const checkbox = node.querySelector('.daily-todo-item input[type="checkbox"]');
    checkbox.checked = true;
    checkbox.dispatchEvent(new Event('change'));

    const item = node.querySelector('.daily-todo-item');
    expect(item.classList.contains('done')).toBe(true);
    // The status column is always rendered (issue #78) so every row's
    // status text lines up in the same fixed-width slot regardless of done
    // state — a done row shows "Done" instead of disappearing entirely.
    const remaining = item.querySelector('.daily-todo-remaining');
    expect(remaining).toBeTruthy();
    expect(remaining.classList.contains('done')).toBe(true);
    expect(remaining.textContent).toBe('Done');
    node._cleanup();
  });

  it('an expired, not-done todo renders under the collapsed Missed section', () => {
    const now = Date.now();
    const store = createFakeStore([
      { id: 'a', title: 'Missed task', createdAt: now - 2000, expiresAt: now - 1000, done: false, doneAt: null }
    ]);
    const node = createDailyTodoPanel(store);

    expect(node.querySelector('.daily-todo-empty')).toBeTruthy();
    const toggle = node.querySelector('.daily-todo-missed-toggle');
    expect(toggle.textContent).toContain('Missed (1)');
    expect(node.querySelector('.daily-todo-missed-list').hidden).toBe(true);

    toggle.click();
    expect(node.querySelector('.daily-todo-missed-list').hidden).toBe(false);
    expect(node.querySelector('.daily-todo-missed-list .daily-todo-title').textContent).toBe('Missed task');
    node._cleanup();
  });

  it('_cleanup stops the countdown interval and unsubscribes from the store', () => {
    const store = createFakeStore();
    store.addTodo({ title: 'Task', durationMs: 2 * 60 * 60 * 1000 });
    const node = createDailyTodoPanel(store);

    const before = node.querySelector('.daily-todo-remaining').textContent;
    node._cleanup();

    vi.advanceTimersByTime(60 * 60 * 1000);
    expect(node.querySelector('.daily-todo-remaining').textContent).toBe(before);
  });

  it('switching the duration select to Custom reveals the hours input', () => {
    const node = createDailyTodoPanel(createFakeStore());
    const select = node.querySelector('.todo-duration-select');
    const customInput = node.querySelector('.todo-custom-hours');
    expect(customInput.hidden).toBe(true);

    select.value = 'custom';
    select.dispatchEvent(new Event('change'));
    expect(customInput.hidden).toBe(false);
    node._cleanup();
  });

  it('an active todo can also be deleted after confirmation (undo, issue #56 follow-up)', async () => {
    const store = createFakeStore();
    store.addTodo({ title: 'Task', durationMs: 60 * 60 * 1000 });
    const node = createDailyTodoPanel(store);

    node.querySelector('.daily-todo-item .daily-todo-delete').click();
    document.querySelector('.modal-overlay [data-action="confirm"]').click();
    await Promise.resolve();
    await Promise.resolve();

    expect(node.querySelector('.daily-todo-item')).toBeNull();
    node._cleanup();
  });

  it('a done todo gets a delete button that removes it after confirmation', async () => {
    const store = createFakeStore();
    store.addTodo({ title: 'Task', durationMs: 60 * 60 * 1000 });
    const id = store.getSnapshot().todos[0].id;
    store.setDone(id, true);
    const node = createDailyTodoPanel(store);

    node.querySelector('.daily-todo-item .daily-todo-delete').click();
    const confirmBtn = document.querySelector('.modal-overlay [data-action="confirm"]');
    expect(confirmBtn).toBeTruthy();
    confirmBtn.click();
    await Promise.resolve();
    await Promise.resolve();

    expect(node.querySelector('.daily-todo-item')).toBeNull();
    node._cleanup();
  });

  it('cancelling the delete confirmation keeps the todo', async () => {
    const store = createFakeStore();
    store.addTodo({ title: 'Task', durationMs: 60 * 60 * 1000 });
    const id = store.getSnapshot().todos[0].id;
    store.setDone(id, true);
    const node = createDailyTodoPanel(store);

    node.querySelector('.daily-todo-item .daily-todo-delete').click();
    document.querySelector('.modal-overlay [data-action="cancel"]').click();

    expect(node.querySelector('.daily-todo-item')).toBeTruthy();
    node._cleanup();
  });

  it('a missed todo also gets a delete button', () => {
    const now = Date.now();
    const store = createFakeStore([
      { id: 'a', title: 'Missed task', createdAt: now - 2000, expiresAt: now - 1000, done: false, doneAt: null }
    ]);
    const node = createDailyTodoPanel(store);
    node.querySelector('.daily-todo-missed-toggle').click();

    expect(node.querySelector('.daily-todo-missed-list .daily-todo-delete')).toBeTruthy();
    node._cleanup();
  });

  it('the info button opens the Daily Todos guide modal', () => {
    const node = createDailyTodoPanel(createFakeStore());
    node.querySelector('.daily-todo-info-btn').click();

    expect(document.querySelector('.modal-overlay[aria-label*="Today\'s Todos"]')).toBeTruthy();
    document.querySelector('.modal-overlay [data-action], .modal-overlay .btn-primary').click();
    node._cleanup();
  });
});

// issue #56 follow-up — a todo created via a roadmap topic's "add to
// Today's Todos" button carries linkedTemplateId/linkedItemId, and
// completing/reverting it must also update that topic in its own roadmap.
function createFakeRoadmapStore({ ok = true, title = 'Semantic HTML' } = {}) {
  return {
    isCustomRoadmapId: id => typeof id === 'string' && id.startsWith('croadmap-'),
    getSnapshot: () => ({ customRoadmaps: [] }),
    setItemDoneInTemplate: vi.fn(() => Promise.resolve(ok ? { ok: true, title } : { ok: false, title: null }))
  };
}

function linkedTodo(overrides = {}) {
  const now = Date.now();
  return {
    id: 't0',
    title: 'Semantic HTML',
    createdAt: now,
    expiresAt: now + 60 * 60 * 1000,
    done: false,
    doneAt: null,
    linkedTemplateId: 'frontend',
    linkedItemId: 'item-1',
    linkedItemTitle: 'Semantic HTML',
    ...overrides
  };
}

async function flushMicrotasks() {
  await Promise.resolve();
  await Promise.resolve();
  await Promise.resolve();
}

describe('createDailyTodoPanel — linked-topic completion (issue #56 follow-up)', () => {
  it('renders a "via <roadmap>" badge for a linked todo', () => {
    const store = createFakeStore([linkedTodo()]);
    const roadmapStore = createFakeRoadmapStore();
    const node = createDailyTodoPanel(store, roadmapStore);

    expect(node.querySelector('.daily-todo-linked-badge').textContent).toBe('via Frontend Developer');
    node._cleanup();
  });

  it('checking a linked todo asks for confirmation naming the roadmap before completing it', async () => {
    const store = createFakeStore([linkedTodo()]);
    const roadmapStore = createFakeRoadmapStore();
    const node = createDailyTodoPanel(store, roadmapStore);

    const checkbox = node.querySelector('input[type="checkbox"]');
    checkbox.checked = true;
    checkbox.dispatchEvent(new Event('change'));

    const dialog = document.querySelector('.modal-overlay[aria-label*="Complete"]');
    expect(dialog).toBeTruthy();
    expect(dialog.textContent).toContain('Frontend Developer');
    // Not applied yet — still waiting on confirmation.
    expect(roadmapStore.setItemDoneInTemplate).not.toHaveBeenCalled();
    document.querySelector('.modal-overlay [data-action="cancel"]').click();
    node._cleanup();
  });

  it('confirming marks the todo done AND updates the linked roadmap topic, then toasts success', async () => {
    const store = createFakeStore([linkedTodo()]);
    const roadmapStore = createFakeRoadmapStore({ title: 'Semantic HTML' });
    const node = createDailyTodoPanel(store, roadmapStore);

    node.querySelector('input[type="checkbox"]').checked = true;
    node.querySelector('input[type="checkbox"]').dispatchEvent(new Event('change'));
    document.querySelector('.modal-overlay [data-action="confirm"]').click();
    await flushMicrotasks();

    expect(store.getSnapshot().todos[0].done).toBe(true);
    expect(roadmapStore.setItemDoneInTemplate).toHaveBeenCalledWith('frontend', 'item-1', true);
    expect(document.querySelector('.toast-stack').textContent).toContain('Marked "Semantic HTML" done in Frontend Developer');
    node._cleanup();
  });

  it('cancelling the confirmation leaves the todo (and the roadmap) untouched', async () => {
    const store = createFakeStore([linkedTodo()]);
    const roadmapStore = createFakeRoadmapStore();
    const node = createDailyTodoPanel(store, roadmapStore);

    const checkbox = node.querySelector('input[type="checkbox"]');
    checkbox.checked = true;
    checkbox.dispatchEvent(new Event('change'));
    document.querySelector('.modal-overlay [data-action="cancel"]').click();
    await flushMicrotasks();

    expect(store.getSnapshot().todos[0].done).toBe(false);
    expect(checkbox.checked).toBe(false);
    expect(roadmapStore.setItemDoneInTemplate).not.toHaveBeenCalled();
    node._cleanup();
  });

  it('unchecking a completed linked todo syncs back to the roadmap without a confirmation dialog', async () => {
    const store = createFakeStore([linkedTodo({ done: true, doneAt: Date.now() })]);
    const roadmapStore = createFakeRoadmapStore({ title: 'Semantic HTML' });
    const node = createDailyTodoPanel(store, roadmapStore);

    const checkbox = node.querySelector('input[type="checkbox"]');
    checkbox.checked = false;
    checkbox.dispatchEvent(new Event('change'));
    await flushMicrotasks();

    expect(document.querySelector('.modal-overlay[aria-label*="Complete"]')).toBeNull();
    expect(store.getSnapshot().todos[0].done).toBe(false);
    expect(roadmapStore.setItemDoneInTemplate).toHaveBeenCalledWith('frontend', 'item-1', false);
    expect(document.querySelector('.toast-stack').textContent).toContain('Reverted "Semantic HTML" in Frontend Developer');
    node._cleanup();
  });

  it('still marks the todo done, with a warning toast, when the linked topic no longer exists', async () => {
    const store = createFakeStore([linkedTodo()]);
    const roadmapStore = createFakeRoadmapStore({ ok: false });
    const node = createDailyTodoPanel(store, roadmapStore);

    node.querySelector('input[type="checkbox"]').checked = true;
    node.querySelector('input[type="checkbox"]').dispatchEvent(new Event('change'));
    document.querySelector('.modal-overlay [data-action="confirm"]').click();
    await flushMicrotasks();

    expect(store.getSnapshot().todos[0].done).toBe(true);
    expect(document.querySelector('.toast-stack').textContent).toContain("Couldn't find that topic in Frontend Developer anymore");
    node._cleanup();
  });

  it('an unlinked todo never opens a confirmation dialog or touches roadmapStore', async () => {
    const store = createFakeStore();
    store.addTodo({ title: 'Plain task', durationMs: 60 * 60 * 1000 });
    const roadmapStore = createFakeRoadmapStore();
    const node = createDailyTodoPanel(store, roadmapStore);

    node.querySelector('input[type="checkbox"]').checked = true;
    node.querySelector('input[type="checkbox"]').dispatchEvent(new Event('change'));
    await flushMicrotasks();

    expect(document.querySelector('.modal-overlay')).toBeNull();
    expect(roadmapStore.setItemDoneInTemplate).not.toHaveBeenCalled();
    expect(store.getSnapshot().todos[0].done).toBe(true);
    node._cleanup();
  });

  it('deleting an active linked todo (undo) never touches roadmapStore, and the confirm message reassures the roadmap is untouched', async () => {
    const store = createFakeStore([linkedTodo()]);
    const roadmapStore = createFakeRoadmapStore();
    const node = createDailyTodoPanel(store, roadmapStore);

    node.querySelector('.daily-todo-item .daily-todo-delete').click();
    const dialog = document.querySelector('.modal-overlay[aria-label*="Delete"]');
    expect(dialog.textContent).toContain('untouched');
    dialog.querySelector('[data-action="confirm"]').click();
    await flushMicrotasks();

    expect(node.querySelector('.daily-todo-item')).toBeNull();
    expect(roadmapStore.setItemDoneInTemplate).not.toHaveBeenCalled();
  });

  it('deleting a DONE linked todo does not repeat the "untouched" reassurance (it already updated the roadmap when completed)', async () => {
    const store = createFakeStore([linkedTodo({ done: true, doneAt: Date.now() })]);
    const roadmapStore = createFakeRoadmapStore();
    const node = createDailyTodoPanel(store, roadmapStore);

    node.querySelector('.daily-todo-item .daily-todo-delete').click();
    const dialog = document.querySelector('.modal-overlay[aria-label*="Delete"]');
    expect(dialog.textContent).not.toContain('untouched');
    dialog.querySelector('[data-action="cancel"]').click();
    node._cleanup();
  });

  describe('collapse/expand (issue #83)', () => {
    it('defaults to expanded when no preference is stored — first sign-in never starts collapsed', () => {
      const node = createDailyTodoPanel(createFakeStore());
      expect(node.classList.contains('collapsed')).toBe(false);
      expect(node.querySelector('.daily-todo-collapse-btn').getAttribute('aria-expanded')).toBe('true');
      node._cleanup();
    });

    it('clicking the collapse button collapses the panel and persists the preference', () => {
      const node = createDailyTodoPanel(createFakeStore());
      node.querySelector('.daily-todo-collapse-btn').click();

      expect(node.classList.contains('collapsed')).toBe(true);
      expect(node.querySelector('.daily-todo-collapse-btn').getAttribute('aria-expanded')).toBe('false');
      expect(localStorage.getItem(KEYS.DAILY_TODOS_COLLAPSED)).toBe('true');
      node._cleanup();
    });

    it('clicking it again expands and persists that too', () => {
      const node = createDailyTodoPanel(createFakeStore());
      const btn = node.querySelector('.daily-todo-collapse-btn');
      btn.click();
      btn.click();

      expect(node.classList.contains('collapsed')).toBe(false);
      expect(localStorage.getItem(KEYS.DAILY_TODOS_COLLAPSED)).toBe('false');
      node._cleanup();
    });

    it('starts collapsed when a prior session already stored that preference', () => {
      localStorage.setItem(KEYS.DAILY_TODOS_COLLAPSED, 'true');
      const node = createDailyTodoPanel(createFakeStore());

      expect(node.classList.contains('collapsed')).toBe(true);
      expect(node.querySelector('.daily-todo-collapse-btn').getAttribute('aria-expanded')).toBe('false');
      node._cleanup();
    });

    it('shows an active-todo count badge that stays in sync as todos are added', () => {
      const store = createFakeStore();
      const node = createDailyTodoPanel(store);
      store.addTodo({ title: 'Task', durationMs: 60 * 60 * 1000 });

      expect(node.querySelector('.daily-todo-count-badge').textContent).toBe('1 active');
      store.addTodo({ title: 'Task 2', durationMs: 60 * 60 * 1000 });
      expect(node.querySelector('.daily-todo-count-badge').textContent).toBe('2 active');
      node._cleanup();
    });
  });
});
