import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../src/services/firebase.js', () => ({
  authApi: { deleteAccount: vi.fn(), signOut: vi.fn() },
  authErrorMessage: e => e?.message || 'error',
  database: {},
  firebaseClock: vi.fn(),
}));
// sidebar.js -> myReports.js (issue #9) imports feedbackStore.js, which
// imports the Firebase Realtime Database SDK directly — same CDN-URL stub
// tests/unit/sidebar.test.js already needs for the identical reason.
vi.mock('https://www.gstatic.com/firebasejs/10.12.5/firebase-database.js', () => ({
  ref: vi.fn(), push: vi.fn(), update: vi.fn(), onValue: vi.fn(), off: vi.fn(),
}));
vi.mock('../../src/ui/router.js', () => ({ navigate: vi.fn() }));

function fakeStore(dirty = false) {
  return { getSnapshot: () => ({ dirty }) };
}

beforeEach(() => {
  vi.resetModules();
  document.body.innerHTML = '';
  localStorage.clear();
});

// Issue #293 — every buildTourSteps() target must resolve against the real
// DOM each real component renders, not a hand-rolled stand-in with a
// matching className (which would pass even if the real component's markup
// drifted out of sync with the tour's own selectors). Assembles the same
// pieces renderDashboard() itself mounts — sidebar (whose footer now also
// carries the theme toggle, issue #488, and whose account menu now also
// carries "Send feedback", issue #498) and topbar (whose avatar dropdown now
// folds in the old changelog bell, issue #488) — plus minimal phase-card/
// check-item stand-ins for the two rows the original issue #17 steps already
// cover.
describe('buildTourSteps() (issue #293 — expanded coverage)', () => {
  async function mountFreshDashboardChrome() {
    const { createSidebar } = await import('../../src/ui/components/sidebar.js');
    const { createTopbar } = await import('../../src/ui/components/topbar.js');

    const user = { isAnonymous: true, uid: 'guest-1' };
    const sidebar = createSidebar({
      activeRoute: '/app',
      user,
      store: fakeStore(),
      onStartTour: () => {}
    });
    const topbar = createTopbar({
      breadcrumb: 'Dashboard',
      user,
      store: fakeStore()
    });

    const phaseCard = document.createElement('div');
    phaseCard.className = 'phase-card';
    const checkItem = document.createElement('div');
    checkItem.className = 'check-item';
    // Issue #490 — the Daily Todos panel moved from onboarding.js to this
    // page's own tour target list.
    const dailyTodoPanel = document.createElement('div');
    dailyTodoPanel.className = 'daily-todo-panel';

    document.body.append(sidebar, topbar, phaseCard, checkItem, dailyTodoPanel);
    return { sidebar, topbar };
  }

  it('resolves every step target to a real, mounted element', async () => {
    const { buildTourSteps } = await import('../../src/ui/pages/dashboard.js');
    await mountFreshDashboardChrome();

    const steps = buildTourSteps();
    expect(steps.length).toBeGreaterThanOrEqual(9);
    for (const step of steps) {
      const target = step.target();
      expect(target, `"${step.title}" target should resolve`).not.toBeNull();
      expect(document.body.contains(target)).toBe(true);
    }
  });

  it('every step has a non-empty title and a body ending in terminal punctuation (.claude/rules/content-style.md)', async () => {
    const { buildTourSteps } = await import('../../src/ui/pages/dashboard.js');
    await mountFreshDashboardChrome();

    for (const step of buildTourSteps()) {
      expect(step.title.length).toBeGreaterThan(0);
      expect(step.body).toMatch(/[.?]$/);
    }
  });

  it('the Settings, account-menu, and changelog-bell steps point at their real components', async () => {
    const { buildTourSteps } = await import('../../src/ui/pages/dashboard.js');
    const { sidebar } = await mountFreshDashboardChrome();

    const steps = buildTourSteps();
    const settingsStep = steps.find(s => s.title === 'Update your settings');
    expect(settingsStep.target()).toBe(sidebar.querySelector('.app-sidebar-nav a[href="#/settings"]'));

    const accountStep = steps.find(s => s.title === 'Share, back up, and send feedback');
    expect(accountStep.target()).toBe(sidebar.querySelector('.app-sidebar-identity'));

    const bellStep = steps.find(s => s.title === 'See what\'s new');
    expect(bellStep.target()).not.toBeNull();
    expect(bellStep.target().classList.contains('app-topbar-bell')).toBe(true);
  });
});
