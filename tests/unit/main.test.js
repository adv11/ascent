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
// A controllable gate on dashboard.js's own dynamic import() — main.js's
// lazyGuard() awaits `import('./ui/pages/dashboard.js')` before ever
// calling renderDashboard, so delaying *this* (not renderDashboard itself,
// which is synchronous) is what reproduces issue #294's real race: a route
// render whose module import is still in flight when a newer route render
// (e.g. onboarding, its own module already resolved) finishes first.
let dashboardImportGate = null;
vi.mock('../../src/ui/pages/dashboard.js', async () => {
  if (dashboardImportGate) await dashboardImportGate;
  return { renderDashboard };
});

const renderOnboarding = vi.fn(() => undefined);
vi.mock('../../src/ui/pages/onboarding.js', () => ({ renderOnboarding }));

beforeEach(() => {
  vi.resetModules();
  signInCleanup.mockClear();
  renderSignIn.mockClear();
  renderDashboard.mockClear();
  renderOnboarding.mockClear();
  roadmapStoreSetUser.mockReset().mockImplementation(() => Promise.resolve());
  dashboardImportGate = null;
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

  it('a same-uid onChange re-fire (e.g. a token refresh) must not bounce the user off a route they are currently, deliberately sitting on (issue #294, a real fix, but not the actual CI root cause — see the guardApp test below for that)', async () => {
    // Neither guard above (authChangeCallId, getNavGeneration) catches
    // this — this invocation isn't stale and there's no round trip: it's a
    // perfectly *current* re-fire for a uid that was already signed in,
    // landing while the user is simply, currently on '/onboarding' (no
    // navigation before or after it). Only isSignInTransition distinguishes
    // this from a genuine sign-in.
    const { authApi } = await import('../../src/services/firebase.js');

    window.location.hash = '#/signin';
    await import('../../src/main.js');
    await vi.waitFor(() => expect(renderSignIn).toHaveBeenCalled());

    const onAuthChange = authApi.onChange.mock.calls[0][0];

    // Genuine sign-in — establishes lastAuthUid.
    await onAuthChange({ uid: 'test-uid' });

    // The user deliberately navigates to '/onboarding' (e.g. to pick a
    // second roadmap) and stays there — no further navigation.
    window.location.hash = '#/onboarding';
    await vi.waitFor(() => expect(renderOnboarding).toHaveBeenCalled());

    // A token refresh (or any other re-fire) for the *same* uid resolves
    // instantly while the user is still sitting on '/onboarding'.
    await onAuthChange({ uid: 'test-uid' });

    expect(window.location.hash).toBe('#/onboarding');
  });

  it('a slower route render (dashboard.js\'s dynamic import still in flight) must not clobber a faster, newer route render that already finished (issue #294, the actual CI root cause, found by reproducing locally against a real Firebase emulator with debug instrumentation)', async () => {
    // None of the authApi.onChange guards above are involved in this bug at
    // all — main.js's own route-render wrapper (guardApp/lazyGuard) had no
    // staleness guard of its own. router.js's `currentCleanup` tracking is
    // a no-op for guarded routes (a guarded route's renderFn is async and
    // never synchronously returns its cleanup to router.js's `run()`); the
    // real cleanup lives entirely inside main.js's own closure. If route A's
    // render (here, dashboard.js's first-ever dynamic import, deliberately
    // slow) is still awaiting when route B's render (onboarding, its module
    // already resolved) starts and finishes first, route A's *later*
    // continuation used to still run to completion and call
    // `app.replaceChildren(...)`, clobbering route B — no navigate() call,
    // no hashchange, nothing router.js's own sequencing could see.
    let resolveDashboardImport;
    dashboardImportGate = new Promise(resolve => { resolveDashboardImport = resolve; });

    window.location.hash = '#/app';
    await import('../../src/main.js');
    // The initial route render for '/app' has started; its dashboard.js
    // import is gated and won't resolve until told to below.

    window.location.hash = '#/onboarding';
    window.dispatchEvent(new HashChangeEvent('hashchange'));
    await vi.waitFor(() => expect(renderOnboarding).toHaveBeenCalled());

    // Now let the stale '/app' render's dashboard.js import finally
    // resolve, well after onboarding already won.
    resolveDashboardImport();
    await new Promise(resolve => setTimeout(resolve, 50));

    // The real page render function must never be called for a superseded
    // route — that's the only way to guarantee it can't mutate the DOM.
    expect(renderDashboard).not.toHaveBeenCalled();
  });
});
