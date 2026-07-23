import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../src/ui/router.js', () => ({ navigate: vi.fn() }));
vi.mock('../../src/ui/components/importRoadmapModal.js', () => ({ openCreateRoadmapModal: vi.fn() }));
// Same transitive firebase.js/gstatic-CDN-URL stub onboarding.test.js already
// needs — see that file's own comment for why (confirmAndSignOut, the
// account dropdown's Settings/My reports/Share/Delete-account items).
vi.mock('../../src/services/firebase.js', () => ({
  authApi: { signOut: vi.fn().mockResolvedValue(undefined), deleteAccount: vi.fn() },
  authErrorMessage: e => e?.message || 'error',
  database: {},
  firebaseClock: vi.fn(),
}));
vi.mock('https://www.gstatic.com/firebasejs/10.12.5/firebase-database.js', () => ({
  ref: vi.fn(), push: vi.fn(), update: vi.fn(), onValue: vi.fn(), off: vi.fn(), get: vi.fn(),
}));

// A minimal fake Daily Todos store, same shape tests/unit/dailyTodoPanel.test.js
// already establishes — createDailyTodoPanel() only needs subscribe/getSnapshot.
function fakeDailyTodoStore() {
  return {
    subscribe: vi.fn(cb => { cb(); return () => {}; }),
    getSnapshot: vi.fn(() => ({ todos: [] }))
  };
}

function fakeRoadmapStore(overrides = {}) {
  return {
    getSnapshot: vi.fn(() => ({
      onboardingDone: true,
      hiddenTemplateIds: [],
      activeTemplateId: 'java-backend',
      startedTemplateIds: ['java-backend'],
      customRoadmaps: [],
      favoriteRoadmapIds: [],
      tourDone: true,
      onboardingTourDone: false,
      ...overrides
    })),
    subscribe: vi.fn(() => () => {}),
    switchRoadmap: vi.fn().mockResolvedValue(undefined),
    hideTemplate: vi.fn().mockResolvedValue(undefined),
    unhideTemplate: vi.fn().mockResolvedValue(undefined),
    createCustomRoadmap: vi.fn().mockResolvedValue('croadmap-test'),
    deleteCustomRoadmap: vi.fn().mockResolvedValue(undefined),
    toggleFavoriteRoadmap: vi.fn().mockResolvedValue({ ok: true, capped: false }),
    resetOnboardingTour: vi.fn(),
    completeOnboardingTour: vi.fn().mockResolvedValue(undefined)
  };
}

beforeEach(() => {
  vi.resetModules();
  document.body.innerHTML = '';
});

// Issue #293 — buildOnboardingTourSteps()'s targets must resolve against the
// real DOM renderOnboarding() actually produces (Daily Todos panel, a
// built-in template card's overflow menu, "Create your own roadmap"), not a
// hand-rolled stand-in — same discipline tests/unit/featureTourSteps.test.js
// established for the dashboard tour.
describe('buildOnboardingTourSteps() (issue #293)', () => {
  it('resolves every step target to a real, mounted element', async () => {
    const { renderOnboarding, buildOnboardingTourSteps } = await import('../../src/ui/pages/onboarding.js');
    const app = document.createElement('div');
    document.body.appendChild(app);
    const store = fakeRoadmapStore();
    const dailyTodoStore = fakeDailyTodoStore();
    renderOnboarding(app, { user: { uid: 'uid-1', isAnonymous: false }, store, dailyTodoStore });

    const visibleGrid = app.querySelector('.template-grid');
    expect(visibleGrid).not.toBeNull();
    const steps = buildOnboardingTourSteps({ visibleGrid, getCreateCardEl: () => app.querySelector('.template-card-create') });

    expect(steps).toHaveLength(3);
    for (const step of steps) {
      const target = step.target();
      expect(target, `"${step.title}" target should resolve`).not.toBeNull();
      expect(document.body.contains(target)).toBe(true);
    }
  });

  it('every step has a non-empty title and a body ending in terminal punctuation (.claude/rules/content-style.md)', async () => {
    const { buildOnboardingTourSteps } = await import('../../src/ui/pages/onboarding.js');
    const visibleGrid = document.createElement('div');
    for (const step of buildOnboardingTourSteps({ visibleGrid, getCreateCardEl: () => null })) {
      expect(step.title.length).toBeGreaterThan(0);
      expect(step.body).toMatch(/[.?]$/);
    }
  });

  it('the favorite-roadmaps step targets the first template card\'s overflow menu trigger', async () => {
    const { renderOnboarding, buildOnboardingTourSteps } = await import('../../src/ui/pages/onboarding.js');
    const app = document.createElement('div');
    document.body.appendChild(app);
    const store = fakeRoadmapStore();
    renderOnboarding(app, { user: { uid: 'uid-1', isAnonymous: false }, store, dailyTodoStore: fakeDailyTodoStore() });

    const visibleGrid = app.querySelector('.template-grid');
    const steps = buildOnboardingTourSteps({ visibleGrid, getCreateCardEl: () => app.querySelector('.template-card-create') });
    const favoriteStep = steps.find(s => s.title === 'Favorite your go-to roadmaps');
    expect(favoriteStep.target()).toBe(visibleGrid.querySelector('.template-card-overflow-btn'));
  });
});

describe('shouldAutoStartOnboardingTour() (issue #293)', () => {
  it('auto-starts only on a return visit, after the dashboard tour has been seen, and only once', async () => {
    const { shouldAutoStartOnboardingTour } = await import('../../src/ui/pages/onboarding.js');

    expect(shouldAutoStartOnboardingTour({ tourDone: true, onboardingTourDone: false }, true)).toBe(true);
  });

  it('never auto-starts during first-time template picking, even if the flags would otherwise allow it', async () => {
    const { shouldAutoStartOnboardingTour } = await import('../../src/ui/pages/onboarding.js');

    expect(shouldAutoStartOnboardingTour({ tourDone: true, onboardingTourDone: false }, false)).toBe(false);
  });

  it('never auto-starts before the dashboard tour itself has been seen', async () => {
    const { shouldAutoStartOnboardingTour } = await import('../../src/ui/pages/onboarding.js');

    expect(shouldAutoStartOnboardingTour({ tourDone: false, onboardingTourDone: false }, true)).toBe(false);
  });

  it('never auto-starts a second time once onboardingTourDone is true', async () => {
    const { shouldAutoStartOnboardingTour } = await import('../../src/ui/pages/onboarding.js');

    expect(shouldAutoStartOnboardingTour({ tourDone: true, onboardingTourDone: true }, true)).toBe(false);
  });
});

describe('"Take a tour" manual replay in the account menu (issue #293)', () => {
  it('resets onboardingTourDone before replaying', async () => {
    const { renderOnboarding } = await import('../../src/ui/pages/onboarding.js');
    const app = document.createElement('div');
    document.body.appendChild(app);
    // Never auto-starts here (onboardingTourDone already true) — isolates the
    // manual "Take a tour" click from the auto-start path above.
    const store = fakeRoadmapStore({ onboardingTourDone: true });
    renderOnboarding(app, { user: { uid: 'uid-1', isAnonymous: false }, store, dailyTodoStore: fakeDailyTodoStore() });

    app.querySelector('.onboarding-account-trigger').click();
    const tourItem = [...document.querySelectorAll('.dropdown-item')].find(el => el.textContent === 'Take a tour');
    expect(tourItem).toBeTruthy();
    tourItem.click();

    expect(store.resetOnboardingTour).toHaveBeenCalledTimes(1);
  });
});
