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

migrateLocalStorageKeys();
initTheme();

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
  await Promise.all([store.setUser(user), dailyTodoStore.setUser(user), activityLogStore.setUser(user)]);

  const route = getRoute();
  const publicRoutes = ['/', '/signin', '/signup'];

  if (!user) {
    if (!publicRoutes.includes(route)) navigate('/signin', true);
    return;
  }

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
