import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../src/services/firebase.js', () => ({
  authApi: { deleteAccount: vi.fn() },
  authErrorMessage: e => e?.message || 'error',
  database: {},
  firebaseClock: vi.fn(),
}));
// progress.js pulls in sidebar.js -> myReports.js (issue #9) -> feedbackStore.js,
// which imports the Firebase Realtime Database SDK directly — same CDN-URL
// stub tests/unit/storage/adapterFactory.test.js established.
vi.mock('https://www.gstatic.com/firebasejs/10.12.5/firebase-database.js', () => ({
  ref: vi.fn(), push: vi.fn(), update: vi.fn(), onValue: vi.fn(), off: vi.fn(),
}));

vi.mock('../../src/ui/router.js', () => ({ navigate: vi.fn() }));

vi.mock('../../src/ui/components/chartWrapper.js', () => ({
  createLineChart: vi.fn(async () => ({ destroy: vi.fn() })),
  createBarChart: vi.fn(async () => ({ destroy: vi.fn() })),
}));

function fakeStore(items = [], overrides = {}) {
  const subscribers = new Set();
  return {
    getSnapshot: () => ({ onboardingDone: true, items, dirty: false, ...overrides }),
    subscribe: cb => { subscribers.add(cb); cb(); return () => subscribers.delete(cb); },
    getUiState: () => ({}),
  };
}

function fakeActivityLogStore(entries = {}) {
  const subscribers = new Set();
  return {
    getSnapshot: () => ({ entries }),
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

async function freshProgress(user, items = [], entries = {}) {
  const { renderProgress } = await import('../../src/ui/pages/progress.js');
  const app = document.createElement('div');
  document.body.appendChild(app);
  const cleanup = renderProgress(app, { user, store: fakeStore(items), activityLogStore: fakeActivityLogStore(entries) });
  return { app, cleanup };
}

describe('renderProgress — basic mount', () => {
  const user = { isAnonymous: false, uid: 'u1', email: 'jane@example.com' };

  it('renders the page header and all six section cards', async () => {
    const { app } = await freshProgress(user);
    expect(app.querySelector('.progress-header h1').textContent).toBe('Progress');
    expect(app.querySelectorAll('.progress-card')).toHaveLength(6);
    expect(app.querySelector('.stat-strip')).not.toBeNull();
  });

  it('renders 4 kpi tiles, one hero-highlighted', async () => {
    const { app } = await freshProgress(user);
    expect(app.querySelectorAll('.kpi-tile')).toHaveLength(4);
    expect(app.querySelectorAll('.kpi-tile-hero')).toHaveLength(1);
  });

  it('renders the heatmap with role=img and an aria-label', async () => {
    const { app } = await freshProgress(user);
    const heatmap = app.querySelector('.heatmap');
    expect(heatmap.getAttribute('role')).toBe('img');
    expect(heatmap.getAttribute('aria-label')).toMatch(/Activity heatmap/);
  });

  it('returns a cleanup function that does not throw', async () => {
    const { cleanup } = await freshProgress(user);
    expect(() => cleanup()).not.toThrow();
  });
});

describe('renderProgress — phase breakdown and priority table', () => {
  const user = { isAnonymous: false, uid: 'u1' };
  const items = [
    { phase: 'Java Core', priority: 'P0', done: true },
    { phase: 'Java Core', priority: 'P0', done: false },
    { phase: 'Spring', priority: 'P1', done: true }
  ];

  it('renders one phase-breakdown row per phase', async () => {
    const { app } = await freshProgress(user, items);
    expect(app.querySelectorAll('.phase-breakdown-row')).toHaveLength(2);
  });

  it('clicking a phase-breakdown row sets the scroll signal and navigates to /app', async () => {
    const { KEYS } = await import('../../src/services/localStorageKeys.js');
    const { navigate } = await import('../../src/ui/router.js');
    const { app } = await freshProgress(user, items);
    const row = app.querySelector('.phase-breakdown-row');
    row.click();
    expect(sessionStorage.getItem(KEYS.SCROLL_TO_PHASE)).toBeTruthy();
    expect(navigate).toHaveBeenCalledWith('/app');
  });

  it('renders a priority table row per phase with a data-band cell', async () => {
    const { app } = await freshProgress(user, items);
    expect(app.querySelectorAll('.priority-table tbody tr')).toHaveLength(2);
    expect(app.querySelector('.priority-cell[data-band]')).not.toBeNull();
  });
});

describe('renderProgress — projection card empty states', () => {
  const user = { isAnonymous: false, uid: 'u1' };

  it('shows the "no recent activity" message when there is work left and 0 velocity', async () => {
    const items = [{ phase: 'A', priority: 'P2', done: false }];
    const { app } = await freshProgress(user, items, {});
    expect(app.querySelector('.projection-empty').textContent).toMatch(/No recent activity/);
  });

  it('shows the completion message once everything is done', async () => {
    const items = [{ phase: 'A', priority: 'P2', done: true, completedAt: Date.now() }];
    const { app } = await freshProgress(user, items, {});
    expect(app.querySelector('.projection-empty').textContent).toMatch(/completed every topic/);
  });
});

describe('renderProgress — guard clauses', () => {
  it('redirects to /signin with no user', async () => {
    const { navigate } = await import('../../src/ui/router.js');
    const { renderProgress } = await import('../../src/ui/pages/progress.js');
    const app = document.createElement('div');
    renderProgress(app, { user: null, store: fakeStore(), activityLogStore: fakeActivityLogStore() });
    expect(navigate).toHaveBeenCalledWith('/signin', true);
  });

  it('redirects to /onboarding when onboarding is not done', async () => {
    const { navigate } = await import('../../src/ui/router.js');
    const { renderProgress } = await import('../../src/ui/pages/progress.js');
    const app = document.createElement('div');
    const store = fakeStore([], { onboardingDone: false });
    renderProgress(app, { user: { uid: 'u1' }, store, activityLogStore: fakeActivityLogStore() });
    expect(navigate).toHaveBeenCalledWith('/onboarding', true);
  });
});
