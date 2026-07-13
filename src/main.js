import { authApi } from './services/firebase.js';
import { createRoadmapStore } from './services/roadmapStore.js';
import { createDailyTodoStore } from './services/dailyTodoStore.js';
import { createActivityLogStore } from './services/activityLogStore.js';
import { initTheme } from './services/theme.js';
import { migrateLocalStorageKeys } from './services/migration.js';
import { startRouter, registerRoute, navigate, getRoute } from './ui/router.js';
import { renderSignIn } from './ui/pages/signIn.js';
import { renderSignUp } from './ui/pages/signUp.js';
import { renderDashboard } from './ui/pages/dashboard.js';
import { renderOnboarding } from './ui/pages/onboarding.js';
import { renderSettings } from './ui/pages/settings.js';
import { renderProgress } from './ui/pages/progress.js';
import { renderLanding } from './ui/pages/landing.js';
import { renderSharedRoadmapView } from './ui/pages/sharedRoadmapView.js';
import { createFeedbackWidget } from './ui/components/feedbackWidget.js';
import { registerServiceWorker } from './services/serviceWorkerRegistration.js';
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

let currentUser = null;
let routeCleanup = null;

// Mounted once, directly on document.body, outside the router (issue #9) —
// must never be unmounted/re-mounted on route change, see CLAUDE.md.
const feedbackWidget = createFeedbackWidget({ user: null });
document.body.appendChild(feedbackWidget);

function guardApp(renderFn) {
  return ctx => {
    if (routeCleanup) {
      routeCleanup();
      routeCleanup = null;
    }
    routeCleanup = renderFn(app, { ...ctx, user: currentUser, store, dailyTodoStore, activityLogStore }) || null;
  };
}

// Awaits setUser so the onboarding-needed decision below always sees this
// sign-in's resolved state (Issue #51) — never a stale value from the previous user.
authApi.onChange(async user => {
  currentUser = user;
  feedbackWidget._setUser(user);
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
  if (publicRoutes.includes(route) || route === '/onboarding') {
    navigate('/app', true);
  }
});

registerRoute('/signin', guardApp(renderSignIn));
registerRoute('/signup', guardApp(renderSignUp));
registerRoute('/onboarding', guardApp(renderOnboarding));
registerRoute('/app', guardApp(renderDashboard));
registerRoute('/settings', guardApp(renderSettings));
registerRoute('/progress', guardApp(renderProgress));
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
