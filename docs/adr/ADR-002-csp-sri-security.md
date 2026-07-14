# ADR-002: CSP + SRI security hardening — inline script extraction and CDN integrity

**Date**: 2026-07-05
**Status**: Active
**Deciders**: solo project — adv01
**Issue**: #25

## Context

SwitchPrep loads three Firebase SDK ES modules from `https://www.gstatic.com/firebasejs/10.12.5/`
via bare CDN URLs with no integrity check. There is no Content Security Policy, leaving
the app open to XSS-via-injected-script, clickjacking (iframe embedding), and MIME
sniffing. The only barrier is Same-Origin Policy, which does not block script injection
from the same page.

Three concrete attack vectors closed by this ADR:

1. **CDN supply-chain compromise** — a BGP hijack or DNS poisoning of `gstatic.com` could
   serve attacker-controlled JS with full access to Firebase credentials and `localStorage`.
2. **Injected inline scripts** — without CSP, any XSS vector that gets text into the DOM
   (e.g., via a future `innerHTML` regression) can inject runnable scripts.
3. **Clickjacking** — without `X-Frame-Options: DENY`, the app can be embedded in a
   hostile `<iframe>` and overlaid with transparent UI elements to steal clicks.

## Decision

### Phase A — Firebase Hosting security headers (`firebase.json`)

Add a `hosting` block to `firebase.json` with five headers applied to all routes:

- `Strict-Transport-Security: max-age=31536000; includeSubDomains` — blocks HTTPS
  downgrade attacks for one year, including all subdomains.
- `X-Frame-Options: DENY` — prevents clickjacking via iframes (belt-and-suspenders with
  CSP's `frame-ancestors 'none'`).
- `X-Content-Type-Options: nosniff` — prevents MIME-type sniffing (e.g. loading a JSON
  file as a script).
- `Referrer-Policy: strict-origin-when-cross-origin` — sends only the origin (not the
  full URL) in cross-origin `Referer` headers.
- `Permissions-Policy: camera=(), microphone=(), geolocation=()` — opts out of powerful
  browser features the app does not use.

### Phase B — Content Security Policy (`index.html` meta tag)

The CSP requires no inline scripts. The original theme bootstrap was an inline IIFE;
this must be extracted to an external file so the CSP's `script-src` can be limited to
`'self' https://www.gstatic.com` without `'unsafe-inline'`.

**Why external file instead of a nonce?**
- Nonces must be generated server-side on every request. This is a fully static site
  served by Firebase Hosting (or `python3 -m http.server` locally). There is no
  server-side templating layer.
- `'unsafe-hashes'` (hash-based CSP for inline scripts) is only supported in CSP Level 3
  and is not universally supported across browser versions yet.
- Extracting the 4-line IIFE to `src/services/themeBootstrap.js` is simpler and makes
  the bootstrap independently testable.

**The theme-before-CSS guarantee is preserved**: `themeBootstrap.js` is loaded as a
classic `<script src="...">` (no `defer`, no `async`, no `type="module"`). The browser
blocks HTML parsing until the script is fetched and executed, so `data-theme` is set on
`<html>` before the CSSOM is built. This is the same timing guarantee as the original
inline script.

CSP directives chosen:

| Directive | Value | Reason |
|---|---|---|
| `default-src` | `'self'` | Catchall — only same-origin resources allowed by default |
| `script-src` | `'self' https://www.gstatic.com https://cdn.jsdelivr.net https://apis.google.com` | Firebase SDK CDN modules, lazy-loaded Chart.js (see the "CDN loading exceptions" section below), and Firebase Auth's own internal cross-tab/iframe script (see "apis.google.com allowlist entry" below) |
| `style-src` | `'self' https://fonts.googleapis.com` | Google Fonts CSS |
| `font-src` | `https://fonts.gstatic.com` | Google Fonts font files |
| `connect-src` | `https://*.firebaseio.com https://identitytoolkit.googleapis.com https://securetoken.googleapis.com wss://*.firebaseio.com http://127.0.0.1:9099 http://127.0.0.1:9000 ws://127.0.0.1:9000` | Firebase Realtime Database (HTTPS + WebSocket), Auth REST, token refresh, plus the local Auth/Database emulator ports used by `FIREBASE_CONFIGURED=true` E2E runs (`connectAuthEmulator`/`connectDatabaseEmulator` in `firebase.js`) |
| `img-src` | `'self' data:` | Allows inline SVG data URIs (used by favicon/icons) |
| `frame-src` | `https://*.firebaseapp.com` | The `apis.google.com` gapi loader (see "apis.google.com allowlist entry" below) opens a hidden cross-tab auth-state iframe against the Firebase project's own `<project-id>.firebaseapp.com` auth domain — wildcarded (matching `connect-src`'s existing `https://*.firebaseio.com` pattern) since each deployment of this codebase has its own project-specific `authDomain` |
| `frame-ancestors` | `'none'` | Belt-and-suspenders with X-Frame-Options: DENY |

The `127.0.0.1` emulator entries only matter when `window.__USE_FIREBASE_EMULATOR__` is
set (CI E2E and local emulator testing per issue #37) — production and normal local dev
never call those code paths, but the CSP is a static meta tag with no per-environment
templating, so the origins have to be allowed unconditionally. Without them, the browser
silently blocks `connectAuthEmulator`/`connectDatabaseEmulator`'s requests, guest sign-in
never completes, and every E2E test gated behind it times out waiting for `.dashboard`.

### Phase C — Subresource Integrity for Firebase SDK (`index.html` modulepreload)

ES module imports (`import { ... } from 'https://...'`) cannot carry inline `integrity`
attributes in the import statement itself (not yet part of the HTML spec). The correct
mechanism is `<link rel="modulepreload" integrity="sha384-...">` in `<head>`. The browser
validates the hash before adding the module to the module map; the subsequent dynamic
import resolves from the (already-validated) module map.

SRI hashes computed at implementation time:

```
firebase-app.js      sha384-znyovRzngjkxL8fWwERhttfl3ktWuL26X6KiQCV0M+l1dCcS8xQTASvz/uSKyxdL
firebase-auth.js     sha384-K1EbNeOM8wMXfcJAC/swEwz6VFy4wAK+KoBXYltJg9sy6jFj0yCTWfVEgFI4tVNp
firebase-database.js sha384-QTGc3vdsjQWaJFRX+uOJCkVRby8Q010Dat5Ve3tIKMHISniPOS3XaDLHVRlxmLE+
```

Command to regenerate:
```sh
curl -s https://www.gstatic.com/firebasejs/10.12.5/firebase-app.js | openssl dgst -sha384 -binary | base64
```

## SDK upgrade process

Firebase CDN URLs are versioned (`/10.12.5/`). They do not change content at a given
version URL — but when upgrading to a new version:

1. Update the import URLs in `src/services/firebase.js` to the new version path.
2. Recompute SRI hashes for the new version (use the `openssl` command above).
3. Update all three `integrity="sha384-..."` attributes in `index.html`.
4. Update the hash table in this ADR.

Failing to update all four of these will cause the browser to reject the module (hash
mismatch) and the app will fail to boot.

## Alternatives considered

**Server-side nonce (rejected)**: Would require a Node.js server or edge function. The
project deliberately has no server-side runtime; adding one just for CSP nonces is
disproportionate.

**`'unsafe-inline'` for script-src (rejected)**: Completely defeats the purpose of CSP
for script injection attacks.

**`'unsafe-hashes'` (deferred)**: Would allow keeping the inline IIFE with a hash-based
CSP. Deferred because browser support is still incomplete and the inline IIFE provides no
testing surface. The external file approach is strictly better.

**No CSP at all (rejected)**: Unacceptable for a product moving toward public launch.
Closes a class of XSS attacks at zero runtime cost.

## CDN loading exceptions (added 2026-07-11, issue #8)

Chart.js (`src/ui/components/chartWrapper.js`) is the first CDN script this app loads
that **cannot** follow the Firebase SDK's `modulepreload` + SRI pattern above, because
the two requirements are in direct tension for this specific case:

- The issue explicitly wants Chart.js **lazy-loaded, only on a user's first visit to
  `#/progress`** — not fetched on every app load the way `modulepreload` (which is
  unconditional, regardless of whether the current route ever uses it) would force.
- A dynamic `import()` call (the only mechanism that achieves that lazy load) **cannot
  carry an `integrity` attribute** — SRI on a dynamically-imported ES module is not
  something any browser supports today; only `<script>`/`<link>` tags can.

Given that tradeoff, `cdn.jsdelivr.net` was added to `script-src` (still an allowlisted,
specific host — not `unsafe-inline`/a wildcard), and `chartWrapper.js` pins an *exact*
released version (`chart.js@4.4.4`, not `@latest`) in its dynamic `import()` URL — a
versioned jsdelivr path is immutable (the bytes at that URL cannot change without
publishing a new Chart.js release), which is a weaker guarantee than a cryptographic
hash but still rules out the "attacker mutates the file at the same URL" class of
supply-chain attack SRI exists to close. This is a **deliberate, documented gap**, not an
oversight: if a stronger guarantee becomes necessary (e.g. Chart.js is used somewhere
CSP-critical, not just an authenticated user's own analytics view), the fallback is to
drop lazy-loading and go back to an eager `modulepreload` + SRI tag, accepting the
extra unconditional network request on every page load.

## `apis.google.com` allowlist entry (added 2026-07-14, issue #168)

A Lighthouse run against the landing page surfaced a CSP violation on every page load:
`https://apis.google.com/js/api.js?onload=...` was being blocked by `script-src`. Root
cause: the Firebase Auth SDK (`firebase-auth.js`, loaded by `src/services/firebase.js`)
internally attempts to load this script as part of its own cross-tab auth-state/iframe
persistence machinery — this happens unconditionally, regardless of whether the app
itself ever calls a Google-OAuth-specific API. This app only uses email/password and
anonymous auth (confirmed via `src/services/firebase.js`), but the SDK's internal
plumbing still reaches for this domain.

Same allowlist pattern as `gstatic.com`/`jsdelivr.net` above: a specific, named host
added to `script-src`, not a wildcard or `unsafe-inline`. `https://apis.google.com` was
added to `index.html`'s CSP meta tag. No SRI hash applies here — this script is loaded
internally by the Firebase Auth SDK itself, not by an `import`/`<script>` tag this app
controls directly, so there's no call site to attach a `modulepreload`/`integrity`
attribute to (the same constraint documented for the Chart.js/jsdelivr entry above,
for a different reason).

**Follow-up found by re-running a real Lighthouse pass (same day):** allowlisting the
script alone was not sufficient — once `apis.google.com`'s gapi loader actually runs, it
opens a hidden iframe against the Firebase project's own `<project-id>.firebaseapp.com`
auth domain for the same cross-tab persistence purpose, which was blocked by
`default-src 'self'` (no `frame-src` was set, so `default-src` was the fallback for
frame loads too) — a second, previously undetected CSP violation, invisible until the
gapi script itself actually executed. A `frame-src https://*.firebaseapp.com` directive
was added (see the directive table above) to close this. Verified with a real
`npx lighthouse` run (not just a manual DevTools console check) before and after: before,
`inspector-issues` scored 0 with a `frame-ancestors`-in-`<meta>`-tag CSP block reported
against `switchprep-adv26.firebaseapp.com`; after, `inspector-issues` scores 1 (clean).
`errors-in-console` still reports a nonzero item, but the only one left is the
pre-existing, already-documented `frame-ancestors`-in-`<meta>`-tag notice (see the
"Noted, not actioned" finding in issue #168 and the `frame-ancestors` row above) — a
browser-spec limitation unrelated to this fix, not a regression.

## Consequences

- **Positive**: Closes CDN supply-chain, XSS-via-script-injection, and clickjacking
  attack vectors. Mozilla Observatory grade improves from F to A (expected).
- **Negative**: When upgrading the Firebase SDK, four places must be updated in sync
  (import URL × 3 in `firebase.js`, integrity × 3 in `index.html`). This is documented
  in CLAUDE.md and AGENTS.md as a mandatory convention.
- **Neutral**: The theme bootstrap is now an externally-loadable file, which adds
  one extra HTTP request on cold load. In practice this is preloaded by the browser
  parser and is sub-millisecond on any CDN edge; the no-FOUC guarantee is unchanged.
