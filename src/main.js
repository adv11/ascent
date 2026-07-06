import { authApi } from './services/firebase.js';
import { createRoadmapStore } from './services/roadmapStore.js';
import { initTheme } from './services/theme.js';
import { migrateLocalStorageKeys } from './services/migration.js';
import { startRouter, registerRoute, navigate, getRoute } from './ui/router.js';
import { renderSignIn } from './ui/pages/signIn.js';
import { renderSignUp } from './ui/pages/signUp.js';
import { renderDashboard } from './ui/pages/dashboard.js';
import { renderOnboarding } from './ui/pages/onboarding.js';

migrateLocalStorageKeys();
initTheme();

const app = document.getElementById('app');
const store = createRoadmapStore();

let currentUser = null;
let routeCleanup = null;

function guardApp(renderFn) {
  return ctx => {
    if (routeCleanup) {
      routeCleanup();
      routeCleanup = null;
    }
    routeCleanup = renderFn(app, { ...ctx, user: currentUser, store }) || null;
  };
}

// Awaits setUser so the onboarding-needed decision below always sees this
// sign-in's resolved state (Issue #51) — never a stale value from the previous user.
authApi.onChange(async user => {
  currentUser = user;
  await store.setUser(user);

  const route = getRoute();
  const publicRoutes = ['/signin', '/signup'];

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
registerRoute('/', () => navigate(currentUser ? '/app' : '/signin', true));

startRouter('/signin');
