const routes = new Map();
let currentCleanup = null;

export function registerRoute(path, renderFn) {
  routes.set(path, renderFn);
}

export function navigate(path, replace = false) {
  const next = path.startsWith('#') ? path : `#${path}`;
  if (replace) window.location.replace(next);
  else window.location.hash = next.slice(1);
}

export function getRoute() {
  const hash = window.location.hash.replace(/^#/, '') || '/';
  return hash.startsWith('/') ? hash : `/${hash}`;
}

export async function startRouter(fallback = '/signin') {
  const run = async () => {
    const route = getRoute();
    const renderFn = routes.get(route) || routes.get(fallback);
    if (currentCleanup) {
      currentCleanup();
      currentCleanup = null;
    }
    if (renderFn) {
      const maybeCleanup = await renderFn(route);
      if (typeof maybeCleanup === 'function') currentCleanup = maybeCleanup;
    }
  };

  window.addEventListener('hashchange', run);
  await run();
  return () => window.removeEventListener('hashchange', run);
}
