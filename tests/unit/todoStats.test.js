import { describe, it, expect, vi, beforeEach } from 'vitest';
import { buildRollingAverage, buildTurnaroundSentence } from '../../src/ui/pages/todoStats.js';

vi.mock('../../src/services/firebase.js', () => ({
  authApi: { deleteAccount: vi.fn() },
  authErrorMessage: e => e?.message || 'error',
  database: {},
  firebaseClock: vi.fn(),
}));
vi.mock('https://www.gstatic.com/firebasejs/10.12.5/firebase-database.js', () => ({
  ref: vi.fn(), push: vi.fn(), update: vi.fn(), onValue: vi.fn(), off: vi.fn(),
}));
vi.mock('../../src/ui/router.js', () => ({ navigate: vi.fn() }));
vi.mock('../../src/ui/components/chartWrapper.js', () => ({
  createBarChart: vi.fn(async () => ({ destroy: vi.fn() })),
}));

function fakeStore(overrides = {}) {
  const subscribers = new Set();
  return {
    getSnapshot: () => ({ onboardingDone: true, dirty: false, ...overrides }),
    subscribe: cb => { subscribers.add(cb); cb(); return () => subscribers.delete(cb); },
    getUiState: () => ({}),
  };
}

function fakeDailyTodoStore(todos = []) {
  const subscribers = new Set();
  return {
    getSnapshot: () => ({ todos }),
    subscribe: cb => { subscribers.add(cb); cb(); return () => subscribers.delete(cb); },
  };
}

beforeEach(() => {
  vi.resetModules();
  vi.clearAllMocks();
  document.body.innerHTML = '';
  localStorage.clear();
  sessionStorage.clear();
  document.documentElement.dataset.theme = 'light';
});

async function freshTodoStats(user, todos = []) {
  const { renderTodoStats } = await import('../../src/ui/pages/todoStats.js');
  const app = document.createElement('div');
  document.body.appendChild(app);
  const cleanup = renderTodoStats(app, { user, store: fakeStore(), dailyTodoStore: fakeDailyTodoStore(todos) });
  return { app, cleanup };
}

describe('buildRollingAverage', () => {
  it('is a plain running average over up to 7 trailing values', () => {
    expect(buildRollingAverage([1, 2, 3])).toEqual([1, 1.5, 2]);
  });

  it('empty input yields empty output', () => {
    expect(buildRollingAverage([])).toEqual([]);
  });
});

describe('buildTurnaroundSentence', () => {
  it('a null average produces an inviting, non-numeric message', () => {
    expect(buildTurnaroundSentence(null)).toMatch(/Complete a todo/);
  });

  it('formats an hours+minutes duration', () => {
    const ms = (2 * 60 + 15) * 60 * 1000; // 2h 15m
    expect(buildTurnaroundSentence(ms)).toContain('2h 15m');
  });

  it('formats a minutes-only duration with no hours', () => {
    const ms = 20 * 60 * 1000;
    expect(buildTurnaroundSentence(ms)).toContain('20m');
    expect(buildTurnaroundSentence(ms)).not.toMatch(/0h/);
  });
});

describe('renderTodoStats — basic mount', () => {
  const user = { isAnonymous: false, uid: 'u1', email: 'jane@example.com' };
  const now = Date.now();

  it('shows an empty state with no todos at all', async () => {
    const { app } = await freshTodoStats(user, []);
    expect(app.querySelector('.empty-state')).not.toBeNull();
    expect(app.querySelector('.kpi-layout')).toBeNull();
  });

  it('renders stat tiles and both per-day cards once at least one todo exists', async () => {
    const { app } = await freshTodoStats(user, [
      { id: 'a', title: 'Task', done: true, doneAt: now, createdAt: now - 1000, expiresAt: now + 1000 }
    ]);
    expect(app.querySelector('.empty-state')).toBeNull();
    expect(app.querySelector('.kpi-layout')).not.toBeNull();
    expect(app.querySelectorAll('.kpi-tile')).toHaveLength(5);
    expect(app.querySelectorAll('.kpi-tile-hero')).toHaveLength(1);
    expect(app.querySelectorAll('.progress-card')).toHaveLength(2);
  });

  it('the hero tile is "Completed" with the right count', async () => {
    const { app } = await freshTodoStats(user, [
      { id: 'a', title: 'Task', done: true, doneAt: now, createdAt: now - 1000, expiresAt: now + 1000 },
      { id: 'b', title: 'Task 2', done: true, doneAt: now, createdAt: now - 1000, expiresAt: now + 1000 }
    ]);
    const hero = app.querySelector('.kpi-tile-hero');
    expect(hero.querySelector('.kpi-tile-label').textContent).toBe('Completed');
    expect(hero.querySelector('.kpi-tile-number').textContent).toBe('2');
  });

  it('returns a cleanup function that does not throw', async () => {
    const { cleanup } = await freshTodoStats(user, [{ id: 'a', title: 'Task', done: false, createdAt: now, expiresAt: now + 1000 }]);
    expect(() => cleanup()).not.toThrow();
  });

  it('redirects to /signin when there is no user', async () => {
    const { navigate } = await import('../../src/ui/router.js');
    const { renderTodoStats } = await import('../../src/ui/pages/todoStats.js');
    const app = document.createElement('div');
    renderTodoStats(app, { user: null, store: fakeStore(), dailyTodoStore: fakeDailyTodoStore() });
    expect(navigate).toHaveBeenCalledWith('/signin', true);
  });

  it('redirects to /onboarding when onboarding is not done', async () => {
    const { navigate } = await import('../../src/ui/router.js');
    const { renderTodoStats } = await import('../../src/ui/pages/todoStats.js');
    const app = document.createElement('div');
    renderTodoStats(app, { user, store: fakeStore({ onboardingDone: false }), dailyTodoStore: fakeDailyTodoStore() });
    expect(navigate).toHaveBeenCalledWith('/onboarding', true);
  });
});
