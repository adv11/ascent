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
// A plain vi.fn() per test would be reassigned too late — main.js's
// module-scope `const store = createRoadmapStore(...)` runs synchronously
// at import time, before a test body gets a chance to swap the
// implementation in. `roadmapStoreSetUser` is declared once, up front, and
// individual tests reconfigure *its* implementation instead of replacing
// createRoadmapStore's return value after the fact.
const roadmapStoreSetUser = vi.fn(() => Promise.resolve());
vi.mock('../../src/services/roadmapStore.js', () => ({
  createRoadmapStore: () => ({ setUser: roadmapStoreSetUser, getSnapshot: () => ({ onboardingDone: true }) }),
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

const renderOnboarding = vi.fn(() => undefined);
vi.mock('../../src/ui/pages/onboarding.js', () => ({ renderOnboarding }));

beforeEach(() => {
  vi.resetModules();
  signInCleanup.mockClear();
  renderSignIn.mockClear();
  renderDashboard.mockClear();
  roadmapStoreSetUser.mockReset().mockImplementation(() => Promise.resolve());
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

  it('a stale onChange invocation must not force-navigate away from a route the user deliberately (re-)entered after it started (issue #294)', async () => {
    const { authApi } = await import('../../src/services/firebase.js');
    // Control exactly when each onChange invocation's own store.setUser()
    // resolves, so the first ("stale") call can be made to resolve *after*
    // the second — reproducing the real race: two onChange invocations for
    // conceptually one sign-in (e.g. an emulator/SDK double-emission), the
    // first slower than the second.
    let resolveFirst;
    const firstSetUser = new Promise(resolve => { resolveFirst = resolve; });
    roadmapStoreSetUser
      .mockImplementationOnce(() => firstSetUser)
      .mockImplementation(() => Promise.resolve());

    window.location.hash = '#/signin';
    await import('../../src/main.js');
    await vi.waitFor(() => expect(renderSignIn).toHaveBeenCalled());

    const onAuthChange = authApi.onChange.mock.calls[0][0];

    // Invocation 1 ("stale") starts while the route is '/onboarding' —
    // matches the real repro where a prior onboarding visit is still the
    // current route when this callback's async work begins.
    window.location.hash = '#/onboarding';
    const firstCall = onAuthChange({ uid: 'test-uid' });

    // Invocation 2 starts and resolves immediately (its own setUser() is
    // already the fallback `Promise.resolve()`), landing on '/app' first —
    // simulating the user picking a roadmap and navigating there.
    await onAuthChange({ uid: 'test-uid' });
    window.location.hash = '#/app';

    // The user (or a test) deliberately re-enters '/onboarding' — same
    // route the still-pending first invocation captured at its own start.
    window.location.hash = '#/onboarding';

    // Now let the stale first invocation's setUser() finally resolve. Its
    // captured routeAtAuthChange ('/onboarding') now coincidentally matches
    // the *current* route again, for an unrelated reason — it must not act
    // on that coincidence.
    resolveFirst();
    await firstCall;

    expect(window.location.hash).toBe('#/onboarding');
  });

  it('a single onChange invocation must not force-navigate away from a route the user round-tripped back to during its own await (issue #294, real CI repro)', async () => {
    // Unlike the test above (two overlapping invocations), this is the
    // *single*-invocation shape that actually reproduced in CI: one
    // onChange call starts while on '/onboarding', and its own
    // store.setUser() await simply takes long enough to span the user
    // picking a roadmap (-> '/app') and deliberately going back to
    // '/onboarding' — the exact same route string this call started on,
    // with no second onChange invocation involved at all. The
    // authChangeCallId guard alone (previous test) does nothing here, since
    // this is trivially still "the latest" call — only the router's
    // navigation-generation counter can tell "round-tripped" apart from
    // "never left."
    const { authApi } = await import('../../src/services/firebase.js');
    const { getNavGeneration } = await import('../../src/ui/router.js');
    let resolveSetUser;
    roadmapStoreSetUser.mockImplementation(() => new Promise(resolve => { resolveSetUser = resolve; }));

    window.location.hash = '#/signin';
    await import('../../src/main.js');
    await vi.waitFor(() => expect(renderSignIn).toHaveBeenCalled());

    const onAuthChange = authApi.onChange.mock.calls[0][0];

    window.location.hash = '#/onboarding';
    await vi.waitFor(() => expect(renderOnboarding).toHaveBeenCalled());
    const call = onAuthChange({ uid: 'test-uid' });

    // Round-trip away and back to the exact same route string while the
    // call's own await is still pending. jsdom's own `location.hash` setter
    // queues its own async 'hashchange' dispatch (this file's other tests
    // already note it can fire more than once per assignment), so rather
    // than count render calls (unreliable here — see those tests' own
    // comments), wait directly on the router's real nav-generation counter
    // actually increasing past where it started before moving to the next
    // step.
    const genBeforeRoundTrip = getNavGeneration();
    window.location.hash = '#/app';
    await vi.waitFor(() => expect(getNavGeneration()).toBeGreaterThan(genBeforeRoundTrip));

    const genBeforeReturn = getNavGeneration();
    window.location.hash = '#/onboarding';
    await vi.waitFor(() => expect(getNavGeneration()).toBeGreaterThan(genBeforeReturn));

    resolveSetUser();
    await call;

    expect(window.location.hash).toBe('#/onboarding');
  });
});
