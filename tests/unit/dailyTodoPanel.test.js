import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createDailyTodoPanel } from '../../src/ui/components/dailyTodoPanel.js';
import { MAX_ACTIVE_TODOS } from '../../src/core/dailyTodo/limits.js';

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
    }
  };
}

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(1_700_000_000_000);
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

  it('checking the box marks it done, strikes it through, and drops its countdown', () => {
    const store = createFakeStore();
    store.addTodo({ title: 'Task', durationMs: 60 * 60 * 1000 });
    const node = createDailyTodoPanel(store);

    const checkbox = node.querySelector('.daily-todo-item input[type="checkbox"]');
    checkbox.checked = true;
    checkbox.dispatchEvent(new Event('change'));

    const item = node.querySelector('.daily-todo-item');
    expect(item.classList.contains('done')).toBe(true);
    expect(item.querySelector('.daily-todo-remaining')).toBeNull();
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
});
