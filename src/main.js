import { authApi } from './services/firebase.js';
import { createRoadmapStore } from './services/roadmapStore.js';
import { createDailyTodoStore } from './services/dailyTodoStore.js';
import { createActivityLogStore } from './services/activityLogStore.js';
import { initTheme } from './services/theme.js';
import { migrateLocalStorageKeys } from './services/migration.js';
import { startRouter, registerRoute, navigate, getRoute, getNavGeneration } from './ui/router.js';
import { renderLanding } from './ui/pages/landing.js';
import { renderSharedRoadmapView } from './ui/pages/sharedRoadmapView.js';
import { createFeedbackWidget } from './ui/components/feedbackWidget.js';
import { registerServiceWorker } from './services/serviceWorkerRegistration.js';
import { initReminderScheduler } from './services/reminderScheduler.js';
import { showToast } from './ui/components/toast.js';
// Eager, side-effect-only import (issue #261) — registers pwaInstall.js's
// module-top-level `beforeinstallprompt`/`appinstalled` listeners at app
// boot, before any route-specific code loads. It used to only load behind
// settings.js's dynamic import() on the /settings route, which meant the
// browser's one-shot `beforeinstallprompt` event was missed for good on any
// page load that didn't visit /settings first (the common case). No export
// from this module is used here — settings.js still imports and calls
// isInstallable()/onInstallabilityChange()/promptInstall() exactly as
// before; only the import timing/site changed.
import './services/pwaInstall.js';

migrateLocalStorageKeys();
initTheme();
registerServiceWorker();

// Issue #19 — sw.js's network-first strategy already falls back to stale
// cached data on its own; this toast is just the user-visible signal that
// happened, since silently serving stale data would look like the sync
// pill simply stopped updating with no explanation.
window.addEventListener('offline', () => showToast("You're offline — showing last synced data.", 'info'));

const app = document.getElementById('app');
const activityLogStore = createActivityLogStore();
// onCompletionToggle (issue #8) is injected rather than importing
// activityLogStore.js from inside roadmapStore.js — keeps roadmapStore.js
// independently testable with no args (see its own doc comment) while still
// recording every done-transition, from any call site, in one place.
const store = createRoadmapStore({
  onCompletionToggle: delta => (delta > 0 ? activityLogStore.recordCompletion() : activityLogStore.recordUncompletion())
});
const dailyTodoStore = createDailyTodoStore();
// App-lifetime, never unmounted — same precedent as feedbackWidget.js above
// (issue #132).
initReminderScheduler(dailyTodoStore);

let currentUser = null;
let routeCleanup = null;

// Mounted once, directly on document.body, outside the router (issue #9) —
// must never be unmounted/re-mounted on route change, see CLAUDE.md.
const feedbackWidget = createFeedbackWidget({ user: null });
document.body.appendChild(feedbackWidget);

// The actual root cause of issue #294's CI flake (tests/e2e/
// customRoadmapRace.test.js), found by adding temporary debug logging and
// reproducing locally against a real Firebase emulator — every previous fix
// attempt on authApi.onChange (below) was chasing a real but unrelated
// class of bug. router.js's own `run()` tracks a `currentCleanup`, but a
// guarded route's renderFn (this function's return value) is `async` and
// never itself returns a cleanup synchronously reachable by `run()` — the
// real cleanup lives in this closure's own `routeCleanup` variable instead,
// entirely decoupled from router.js's sequencing. Nothing here guarded
// against two overlapping invocations: if route A's render (e.g. `/app`,
// mid a slow first-ever dynamic import() of dashboard.js's whole module
// graph) is still awaiting when route B's render (e.g. `/onboarding`, from
// a deliberate second visit, its own module already cached and fast) starts
// and finishes first, route A's *later*-resolving continuation would still
// run to completion afterward — calling `app.replaceChildren(...)` inside
// route B's already-mounted page and silently overwriting it, with no
// `navigate()` call and no router.js `hashchange` involved at all, which is
// exactly why every guard added to authApi.onChange had zero effect: the
// bug was never there. `routeRenderCallId` is the same `stateCallId`
// pattern used throughout this codebase for this exact class of problem
// (`.claude/rules/roadmap-store.md`) — only the most recently *started*
// guarded render is allowed to mount or assign `routeCleanup`; an earlier,
// slower one recognizes it's been superseded and abandons itself entirely
// once its own await resolves, never touching the DOM.
let routeRenderCallId = 0;

// `renderFn` receives an extra `isStale()` argument — every actual page
// render function (renderDashboard/renderOnboarding/etc.) mutates the DOM
// *synchronously* the moment it's called, so the only safe place to check
// staleness is *before* that call, not after (by then the clobbering
// already happened as an unavoidable side effect of calling it at all).
// lazyGuard below is the only real caller and is the one place with an
// async gap (the dynamic import) between "this call started" and "it's
// about to mutate the DOM."
function guardApp(renderFn) {
  return async ctx => {
    const callId = ++routeRenderCallId;
    if (routeCleanup) {
      routeCleanup();
      routeCleanup = null;
    }
    const result = await renderFn(app, { ...ctx, user: currentUser, store, dailyTodoStore, activityLogStore }, () => callId !== routeRenderCallId);
    if (callId !== routeRenderCallId) {
      // Superseded while resolving. renderFn (lazyGuard) is expected to
      // have already skipped calling the real page render function once it
      // saw isStale() — result should be undefined here — but tear down
      // defensively if it somehow returned a live cleanup anyway, and never
      // touch routeCleanup (a newer render already owns it).
      if (typeof result === 'function') result();
      return;
    }
    routeCleanup = result || null;
  };
}

// Wraps a route's render function behind a dynamic import() so a signed-out
// visitor's initial page load only fetches the page module(s) their current
// route actually needs (issue #137) — same lazy-load technique
// chartWrapper.js already uses for Chart.js, applied to the app's own page
// modules instead of a third-party one. loadModule() is only invoked the
// first time the route is actually navigated to.
function lazyGuard(loadModule, renderKey) {
  return guardApp(async (appEl, ctx, isStale) => {
    const module = await loadModule();
    // A newer route render already started while this dynamic import() was
    // in flight — the only async gap in this whole call chain, and
    // therefore the only place a stale invocation can still be caught
    // before it mutates the DOM. Skip calling the real page render
    // function entirely; returning undefined here means guardApp's own
    // staleness check (redundant but harmless) has nothing to tear down.
    if (isStale()) return undefined;
    return module[renderKey](appEl, ctx);
  });
}

let dashboardPreloaded = false;
// dashboard.js is the single most-visited authenticated route (issue #137
// Phase 2) — once we know a just-resolved sign-in is about to redirect to
// '/app', start fetching/compiling its module graph via a <link
// rel="modulepreload"> hint a beat early, rather than waiting for the
// dynamic import() inside the '/app' route's own lazyGuard() to kick it off
// only once the router actually runs the route. Idempotent (a second call
// is a no-op). A user who bookmarks straight to '/app' never hits this call
// site at all — that path's own lazy import() is already the earliest
// possible fetch, so there's nothing to warm ahead of it.
function preloadDashboardModule() {
  if (dashboardPreloaded) return;
  dashboardPreloaded = true;
  const link = document.createElement('link');
  link.rel = 'modulepreload';
  link.href = new URL('./ui/pages/dashboard.js', import.meta.url).href;
  document.head.appendChild(link);
}

// Guards against a second (or later) authApi.onChange invocation — a real
// occurrence, not hypothetical: Firebase's onAuthStateChanged can fire more
// than once for what's conceptually a single sign-in (token refresh, or an
// emulator/SDK double-emission around sign-up — tests/unit/main.test.js's
// own "a second resolution (e.g. a token refresh)" case already exercises
// this). `authChangeCallId` follows the exact `stateCallId` pattern
// roadmapStore.js already uses for this class of problem (see
// .claude/rules/roadmap-store.md's "stale-call guard") — only the most
// recently *started* invocation is allowed to act once its own await
// resolves; every earlier one abandons its navigation decision entirely.
let authChangeCallId = 0;

// The actual root cause of issue #294 (tests/e2e/customRoadmapRace.test.js
// flaking ~5/6 CI runs): the "already-onboarded, redirect off /onboarding
// or a public route to /app" logic below used to run on *every* onChange
// invocation, including a token-refresh (or emulator double-emission)
// re-fire for a uid that was already signed in — not just a genuine
// sign-in transition. Two earlier fix attempts (a route-string comparison,
// then a navigation-generation counter — both still present below, both
// genuinely correct for the races they target) treated this as a
// staleness/timing problem and didn't fix the CI repro, because the
// invocation that does the damage isn't stale at all: it's a perfectly
// "current" re-fire for the same uid that happens to land while the user
// is deliberately sitting on '/onboarding' again (e.g. picking a second
// roadmap) — no coincidence or race required. `lastAuthUid` (a sentinel,
// not `undefined`, so the very first boot call — uid transitioning from
// "never seen" to whatever it is — always counts as a genuine sign-in)
// tracks the most recently *seen* uid; `isSignInTransition` is captured
// synchronously at the very top of each invocation, before any await, so
// it reflects whether *this specific call* represents an actual uid change
// — a token refresh for an unchanged uid is never a sign-in transition, no
// matter how many other invocations race around it.
const NO_UID_SEEN_YET = Symbol('no-uid-seen-yet');
let lastAuthUid = NO_UID_SEEN_YET;

// Awaits setUser so the onboarding-needed decision below always sees this
// sign-in's resolved state (Issue #51) — never a stale value from the previous user.
authApi.onChange(async user => {
  const callId = ++authChangeCallId;
  const isSignInTransition = user?.uid !== lastAuthUid;
  lastAuthUid = user?.uid ?? null;
  currentUser = user;
  feedbackWidget._setUser(user);
  // Captured *before* the await below, specifically to detect whether the
  // user (or, in a test, an explicit page.goto) navigated elsewhere while
  // this auth resolution was still in flight. router.js's getNavGeneration()
  // bumps on *every* processed navigation, so a round trip back to the
  // exact same route string (e.g. /onboarding -> /app -> /onboarding) still
  // registers as "something navigated," where a bare route-string
  // comparison would wrongly read it as "nothing changed." Kept alongside
  // `isSignInTransition` below — each guards a genuinely different variant
  // of "should this invocation be allowed to force-navigate."
  const navGenAtAuthChange = getNavGeneration();
  await Promise.all([store.setUser(user), dailyTodoStore.setUser(user), activityLogStore.setUser(user)]);
  // A newer onChange invocation already started (and will make its own,
  // fresher navigation decision) — this one's view of the world is stale,
  // abandon it entirely rather than let a coincidental route match trigger
  // a wrong redirect.
  if (callId !== authChangeCallId) return;

  const route = getRoute();
  const publicRoutes = ['/', '/signin', '/signup'];
  // '/shared' carries a query-string shareId (router.js has no param
  // support — see its 'matchRoute' prefix-match comment), so it's checked
  // by prefix, not an exact publicRoutes entry. Reachable signed-out *and*
  // signed-in — showing someone else's shared roadmap must never force a
  // detour through sign-in.
  const isSharedRoute = route.startsWith('/shared');

  if (!user) {
    if (!publicRoutes.includes(route) && !isSharedRoute) navigate('/signin', true);
    return;
  }
  if (isSharedRoute) return;

  if (!store.getSnapshot().onboardingDone) {
    if (route !== '/onboarding') navigate('/onboarding', true);
    return;
  }
  // Only auto-redirect an already-onboarded user off a public route or the
  // onboarding picker on an actual sign-in transition (`isSignInTransition`)
  // — never on a re-fire for a uid that was already signed in (a token
  // refresh, or an emulator/SDK double-emission), which must be free to
  // land while the user is deliberately sitting on '/onboarding' (e.g.
  // picking a second roadmap) without getting bounced to '/app'. This is
  // the actual fix for issue #294's CI repro (tests/e2e/
  // customRoadmapRace.test.js) — two earlier attempts here treated it as a
  // staleness/timing problem (a route-string comparison, then
  // `getNavGeneration()`, both kept below as they're still independently
  // correct for the races they target) and didn't close the real gap: the
  // invocation that does the damage is a perfectly *current*, non-stale
  // re-fire for an unchanged uid, not a delayed/superseded one.
  // `getNavGeneration() === navGenAtAuthChange` still matters on top of
  // that: even on a genuine sign-in transition, don't clobber a navigation
  // that happened to race with this callback's own store.setUser() await
  // (the original issue #234 scenario).
  if (isSignInTransition && getNavGeneration() === navGenAtAuthChange
    && (publicRoutes.includes(route) || route === '/onboarding')) {
    preloadDashboardModule();
    navigate('/app', true);
  }
});

registerRoute('/signin', lazyGuard(() => import('./ui/pages/signIn.js'), 'renderSignIn'));
registerRoute('/signup', lazyGuard(() => import('./ui/pages/signUp.js'), 'renderSignUp'));
registerRoute('/onboarding', lazyGuard(() => import('./ui/pages/onboarding.js'), 'renderOnboarding'));
registerRoute('/app', lazyGuard(() => import('./ui/pages/dashboard.js'), 'renderDashboard'));
registerRoute('/settings', lazyGuard(() => import('./ui/pages/settings.js'), 'renderSettings'));
registerRoute('/progress', lazyGuard(() => import('./ui/pages/progress.js'), 'renderProgress'));
// Wildcard prefix match ('/shared*') — unauthenticated-reachable, not routed
// through guardApp, since it renders someone else's published snapshot, not
// the current user's own data (see router.js's matchRoute for the pattern).
registerRoute('/shared*', () => renderSharedRoadmapView(app));
// Marketing landing page for signed-out visitors (issue #6 Phase 6); an
// already-signed-in user is bounced to '/app' here instead of ever rendering
// it — the authApi.onChange listener above additionally treats '/' as a
// public route and redoes this same check once auth state resolves, in case
// it resolves after this initial render already ran.
registerRoute('/', () => {
  if (currentUser) {
    navigate('/app', true);
    return;
  }
  renderLanding(app);
});

startRouter('/signin');
