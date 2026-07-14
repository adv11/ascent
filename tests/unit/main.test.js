import { describe, it, expect, vi, beforeEach } from 'vitest';

// main.js registers every guarded route behind a dynamic import() (issue
// #137) instead of the page module being a static top-of-file import — this
// suite exists specifically to confirm a lazy route still resolves its real
// render function and cleanup correctly, since a dynamic-import-based route
// that silently fails to register a working cleanup wouldn't be caught by
// router.js's own tests (which only ever register plain vi.fn() renderers,
// never a real lazy-loaded module).

vi.mock('../../src/services/firebase.js', () => ({
  authApi: { onChange: vi.fn() },
}));
vi.mock('../../src/services/roadmapStore.js', () => ({
  createRoadmapStore: () => ({ setUser: vi.fn(), getSnapshot: () => ({ onboardingDone: true }) }),
}));
vi.mock('../../src/services/dailyTodoStore.js', () => ({
  createDailyTodoStore: () => ({ setUser: vi.fn() }),
}));
vi.mock('../../src/services/activityLogStore.js', () => ({
  createActivityLogStore: () => ({ setUser: vi.fn(), recordCompletion: vi.fn(), recordUncompletion: vi.fn() }),
}));
vi.mock('../../src/services/theme.js', () => ({ initTheme: vi.fn() }));
vi.mock('../../src/services/migration.js', () => ({ migrateLocalStorageKeys: vi.fn() }));
vi.mock('../../src/services/serviceWorkerRegistration.js', () => ({ registerServiceWorker: vi.fn() }));
vi.mock('../../src/services/reminderScheduler.js', () => ({ initReminderScheduler: vi.fn() }));
vi.mock('../../src/ui/components/toast.js', () => ({ showToast: vi.fn() }));
vi.mock('../../src/ui/components/feedbackWidget.js', () => ({
  createFeedbackWidget: () => Object.assign(document.createElement('div'), { _setUser: vi.fn() }),
}));
vi.mock('../../src/ui/pages/landing.js', () => ({ renderLanding: vi.fn() }));
vi.mock('../../src/ui/pages/sharedRoadmapView.js', () => ({ renderSharedRoadmapView: vi.fn() }));

const signInCleanup = vi.fn();
const renderSignIn = vi.fn(() => signInCleanup);
vi.mock('../../src/ui/pages/signIn.js', () => ({ renderSignIn }));

const renderDashboard = vi.fn(() => undefined);
vi.mock('../../src/ui/pages/dashboard.js', () => ({ renderDashboard }));

beforeEach(() => {
  vi.resetModules();
  signInCleanup.mockClear();
  renderSignIn.mockClear();
  renderDashboard.mockClear();
  document.body.innerHTML = '<div id="app"></div>';
  window.location.hash = '';
});

describe('main.js lazy route registration (issue #137)', () => {
  // A single test, not two — main.js's startRouter() attaches a 'hashchange'
  // listener directly to the shared jsdom `window` and never removes it, so
  // importing main.js a second time (even after vi.resetModules()) would
  // leave the first test's listener still attached and double-fire on the
  // next hashchange.
  it('dynamically imports the target page module, calls its render function, and runs the previous route\'s cleanup on navigation', async () => {
    window.location.hash = '#/signin';
    await import('../../src/main.js');
    // registerRoute -> startRouter both run off the module's own top-level
    // await chain; give the dynamic import() a microtask/macrotask to
    // resolve before asserting. Assert "called" rather than an exact count:
    // jsdom's own `location.hash` setter independently queues an async
    // 'hashchange' dispatch on top of any explicit one below, so exactly how
    // many times a route re-runs isn't this test's concern — only that the
    // lazy import resolved to the real render function at all.
    await vi.waitFor(() => expect(renderSignIn).toHaveBeenCalled());
    const [appEl, ctx] = renderSignIn.mock.calls[0];
    expect(appEl.id).toBe('app');
    expect(ctx.store).toBeDefined();

    window.location.hash = '#/app';
    window.dispatchEvent(new HashChangeEvent('hashchange'));

    await vi.waitFor(() => expect(renderDashboard).toHaveBeenCalled());
    expect(signInCleanup).toHaveBeenCalled();
  });

  it('modulepreloads dashboard.js once auth resolves and a redirect to /app is about to happen (issue #137 Phase 2)', async () => {
    const { authApi } = await import('../../src/services/firebase.js');
    window.location.hash = '#/signin';
    await import('../../src/main.js');
    await vi.waitFor(() => expect(renderSignIn).toHaveBeenCalled());

    expect(document.head.querySelector('link[rel="modulepreload"][href*="dashboard.js"]')).toBeNull();

    // Simulate a resolved, already-onboarded sign-in on a public route —
    // the exact condition main.js's authApi.onChange uses to redirect to
    // '/app'.
    const onAuthChange = authApi.onChange.mock.calls[0][0];
    await onAuthChange({ uid: 'test-uid' });

    const preloadLink = document.head.querySelector('link[rel="modulepreload"][href*="dashboard.js"]');
    expect(preloadLink).not.toBeNull();

    // A second resolution (e.g. a token refresh) must not append a
    // duplicate hint.
    await onAuthChange({ uid: 'test-uid' });
    expect(document.head.querySelectorAll('link[rel="modulepreload"][href*="dashboard.js"]')).toHaveLength(1);
  });
});
