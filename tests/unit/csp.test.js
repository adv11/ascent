import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';

// Issue #345 — RTDB's long-polling fallback (used when WebSockets are blocked by a
// corporate proxy, certain mobile carriers/VPNs, or privacy modes) loads its `/.lp`
// channel via a `<script>` tag and, in some cases, an iframe — not a plain fetch/XHR
// that sw.js's cacheStrategies.js can see or influence. Confirmed live (real dev server,
// WebSocket disabled to force long-polling): the browser's own CSP silently blocked both
// the script-src and frame-src loads with no error surfaced to onValue()'s callback or
// onError() — the exact "stuck on Loading… forever" symptom, with a completely different
// root cause than issue #264's service-worker fix. Fixed by allow-listing
// https://*.firebaseio.com in both directives. This test guards the static CSP string
// directly since there's no unit-testable JS logic behind this fix — a real browser
// repro is the only way this class of regression was ever caught.
const indexHtmlPath = path.resolve(process.cwd(), 'index.html');
const indexHtml = readFileSync(indexHtmlPath, 'utf-8');
const cspMatch = indexHtml.match(/<meta http-equiv="Content-Security-Policy"\s+content="([^"]+)"/s);
const csp = cspMatch[1];

function directive(name) {
  const match = csp.match(new RegExp(`${name}\\s+([^;]+);`));
  return match ? match[1] : '';
}

describe('index.html CSP — RTDB long-polling fallback hosts', () => {
  it('allows https://*.firebaseio.com in script-src (the /.lp JSONP-style channel load)', () => {
    expect(directive('script-src')).toContain('https://*.firebaseio.com');
  });

  it('allows https://*.firebaseio.com in frame-src (the RTDB iframe fallback)', () => {
    expect(directive('frame-src')).toContain('https://*.firebaseio.com');
  });
});
