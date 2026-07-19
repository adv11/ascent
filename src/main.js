import { authApi } from './services/firebase.js';
import { createRoadmapStore } from './services/roadmapStore.js';
import { createDailyTodoStore } from './services/dailyTodoStore.js';
import { createActivityLogStore } from './services/activityLogStore.js';
import { initTheme } from './services/theme.js';
import { migrateLocalStorageKeys } from './services/migration.js';
import { startRouter, registerRoute, navigate, getRoute } from './ui/router.js';
import { renderLanding } from './ui/pages/landing.js';
import { renderSharedRoadmapView } from './ui/pages/sharedRoadmapView.js';
import { createFeedbackWidget } from './ui/components/feedbackWidget.js';
import { registerServiceWorker } from './services/serviceWorkerRegistration.js';
import { initReminderScheduler } from './services/reminderScheduler.js';
import { showToast } from './ui/components/toast.js';

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

function guardApp(renderFn) {
  return async ctx => {
    if (routeCleanup) {
      routeCleanup();
      routeCleanup = null;
    }
    routeCleanup = (await renderFn(app, { ...ctx, user: currentUser, store, dailyTodoStore, activityLogStore })) || null;
  };
}

// Wraps a route's render function behind a dynamic import() so a signed-out
// visitor's initial page load only fetches the page module(s) their current
// route actually needs (issue #137) — same lazy-load technique
// chartWrapper.js already uses for Chart.js, applied to the app's own page
// modules instead of a third-party one. loadModule() is only invoked the
// first time the route is actually navigated to.
function lazyGuard(loadModule, renderKey) {
  return guardApp(async (...args) => {
    const module = await loadModule();
    return module[renderKey](...args);
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

// Awaits setUser so the onboarding-needed decision below always sees this
// sign-in's resolved state (Issue #51) — never a stale value from the previous user.
authApi.onChange(async user => {
  currentUser = user;
  feedbackWidget._setUser(user);
  // Captured *before* the await below, specifically to detect whether the
  // user (or, in a test, an explicit page.goto) navigated elsewhere while
  // this auth resolution was still in flight — see the staleness check
  // below for why this matters.
  const routeAtAuthChange = getRoute();
  await Promise.all([store.setUser(user), dailyTodoStore.setUser(user), activityLogStore.setUser(user)]);

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
  // onboarding picker if the route hasn't changed since this callback
  // started — a real, reproduced race (found reproducing tests/e2e/
  // customRoadmapRace.test.js locally): store.setUser()'s Firebase round
  // trip can still be in flight after signIn.js's own success handler has
  // already navigated to '/app', and if the user (or a test) then
  // deliberately re-enters '/onboarding' — e.g. the dashboard's "Switch
  // template" link — while this callback is still awaiting, it used to read
  // the *current* route once the await resolved and force-navigate back to
  // '/app', silently clobbering that deliberate navigation. `route ===
  // routeAtAuthChange` means nothing navigated away during the await, so
  // this is still the original "just landed here from sign-in" case the
  // redirect exists for.
  if (route === routeAtAuthChange && (publicRoutes.includes(route) || route === '/onboarding')) {
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
