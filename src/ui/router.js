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

// Exact-match lookup first; falls back to a registered prefix pattern ending
// in '*' (e.g. '/shared*' matches '/shared?id=abc123') — router.js has no
// real param support, so a dynamic segment is encoded as a query string on
// the hash instead (issue #131's `#/shared?id=...` route) rather than
// building out full `:param` matching for a single call site.
function matchRoute(route) {
  if (routes.has(route)) return routes.get(route);
  for (const [pattern, fn] of routes) {
    if (pattern.endsWith('*') && route.startsWith(pattern.slice(0, -1))) return fn;
  }
  return null;
}

export async function startRouter(fallback = '/signin') {
  const run = async () => {
    const route = getRoute();
    const renderFn = matchRoute(route) || routes.get(fallback);
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
