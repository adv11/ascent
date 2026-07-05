# SwitchPrep — Architecture & Living Guide

> **Start here.** This is the single canonical reference for what SwitchPrep is, how it
> is built, why each choice was made, and how it has evolved. Every significant
> architectural change appended to the [Build Log](#build-log) below — one entry per
> PR, written at merge time.

---

## 1. Project origin & goals

SwitchPrep is a prep tracker for backend engineers (Java, Spring Boot, microservices,
GenAI/agentic AI, system design) working toward a company switch. It started as a
personal tool and is moving toward a sellable product. Correctness and polish are
treated as customer-facing, not side-project-level.

**Current product stage (2026-07):** Phase 0 (Foundation & Standards) complete.
Working toward Phase 1 (hosting, auth improvements, core architecture hardening).

---

## 2. Stack & why each choice was made

| Choice | Rationale |
|---|---|
| Vanilla JS, native ES modules, no bundler | Zero-cost dev startup (`python3 -m http.server 4173`). No build step to fail, no lock-in. Appropriate for a solo MVP moving toward a sellable product where bundle size and framework churn are risks. |
| Firebase Auth (email/password + anonymous) | Covers both the guest "try it now" path and the returning registered user in one SDK. Anonymous sessions can be upgraded to email accounts later without losing progress. |
| Firebase Realtime Database | Per-user roadmap documents, offline-capable, real-time sync, and simple security rules (`auth.uid == $uid`). Simpler than Firestore for a flat `items` map with no query needs. |
| Vitest | Fast, ESM-native, jsdom-integrated. No need for Jest's transform layer on a no-build codebase. |
| Playwright | Chromium E2E with Firebase Emulator — real auth flows without hitting production. |
| No framework (no React, Vue, etc.) | At MVP scale the overhead of a VDOM/reactivity layer exceeds its benefit. The `el()` helper + pub-sub store gives the same mental model at a fraction of the cost. Revisit if component count or state complexity grows past what the store pattern handles cleanly. |

---

## 3. Module-by-module walkthrough

```
index.html
```
Entry HTML. Contains an **inline no-FOUC theme bootstrap script** that reads
`switchprep-theme` from `localStorage` and sets `data-theme` on `<html>` before any
CSS loads — this prevents the flash of the wrong theme on a hard reload.

```
src/main.js
```
Boot entry. Initialises theme, wires the Firebase auth state listener, and starts the
hash router. The auth listener calls `roadmapStore.setUser(user)` on every auth change
(sign-in, sign-out, token refresh) — this is the single source of truth for which
user's data is loaded.

```
src/data/roadmap.js
```
Seed data only — the default phases, sections, topics, and resource library that every
new user starts with. No business logic here. This is what `buildSeedItems()` in
`roadmapStore.js` returns when there is no saved data for a user.

```
src/services/firebase.js
```
Thin wrappers around the Firebase SDK — `authApi` (signIn, signUp, signOut, onAuthChange)
and `dbApi` (listenRoadmap, saveRoadmap). Keeps SDK coupling in one place so the rest of
the codebase can be tested against the mock in `tests/__mocks__/firebase.js`.

```
src/services/firebase.config.js   (gitignored)
src/services/firebase.config.example.js  (committed template)
```
Real Firebase project credentials live in the gitignored file. Copy the example to that
path and fill in your project's values before running locally. Never commit real credentials.

```
src/services/roadmapStore.js
```
The central state container. Key design decisions:

- **Single mutable `items` map** — all mutations go through named helpers
  (`updateItem`, `addResource`, …) that call `notify()` + `queueSave()`.
- **`subscribe(callback)` / `notify()`** — pub-sub; subscribers receive a snapshot
  `{ items, saveState, structuralVersion }`.
- **500 ms debounced `queueSave()`** — writes to `localStorage` immediately and to
  Firebase after the debounce, to avoid hammering the database on every keystroke.
- **`structuralVersion` counter** — see §5.1.
- **`stableStringify` comparison** — see §5.2.
- **`setUser(nextUser)` sign-out guard** — see §5.3.

```
src/services/theme.js
```
Owns `getTheme()` / `setTheme()` / `toggleTheme()` / `onThemeChange()`, persisted under
`switchprep-theme` in `localStorage`. Follows `prefers-color-scheme` until the user makes
an explicit choice. Returns an unsubscribe function from `onThemeChange()` — callers must
capture and call it on teardown (see §5.4).

```
src/ui/router.js
```
Tiny hash router (`registerRoute` / `navigate` / `startRouter`). Each route registers a
render function and an optional cleanup function. The router calls cleanup before
switching routes to prevent subscription leaks.

```
src/ui/dom.js
```
`el(tag, attrs, children)` — the only DOM-construction helper. `attrs.className`,
`dataset`, and `text` are special-cased; any `onX` key becomes an `addEventListener`.
Also exports `debounce` and `isValidUrl`. See §5.5 for why `innerHTML` is never used.

```
src/ui/pages/signIn.js
src/ui/pages/signUp.js
```
Auth screens. Both use `authShell.js` for the shared chrome (brand row + theme toggle +
card wrapper) and compose UI entirely with `el()`.

```
src/ui/pages/dashboard.js
```
The roadmap dashboard — effectively the whole app. Renders phase-cards, checklist rows,
progress stats, and wires up the `roadmapStore` subscription. Uses `structuralVersion`
to decide between a full `render()` and the lighter `patchDoneStates()` on each snapshot.
The `data-action` click-guard (§5.6) lives here.

```
src/ui/components/authShell.js
```
Shared chrome for `signIn` and `signUp` — brand row, theme toggle, card wrapper. Returned
as `{ node, cleanup }` so the route can call `cleanup()` on navigation away.

```
src/ui/components/themeToggle.js
```
Reusable dark/light toggle button. Subscribes to `onThemeChange()` and must be cleaned
up — its cleanup is returned from the factory and wired into `main.js`'s route cleanup.

```
src/ui/components/itemPanel.js
```
Slide-in panel for editing a topic and its resource links. Validates resource URLs via
`isValidUrl()` before saving. Opens on "N resources" badge click; closes on backdrop
click or Escape.

```
src/ui/components/toast.js
```
Transient toast notifications. Auto-dismiss after a configurable delay.

```
src/styles/app.css
```
The entire design system — CSS custom properties (tokens) defined once under `:root`
(light mode) and re-defined under `:root[data-theme='dark']`. No hard-coded colors in
component rules — always use a token so both themes stay correct.

```
firebase/database.rules.json
```
Realtime Database security rules. Each user's roadmap is scoped to `users/{uid}` with
`auth != null && auth.uid == $uid` for both reads and writes.

---

## 4. CI/testing pipeline

| Job | Tool | What it checks |
|---|---|---|
| `lint` | ESLint (flat config) | Security rules (no `innerHTML`, no `eval`), unused vars, undefined refs |
| `security` | gitleaks + git ls-files | No committed secrets; `firebase.config.js` not tracked |
| `test-unit` | Vitest + jsdom | Unit and integration tests in `tests/unit/` and `tests/integration/` |
| `test-e2e` | Playwright (Chromium) | End-to-end flows via Firebase Emulator |
| `pr-checklist` | github-script | PR body filled (≥ 50 chars, references an issue); CHANGELOG.md updated when `src/` changes; `docs/architecture.md` Build Log updated when new module added |
| `issues-label-check` | github-script | All three label categories (type/priority/domain) present on new/edited issues |

**Branch protection on `main` (active):** ESLint, Secret scan, Vitest, and PR description
check are all required. E2E (`test-e2e`) is a required check once `FIREBASE_TOKEN` and
`FIREBASE_CONFIG_TEST` secrets are configured (issue #37 completed the emulator wiring;
the secrets are manual steps documented there).

**Pipeline evolution:**
- **PR #38 (issue #30):** Stood up ESLint + Vitest + Playwright + secret scan + branch protection.
- **PR #40 (issue #37):** Wired Firebase Emulator into E2E CI; made `test-e2e` a conditional required check.
- **PR #41 (issue #3):** Added integration tests (12 Vitest tests), coverage thresholds, five `.claude/rules/` files, ADR-001.
- **PR #45 (issue #43):** Extended `pr-checklist` with CHANGELOG + architecture-doc checks; added `issues-label-check` workflow; added `docs-sync` rule.

### Test structure

```
tests/
  unit/             ← Vitest unit tests (jsdom environment)
    dom.test.js
    themeToggle.test.js
  integration/      ← Vitest integration tests (store round-trips, pub-sub)
    roadmapStore.test.js
  e2e/              ← Playwright E2E tests (real Chromium, Firebase Emulator)
    auth.test.js
    fixtures.js     ← custom `page` fixture that injects __USE_FIREBASE_EMULATOR__
  __mocks__/
    firebase.js     ← vi.fn() stubs for authApi / dbApi (use with vi.mock())
  setup.js          ← jsdom shims: matchMedia, localStorage
```

| Command | What it runs |
|---|---|
| `npm test` | Vitest unit + integration (CI mode, no watch) |
| `npm run test:watch` | Vitest in watch mode |
| `npm run test:coverage` | Vitest with v8 coverage report |
| `npm run test:e2e` | Playwright E2E (requires Firebase Emulator or real config) |
| `npm run lint` | ESLint on `src/` |
| `npm run lint:fix` | ESLint with auto-fix |

---

## 5. Non-obvious conventions & the incidents that produced them

### 5.1 `structuralVersion` — do not regress

`roadmapStore.js` carries a `structuralVersion` counter in every snapshot. Toggling
`done` on an item does **not** bump it — a done-toggle never changes which items exist
or how they are grouped. `dashboard.js`'s `handleSnapshot` runs the full `render()` only
when `structuralVersion` changes; otherwise it calls the lightweight `patchDoneStates()`,
which patches stats and the affected row's classes in place. This eliminates a visible
flash of all phase-cards on every checkbox click.

**Rule:** bump `structuralVersion` for any mutation that changes the *set or shape* of
items (add/remove/reorder/edit fields other than `done`). Don't bump it for cosmetic
changes on an existing row.

Cross-reference: `CLAUDE.md §structuralVersion`.

### 5.2 Firebase echo & `stableStringify`

`dbApi.listenRoadmap`'s `onValue` fires on every write to the path — *including the echo
of writes this client just made* (every debounced save round-trips back through the
listener ~500 ms–1 s after a click). `roadmapStore.js` compares the incoming remote data
against the current in-memory `items` with a key-order-independent `stableStringify`.
Realtime Database returns keys sorted; our in-memory map is insertion-order, so a plain
`JSON.stringify` would produce false positives and bump `structuralVersion` on the echo
— causing the checklist flicker even after the fix, just delayed by a save round-trip.

**Rule:** never replace `stableStringify` with `JSON.stringify` in the echo-detection
comparison, and never make the echo-detection unconditionally bump `structuralVersion`.

Cross-reference: `CLAUDE.md §Watch the Firebase echo`.

### 5.3 Sign-out localStorage guard

`setUser(nextUser)` in `roadmapStore.js` detects when the active `uid` changes. Whenever
`uid` transitions from a non-null value to any other value, it calls `clearLocal()`
(removes both `LOCAL_KEY` and `UI_KEY`) and resets in-memory `items` to `buildSeedItems()`
before the incoming user's session starts. `loadLocal()` is only called for the *incoming*
user, after `uid` is updated.

**Why:** without this guard, signing out as User A and signing in as User B on the same
device would load User A's `localStorage` data into User B's session before the Firebase
fetch completes — a privacy leak on shared devices (issue #23).

Cross-reference: `CLAUDE.md §Sign-out contract`.

### 5.4 Component subscription cleanup

Any component that calls `onThemeChange()` or subscribes to any module-level store must
capture the returned unsubscribe function and call it when the component is torn down.
Pattern: attach to the element as `el._cleanup = unsubscribe`; have the factory return
`{ node, cleanup }`; wire into the route's cleanup return in `main.js`.

Failing to do this leaks dead DOM references and fires callbacks on removed nodes (issue #27).

Cross-reference: `CLAUDE.md §Component subscription cleanup`.

### 5.5 No `innerHTML` — ever

All text must flow through `textContent` (via `el()`'s `text:` key or
`node.textContent = …`). The `html` key was removed from `el()` (issue #22) because it
routed directly to `node.innerHTML`, which is an XSS vector. Resource URLs from the
store must pass `isValidUrl()` before being set as `href` — this blocks `javascript:`
and `data:` URIs.

Cross-reference: `CLAUDE.md §Never use innerHTML` and `.claude/rules/no-innerHTML.json`.

### 5.6 `data-action` click-guard

A checklist row toggles `done` on click. Child controls (Edit button, resource-count
badge) are marked `data-action="…"` and call `e.stopPropagation()` in their own handler.
Any new interactive element nested inside a row must follow this pattern or it will
silently toggle the row's checkbox.

Cross-reference: `CLAUDE.md §data-action click-guard convention`.

---

## 6. Deploy checklist

1. Create a Firebase project and copy `src/services/firebase.config.example.js` to
   `src/services/firebase.config.js`, filling in that project's values (gitignored —
   never commit real credentials).
2. Enable Email/Password and Anonymous auth in Firebase Console.
3. Publish Realtime Database rules from `firebase/database.rules.json`.
4. Serve static files (`python3 -m http.server 4173` locally; Firebase Hosting or any
   CDN in production).
5. Enable Firebase App Check before a public launch.
6. Add `FIREBASE_CONFIG_TEST` and `FIREBASE_TOKEN` GitHub secrets to enable E2E CI.

**Future hardening:**
- Move public seed roadmap content to versioned static JSON or a `roadmapTemplates/{version}` node.
- Add server-side validation with Cloud Functions if sharing/community resources are introduced.
- Track analytics events without storing sensitive preparation notes.

---

## 7. Issue templates & enforcement

`.github/ISSUE_TEMPLATE/` contains four GitHub issue forms:

| Template | Use for |
|---|---|
| `feature.yml` | New functionality or user-visible improvement (`type:feat`) |
| `bug.yml` | Something broken (`type:fix`) |
| `chore-refactor.yml` | Maintenance, deps, config, restructuring (`type:chore` / `type:refactor`) |
| `docs.yml` | Documentation improvements (`type:docs`) |

`config.yml` disables blank issues and links to tracker #11 and CLAUDE.md.

The `issues-label-check` workflow (`.github/workflows/issues-label-check.yml`) fires on
`issues.opened` / `issues.edited` and comments on any issue missing a `type:*`,
`priority:*`, or `domain:*` label.

---

## 8. Build Log

> One entry per significant PR. Append at the bottom. Format:
> `### YYYY-MM-DD — PR #N — <short title>` + what changed architecturally and why.
> This is the developer-facing history; `CHANGELOG.md` is the user-facing one.

### 2026-07-05 — PR #29 — Fix missing import in resource panel (issue #12A)

Fixed a `ReferenceError` thrown on every "Add resource" click. One missing import line
in `itemPanel.js`. No structural change.

### 2026-07-05 — PR #31 — Checklist reliability fixes (issue #2)

Fixed four bugs in `roadmapStore.js` and `dashboard.js`: stale toggle closure, Firebase
echo race, stale snapshot in filter/phase handlers, and phase progress counter lag.
Introduced `structuralVersion` to split render paths (full re-render vs. `patchDoneStates`).

### 2026-07-05 — PR #32 — Sign-out localStorage guard (issue #23)

Added uid-change detection in `setUser()`. On sign-out, `clearLocal()` wipes
`LOCAL_KEY` and `UI_KEY` before the incoming user's session starts. Prevents privacy
leak on shared devices.

### 2026-07-05 — PR #33 — XSS hardening (issue #22)

Removed `innerHTML` usage from `dashboard.js`, deleted the dangerous `html` key from
`el()`, and added `isValidUrl()` validation for all resource URLs rendered as `href`.
Added `.claude/rules/no-innerHTML.json` and `url-validation.json`.

### 2026-07-05 — PR #34 — Theme-toggle subscription cleanup (issue #27)

`themeToggle.js` now returns `{ node, cleanup }`. Routes in `main.js` call `cleanup()`
on navigation. Fixes memory leak from unbounded `onThemeChange` subscribers. Also fixed
static `aria-label` (was never updating to reflect current theme).

### 2026-07-05 — PR #38 — CI quality gate (issue #30)

Stood up the full GitHub Actions pipeline: ESLint (flat config, security rules), Vitest
(17 unit tests, jsdom), Playwright E2E (Chromium), gitleaks secret scan, PR checklist
enforcement, and branch protection on `main`. Added `tests/` directory structure,
`tests/__mocks__/firebase.js`, `tests/setup.js`, `playwright.config.js`,
`.github/PULL_REQUEST_TEMPLATE.md`.

### 2026-07-05 — PR #40 — Firebase Emulator E2E CI (issue #37)

Wired Firebase Emulator into the E2E CI job. `firebase.json` emulator config (auth port
9099, database port 9000). Browser SDK connects to emulator when
`window.__USE_FIREBASE_EMULATOR__` is set via Playwright `addInitScript`. Added
`tests/e2e/fixtures.js`. `firebase-tools` added as devDependency.

### 2026-07-05 — PR #41 — Enterprise testing standards & AI-agent rules (issue #3)

Added `tests/integration/roadmapStore.test.js` (12 tests covering subscribe/notify,
structuralVersion contract, sign-out guard, Firebase echo detection). Added coverage
thresholds (20% baseline). Added five `.claude/rules/` JSON files
(`structural-version`, `subscription-cleanup`, `store-pattern`). Added
`docs/adr/ADR-001-current-architecture.md` and `docs/roadmap.md`.

### 2026-07-05 — PR #45 — Living architecture doc & doc-sync enforcement (issue #43)

Rewrote `docs/architecture.md` into this living guide with Build Log. Added four GitHub
issue form templates (`.github/ISSUE_TEMPLATE/`). Upgraded PR template with Build Log
checkbox and Breaking changes section. Extended `pr-checklist` CI job to fail when `src/`
changes without a `CHANGELOG.md` update or when a new module is added without an
`architecture.md` diff. Added `issues-label-check` workflow. Added `.claude/rules/docs-sync.json`.
Updated `CLAUDE.md` and `AGENTS.md` with the Living architecture doc convention.

### 2026-07-05 — PR #46 — CSP + SRI + security headers (issue #25)

Three security layers added in one PR:

**Phase A — Firebase Hosting headers**: `firebase.json` extended with a `hosting` block
that sets five HTTP security headers on all routes: HSTS (1 year, includeSubDomains),
`X-Frame-Options: DENY`, `X-Content-Type-Options: nosniff`,
`Referrer-Policy: strict-origin-when-cross-origin`, and
`Permissions-Policy` disabling camera/mic/geolocation.

**Phase B — Content Security Policy**: CSP meta tag added to `index.html`. The existing
inline theme-bootstrap IIFE was extracted to `src/services/themeBootstrap.js` (a classic
`<script src="...">` — not a module, so it remains synchronous and preserves the
no-FOUC guarantee). CSP allows `script-src 'self' https://www.gstatic.com`,
`style-src 'self' https://fonts.googleapis.com`, `font-src https://fonts.gstatic.com`,
`connect-src` covering Firebase Realtime Database, Auth, and token-refresh endpoints,
and `frame-ancestors 'none'` (belt-and-suspenders with X-Frame-Options).

**Phase C — SRI for Firebase SDK**: `<link rel="modulepreload" integrity="sha384-...
crossorigin="anonymous">` entries added for all three Firebase SDK modules. Hashes
computed at implementation time via `openssl dgst -sha384 -binary | base64`. SDK upgrade
process documented in ADR-002 and CLAUDE.md.

New files: `src/services/themeBootstrap.js`, `docs/adr/ADR-002-csp-sri-security.md`,
`tests/unit/themeBootstrap.test.js`.

### 2026-07-05 — PR #TBD — Firebase Hosting + CI/CD (issue #28)

**Platform**: Firebase Hosting (Spark free tier) chosen over Cloudflare Pages and Netlify
because Auth + Realtime Database already live in the same Firebase project. One CLI, one
dashboard, one billing account. ADR-003 documents the tradeoffs and the Cloudflare Pages
migration path if bandwidth grows.

**`firebase.json`** extended from emulator-only to a full hosting config:
- `ignore` list keeps dev/doc files (CLAUDE.md, tests/, docs/, package.json, etc.) off the CDN
- `rewrites` rule `"source": "**" → "/index.html"` enables SPA hash-router on direct URL access
- `Cache-Control` per route: `no-cache` for `index.html` (always-fresh entry point), `max-age=31536000, immutable` for `/src/**` and `*.css` (cache-busted by the fresh HTML reference)
- Security headers on `**`: HSTS, X-Frame-Options: DENY, X-Content-Type-Options, Referrer-Policy, Permissions-Policy (supersedes the security-headers-only version from PR #46 / issue #25)
- `database.rules` wired so `firebase deploy` also updates Realtime DB Security Rules

**`.firebaserc`** added with a `YOUR_FIREBASE_PROJECT_ID` placeholder — must be set to the real project ID before deploying.

**`.github/workflows/deploy.yml`** added: `FirebaseExtended/action-hosting-deploy@v0`
triggered on push to `main` (live channel) and on PRs (temporary channel, expires 7d). Deploy
steps are guarded by a readiness check — if `FIREBASE_SERVICE_ACCOUNT` is not set, the
workflow prints instructions and exits cleanly rather than failing. Required setup:
- `FIREBASE_SERVICE_ACCOUNT` (secret) — service account JSON from Firebase Console
- `FIREBASE_CONFIG` (secret) — production `firebase.config.js` contents
- `FIREBASE_PROJECT_ID` (variable) — project ID (non-sensitive)
