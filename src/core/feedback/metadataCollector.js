// Pure metadata collection for the in-app feedback system (issue #9) — parses
// navigator.userAgent/viewport/theme into the shape §5 of the issue specifies.
// Never collects email, roadmap content, or localStorage contents — only
// what's listed here. Dependency-injected (no direct `window`/`navigator`
// reference at module scope) so this stays unit-testable without jsdom
// globals leaking in unexpectedly, same reasoning authCleanup.js gives for
// staying pure and dependency-free.

// This app has no build-time version stamping — a small, manually bumped
// constant is enough for a bug report's "what version were they on" context.
export const APP_VERSION = '1.0.0';

function parseBrowser(userAgent) {
  const ua = userAgent || '';
  const patterns = [
    ['Edg/', 'Edge'],
    ['OPR/', 'Opera'],
    ['Chrome/', 'Chrome'],
    ['CriOS/', 'Chrome'],
    ['Firefox/', 'Firefox'],
    ['FxiOS/', 'Firefox'],
    ['Safari/', 'Safari']
  ];
  for (const [marker, name] of patterns) {
    const idx = ua.indexOf(marker);
    if (idx === -1) continue;
    const version = ua.slice(idx + marker.length).split(/[\s;)]/)[0].split('.')[0];
    return version ? `${name} ${version}` : name;
  }
  return 'Unknown browser';
}

function parseOs(userAgent) {
  const ua = userAgent || '';
  if (/Windows/.test(ua)) return 'Windows';
  if (/Mac OS X/.test(ua)) return 'macOS';
  if (/Android/.test(ua)) return 'Android';
  if (/iPhone|iPad|iPod/.test(ua)) return 'iOS';
  if (/Linux/.test(ua)) return 'Linux';
  return 'Unknown OS';
}

// deps are all injected so this never reaches for a global directly —
// callers (metadataCollector.js's own default export below, tests) supply
// them explicitly.
export function collectMetadata({ userAgent, innerWidth, innerHeight, devicePixelRatio, route, theme, userId, isAnonymous }) {
  return {
    browser: parseBrowser(userAgent),
    os: parseOs(userAgent),
    viewport: `${innerWidth}×${innerHeight}`,
    devicePixelRatio: devicePixelRatio || 1,
    currentRoute: route || '',
    appVersion: APP_VERSION,
    theme: theme || 'light',
    userId: userId || null,
    isAnonymous: !!isAnonymous
  };
}

// Convenience wrapper reading the real browser globals — the one call site
// used by feedbackForm.js; collectMetadata() above stays the pure/testable
// core.
export function collectCurrentMetadata({ route, theme, user }) {
  return collectMetadata({
    userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : '',
    innerWidth: typeof window !== 'undefined' ? window.innerWidth : 0,
    innerHeight: typeof window !== 'undefined' ? window.innerHeight : 0,
    devicePixelRatio: typeof window !== 'undefined' ? window.devicePixelRatio : 1,
    route,
    theme,
    userId: user?.uid || null,
    isAnonymous: !!user?.isAnonymous
  });
}
