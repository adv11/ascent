# Ascent — Architecture & Living Guide

> **Start here.** This is the single canonical reference for what Ascent is, how it
> is built, why each choice was made, and how it has evolved. Every significant
> architectural change appended to the [Build Log](#build-log) below — one entry per
> PR, written at merge time.

---

## 1. Project origin & goals

Ascent is a personal roadmap tracker for anyone learning, revising, or tracking
progress toward a goal — students, professionals, or career switchers. New sign-ups
pick a starter template (Issue #51) instead of always getting the original Java
Backend Engineer roadmap: Java Backend Engineer, Frontend Developer, Data Scientist,
or a blank slate to fill in themselves. It started as a personal tool and is moving
toward a sellable product. Correctness and polish are treated as customer-facing, not
side-project-level.

**Current product stage (2026-07):** Feature-complete through Step 7 of the build-out
(bug fixes, CI, hosting, auth, core architecture, the full UI/UX revamp, and feature
expansion — analytics, sharing, exports, PWA, and more). Step 8 (Launch) is in its
final stretch. [Issue #11](https://github.com/adv11/ascent/issues/11) is the
single source of truth for current status; check it rather than this paragraph for
what's still open.

---

## 2. Stack & why each choice was made

| Choice | Rationale |
|---|---|
| Vanilla JS, native ES modules, no bundler | Zero-cost dev startup (`npm run dev`, a small Node-only static server — see `scripts/dev-server.mjs`). No build step to fail, no lock-in, and no OS-specific dependency (issue #211). Appropriate for a solo MVP moving toward a sellable product where bundle size and framework churn are risks. |
| Firebase Auth (email/password + anonymous) | Covers both the guest "try it now" path and the returning registered user in one SDK. Anonymous sessions can be upgraded to email accounts later without losing progress. |
| Firebase Realtime Database | Per-user roadmap documents, offline-capable, real-time sync, and simple security rules (`auth.uid == $uid`). Simpler than Firestore for a flat `items` map with no query needs. |
| Vitest | Fast, ESM-native, jsdom-integrated. No need for Jest's transform layer on a no-build codebase. |
| Playwright | Chromium E2E with Firebase Emulator — real auth flows without hitting production. |
| No framework (no React, Vue, etc.) | At MVP scale the overhead of a VDOM/reactivity layer exceeds its benefit. The `el()` helper + pub-sub store gives the same mental model at a fraction of the cost. Revisit if component count or state complexity grows past what the store pattern handles cleanly. |

**Known, accepted cost of the no-bundler decision — unminified/unused CSS/JS (decision-only, issue #168, 2026-07-14).** A real Lighthouse run against the post-issue-#137 landing page flagged `unminified-css`, `unminified-javascript`, `unused-css-rules`, and `unused-javascript` — all score 0, ~750ms/~140KB of potential savings each. This is the direct, expected consequence of shipping raw `src/**` files with no build step: nothing minifies `app.css`/the JS module graph, and `app.css` is intentionally one shared stylesheet across every page/theme (see `.claude/rules/ui-styling.md`), so any given page loads CSS rules other pages use. Issue #137's own "Out of scope" section already ruled out introducing a bundler to solve a closely related problem, for the same "no build step" reasoning captured in the stack table above. This is recorded here as the reference measurement for anyone who revisits the no-bundler tradeoff later — no bundler, minifier, or CSS-splitting work was implemented as part of issue #168; that remains a bigger call than a documentation note and would need its own scoped issue (matching how #135 tracks the monetization-model decision at the same milestone).

---

## 3. Module-by-module walkthrough

```
index.html
```
Entry HTML. Contains an **inline no-FOUC theme bootstrap script** that reads
`ascent-theme` (falling back to the pre-rename `switchprep-theme` key) from
`localStorage` and sets `data-theme` on `<html>` before any CSS loads — this prevents
the flash of the wrong theme on a hard reload.

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
Backward-compat shim (Issue #51) — re-exports `PHASES`, `RESOURCE_LIBRARY`,
`TOPIC_RESOURCES`, `ROADMAP_VERSION`, and `buildSeedItems()` from
`src/data/templates/java-backend.js` so every pre-existing import keeps working. No
logic lives here; the actual seed data moved to `src/data/templates/`.

```
src/data/templates/
```
The starter template system (Issue #51). `index.js` is the registry: `TEMPLATES` (id,
name, description, icon, `buildItems()`), `getTemplate(id)`, `buildSeedItems(templateId)`,
`getTemplatePhases(templateId)`, and (migration-only, see below) `getLegacyBlankTemplateData()`.
Seven registered template modules — `java-backend.js`, `frontend.js`, `data-science.js`,
`genai-agentic-ai.js`, `math-grade12.js`, `piano.js`, `marketing.js` — each export their
own `PHASES` + `buildSeedItems()` in the exact shape the original `roadmap.js` used, so
`roadmapStore.js` and `dashboard.js` don't need to know which template is active beyond
the id. `java-backend.js` is the original 500+-item roadmap, moved verbatim — nothing
about its content changed. The registry has no concept of "hidden" templates — that's a
per-user preference layered on top in `roadmapStore.js` (see §5.9), not a property of a
template itself. Templates are loaded via dynamic `import()` (not a static import at the
top of `roadmapStore.js`) specifically so a signed-out visitor on the sign-in page never
downloads roadmap content for templates they haven't picked yet — this file has no
bundler/tree-shaking, so every module is its own network request. `blank.js` (four
fixed, empty Learn/Practice/Build/Review phases) is **not** one of the 7 — retired by
issue #4's follow-up once manual roadmap creation and AI-assisted import both existed,
since it was a strict subset of a custom roadmap. The file itself is untouched and still
directly importable via `getLegacyBlankTemplateData()`, used only by `roadmapStore.js`'s
one-time migration for accounts that started it before the retirement — see the
"blank-template retirement and migration" Build Log entry below.

```
src/ui/pages/onboarding.js
```
The `/onboarding` route (Issue #51) — a template picker shown right after a brand-new
sign-up, and reachable afterward via the dashboard's "Switch template" link (see §5.8).
Renders one card per `TEMPLATES` entry not currently hidden for this user, plus a
"Create your own roadmap" card and an "Import roadmap" card (issue #4, always first);
picking a template card calls `store.switchRoadmap(templateId)` then navigates to
`/app`. Every built-in template card has a hide (×) button (see §5.9) — no exceptions,
since issue #4's follow-up retired "blank", the one card that used to be exempt.
"Create your own roadmap" instead has a corner ℹ "How do I build my own roadmap?"
button opening `buildYourOwnGuide.js`. Self-guards like the other pages: redirects to
`/signin` if there's no user. Does **not** redirect away when `onboardingDone` is
already `true` — that's the switch-template re-entry path, not a bug; see §5.8.

```
src/ui/components/buildYourOwnGuide.js
```
An informational modal (Issue #51, rewritten for issue #4's follow-up) opened from
"Create your own roadmap"'s corner ℹ button — it used to live on the now-retired
"blank" template's card instead. Explains both real ways to fill in a roadmap today,
side by side: manually, via `"+ Add phase"`/`"+ Add section"`/the dashboard's "Add a
custom topic…" row; or with an AI assistant, via the "Import roadmap" card's real
prompt-generation → paste → validate → auto-import flow. An "Open Import roadmap"
button closes the guide and calls the caller's own `handleImport()` (passed in as
`onOpenImport`) instead of duplicating that flow's logic here. Do not let this copy
drift back to describing a manual copy-topics-in-one-at-a-time tip now that real
automated import exists.

```
src/services/firebase.js
```
Thin wrappers around the Firebase SDK — `authApi` (signIn, signUp, signOut, onAuthChange)
and `dbApi` (listenRoadmap, saveRoadmap, getRoadmap, getMeta, saveMeta). `getRoadmap`/
`getMeta` are one-time `get()` reads (not listeners) used only during `setUser`'s
onboarding-detection step (Issue #51); `listenRoadmap` remains the ongoing real-time
sync mechanism once a user is confirmed onboarded. Keeps SDK coupling in one place so
the rest of the codebase can be tested against the mock in `tests/__mocks__/firebase.js`.

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
  `{ items, saveState, structuralVersion, templateId, onboardingDone, phases }`.
- **500 ms debounced `queueSave()`** — writes to `localStorage` immediately and to
  Firebase after the debounce, to avoid hammering the database on every keystroke.
- **`structuralVersion` counter** — see §5.1.
- **`stableStringify` comparison** — see §5.2.
- **`setUser(nextUser)` sign-out guard** — see §5.3.
- **`setUser(nextUser)` is `async` and doubles as onboarding detection** (Issue #51) —
  see §5.7. `main.js` must `await` it before deciding whether to route to `/onboarding`
  or `/app`.
- **`initFromTemplate(templateId)`** — called once by `onboarding.js` after a template
  pick; seeds `items` from that template, sets `templateId`/`onboardingDone`, and starts
  the same debounced-save + realtime-listener sync every other user gets.

```
src/services/theme.js
```
Owns `getTheme()` / `setTheme()` / `toggleTheme()` / `onThemeChange()`, persisted under
`ascent-theme` in `localStorage` (key comes from `localStorageKeys.js`). Follows
`prefers-color-scheme` until the user makes
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
| `pr-checklist` | github-script | PR body filled (≥ 50 chars, references an issue); CHANGELOG.md updated when `src/` changes; `docs/architecture.md` Build Log updated when new module added; `sw.js`'s `CACHE_VERSION` bumped when `src/` changes (issue #185) |
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

**Follow-up (issue #51 follow-up, superseded by issue #58): cross-template echo guard.**
The echo check above only protects against a write's *own* echo (matched via
`lastFlushedStr`). Originally it did not protect against a *different* write's echo —
specifically, a debounced save queued against the template a user just switched *away
from* — and was fixed with a payload-tag check. Issue #58 replaced that mechanism
entirely by giving each template its own Firebase path
(`users/{uid}/roadmaps/{templateId}`, not a single shared `users/{uid}/roadmap`), which
makes this class of cross-template echo structurally impossible rather than merely
filtered. See §5.11 for the current mechanism (a closure-based stale-listener guard) and
the flush-before-switch fix that replaced the old destructive-switch model this
subsection originally described.

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

### 5.7 Onboarding detection order (Issue #51)

`roadmapStore.js`'s `setUser(nextUser)` is `async` specifically so it can resolve
whether a user still needs the `/onboarding` template picker *before* `main.js` decides
where to route them. On every sign-in it does a one-time `dbApi.getMeta(uid)` read (not
the realtime listener — that only attaches once onboarding is confirmed done and a
template is active) and evaluates, in order:

1. `remoteMeta.startedTemplateIds` is non-empty → already on the issue #58 meta shape,
   already onboarded; use `remoteMeta.activeTemplateId` (or the first started id).
2. Otherwise, read the legacy singular `users/{uid}/roadmap` path once and check, in
   order: `remoteMeta.onboardingDone` is `true` (post-#51, pre-#58 shape; use
   `remoteMeta.templateId`) → the local `ascent-onboarding-done` flag is `true` (fast
   local path, e.g. offline) → the legacy roadmap or local blob already has an item with
   `custom: true` or `done: true` (a pre-existing account from before the template
   system existed at all). Any of these → treat as onboarded and **migrate/backfill**:
   copy the legacy roadmap forward into `users/{uid}/roadmaps/{templateId}` (if it
   existed) and write `meta.startedTemplateIds`/`meta.activeTemplateId`/
   `meta.onboardingDone` (fire-and-forget — no forced migration step). See §5.11.
3. Otherwise → a genuinely new account. `onboardingDone = false`, `items = {}`, and the
   realtime listener is **not** attached yet (nothing to sync until a template exists).

`main.js`'s auth listener `await`s `setUser` before reading
`store.getSnapshot().onboardingDone` to route to `/onboarding` or `/app` — if this ever
becomes a fire-and-forget call again, the router will act on stale state from the
*previous* user and route incorrectly. `dashboard.js` self-guards on `onboardingDone`
(mirroring the existing `!user` self-guard) so direct hash navigation to `#/app` can't
bypass first-time onboarding. `onboarding.js` itself no longer bounces an already-
onboarded user away — see §5.8, it's a deliberate re-entry point now.

Cross-reference: `CLAUDE.md §Starter templates and onboarding`.

### 5.8 Switching templates and the `stateCallId` stale-call guard (Issue #51 follow-up)

Two gaps surfaced from real-world manual testing of the onboarding picker, fixed in the
same PR before merge:

**No way back.** The picker was originally a strict one-way gate — once a template was
picked, there was no UI path back to it, even to deliberately start over with a
different template. Fixed by adding a **"Switch template"** link to the dashboard
header (`navigate('/onboarding')`) and relaxing `onboarding.js`'s self-guard: it no
longer redirects away when `onboardingDone` is already `true`. Instead, when reached in
that state it shows a **"← Back to my roadmap"** link. Originally (issue #51 follow-up)
picking a different template here was destructive — `initFromTemplate()` fully replaced
`items`, so the pick handler wrapped it in a `confirmDialog()` warning "this cannot be
undone." **Issue #58 removed that confirmation entirely**: `switchRoadmap()` (which
replaced `initFromTemplate()`) never discards another template's data, so there is
nothing left to confirm — see §5.11. First-time onboarding (`onboardingDone === false`)
still shows no back link, since there is nothing to switch away from yet.

**Stale async writes.** `setUser()` and `initFromTemplate()` both `await` a Firebase
round-trip before mutating store state. Firebase's `onAuthStateChanged` can fire in
quick succession — most notably, deleting an account and immediately signing up again
with the same email fires it for the old uid (`null`) and the new uid back-to-back. If
an older call's network round-trip happens to resolve *after* a newer call has already
finished, the older call would still go on to overwrite `items`/`templateId`/
`onboardingDone` with its now-stale result — observed as a freshly re-created account
incorrectly skipping the onboarding picker. Fixed with a `stateCallId` counter: every
`setUser`/`initFromTemplate` call captures the counter's value at entry and re-checks it
against the (module-level) current value after each `await`; if a newer call has since
started, the older one returns without touching any state. Any future `await` added to
either function must be followed by the same check before mutating state — see the
`isStale()` helper in `setUser` for the pattern.

Cross-reference: `CLAUDE.md §setUser/initFromTemplate stale-call guard`.

### 5.9 Per-user hidden templates and the "build your own" guide (Issue #51 follow-up)

A user who doesn't want a given starter template cluttering their picker can hide it —
requested directly from manual testing feedback: "some roadmaps I don't want, let me
remove them, but only for me." Two things make this safe:

- **It's per-user, not global.** Hiding writes to `users/{uid}/meta/hiddenTemplateIds`
  (an array of template ids) via `dbApi.saveMeta` — the same per-account meta node
  `templateId`/`onboardingDone` already live in. It never touches the template's own
  content (`src/data/templates/*.js` is untouched) and has zero effect on any other
  account. `roadmapStore.js` loads it the same way it loads `templateId`: during
  `setUser`, normalizing whatever shape Firebase returns (`normalizeHiddenTemplateIds` —
  Realtime Database only returns a genuine array when child keys are dense integers from
  0; a sparse/gappy shape comes back as a plain object instead) with a local-storage
  fallback for the offline/fast-path case, same as `onboardingDone`.
- **No template-specific exceptions anymore.** `hideTemplate` used to special-case
  `'blank'` as a permanent no-op, since it was the only path into
  `buildYourOwnGuide.js`'s manual/AI-assisted instructions — removing it would have left
  a user with zero ways to start a roadmap outside the seeded templates. Issue #4's
  follow-up retired "blank" entirely (see the "src/data/templates/" file-map entry
  above and the Build Log) once "Create your own roadmap" + "Import roadmap" gave every
  user those same two ways to start a roadmap, unconditionally, with no template card
  needed to reach them — so the guide's trigger moved to a corner ℹ button on "Create
  your own roadmap" (never hideable itself, since it's an action card, not a pickable
  template) and every built-in template card gets a hide button with no exceptions.

`onboarding.js` filters `TEMPLATES` down to non-hidden entries when building the
visible grid. A "Show hidden templates (N)" toggle
appears whenever `hiddenTemplateIds` is non-empty, revealing a second row of cards with
a "Restore" button (`store.unhideTemplate(id)`) instead of the normal pick/hide
affordances. Hiding and unhiding both go through confirmation-free store methods — the
*hide* action itself is gated behind a `confirmDialog()` in `onboarding.js` (since it's
a one-click action a user could easily fat-finger), but restoring is not, since it's
non-destructive.

Cross-reference: `CLAUDE.md §Per-user hidden templates`.

### 5.10 Custom `confirmDialog()`, the brand-as-home link, and the current-roadmap indicator (Issue #51 follow-up)

Three small UX gaps surfaced from a manual design pass over the onboarding picker and
dashboard, fixed together since all three touch the same "which roadmap, and what
happens if I click this" confusion:

**Replacing `window.confirm()`.** Every native `confirm()` call in the app (`onboarding.js`'s
switch/hide prompts, `dashboard.js`'s sign-out-with-unsaved-changes prompt,
`itemPanel.js`'s delete-topic prompt) rendered the browser's own unstyleable dialog —
functional but visibly out of place next to the rest of the app's design system. All
four now go through the new `src/ui/components/confirmDialog.js`, which returns a
`Promise<boolean>` and reuses the existing `.modal-overlay`/`.modal-card` chrome
(same pattern as `dashboard.js`'s delete-account modal and `buildYourOwnGuide.js`).
`danger: true` swaps the confirm button to the red/`btn-danger` treatment for
irreversible actions. See `CLAUDE.md §Never use the native window.confirm()`.

**Brand mark as a home link.** `dashboard.js` and `onboarding.js` both wrapped
`createBrandMark()` in a plain, non-interactive `<div class="brand">` — clicking the
"Ascent" logo did nothing on either page, unlike the sign-in/sign-up pages where it was
already `<a href="#/signin">`. Both now use `<a class="brand" href="#/onboarding">`,
since the template picker is the closest thing this app has to an "all roadmaps" home
screen. No CSS changes were needed — `.brand` was already anchor-styled
(`text-decoration: none; color: inherit;`).

**Current-roadmap visibility.** Neither the dashboard nor the "Switch your starter
roadmap" picker gave any indication of which template was actually active, which
became a real footgun combined with the picker's (at the time) destructive re-seed: a
user unsure whether they were already on, say, the Java Backend roadmap could click that
same card "just to check" and — before this fix — silently wipe their own progress,
since `pickTemplate()` didn't special-case re-selecting the current template. Fixed with
two additions sourced from the same `getTemplate(store.getSnapshot().activeTemplateId)`
lookup (renamed from `.templateId` in issue #58): (1) `dashboard.js`'s hero always
renders a `.current-roadmap-badge` (icon + template name) above the "Learn it. Revise
it. Track it." title; (2) `onboarding.js` marks the active template's card with a
`.template-card-current` highlight and a "Current" badge (placed inside the existing
`.template-card-footer` row next to the topic count, so it doesn't add a new flex row
and break the equal-height card layout from §5.10's sibling card-grid convention in
`CLAUDE.md`), and `pickTemplate()` short-circuits re-picking that same card into a plain
`navigate('/app', true)` — no confirmation dialog, no `switchRoadmap()` call, no data
loss. Issue #58 added a third badge state, `.template-card-started-badge` ("In
progress"), for any template that's been started but isn't the active one — see §5.11.

Cross-reference: `CLAUDE.md §Never use the native window.confirm()`, `CLAUDE.md §Brand
mark is a home link`, `CLAUDE.md §The active roadmap must always be visible`.

### 5.11 Multi-roadmap support — concurrent progress per template (Issue #58)

Issue #51 gave every account exactly one roadmap slot (`users/{uid}/roadmap`), and
switching templates via `initFromTemplate()` always replaced it wholesale — the only
guard was a `confirmDialog()` warning the switch "cannot be undone." That broke the
product's actual goal: a user tracking two things at once (e.g. Frontend for a job
search, Piano as a hobby) couldn't keep both moving — picking one destroyed the other.

**Data model.** Each started template gets its own Firebase node,
`users/{uid}/roadmaps/{templateId}/` (`version`/`updatedAt`/`templateId`/`items` — same
item shape as before). `users/{uid}/meta` gains `activeTemplateId` (renamed from
`templateId`, the currently displayed roadmap) and `startedTemplateIds` (string array —
every template with a `roadmaps/` node). The old singular `users/{uid}/roadmap` path,
and the old `meta.templateId` field, are **left in place, never written to again** —
pure migration source and safety net; `firebase/database.rules.json` still validates
both the legacy and new shapes side by side.

**Store shape.** `roadmapStore.js` replaces the single `items`/`templateId`/
`templatePhases` trio with `activeTemplateId`, `startedTemplateIds`, and an in-memory
`roadmapCache` (`{ [templateId]: { items, phases, dirty } }`) populated lazily as
templates are visited in a session. `switchRoadmap(templateId)` replaces
`initFromTemplate()` entirely — one function now handles both a first-time pick and a
later switch, because the logic is identical: an already-started template resolves
cache-first (in-memory → Firebase → local blob → seed, never re-seeded), a not-yet-
started one always seeds fresh and is appended to `startedTemplateIds`. Neither path
ever touches another template's stored items. Locally, `KEYS.ROADMAPS`
(`ascent-roadmaps-v1`) replaces the single `KEYS.ROADMAP` blob with a
`{ [templateId]: { version, dirty, items } }` shape; a one-time
`migrateLocalRoadmapsShape()` wraps any pre-existing single blob into the new shape
before the store's first read, leaving the old key in place.

**Only one Firebase listener open at a time.** Switching detaches the previously
active template's `onValue` listener and attaches a new one on the newly active
template's path — keeping every started template's listener open concurrently (for
instant cross-device sync of an inactive template) is an explicit non-goal for this
issue, not an oversight; it's called out as a future optimization.

**Firebase migration for pre-#58 accounts.** On the first `setUser()` after this
shipped, an account whose meta lacks `startedTemplateIds` is treated as legacy: its
`users/{uid}/roadmap` node (if any) is read once and, if the account turns out to
already be onboarded (via the pre-#58 `meta.onboardingDone` flag, a local flag, or the
pre-#51 `hasRealProgress` fallback — see §5.7), copied forward into
`users/{uid}/roadmaps/{templateId}` and the new meta fields are written. The freshly
migrated items are seeded directly into `roadmapCache` rather than re-read from
Firebase afterward — re-reading would race the fire-and-forget migration write and
could return stale (pre-migration) data.

**Flush-before-switch.** `flush()` always saves whatever `items`/`activeTemplateId` are
current *at the moment it runs*, not what they were when `queueSave()` scheduled it. A
debounced edit on the outgoing template that was still pending when `switchRoadmap()`
reassigns `activeTemplateId` would otherwise never get flushed to the outgoing
template's own path once the timer fires — the timer would instead redundantly re-save
the *new* template using the by-then-reassigned variables. `switchRoadmap()` checks the
outgoing template's `dirty` flag and, if set, cancels the pending timer and `await`s
`flush()` synchronously **before** reassigning `activeTemplateId`. Regression-tested in
`tests/integration/roadmapStore.test.js`'s "flush-before-switch" block.

**Stale-listener guard.** Because each template now has its own path,
`attachRoadmapListener(templateId)`'s `onValue` callback closes over the `templateId` it
was attached for and drops any invocation once that no longer matches the current
`activeTemplateId` — this fully supersedes the old #51 payload-tag cross-template echo
guard (§5.2) for this purpose, since a callback queued before `off()` takes effect can't
slip through. Regression-tested in the "stale listener guard" describe block in the same
test file.

**Never apply a remote snapshot while a local edit is unflushed.** Found only through
real E2E testing against live Firebase — not by the mocked unit/integration suite, which
can't reproduce genuine network-timing non-determinism. Reproduction: switch to a
not-yet-started template (seeds fresh, flushes the seed, attaches the listener — all in
the same narrow window), then immediately check an item. Intermittently, the check would
silently revert a few hundred milliseconds later. Root cause: Firebase's echoed payload
does not always byte-for-byte match what was computed locally before sending (its own
data normalization), so `recentFlushedStrs`-style content matching can't be fully trusted
as the sole defense against a *delayed* echo — an older write's echo arriving after a
newer, not-yet-flushed edit could fail to match anything recorded and get misapplied as
"genuinely different, newer" remote data, silently overwriting the newer edit. Fixed by
having `attachRoadmapListener`'s callback return immediately, without touching `items` at
all, whenever `dirty` is `true`: a queued-or-in-flight local edit is, by definition,
always newer than anything the listener could be echoing at that moment — whether that's
a delayed echo of an *our own* older write or genuinely new external data — so it's
always correct to defer applying remote data until our own edit has flushed. `lastFlushedStr`
was also widened from a single value to a small bounded history (`recentFlushedStrs`) so
an out-of-order echo of an *already-confirmed* older flush (arriving once `dirty` is back
to `false`) is still recognized as our own and doesn't cause a spurious
`structuralVersion` bump. Regression-tested in the "out-of-order echo guard" describe
block; verified against the live Firebase project the bug was found on (10 consecutive
clean E2E runs after the fix, versus a highly reproducible failure before it).

**The same dirty-local guard was missing from the initial-load path (issue #67).** The
guard above only covered `attachRoadmapListener`'s realtime callback — but
`resolveRoadmapItems` (used on every `setUser()`/initial page load) had the identical
hazard on its own read path: if a page reload/close interrupts the 500ms-debounced
`flush()` before it lands, Firebase is left holding stale (pre-edit) data while the local
blob (written synchronously by `queueSave()`) already has the edit and is marked
`dirty: true`. `resolveRoadmapItems` used to prefer a successful remote read over the
local blob unconditionally whenever the remote had *any* items — silently overwriting
the fresher local edit with the stale remote snapshot the moment the page reloaded.
Reproduced deterministically with `tests/e2e/itemNotes.test.js`'s "notes survive a page
reload" test against a local Firebase emulator (both before and independent of any
in-flight PR — confirmed on a clean `main` checkout). Fixed by having
`resolveRoadmapItems` check the local blob's `dirty` flag *before* attempting a remote
read at all: a dirty local blob is by definition at least as new as anything remote can
offer, so it's returned directly (with `dirty: true` preserved) and `setUser()`'s
existing `if (dirty) queueSave();` re-attempts the previously-interrupted write on the
new page load — no separate wiring needed. Regression-tested in the "resolveRoadmapItems
— dirty local blob outranks stale remote" describe block in
`tests/integration/roadmapStore.test.js`; verified against the local emulator (multiple
consecutive clean runs of the E2E test after the fix, versus a deterministic failure
before it).

**UI.** `onboarding.js` reads `activeTemplateId`/`startedTemplateIds` off the snapshot
and drops the switch-mode `confirmDialog()` entirely — every pick (started or not) now
calls `store.switchRoadmap(id)` directly with no prompt, since nothing is ever destroyed.
Cards gain a third badge state, `.template-card-started-badge` ("In progress"), for a
started-but-not-active template; a hidden template that's also started stays visible
(badged, not moved into the "restore" section) since hiding only ever filters the
"start something new" grid, never an already-started roadmap's visibility.

Cross-reference: `CLAUDE.md §Multi-roadmap support`, `CLAUDE.md §Flush-before-switch`,
`CLAUDE.md §Stale-listener guard`, `docs/api.md`.

### 5.12 Storage adapter abstraction (Issue #5, part 1)

Everything above in §5.11 describes reads/writes as going straight to Firebase, because
until this issue that was the only backend. Issue #5 originally set out to add Google
Drive as a second, opt-in backend, plus a full Google OAuth (GIS) sign-in flow — that
work (parts 2 and 3) was built, then removed; see the note at the end of this section.
What stayed is part 1: `StorageAdapter` interface + `FirebaseAdapter` (`dbApi`'s exact
logic, relocated) + a standalone `LocalStorageAdapter`. `roadmapStore.js` now calls
whichever adapter `getStorageAdapter()` (`src/services/storage/adapterFactory.js`)
returns, instead of importing `firebase.js`'s `dbApi` directly — today that's always
`firebaseAdapter`, so this is purely an import-boundary move with no behavior change
versus §5.11 above; the value is that a future second backend only means adding a branch
inside `adapterFactory.js`, not touching `roadmapStore.js` or any feature built on it.

**Why the interface differs from a naive single-document design.** A simple contract
would be `load(roadmapId)`/`save(roadmapId, data)` — one document, no user concept. That
doesn't match issues #58 and #4, which made the app multi-user *and*
multi-roadmap-per-user; `roadmapStore.js` already calls Firebase with `(uid, templateId,
...)` on every roadmap method, plus a separate per-user `meta` document and a one-time
legacy-migration read. `StorageAdapter` (`src/services/storage/StorageAdapter.js`) is
shaped to match what `roadmapStore.js` actually calls — see `docs/api.md` for the full
method list. `getLegacyRoadmap` is optional (default resolves `null`) since only
Firebase has pre-#58 data to migrate from; `now()` is adapter-specific (Firebase stamps
its `serverTimestamp()` sentinel) so each backend controls its own write-timestamp
representation. `listenRoadmap`'s callback receives the plain roadmap payload (or
`null`) — never a backend-specific wrapper: `attachRoadmapListener` used to call
`snapshot.exists()`/`snapshot.val()` directly on whatever the callback received, leaking
Firebase's `DataSnapshot` shape through what was meant to be a generic interface. Fixed
by having `FirebaseAdapter.listenRoadmap` unwrap its own snapshot internally
(`callback(snapshot.exists() ? snapshot.val() : null)`) before ever invoking the
callback.

**`LocalStorageAdapter` is intentionally not wired into `roadmapStore.js` yet.**
`roadmapStore.js` already maintains its own local-cache bookkeeping (`KEYS.ROADMAPS` and
friends — see §5.11's "Store shape") independently of whichever remote adapter is
active, and that is untouched here. `LocalStorageAdapter` is a real, unit-tested
implementation of the same `StorageAdapter` contract over its own dedicated keys
(`KEYS.LOCAL_ADAPTER_ROADMAPS`/`KEYS.LOCAL_ADAPTER_META`) — built so a later PR can
select it (e.g. a true guest-only local mode, or an explicit offline-cache adapter)
without redesigning the interface at that point. It is deliberately unreferenced by
`adapterFactory.js` today; this is scope discipline, not an oversight.

**Google Drive was built (parts 2 and 3) and then removed.** Part 2 (PR #69) added a
`GoogleDriveAdapter` — conflict retry via etag, visibility-based polling since Drive has
no push — and `adapterFactory` branching by auth provider; it was always unreachable in
production (no UI ever created a Google-authenticated user). Part 3 (PR #70, never
merged) was the actual "Sign in with Google" UI/OAuth wiring. After real-world OAuth
problems (popup timing, CSP, GIS silent refresh) cost two days without a reliable
result, the decision was made it wasn't worth the ongoing cost right now — both were
deleted (code, tests, docs) and issues #5/#71 closed. See the Build Log entry below for
the removal PR. `adapterFactory.getStorageAdapter(user)` today ignores its `user`
argument entirely and always returns `firebaseAdapter`; the parameter is kept so a
future backend can branch on it again without a call-site change.

Cross-reference: `CLAUDE.md §Storage adapter abstraction`, `docs/api.md §Storage
adapters`.

---

## 6. Deploy checklist

1. Create a Firebase project and copy `src/services/firebase.config.example.js` to
   `src/services/firebase.config.js`, filling in that project's values (gitignored —
   never commit real credentials).
2. Enable Email/Password and Anonymous auth in Firebase Console.
3. Publish Realtime Database rules from `firebase/database.rules.json`.
4. Serve static files (`npm run dev` locally, via `scripts/dev-server.mjs`; Firebase
   Hosting or any CDN in production).
5. Enable Firebase App Check before a public launch.
6. Add `FIREBASE_CONFIG_TEST` and `FIREBASE_TOKEN` GitHub secrets to enable E2E CI.

**Future hardening:**
- Move public seed roadmap content to versioned static JSON or a `roadmapTemplates/{version}` node.
- Add server-side validation with Cloud Functions if sharing/community resources are introduced.
- Track analytics events without storing sensitive preparation notes.

---

## 6a. Database backup & disaster recovery

`.github/workflows/db-backup.yml` (issue #130) runs a daily scheduled export (09:00 UTC
cron, plus `workflow_dispatch` for manual/on-demand runs) of the entire Firebase
Realtime Database via `firebase database:get /`, authenticated with the same
the `FIREBASE_SERVICE_ACCOUNT_<PROJECT_ID>` secret already used by `deploy.yml` — evaluated against a
narrower-scoped service account and kept as the existing one since it already has the
Realtime Database read access a backup needs, and provisioning a second credential
would be extra secret-rotation surface for no real isolation benefit (a backup job
compromised via the same secret as deploy is no worse than deploy itself being
compromised). **This repo is public**, so GitHub Actions artifacts are downloadable by
anyone with read access to it — the plaintext export would leak every user's roadmap,
Daily Todos, activity log, and feedback-report data. The snapshot is therefore
AES-256-CBC encrypted (`openssl enc -pbkdf2`) with a dedicated `BACKUP_ENCRYPTION_KEY`
secret before upload, and the plaintext JSON is deleted from the runner immediately
after encryption; only the `.enc` ciphertext is ever uploaded. `BACKUP_ENCRYPTION_KEY`
is a separate secret from the deploy service-account secret (a long random passphrase, e.g.
`openssl rand -base64 32`, set once in repo → Settings → Secrets and variables →
Actions) — anyone with that passphrase plus a downloaded artifact can read a full
database dump, so treat it with the same care as a production credential and rotate it
if ever suspected of leaking (rotating it does not retroactively re-encrypt older
artifacts, only affects future runs). Each snapshot is uploaded as a GitHub Actions
build artifact named `rtdb-backup-<UTC timestamp>.json.enc` with `retention-days: 30`
— at this app's data size (~20-30KB per user, per issue #5's research), a daily
snapshot is trivially cheap and a private Cloud Storage bucket (which wouldn't need
this encryption step, since it isn't publicly readable) is deferred until real usage
numbers justify the added infrastructure. Retention policy: GitHub Actions retains the
last 30 daily snapshots
automatically; anyone wanting longer-term (e.g. weekly-for-a-year) retention should
download and archive a snapshot manually until this graduates to a bucket with
lifecycle rules. If the workflow itself fails, GitHub's own workflow-failure
notification (email/GitHub UI, to whoever has notifications enabled for this repo) is
the alert — no separate alerting infrastructure was built for this.

**Restore procedure** (manual — not automated; see issue #130's scope):

1. Download the encrypted snapshot artifact from the failed/target workflow run
   (Actions tab → run → Artifacts) — it downloads as a `.zip` containing the
   `rtdb-backup-<timestamp>.json.enc` file.
2. Decrypt it locally with the `BACKUP_ENCRYPTION_KEY` secret's value (repo → Settings
   → Secrets and variables → Actions doesn't let you view an existing secret's value —
   whoever holds a copy from when it was created must supply it):
   ```
   openssl enc -d -aes-256-cbc -pbkdf2 \
     -in rtdb-backup-<timestamp>.json.enc \
     -out rtdb-backup-<timestamp>.json \
     -pass pass:<the BACKUP_ENCRYPTION_KEY value>
   ```
3. **Freeze writes first.** Don't restore over live traffic — either put the app in
   maintenance mode or temporarily tighten `firebase/database.rules.json` to
   read-only, deploy that, confirm no writes are in flight, then proceed.
4. Restore with the Firebase CLI, authenticated as an operator with write access to
   the target project:
   ```
   firebase database:set / rtdb-backup-<timestamp>.json --project <project-id>
   ```
   This **overwrites the entire database** with the snapshot's contents — there is no
   partial/merge restore. Double-check the project ID before running it.
5. Revert any temporary rules lockdown from step 3 and redeploy the real
   `firebase/database.rules.json`.
6. Spot-check a few known user records (roadmap, Daily Todos) against the snapshot to
   confirm the restore matches, before announcing the incident resolved.
7. Delete the decrypted plaintext JSON from your local machine once the restore is
   confirmed — it's the same sensitive full-database dump the encryption step exists
   to protect.

Before relying on this in a real incident, run the dry run once against a throwaway
Firebase project: trigger the workflow via `workflow_dispatch`, download the resulting
artifact, then run the `database:set` command above against that same throwaway
project and confirm the data matches. This has not yet been performed as of the
workflow's introduction (issue #130) — do it before the first real incident, not
during one.

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

## Open product decisions

Business/product questions deliberately tracked as open, not silently deferred:

- **Monetization model** (issue #135, `docs/monetization-decision.md`) — free forever,
  freemium, one-time purchase, or subscription. No decision made yet; revisit
  post-launch based on real user demand.

---

## Accepted security risks

Dependency/CVE findings deliberately left unresolved after investigation, with the
reasoning recorded so the decision isn't silently re-litigated (or silently forgotten)
later:

- **`firebase-tools` transitive moderate advisories** (issue #191, 2026-07-17) —
  `npm audit` reports 5 moderate advisories (`@opentelemetry/core <2.8.0` unbounded
  memory allocation, `uuid <11.1.1` missing buffer bounds check) pulled in transitively
  via `firebase-tools`'s own `@google-cloud/pubsub`/`gaxios` dependencies. Confirmed
  `firebase-tools@15.24.0` (latest as of this writing; bumped from the previously
  pinned `^15.22.4`) still resolves to the same vulnerable transitive versions — no
  upstream release yet fixes this. `npm audit fix --force` would downgrade
  `firebase-tools` to `14.23.0`, a major-version downgrade with its own
  CLI-compatibility risk, so that path was rejected. Accepted because: `firebase-tools`
  is a devDependency only, never shipped to the client bundle; exposure is limited to
  local/CI developer machines running the CLI. Revisit next time `firebase-tools` is
  bumped, or every ~90 days, whichever comes first — re-run `npm audit` and `npm ls
  @opentelemetry/core uuid` to check whether upstream has resolved it.

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
- `Cache-Control` per route: `no-cache` for `index.html` (always-fresh entry point), `max-age=86400, must-revalidate` for `/src/**` and `*.css` (see issue #185 Build Log entry below for why this was shortened from a 1-year `immutable` value)
- Security headers on `**`: HSTS, X-Frame-Options: DENY, X-Content-Type-Options, Referrer-Policy, Permissions-Policy (supersedes the security-headers-only version from PR #46 / issue #25)
- `database.rules` wired so `firebase deploy` also updates Realtime DB Security Rules

**`.firebaserc`** added with a `YOUR_FIREBASE_PROJECT_ID` placeholder — must be set to the real project ID before deploying.

**`.github/workflows/deploy.yml`** added: `FirebaseExtended/action-hosting-deploy@v0`
triggered on push to `main` (live channel) and on PRs (temporary channel, expires 7d). Deploy
steps are guarded by a readiness check — if the service-account secret is not set, the
workflow prints instructions and exits cleanly rather than failing. Required setup:
- `FIREBASE_SERVICE_ACCOUNT_<PROJECT_ID>` (secret) — service account JSON, created and
  uploaded automatically by `firebase init hosting:github` (the secret name is derived
  from the linked project ID, not the bare literal `FIREBASE_SERVICE_ACCOUNT`)
- `FIREBASE_CONFIG` (secret) — production `firebase.config.js` contents
- `FIREBASE_PROJECT_ID` (variable) — project ID (non-sensitive)

### 2026-07-05 — PR #TBD — Email verification, persistent sessions, account deletion (issue #14)

**New module**: `src/ui/components/verificationBanner.js` — dismissible info bar shown on
the dashboard when the signed-in user's email is not yet verified. Dismiss state is stored
in `sessionStorage` keyed by `ascent-verify-dismissed-{uid}` so it persists across
navigations but clears on browser close.

**`src/services/firebase.js`** extended with three new `authApi` methods:
- `sendVerificationEmail()` — wraps `sendEmailVerification(auth.currentUser)`; called best-effort
  after sign-up (error is swallowed so a transient Firebase failure never blocks account creation)
- `setPersistence(rememberMe)` — switches between `browserLocalPersistence` (default, survives
  restart) and `browserSessionPersistence` (tab-only); called in signIn.js before the sign-in
  call so persistence is set before the credential exchange
- `deleteAccount(password)` — re-authenticates with `reauthenticateWithCredential`, then deletes
  `users/{uid}` from Realtime Database *before* calling `deleteUser` (reversing this order leaves
  orphaned database data)

**`src/ui/pages/dashboard.js`**: mounts `verificationBanner` above the offline banner;
adds a "Delete account" button (non-anonymous users only) that opens an inline confirmation modal
with password re-entry — no native `confirm()`.

**`src/ui/pages/signIn.js`**: "Keep me signed in" checkbox (checked by default) calls
`authApi.setPersistence` before sign-in.

### 2026-07-05 — PR #TBD — Auth form UX hardening (issue #26)

**New module**: `src/ui/utils/password.js` — two exports used by both auth pages:
- `scorePassword(s)` — pure function returning 0–4; 0 for empty/too-short, 1 base for
  ≥6 chars, +1 for ≥8, +1 for ≥12, +1 for mixed case, +1 for digit, +1 for special char
  (capped at 4). No external library.
- `makePasswordToggle(input)` — factory returning an absolutely-positioned `<button>`
  that toggles `input.type` between `'password'` and `'text'` and updates `aria-label`.
  Caller wraps the input in `.field-input-wrap` (CSS `position: relative`).

**`src/ui/pages/signUp.js`**: added confirm-password field with real-time mismatch
validation (fires on `input` event and on submit before any Firebase call); 4-segment
strength meter driven by `scorePassword`; show/hide toggles on both password fields;
"Continue as guest" divider + button (matching sign-in). Labels changed to "Create a
password" / "Confirm password".

**`src/ui/pages/signIn.js`**: show/hide toggle added to the password field.

**`src/styles/app.css`**: new classes `.field-input-wrap`, `.password-toggle`,
`.strength-meter`, `.strength-segment`, `.strength-segment.weak/.fair/.strong`,
`.field-error`.

### 2026-07-06 — PR #TBD — Product rename to Ascent, brand system, localStorage key migration (issue #7)

**New module**: `src/ui/components/brand.js` — single source of truth for the wordmark.
Exports `createBrandIcon()` / `createBrandWordmark()` / `createBrandMark({ tagline })`.
Replaces the `✓`-glyph markup that was previously duplicated inline in both
`authShell.js` and `dashboard.js` with a shared inline SVG triangle (filled with
`currentColor` so `.brand-mark`'s CSS still controls the color). `el()` only creates
HTML elements (`document.createElement`), so `brand.js` adds its own tiny local
`svgEl()` helper (`document.createElementNS`) rather than changing the shared `dom.js`
contract, since nothing else in the app needs SVG creation.

**New modules**: `src/services/localStorageKeys.js` (canonical `KEYS` object +
`verifyDismissedKey(uid)`) and `src/services/migration.js`
(`migrateLocalStorageKeys()`), called at the top of `main.js` before `initTheme()`.
Renaming `switchprep-theme` / `switchprep-roadmap-v3` / `switchprep-ui-v3` without a
migration would have silently reset every existing user's theme and roadmap progress
on their next visit. `src/services/themeBootstrap.js` (a classic script that runs
before `main.js`'s migration ever gets a chance to) reads `ascent-theme` first and
falls back to `switchprep-theme`, so first paint is still correct pre-migration.

**New assets**: `public/favicon.svg` (hand-written, matches `.brand-mark`'s existing
40×40 / `rx: 12` / teal→cyan gradient exactly), plus `public/favicon-32.png`,
`public/apple-touch-icon.png`, `public/icon-192.png`, `public/icon-512.png`,
`public/og-image.png`, and `public/manifest.json`. The PNGs and OG image are generated
by `scripts/generate-brand-assets.mjs` (dev-only, run via
`npm run generate:brand-assets`), which uses the already-installed
`@playwright/test` Chromium to screenshot `favicon.svg` at each required size —
pixel-consistent with the in-app icon rather than redrawn by hand. `index.html` gains
`<link rel="icon"/manifest/apple-touch-icon>`, `theme-color`, and `og:*` meta tags;
none existed before this PR.

**Deferred** (see `docs/adr/ADR-004-product-rename.md`): the GitHub repository rename
is Issue #10; Firebase Console changes (project display name, Auth email templates,
custom action-URL domain) are manual, non-code steps documented as a checklist on the
closing PR.

### 2026-07-06 — PR #TBD — Starter template system, new-user onboarding picker (issue #51)

**New directory**: `src/data/templates/` — the starter template registry (`index.js`:
`TEMPLATES`, `getTemplate`, `buildSeedItems(templateId)`, `getTemplatePhases(templateId)`)
plus four template modules: `java-backend.js` (the original roadmap, moved verbatim from
`src/data/roadmap.js`), `frontend.js`, `data-science.js`, and `blank.js` (four empty
phases, no seeded topics). `src/data/roadmap.js` is now a thin re-export shim pointing at
`templates/java-backend.js` — every existing import of it keeps working unchanged.
Templates load via dynamic `import()` so the sign-in/sign-up pages never download roadmap
content the visitor hasn't picked yet.

**New route/page**: `src/ui/pages/onboarding.js` (`/onboarding`) — a template picker
shown once, right after a brand-new sign-up (no back link or confirmation needed then,
since there's nothing to lose yet). Renders one card per registered template with a
live item count (fetched async per card), and calls the new
`roadmapStore.initFromTemplate(templateId)` on selection. Also reachable later via the
dashboard's new "Switch template" link — see the follow-up note below.

**`src/services/roadmapStore.js`**: `setUser(nextUser)` is now `async`. It performs a
one-time `dbApi.getMeta` + `dbApi.getRoadmap` read to decide `onboardingDone` before
attaching the realtime `listenRoadmap` listener — see §5.7 for the full detection order,
including the Part 5 backfill for every pre-existing account. Snapshots now also carry
`templateId`, `onboardingDone`, and `phases` (the active template's phase/section
skeleton). New `initFromTemplate(templateId)` seeds items from a chosen template and
starts syncing.

**`src/services/firebase.js`**: `dbApi` gains `getRoadmap`/`getMeta` (one-time `get()`
reads) and `saveMeta` (partial `update()` of `users/{uid}/meta`), alongside the existing
`listenRoadmap`/`saveRoadmap`.

**`firebase/database.rules.json`**: added validation for `users/{uid}/meta/templateId`
(string) and `meta/onboardingDone` (boolean).

**`src/ui/pages/dashboard.js`**: `groupItems()` now takes the active template's phase
skeleton (`store.getSnapshot().phases`) as a parameter instead of a hardcoded `PHASES`
import, and a section with zero total items (as opposed to zero items *after* a
filter/search) always stays visible — otherwise the "blank" template's four empty phases
would never render a phase-card at all. Also self-guards on `!store.getSnapshot().onboardingDone`
the same way it already self-guards on `!user`.

**Copy**: the dashboard search input's placeholder ("Search topics, e.g. Kafka, RAG,
Saga…") was the last Java-specific string outside the templates themselves; changed to
"Search topics…".

**Follow-up fixes from manual testing, same PR**: (1) added a "Switch template" link to
the dashboard header and relaxed `onboarding.js`'s self-guard so it no longer redirects
an already-onboarded user away — reached that way it shows a "← Back to my roadmap"
link and a confirmation dialog before replacing the roadmap (see §5.8, and §5.10 for the
later switch from the native `confirm()` to `confirmDialog()`); (2) fixed a real
concurrency bug where a slow, superseded `setUser()` call could resolve after a newer
one and clobber its state — most reproducible by deleting an account and immediately
signing up again with the same email — via a `stateCallId` generation guard shared with
`initFromTemplate()` (see §5.8); (3) substantially expanded `frontend.js` (116 → 230
topics) and `data-science.js` (80 → 166 topics) to match the Java Backend template's
depth, adding a `TOPIC_RESOURCES` map to both.

**Second follow-up round, same PR — diversify templates, per-user hiding, self-build
guide**: (4) added four new starter templates so the lineup no longer reads as
"one category, software engineering" — `genai-agentic-ai.js`, `math-grade12.js`,
`piano.js`, `marketing.js` — bringing the registry to 8 templates total (kept
`frontend.js`/`data-science.js` rather than removing them, per explicit direction).
(5) Added a per-user "hide this template" preference (§5.9): a hide (×) button on every
card except "blank", persisted to `users/{uid}/meta/hiddenTemplateIds`
(`roadmapStore.hideTemplate`/`unhideTemplate`), with a "Show hidden templates" reveal
and "Restore" affordance — explicitly scoped to the signed-in user only, never a global
template deletion. (6) Added `src/ui/components/buildYourOwnGuide.js`, an informational
modal opened from the "blank" card's new "ℹ How do I build my own?" button, explaining
the manual "Add a custom topic…" workflow and a practical external-AI-assistant tip —
honest that automated AI import isn't built yet. `onboarding.js`'s card markup changed
from a `<button class="template-card">` to a `<div role="button" tabindex="0">` so each
card can host a real nested `<button>` (hide or info) without invalid button-in-button
markup; `firebase/database.rules.json` validates the new `meta.hiddenTemplateIds` array.

### 2026-07-06 — PR #57 — Onboarding UX polish: custom confirm dialog, home link, current-roadmap indicator (issue #51 follow-up)

**New component**: `src/ui/components/confirmDialog.js` — replaces every native
`window.confirm()` call in the app (`onboarding.js` switch/hide prompts,
`dashboard.js` sign-out-with-unsaved-changes prompt, `itemPanel.js` delete-topic
prompt) with a themed `Promise<boolean>`-returning modal built on the existing
`.modal-overlay`/`.modal-card` styling. See §5.10.

**`src/ui/pages/dashboard.js` / `src/ui/pages/onboarding.js`**: the brand mark
(`createBrandMark()`) is now wrapped in `<a class="brand" href="#/onboarding">` on
both pages instead of a non-interactive `<div>`, giving the app a consistent "click
the logo to go home" affordance (the sign-in/sign-up pages already had this via
`#/signin`). The dashboard hero also gained a `.current-roadmap-badge` showing the
active template's icon and name, and the onboarding picker marks the active
template's card with a `.template-card-current` highlight plus a "Current" badge;
re-picking that same card now short-circuits to `navigate('/app', true)` instead of
calling `store.initFromTemplate()` again, which previously would have silently
re-seeded (and discarded progress on) the roadmap the user was already on. See §5.10.

**`src/styles/app.css`**: also fixed `.template-card` rendering at inconsistent
heights within the same onboarding grid row (no `height: 100%`, content-sized
`display: grid` rows) — now a `height: 100%` flex column with the topic-count/footer
row (`.template-card-footer`) pinned to the bottom via `margin-top: auto`. Documented
as a required "Card/grid layout" convention in `CLAUDE.md`/`AGENTS.md` for any future
card-grid component.

### 2026-07-06 — PR #57 — Fix: previous template's content could reappear after switching roadmaps (issue #51 follow-up)

**Bug**: reported from real usage — after switching to a different starter template,
the *previous* template's items (including checked-off progress) would sometimes
reappear in place of the freshly-picked template's, reproducing on nearly every
switch rather than as a rare fluke.

**Root cause**: `initFromTemplate()` resets `items`/`templateId`/`lastFlushedStr`
synchronously, but a debounced save queued against the *previous* template can
already be in flight to Firebase and can't be cancelled. `attachRoadmapListener()`'s
still-attached `onValue` listener receives that save's echo after the switch; it
fails the now-reset `lastFlushedStr` comparison (§5.2) and fell through to the
"genuinely different remote data" branch, which overwrote the new template's
`items` with the old template's — and persisted that to `localStorage` too.

**Fix**: `flush()` now tags every saved payload with the `templateId` it was
written for; `attachRoadmapListener()`'s callback rejects any incoming update whose
`templateId` doesn't match the currently active template before running the
echo/structuralVersion comparison at all. Payloads from before this field existed
have no `templateId` and are still trusted. `firebase/database.rules.json` validates
the new `roadmap.templateId` field. See §5.2's follow-up subsection for the full
writeup. Regression-tested in `tests/integration/roadmapStore.test.js`'s
"cross-template echo guard" block (4 new tests: stale cross-template echo is
dropped, a genuine same-template remote update still applies, legacy untagged saves
are still trusted, and every save is tagged with its `templateId`) — verified the
new test fails without the fix and passes with it, rather than trusting a
timing-dependent manual repro.

### 2026-07-06 — PR #58 — Multi-roadmap support: concurrent progress per template, non-destructive switching (issue #58)

Replaced the single-roadmap-slot model (`users/{uid}/roadmap`, replace-on-switch via
`initFromTemplate()`) with per-template Firebase storage
(`users/{uid}/roadmaps/{templateId}/`) so a user can start multiple templates and
switch between them with zero data loss. `roadmapStore.js` rewritten: `activeTemplateId`
+ `startedTemplateIds` replace `templateId`; a session-scoped `roadmapCache` makes
switching back to an already-visited template instant; `switchRoadmap(templateId)`
replaces `initFromTemplate()` for both first-time picks and later switches. Three
correctness fixes specific to the new per-template-path design: (1) "flush-before-switch"
— an edit pending on the outgoing template is flushed to its own path before
`activeTemplateId` is reassigned, or it would otherwise be silently dropped; (2) a
closure-based "stale listener guard" replaces the old #51 payload-tag cross-template
echo guard, since each template's listener is now structurally scoped to its own path;
(3) found via real E2E testing against live Firebase (reliably reproducible, not caught
by the mocked test suite) — the realtime listener no longer applies an incoming snapshot
while a local edit is still unflushed (`dirty === true`), since a delayed echo of an
older write could otherwise fail to string-match what was last flushed (Firebase's own
data normalization) and get misapplied as newer data, silently reverting an edit made
right after starting a fresh template. `setUser()` migrates pre-#58 accounts (legacy
`users/{uid}/roadmap` + old meta shape)
forward on first sign-in, leaving the old path untouched as a safety net.
`firebase/database.rules.json` extended with the `roadmaps/$templateId` node and
`meta.activeTemplateId`/`meta.startedTemplateIds` validators, alongside (not replacing)
the legacy validators. `onboarding.js` drops the switch-mode `confirmDialog()` entirely
(nothing is destroyed anymore) and gains a third card badge state, "In progress", for a
started-but-not-active template. See §5.11 for the full writeup.

### 2026-07-07 — PR #60 — Manual roadmap creation: full phase/section/topic CRUD (issue #4)

Added a "Create your own roadmap" path alongside the 8 built-in starter templates.
`roadmapStore.js` gains `createCustomRoadmap`/`deleteCustomRoadmap` and a `customRoadmaps`
list (`{ id, title, description, createdAt }`, synced to `users/{uid}/meta.customRoadmaps`);
each custom roadmap gets a generated `croadmap-<timestamp>-<random>` id
(`isCustomRoadmapId()`, exported from the store) instead of a built-in template id, and
reuses the exact same per-template Firebase path / `startedTemplateIds` / cache-first
resolution machinery issue #58 built — no new storage model, just a new kind of id
flowing through the existing one. The one real structural addition: a built-in template's
`phases` skeleton is fixed code, never persisted, but a custom roadmap's `phases` (now
carrying generated `phase-...`/`section-...` ids so they can be renamed/removed
unambiguously) are user data with no code-side source of truth, so `fetchTemplateData`/
`resolveRoadmapItems`/`flush`/`persistLocal` all thread `phases` through the same
cache → Firebase → local-blob → seed resolution `items` already used, and
`attachRoadmapListener`'s echo/structural-version comparison now compares `{ items,
phases }` together instead of `items` alone (a no-op for built-in templates, whose phases
never differ). New store mutations `addPhase`/`renamePhase`/`removePhase`/`addSection`/
`renameSection`/`removeSection` are no-ops unless `activeTemplateId` is a custom id;
renaming re-files affected items to the new title, removing soft-deletes items under the
removed phase/section (same soft-delete convention `removeItem` already used). New
`src/ui/components/newRoadmapModal.js` (title/description form, same `.modal-overlay`
chrome as `confirmDialog`); `onboarding.js` renders a "Create your own roadmap" card plus
one card per custom roadmap (same Current/In-progress badges as template cards, with a
delete button instead of hide); `dashboard.js` shows "+ Add phase"/"+ Add section" and
inline rename/delete controls only when `store.isCustomRoadmapId(activeTemplateId)`.
`firebase/database.rules.json` extended with a `meta.customRoadmaps` array validator.
Superseded the original issue #4's "default pinned/read-only roadmap" proposal — issue
#51's starter-template system already gives every user a roadmap on first load, so a
separate read-only "default" concept would have been redundant. AI-assisted import
shipped separately — see the entry below.

### 2026-07-07 — PR #62 — AI-assisted roadmap import (issue #4)

Added the AI-import half of issue #4, on top of PR #60's manual-CRUD custom-roadmap
data model. Two new pure modules with a strict one-way dependency (adapter depends on
validator's output shape, never the reverse): `src/core/roadmap/importValidator.js`
(`parseImportJson`/`validateImportPayload`/`validateImportText`) checks a pasted JSON
string against schema version 1 — required `title`, non-empty `phases` with valid
`title`/`priority ∈ {P0-P3}`/`sections`, non-empty `items` per section, each item a
string or `["title","priority"]` tuple, and a 500-item cap — returning per-field error
strings; `src/core/roadmap/schemaAdapter.js` (`adaptImportToRoadmap`) then converts
already-validated data into the `{ phases, items }` shape `roadmapStore.createCustomRoadmap`
expects, generating `phase-...`/`section-...`/`custom-...` ids the same way
`addPhase`/`addSection`/`addItem` already did. `src/data/importPrompt.js` holds a
versioned (`IMPORT_PROMPT_VERSION`), copyable prompt template. New
`src/ui/components/importRoadmapModal.js` is a two-tab modal ("Generate with AI" /
"Paste & Import", 300ms-debounced validation, Clipboard API with an `execCommand`
fallback) resolving `{ title, phases, items } | null`. `roadmapStore.js`'s
`createCustomRoadmap` gained optional `phases`/`items` parameters, threaded through a new
one-shot `pendingCustomSeeds` map that `fetchTemplateData` consumes instead of the usual
empty seed for a not-yet-started custom id — omitted (the manual-creation path), it falls
through to the empty seed exactly as before, so this was a purely additive change to an
already-shipped function's signature. `onboarding.js` gained a second action card,
"Import roadmap", right after "Create your own roadmap", wired to the same
`store.createCustomRoadmap` call. From activation onward an imported roadmap is
identical to a manually-built one — same Firebase path, same phase/section CRUD
controls, same `deleteCustomRoadmap` cleanup. This closes out issue #4 in full.

**Same PR, follow-up scope found during the above work**: retired the "Start blank"
built-in template. Once manual CRUD and AI import both existed in this same branch,
"blank" — four fixed, uneditable phases, exactly one per account, never hideable — was
recognized as a strict subset of "Create your own roadmap" (fully editable, unlimited
instances, deletable) and removed from `TEMPLATES`. `blank.js` itself is untouched, kept
importable via a new migration-only export, `getLegacyBlankTemplateData()` — every other
path (`getTemplate`, `buildSeedItems`, `getTemplatePhases`) now falls back to
`TEMPLATES[0]` for `'blank'` like any unrecognized id. `roadmapStore.js`'s `setUser()`
gained a one-time migration, inserted before the meta-driven `activeTemplateId`/
`startedTemplateIds` are used to call `fetchTemplateData` (which would otherwise be
called with the now-meaningless `'blank'` id and silently resolve wrong content): reads
whatever's actually stored at `users/{uid}/roadmaps/blank` (Firebase, then the local
blob), falls back to `getLegacyBlankTemplateData()` only for whichever half (items or
phases) is missing (pre-PR-#60 accounts never persisted `phases`), creates a new
`croadmap-...` entry titled "My roadmap", and corrects `activeTemplateId`/
`startedTemplateIds`/`customRoadmaps` in both memory and a single Firebase `saveMeta`
call so the account is never re-migrated (or duplicated) on a later sign-in. The old
`users/{uid}/roadmaps/blank` node is left in place, never deleted — same
never-delete-just-stop-reading precedent as every other legacy path in this file
(pre-#58 single-roadmap accounts, pre-#51 identity). `onboarding.js` dropped the
`isBlank` branch in `buildCard()` and the `'blank'`-only filter carve-out — every
built-in template card now gets a hide button unconditionally.
`buildYourOwnGuide.js` (formerly blank's info-button destination) was rewritten to cover
both the manual workflow and the real AI-import flow side by side, with an "Open Import
roadmap" button handing off to `onboarding.js`'s own `handleImport()` — its trigger moved
from blank's card (now gone) to a new corner ℹ button on "Create your own roadmap",
styled like the existing hide/delete corner buttons (`.template-card-info-corner`).
Manually verified against the live Firebase emulator: seeded a legacy "blank" account's
meta/data directly via the SDK, reloaded, and confirmed the migrated roadmap kept its
exact phases and topic, showed up correctly in both the dashboard and the onboarding
picker, and that no "Start blank" card remained.

### 2026-07-07 — PR #TBD — Personal notes per topic (issue #15)

Added a `notes: string` field to the item schema, alongside the existing `resources`
array. No template/seed changes: backward compat is handled entirely by treating a
missing `notes` field as `''` at read time, the same way older items without seeded
`resources: []` were never retrofitted either. `updateItem`'s existing cosmetic-check
(`Object.keys(patch).every(key => key === 'done')`) already classified a `{ notes }`
patch as non-cosmetic with zero code change — added a comment there specifically
warning against ever adding `'notes'` to that check, since the row's notes indicator
depends on `structuralVersion` bumping to re-render.

`src/ui/components/itemPanel.js` gained a Notes field between Priority and Resources —
a `<textarea maxlength="5000">` with `field-sizing: content` (auto-grows, no JS height
sync needed) and its own independent autosave path: an 800ms-debounced call to `onSave`
with just `{ notes }`, separate from the title/priority/resources bundle the "Save
changes" button submits. A local `notesSaveTimer` is flushed synchronously in `close()`
(Cancel, Escape, outside-click, or Delete) so an edit made in the narrow window before
the debounce fires is never silently lost — the same class of bug the "flush-before-switch"
and "out-of-order echo guard" work in `roadmapStore.js` already exists to prevent, just
at the component level instead of the store level. A `focusField: 'notes'` option (new,
optional — defaults to focusing the title input as before) lets a caller open the panel
with focus already in the notes textarea.

`dashboard.js`'s `renderItemRow` gained a `data-action="notes"` 📝 button next to the
resource-count badge, rendered only when `item.notes` is non-empty, following the same
`e.stopPropagation()` click-guard convention as the resource badge and Edit button —
clicking it opens the item panel via `focusField: 'notes'`. Uses the native `title`
attribute for the "Has notes" tooltip rather than a custom tooltip component, since a
plain hover title was sufficient here.

New tests: `tests/unit/itemPanel.test.js` (textarea pre-fill, maxlength cap, character
counter threshold, debounce timing, autosaved/failed indicator states, flush-on-close,
focusField); two new cases in `tests/integration/roadmapStore.test.js`'s
`structuralVersion contract` block (notes patch bumps `structuralVersion`; missing
`notes` field reads as `''`); `tests/e2e/itemNotes.test.js` (add note → reopen → note
restored; indicator visibility + click-to-focus; survives a page reload).

### 2026-07-07 — PR #68 — Fix: dirty local blob outranked by stale remote on reload (issue #67)

Found while investigating an E2E failure surfaced during an unrelated PR
(`tests/e2e/itemNotes.test.js`'s "notes survive a page reload"): reproduced
deterministically against a local Firebase emulator on a clean `main` checkout, so it
predates and is independent of that PR. See §5.11 "The same dirty-local guard was
missing from the initial-load path" above for the full root-cause writeup —
`resolveRoadmapItems` unconditionally preferred a successful remote read over the local
blob whenever remote had any items, with no check of the local blob's `dirty` flag. Fixed
by checking `localBlob.dirty` before attempting a remote read at all.

New tests: `tests/integration/roadmapStore.test.js`'s "resolveRoadmapItems — dirty local
blob outranks stale remote" describe block (dirty local wins over stale remote; the
recovered dirty state re-queues a save; an already-clean local blob still reads from
remote as before, unaffected). Verified against the local Firebase emulator: the
previously-deterministic E2E failure passed on repeated runs after the fix.

### 2026-07-07 — PR #TBD — Storage adapter abstraction (issue #5, part 1/3)

First of three PRs implementing issue #5 (pluggable storage backends). This PR
introduces the `StorageAdapter` interface and refactors `roadmapStore.js` to go through
it instead of importing `firebase.js` directly — see §5.12 above for the full
rationale, including why the interface's shape (`(uid, templateId, ...)` on every
method, plus a separate `meta` document) deviates from the issue's simpler MVP sketch.

`src/services/storage/FirebaseAdapter.js` is `dbApi`'s exact previous logic (same ref
paths, same method bodies), just relocated out of `firebase.js`; `firebase.js` keeps
only `auth`/`database`/`firebaseClock`/`authApi`/`authErrorMessage`.
`src/services/storage/adapterFactory.js`'s `getStorageAdapter()` always returns
`firebaseAdapter` for now — every signed-in uid, including anonymous/guest sessions
(which already used Firebase before this PR), keeps identical behavior; this is the
seam part 2 extends once a `GoogleDriveAdapter` exists.
`src/services/storage/LocalStorageAdapter.js` is a standalone, tested implementation of
the same contract over its own dedicated local-storage keys — not wired into
`roadmapStore.js` in this PR (see §5.12).

No behavior change: `roadmapStore.js`'s echo guard, stale-call guard, flush-before-
switch, and `structuralVersion` logic are untouched — only the 13 `dbApi.*` call sites
became `adapter.*`, and the two `firebaseClock()` calls became `adapter.now()`.

New tests: `tests/unit/storage/StorageAdapter.test.js` (required methods throw, optional
methods have safe defaults); `tests/unit/storage/LocalStorageAdapter.test.js`
(save/get/delete round-trips, per-template isolation, partial `saveMeta` updates,
no-op `listenRoadmap` unsubscribe, `uid` is ignored). The existing 63-test
`tests/integration/roadmapStore.test.js` suite required no behavioral changes — only its
mock target moved from `../../src/services/firebase.js` to `../../src/services/storage/
adapterFactory.js`, keeping the same `dbApi`-named fake so every existing test body is
unchanged.

### 2026-07-07 — PR #TBD — Google Drive storage adapter (issue #5, part 2/3)

*(This adapter, and part 3 below, were removed in the 2026-07-08 entry at the end of
this log — kept here as an accurate record of what shipped and why, not current state.)*

Second of three PRs implementing issue #5. See §5.13 (as it existed at the time) —
`GoogleDriveAdapter` (Drive REST API via raw `fetch`, conflict retry via etag +
last-write-wins-per-item merge, visibility/focus polling in place of realtime push) and
`adapterFactory.getStorageAdapter(user)` branching on `providerData` — plus the
`listenRoadmap` interface fix (callback now receives a plain payload, never a Firebase
`DataSnapshot`) that building this adapter surfaced as a real defect in part 1.

`roadmapStore.js`'s `adapter` binding changed from a `const` fixed at store creation to a
`let` reassigned via `getStorageAdapter(nextUser)` at the top of every `setUser()` call —
necessary since which backend applies now depends on which user signs in, not a
once-per-app-load choice. No behavior change for any account reachable today (anonymous
or email/password): `getStorageAdapter` still resolves to `firebaseAdapter` for all of
them, and `googleDriveAdapter` is unreachable until part 3 ships real Google sign-in.

New tests: `tests/unit/storage/GoogleDriveAdapter.test.js` (save create/update/412-merge-
retry, load found/missing/network-error, delete found/missing, meta read-merge-write,
visibility/focus-triggered polling and its unsubscribe, 401 → `onTokenExpired` +
rejection, missing token provider throws only when actually used);
`tests/unit/storage/adapterFactory.test.js` (correct adapter for null/anonymous/email/
Google-shaped users); two new cases in `tests/integration/roadmapStore.test.js`'s new
"adapter reselection per sign-in" block (`setUser` calls `getStorageAdapter` with the
signed-in user; a later sign-in as a different auth type actually switches which
adapter's methods get called, not a stale one from the previous session).

### 2026-07-08 — PR #TBD — Remove Google Sign-In and the Google Drive storage adapter (issue #5 parts 2–3, issue #71)

Part 3 of issue #5 (real "Sign in with Google" UI/GIS token wiring, PR #70) spent two
days fighting real-world OAuth problems — popup timing losing the browser's user-gesture
window across two chained popups, CSP blocking the GIS relay iframe, silent-refresh
edge cases — without landing a version considered reliable enough to ship. Decision: not
worth the ongoing cost right now. PR #70 was closed unmerged; its branch,
`feat/issue-5-google-signin`, was never merged into `main`.

Since part 2 (`GoogleDriveAdapter`, PR #69) was *only* reachable once part 3 shipped a
real Google-authenticated user, dropping part 3 made part 2 permanently dead code, not
just temporarily unreachable — so it was removed too: `src/services/storage/
GoogleDriveAdapter.js` and its test deleted; `adapterFactory.js`'s `isGoogleUser`
branch removed, `getStorageAdapter()` now unconditionally returns `firebaseAdapter`
(the `user` parameter is kept, unused, as the seam a future backend would need); the
Google-branch test cases in `adapterFactory.test.js` and the Google-specific fixture in
`roadmapStore.test.js`'s "adapter reselection" test were replaced with backend-agnostic
equivalents that still cover the real behavior (adapter is re-resolved on every
`setUser()`, a later sign-in doesn't keep a stale previous adapter).

**Part 1 (the `StorageAdapter`/`FirebaseAdapter`/`LocalStorageAdapter` interface, PR
#66) was deliberately kept**, not reverted — it was already load-bearing for #58
(multi-roadmap), #4 (custom roadmaps/import), #15 (notes), and #67 (dirty-guard), all
built on top of `roadmapStore.js` calling "the active adapter" rather than `firebase.js`
directly. With `adapterFactory.js` simplified to a single unconditional branch, this
behaves identically to hard-wiring Firebase, at zero ongoing cost, while leaving the one
seam a future second backend would plug into. See §5.12 (rewritten by this PR — the old
§5.13 covering `GoogleDriveAdapter` internals was folded/removed) for the current-state
description.

Docs updated in the same pass: `CLAUDE.md`/`AGENTS.md` (storage adapter section
trimmed, file map entry removed), `docs/api.md` (`GoogleDriveAdapter` section removed),
`docs/roadmap.md` (Google Drive backend line removed from Future), `CHANGELOG.md`
(part 2 entry removed, part 1 entry's forward-looking framing trimmed, new entry added).
Issues #5 and #71 were closed; #18, #10, and #6 had stale Google/Drive references
updated (they weren't about Google Sign-In themselves, just referenced it in passing);
tracker issue #11 updated to match.

### 2026-07-08 — PR #TBD — Firebase Database Rules hardening + anonymous data cleanup (issue #24)

Four gaps identified in `firebase/database.rules.json`: no payload size limits, weak
field-level type validation, no rules for the future `reports/` path (issue #9), and
orphaned anonymous Firebase Auth users whose roadmap data outlived their session.

**Rules (`firebase/database.rules.json`).** `version`/`updatedAt` under both
`roadmap` (legacy) and `roadmaps/$templateId` now validate as `isNumber()` (or `null`
for `updatedAt`, which is absent on very old writes) instead of only checking presence
via `hasChildren`. A `$other: { ".validate": "false" }` catch-all under `users/$uid`
rejects writes to any path other than `roadmap`, `roadmaps`, or `meta` — closing the gap
where a buggy or malicious client could otherwise write arbitrary data anywhere under
its own uid (still auth-scoped, just unbounded in shape). A `reports/$uid` stub
(`.write` auth-scoped, `.read: false`) is added ahead of issue #9 actually using it, so
that issue doesn't also need a rules PR before shipping — Firebase's default-deny for
unmatched paths meant `reports/` had no access at all until this.

Firebase's Rules Simulator/emulator has no per-`.validate` unit test harness wired into
CI yet (issue #24 was explicitly blocked on issue #3's testing-infra work for this, which
is still open) — the pass/fail matrix below was verified by hand against the local
`firebase-tools` emulator and belongs in the PR description, not an automated suite. A
follow-up once #3's Rules Simulator CI lands should convert this matrix into real tests.

**Item count limit — client-side, not a rule.** Realtime Database rules cannot count a
map's children directly, so the 1,000-item-per-roadmap soft cap lives in
`roadmapStore.js`'s `addItem()` — the single place any new item is created — which now
returns `false` (instead of mutating anything) once a roadmap already holds 1,000
non-deleted items; `dashboard.js`'s "Add a custom topic…" row shows an error toast
instead of "Added" when this happens. Soft-deleted items don't count toward the cap.

**Anonymous data cleanup (Phase B, Option 2 — see
`docs/adr/ADR-005-anonymous-user-lifecycle.md`).** `authApi.signOut()` in
`src/services/firebase.js` now delegates to `signOutWithCleanup()`
(`src/services/authCleanup.js`) — a small, dependency-injected function with no
Firebase imports, extracted specifically so this branching logic is unit-testable in
CI without a real `firebase.config.js` (that file is gitignored and doesn't exist on
CI runners; `firebase.js` itself is never imported directly by any test in this repo
for that reason). It checks `user.isAnonymous` before signing out: an unlinked guest
gets `users/{uid}` removed from the database and their anonymous Firebase Auth record
deleted (same delete-data-before-delete-auth order as `deleteAccount()`, for the same
reason — the security rules would otherwise block the database cleanup once the Auth
record is gone) instead of a plain sign-out, so no inaccessible orphan is left behind.
A guest who links to a real account first (`linkGuest()`, already existing) is no
longer anonymous by the time `signOut()` could ever run, so that path was already
orphan-free and is unaffected. If the cleanup call itself throws (e.g. a stale token),
it falls back to a plain sign-out rather than trapping the user in the app over a
cleanup failure. See `tests/unit/firebaseSignOutCleanup.test.js` for the unit coverage.

### 2026-07-08 — PR #TBD — ESLint complexity gates, targeted refactors, client-side security hardening (issue #53)

Based on SonarSource's "Does Code Cleanliness Affect Coding Agents?" study
(arXiv:2605.20049): cleaner code (fewer static-analysis violations, lower cognitive
complexity) measurably reduced coding-agent token cost and file revisitations. Three
parts: CI gates, targeted refactors to satisfy them, and unrelated client-side security
hardening bundled into the same issue.

**Part 1 — ESLint gates (`eslint.config.js`).** Added four ESLint core rules as `warn`
— `complexity: 10`, `max-depth: 4`, `max-lines-per-function: { max: 80 }`, `max-params:
4` — plus `no-prototype-builtins: 'error'` (a core rule, not a new dependency).
`eslint-plugin-security`'s `detect-unsafe-regex`/`detect-non-literal-regexp` were
evaluated and skipped: adding it would be this project's first ESLint plugin
dependency, and a repo-wide grep found no dynamic `new RegExp(...)` construction or
`hasOwnProperty`/`Object.prototype` access in `src/` for it to catch today. Baseline at
issue creation: 16 violations across 7 files. The rules stay `warn` rather than
flipping to `error` — Part 2 below brought its three targeted files to zero violations,
but `itemPanel.js`, `signUp.js`, `onboarding.js`, and `importRoadmapModal.js` (outside
this issue's declared scope) still carry pre-existing violations of their own.
`roadmapStore.js`'s `setUser()`/`switchRoadmap()`/`resolveRoadmapItems()` also still
exceed the complexity/line thresholds beyond the one extraction Part 2 called for —
these functions carry many *documented, load-bearing* invariants (stale-call guards,
legacy migrations, echo detection) accumulated across several issues, and restructuring
them further was judged out of scope for this issue's risk budget.

**Part 2 — targeted refactors.** `dashboard.js`: extracted module-scope
`renderFilterChips(items, activeFilter, onFilterChange)` and `renderPhaseCard(phase,
pi, deps)` (previously inlined/anonymous-closure logic inside `render()`), and hoisted
`showDeleteModal()` out of the `renderDashboard` closure entirely — it only ever
touched module-level imports (`authApi`, `showToast`, `navigate`), so it had no real
dependency on `renderDashboard`'s reactive state. `render()` dropped from ~88 to ~30
lines. `signIn.js`: extracted module-scope `buildSignInForm({ prefillEmail,
onForgotPassword })` and `buildResetForm({ prefillEmail, onBack, onSuccess })` out of
the `showSignInView`/`showResetView` closures, which become thin ~10-line wrappers;
`buildSignInForm`'s guest-sign-in handler was further split into a small
`signInAsGuest()` helper purely to clear the `max-lines-per-function` threshold.
`roadmapStore.js`: extracted a pure, exported `applyRemoteSnapshot(remote,
currentItems, currentPhases, recentFlushedStrs)` from `attachRoadmapListener`'s
`onValue` callback — the stableStringify-compare / echo-detection /
`structuralVersion`-bump decision was three closures deep and impossible to unit-test
without a real Firebase listener; it now returns `null` (nothing to apply) or `{
items, phases, structuralVersionBumped }` for the caller to assign onto store state.
See `tests/integration/roadmapStore.test.js`'s "applyRemoteSnapshot" describe block.

**Part 3 — client-side security hardening.** New `src/core/roadmap/limits.js`
(dependency-free — no Firebase, no store) exports `MAX_TITLE_LENGTH` (200),
`MAX_RESOURCE_LABEL_LENGTH` (120), `MAX_RESOURCE_URL_LENGTH` (2048), and
`isValidResource()`. `roadmapStore.js`'s `addItem()`, `updateItem()`, `addResource()`,
and `updateResource()` — the only places these fields are ever written — now reject
(returning `false`, mutating nothing) a title or resource over these caps; `itemPanel.js`
and `dashboard.js`'s quick-add row surface a friendly inline/toast message using the
same constants before the store call is even attempted, mirroring issue #24's
server-rule-rejects/client-rule-warns-first pattern. `limits.js` was deliberately split
out of `roadmapStore.js` (rather than exporting the constants from there) because
`roadmapStore.js` transitively imports the Firebase SDK via `adapterFactory.js` →
`FirebaseAdapter.js` → `firebase.js`'s `https://www.gstatic.com/...` imports —
`itemPanel.js` has no other reason to load that chain, and doing so broke its existing
unit tests (which don't mock `firebase.js`) under Node's ESM loader.

The pre-existing per-roadmap item cap (issue #24) was lowered from 1,000 to 800 — no
real roadmap organically approaches even 800 topics, so the tighter cap costs no
legitimate user anything while shrinking the accidental-storage-runaway window on the
free tier further. (The issue's Part 3b originally asked for a *new*, separate 500-item
cap without realizing issue #24 had already shipped one; rather than stacking two
overlapping caps, the existing one was tightened instead.)

`authApi.deleteAccount()` (`src/services/firebase.js`) now calls a new
`assertAccountDeletable(user)` guard (`src/services/accountGuards.js`) as its first
line, throwing for an anonymous user instead of attempting to build an
`EmailAuthProvider` credential from a guest account that has no email. Extracted into
its own dependency-free module — same reasoning as `authCleanup.js`'s
`signOutWithCleanup()` — so it's unit-testable (`tests/unit/accountGuards.test.js`)
without importing the real `firebase.js`, which is unimportable in CI (gitignored
`firebase.config.js`, `https://` SDK imports rejected by Node's default ESM loader).
This is defense in depth: the dashboard already hides the Delete-account button for
anonymous users; this guard protects the API layer even if some future call site
doesn't.

### 2026-07-09 — PR #TBD — Daily Todos: rolling-deadline task list, separate from the roadmap (issue #56)

A genuinely different rhythm from the roadmap — time-boxed vs. untimed, flat list vs.
phased hierarchy, ephemeral vs. durable — so it gets its own store, its own UI card, and
its own Firebase/localStorage path rather than being bolted onto `roadmapStore.js`.

**Deviation from the original issue write-up, confirmed before implementation.** Issue
#56 was written around a fixed 24-hour deadline (`expiresAt = createdAt + 24h`) for
every todo. Before implementation began, the requirement was changed to let the user
pick the duration per todo (a preset — 1h/3h/6h/12h/24h/48h — or a custom number of
hours from 15 minutes to 7 days), confirmed in a comment on the issue. Everything else
about the issue's design — rolling deadline (not calendar-midnight-reset), client-
computed expiry (no server cron), a collapsed "Missed" section instead of deletion, no
`structuralVersion` — is unchanged from the original write-up.

**Store (`src/services/dailyTodoStore.js`).** A second instance of the `roadmapStore.js`
"Store pattern" documented in `CLAUDE.md`/`AGENTS.md`: a mutable `items` map keyed by
todo id, `subscribe`/`notify` pub-sub, and a 500ms debounced `queueSave()` that persists
to `localStorage` (`KEYS.DAILY_TODOS`) immediately and to the storage adapter
(`adapter.saveDailyTodos`) after the debounce. Reuses two things from `roadmapStore.js`
rather than reinventing them: the sign-out privacy guard (`setUser`'s uid-transition
check clears this store's own local data too — a second store is just as subject to
"never load one user's localStorage into another user's session" as the first one), and
the `stableStringify`-based Firebase-echo comparison (duplicated into this file rather
than imported, so the two stores stay independent modules with no coupling between
them). Deliberately drops `structuralVersion`: that optimization exists specifically to
avoid rebuilding every roadmap phase-card on a `done` toggle, and this list is flat and
capped at 20 active items, with no equivalent expensive re-render to protect — a plain
re-render on every store change is fine here.

**Storage.** `users/{uid}/dailyTodos/{todoId}` in Firebase, sibling to `roadmap`/
`roadmaps`/`meta` under `users/{uid}` (not nested inside the roadmap tree).
`StorageAdapter`'s base contract gained `listenDailyTodos`/`saveDailyTodos` as optional
methods with a safe no-op default (mirrors `getLegacyRoadmap`'s optional-with-default
pattern) — `LocalStorageAdapter` doesn't implement them (it has no push mechanism and
isn't wired into either store today), `FirebaseAdapter` does, mirroring
`listenRoadmap`/`saveRoadmap`'s exact shape (unwrap the `DataSnapshot` inside the
adapter, never leak it through the callback). `firebase/database.rules.json` gained a
validated `dailyTodos/$todoId` child (id/title/createdAt/expiresAt/done/doneAt) —
the same per-field `.validate` pattern as `roadmap`/`roadmaps`, not a second style.

**Client-side caps (`src/core/dailyTodo/limits.js`).** `MAX_TODO_TITLE_LENGTH` (200),
`MAX_ACTIVE_TODOS` (20, since Realtime Database rules can't count a map's children —
same reasoning as `roadmapStore.js`'s per-roadmap item cap), `MIN_DURATION_MS`/
`MAX_DURATION_MS` (15 minutes / 7 days) and `DURATION_PRESETS` all live in their own
dependency-free module, same reasoning as `core/roadmap/limits.js`: both
`dailyTodoStore.js` and `dailyTodoPanel.js` need these without importing each other.

**Pure time helpers (`src/ui/utils/dailyTodo.js`).** `isExpired(todo, now)`,
`remainingMs(todo, now)`, `formatRemaining(ms)`, and `remainingBand(ms)` are pure, no
DOM/Firebase dependency, `now` injectable for deterministic unit tests. Expiry is
computed on every read, never stored/mutated — this app is static-hosted (Firebase
Hosting, Spark/free tier, see ADR-003) with no Cloud Functions, so there is no way to
run a background "at T+duration, mark this missed" job server-side.

**UI (`src/ui/components/dailyTodoPanel.js`).** A card mounted in `dashboard.js` next
to the hero/progress card, not inside the phase list. Reuses the existing Enter-to-add
`.field-input.compact.inline-add` pattern (`renderAddRow` in `dashboard.js`) for the
title input, plus a duration `<select>` (presets + "Custom…", which reveals an hours
`<input type="number">`). A `setInterval` at 30s resolution re-renders the countdown
text/color-band (`ok`/`warn`/`danger`, mapped to the existing `--brand`/`--p1`/`--p0`
tokens — no new hex values). This is a new instance of the exact hazard
`CLAUDE.md`/`AGENTS.md`'s "Component subscription cleanup" rule already covered for
store subscriptions — a timer left running after the panel's DOM node is removed leaks
the same way an unremoved subscription does. The panel returns its node with
`node._cleanup` set (same convention `createThemeToggle()` already uses, rather than
inventing a `{ node, cleanup }` return shape), calling both `clearInterval` and the
store unsubscribe; wired into `dashboard.js`'s route cleanup alongside
`themeToggleBtn._cleanup?.()`. Both `CLAUDE.md` and `AGENTS.md`'s subscription-cleanup
paragraph were reworded to say "or clear the timer" so the rule reads as covering both
cases going forward.

**Wiring (`main.js`, `onboarding.js`).** `main.js` creates `dailyTodoStore` alongside the
existing `store` (roadmap) at module scope, calls `dailyTodoStore.setUser(user)`
alongside `store.setUser(user)` in the `authApi.onChange` handler (via `Promise.all`,
so both resolve before the onboarding-routing decision runs), and passes it through
`guardApp`'s ctx to every route. `onboarding.js` mounts
`createDailyTodoPanel(dailyTodoStore)` only when a `dailyTodoStore` is present in ctx,
right after the page heading and above `visibleGrid` (the template cards) —
`dailyTodoPanel?._cleanup?.()` is added to `renderOnboarding`'s existing cleanup return,
alongside `themeToggleBtn._cleanup?.()`.

**Placement follow-up — tried twice.** First mounted on `dashboard.js`, between the
header and the phase-list `content` — technically correct (the store is independent of
any roadmap) but visually read as *part of* whichever roadmap's dashboard you were
looking at. Moved once within `dashboard.js` (inside `<header class="dashboard-header">`,
above `.hero-panel`) on the theory that "above the roadmap hero" was separate enough —
it wasn't; the dashboard route itself is inherently per-roadmap (`renderDashboard`
bounces straight back to `/onboarding` if no template is active yet), so anything
rendered there reads as belonging to whatever roadmap is currently loaded, no matter
where in the page it sits. Moved a second time — off `dashboard.js` entirely, onto
`onboarding.js`, which is the one route in the app that is genuinely roadmap-agnostic
(it's the "all roadmaps" picker, reachable via "Switch template" regardless of which
roadmap, if any, is active). `dashboard.js` no longer imports `createDailyTodoPanel` or
accepts a `dailyTodoStore` param at all. Lesson for any future "make X feel independent
of Y" placement decision in this app: check whether the *page/route* itself is scoped to
Y, not just where inside that page's DOM the element sits — a global feature inside a
scoped page reads as scoped no matter how it's positioned there.

**Cleanup follow-up — `removeTodo` and the guide modal.** Two gaps found once the
feature was actually used: (1) a done todo stayed visible (struck through) forever with
no way to clear it, and a missed todo could only be *seen* via the collapsed section,
never cleared either — both lists would grow without bound. `dailyTodoStore.js` gained
`removeTodo(id)` (a hard delete, unlike the roadmap's soft-delete-and-keep-forever
pattern — a done/missed todo has no further use and no undo value), and
`dailyTodoPanel.js` renders a ✕ button on any `done` or expired-and-not-done row (never
an active one) that calls it after a `confirmDialog({ danger: true })` — same
destructive-action convention as `removePhase`/`deleteCustomRoadmap`'s call sites. (2)
The feature had no explanation anywhere in the app. Added an ℹ corner button next to the
"Today's Todos" heading opening `src/ui/components/dailyTodoGuide.js`
(`openDailyTodoGuide()`), a small informational modal — the same shape as
`buildYourOwnGuide.js` — covering the rolling-deadline/preset-duration model and the
done/Missed/delete behavior.

### 2026-07-09 — PR #76 (same branch) — Daily Todos: distinct card styling + cross-roadmap header badge

Two polish items applied to the already-shipped Daily Todos feature (issue #56), before
the linking feature below.

**Restyle.** `.daily-todo-panel` moved from plain-box styling to the same glass-card
chrome as `.template-card` (`--surface-glass` background, `backdrop-filter`,
`--radius-lg`, `--shadow-md`) so it visually belongs to the same card family as the
template grid it sits above on `onboarding.js` — but with an `--accent` (not `--brand`)
border and clock icon, since `--accent` was already the app's established "not the
roadmap-teal" token (progress bar highlight, `.glow-accent`) rather than a new color
invented for this. Inner rows (`add-row`/`list`/`missed-toggle`/`missed-list`) dropped
their own individual borders/backgrounds so the whole thing reads as one card, divided
by hairlines, instead of a heading floating above a stack of separate boxes.

**Cross-roadmap header badge.** Todos are global, but a signed-in user's default view is
the per-roadmap dashboard, not the onboarding picker where the actual list lives — so a
user could have an urgent todo about to expire and never see it unless they happened to
navigate back to "Switch template." `dashboard.js` re-imports `dailyTodoStore` (removed
in the earlier placement-only pass, now back for this one read-only purpose) to render a
small pill next to the theme toggle showing the soonest active todo's countdown,
reusing the exact same helpers/color-band logic `dailyTodoPanel.js`'s own countdown
uses. Deliberately read-only and link-only (`<a href="#/onboarding">`) at this point —
no way to add/complete/delete a todo from the dashboard yet; see the next entry for where
that boundary moved.

### 2026-07-09 — PR #76 (same branch) — Link a roadmap topic to a Daily Todo (issue #56 follow-up)

User-requested follow-up: let a Daily Todo be created *from* a roadmap topic instead of
always typed from scratch, and let completing either one update the other — with the
same rolling-deadline/no-server-cron/global-store architecture from the original issue
untouched, just a new relationship layered on top.

**The linking button and modal.** `renderItemRow` (`dashboard.js`) gained a ⏱ button
next to Edit, opening a new promise-based modal, `openAddToDailyTodoModal()`
(`src/ui/components/addToDailyTodoModal.js`, same `{ ... } | null` contract as
`openNewRoadmapModal()`), pre-filled with the topic's own title (editable) and the usual
preset/custom duration picker. Confirming calls `dailyTodoStore.addTodo()` with
`linkedTemplateId`/`linkedItemId` set to `(activeTemplateId, item.id)` — deliberately the
id pair, not the topic's title, since the same title can exist in more than one roadmap
(a built-in template and a user's own custom roadmap could easily both have a
"Fundamentals" topic) and only the id pair says which specific item a todo actually
points at. `linkedItemTitle` is stored too, but purely as a display-time snapshot — never
consulted to resolve the link itself, so a later rename of the source topic can't
silently break it. `firebase/database.rules.json`'s `dailyTodos/$todoId` validator
gained matching nullable-string entries for all three fields.

**Completing a linked todo — the one genuinely hard part.** The obvious implementation
(when a linked todo is checked, just call `roadmapStore.updateItem()`) only works if the
linked topic's roadmap happens to be the one currently loaded into `roadmapStore`'s
in-memory `items` — which is almost never guaranteed, since a todo linked yesterday to a
"Frontend" topic can easily get completed while the user is looking at their "Data
Scientist" dashboard today. Silently switching the user's active roadmap out from under
them to apply the update was ruled out (confirmed with the user before building this) as
too disruptive. Instead, `roadmapStore.js` gained `setItemDoneInTemplate(templateId,
itemId, done)`, a new low-level entry point with three cases, cheapest first:
1. **Active template** — the fast path, just `updateItem()` with `completedViaTodoAt`
   folded into the same patch (making the patch non-cosmetic — see the `structuralVersion`
   section above — so the row's new badge, below, gets its re-render for free, exactly
   like the `notes` field already does).
2. **Cached, not active** (visited earlier this session, e.g. via `switchRoadmap`, but
   not the one on screen right now) — patches `roadmapCache[templateId]` in place and
   persists (local blob + `adapter.saveRoadmap`) directly, without touching
   `activeTemplateId`, `items`, `dirty`, or `structuralVersion` — none of those describe
   what's currently rendered, so there's nothing to notify.
3. **Cold** (never touched this session) — a one-shot read (Firebase first, falling back
   to the local blob, mirroring `resolveRoadmapItems`'s own fallback order), patch,
   persist the same way. Never seeds a not-yet-started template — a linked todo can only
   ever point at an item that already exists somewhere; if it doesn't (case 4: the topic
   or its whole roadmap was deleted after the link was made), resolves `{ ok: false }`
   and the caller still lets the todo itself complete, just with a softer toast instead
   of pretending the roadmap side succeeded.

**Confirmation and sync direction — settled with the user before implementation** (the
original ask specifically wanted a "please confirm" step): checking a linked todo shows
`confirmDialog` naming the target roadmap before applying anything, since it's a
cross-cutting write to data the user isn't necessarily looking at; unchecking one syncs
back silently, since that's the safe/reversible direction and matches how every other
done toggle in the app already behaves (no confirmation to *undo* something). Both
directions are wired only from `dailyTodoPanel.js`'s `handleToggleDone()`, which is
handed both `dailyTodoStore` and `roadmapStore` (`onboarding.js` passes its own `store`
through as the panel's second argument) — `dailyTodoStore.js` itself never imports
`roadmapStore.js`, keeping a todo's ability to exist standalone (no link at all)
structurally guaranteed rather than incidental.

**The completion badge — a new field, not a notes append.** `item.completedViaTodoAt`
(set alongside `done: true` by `setItemDoneInTemplate`, cleared alongside `done: false`
by the same function, and also cleared by `dashboard.js`'s own checklist-row
`toggleDone()` when a user unchecks a topic directly rather than via its linked todo)
drives a small ⏱✓ indicator, `.completed-via-todo-indicator`, next to the row's
notes/resource icons. Considered — and rejected — appending a sentence to the topic's
existing `notes` field (issue #15) instead of adding a new field: notes is free text the
user thinks of as their own, and silently editing it out from under them for a
system-generated annotation was judged worse than one more small field. This is
deliberately **not** full bidirectional sync: toggling a linked topic's `done` state
directly on the dashboard does not reach back and flip the linked todo — only the
`completedViaTodoAt` annotation is kept honest in that direction. If two-way sync is ever
wanted, it needs to be built on purpose (most likely: `roadmapStore.js` gaining a way to
notify `dailyTodoStore.js` of a linked-item change, inverting today's one-directional
`dailyTodoPanel.js → both stores` shape), not assumed to already exist.

### 2026-07-09 — PR #76 (same branch) — Undo for an active linked todo, a soft-delete edge case, and a shared modal-overflow bug (issue #56 follow-up)

Feedback after the linking feature above landed: users had no way to remove a todo they'd
linked to a roadmap topic by mistake unless they waited for it to finish or expire, since
delete was originally scoped to done/missed todos only. Reviewed the edge-case space with
the user before building anything (per their own request) — three things were confirmed
worth doing now; a fourth (unlink-without-deleting as an alternative to full delete) was
considered and explicitly not chosen in favor of the simpler "just delete it" behavior,
matching the rest of the app's existing delete-with-confirm convention rather than adding
a second, softer action alongside it.

**Delete, unrestricted by state.** `dailyTodoPanel.js`'s `renderRow` no longer gates the
✕ button behind `todo.done || isExpired(todo)` — every todo gets one. `handleDelete`'s
confirm message is conditional: for an active, linked todo it adds "The linked roadmap
topic is untouched either way," since that's the one case where a user might reasonably
wonder whether deleting reaches back into the roadmap (it doesn't — completing is the
only path that does). The scope decision (linked-only vs. every active todo) was put to
the user directly rather than assumed; they chose to extend it to every active todo, not
just linked ones, for consistency — so a plain, manually-typed todo can now also be
deleted before it's done or missed, not only ones created via the roadmap-linking flow.

**Soft-deleted item edge case.** `roadmapStore.js`'s `setItemDoneInTemplate` previously
only checked whether `itemId` was present in the relevant items map — but `removeItem()`
never actually deletes an item from that map, it just sets `item.deleted = true` (so the
row stops rendering but the record survives, same precedent as every other soft-delete in
this file). A linked todo whose topic had been removed this way would "complete
successfully" with literally nothing visible happening, since the topic no longer renders
anywhere to show it as done. All three cases (active/cached/cold) now check
`!items[itemId] || items[itemId].deleted` (or the cached/remote equivalent) and resolve
`{ ok: false }` for either — the cached-branch check was restructured slightly (checking
`cached.items` truthiness first, then item existence/deleted state inside) specifically
so a cached-but-deleted item short-circuits immediately instead of falling through to a
redundant, wasted Firebase read in the cold-path branch below it.

**Shared modal-overflow bug, found by accident.** Rewriting `dailyTodoGuide.js` to cover
all of the above (delete-at-any-time, the linking flow, the confirm/no-confirm split, and
that missed todos never auto-touch the roadmap) made the modal's content taller than a
typical viewport — and its "Got it" button became genuinely unreachable, not just
visually cut off: `.modal-overlay`'s `display: flex; align-items: center` clips both ends
of overflowing content equally in the CSS flexbox spec, and no amount of scrolling
reaches the clipped portion. This wasn't a `dailyTodoGuide.js`-specific bug — every modal
in the app (`confirmDialog`, `showDeleteModal`, `buildYourOwnGuide`, both new modals from
this feature) shares the same `.modal-overlay`/`.modal-card` chrome and was equally
exposed, just lucky enough not to have hit content long enough to trigger it yet. Fixed
at the shared CSS level: `align-items: safe center` (centers when content fits, falls
back to scrollable start-alignment when it doesn't) plus `overflow-y: auto` on
`.modal-overlay` — one fix, every current and future modal benefits, no per-modal special
case needed.

### 2026-07-09 — PR #82 — Import roadmap: single-flow modal + AI-generation customization inputs (issue #64)

`importRoadmapModal.js`'s "Generate with AI" / "Paste & Import" tab split was removed —
`selectTab()`/`generateTabBtn`/`pasteTabBtn` deleted, both sections now render
sequentially in one flow, and the now-dead `.import-tabs`/`.import-tab-btn` CSS rules
were dropped. `buildImportPrompt()` (`src/data/importPrompt.js`) gained a second
parameter, `options`, carrying four new optional customization inputs (experience level,
target timeframe, goal/context, "already know") rendered as chip groups/a select/a text
input above the generated prompt; each appends one line to the prompt's free-text
instructions block when set, omitted entirely when unset. This only changes the
instructions block, never the versioned JSON schema contract in the same file, so
`IMPORT_PROMPT_VERSION` did not need to bump and `importValidator.js`/`schemaAdapter.js`
were untouched.

### 2026-07-09 — PR TBD — Agent memory architecture overhaul (issue #86)

Root `CLAUDE.md` had grown from 724 to 10,510 words / 852 lines in 5 days across 44
commits — over 4x Anthropic's ~200-line guidance for a file loaded in full on every
Claude Code session regardless of task. Measured and verified-against-current-docs
findings, plus the resulting restructuring, are recorded in
`docs/adr/ADR-007-agent-memory-architecture.md` — summary: content was relocated
(not revised) out of root `CLAUDE.md` into three new path-scoped `.claude/rules/*.md`
files (`roadmap-store.md`, `ui-styling.md`, `auth-security.md`, using the YAML `paths:`
frontmatter format Claude Code actually loads conditionally) and six new
`.claude/skills/*/SKILL.md` procedures (`raise-issue`, `start-issue`, `open-pr`,
`after-merge`, `parallel-work`, `verify-changes`), which load lazily rather than
unconditionally. The six pre-existing `.claude/rules/*.json` files (added in issues #3/#43)
were deleted — they used plain JSON, a format Claude Code never actually read, and a
full-repo grep confirmed nothing referenced them. `AGENTS.md` was collapsed from a
~9,500-word full duplicate to a short pointer, since Claude Code never reads `AGENTS.md`
in the first place. A new CI step (`.github/workflows/ci.yml`, `pr-checklist` job) fails
a PR if root `CLAUDE.md` exceeds 220 lines, so the same unbounded growth pattern can't
silently recur. Root `CLAUDE.md` is now ~216 lines / ~2,030 words — no application
source, test, or Firebase-rules code changed as part of this.

### 2026-07-09 — PR TBD — Design token system refinement, Phase 1 of the enterprise UI/UX revamp (issue #6)

Issue #6 is a 10-phase, multi-week revamp (tokens → app shell → component library →
dashboard/auth/landing redesign → animations → responsive → a11y → PWA assets); per its
own readiness-study comment and this repo's "each phase is a separate PR" convention,
this PR is scoped to Phase 1 (design tokens) only — Phases 2–10 remain future work.
Added a typography scale, spacing scale, motion tokens (easing curves + durations), a
numbered brand/accent/neutral color scale, and a `--surface-0`..`--surface-3` hierarchy
to `src/styles/app.css`'s `:root`/`:root[data-theme='dark']` blocks; `--surface-0/1/2`
alias the existing theme-flipping `--soft`/`--panel`/`--panel-2` tokens rather than
duplicating them, so they stay theme-correct with a single definition, while
`--surface-3` (a new "deepest inset" literal) needed its own per-theme value since it
isn't an alias. Refined `--shadow-sm`/`--shadow-md`/`--shadow-lg` to a subtler, layered
look and added `--shadow-xs`/`--shadow-xl`/`--shadow-brand` — every existing consumer
picks up the refined values automatically via the same token names, verified visually
across both themes at desktop and mobile widths (no regressions). `Plus Jakarta Sans`
is now loaded in `index.html` alongside `Inter` as `--font-display`, unused until a
later phase applies it to headings. Migrated ~40 exact-match hardcoded `font-size`
declarations (and a few exact-match transition durations/easings) to the new tokens —
deliberately excluded icon/emoji glyph sizes and mono/numeric badges (a different
concern from typographic text scale) and deliberately did not migrate every
`padding`/`margin`/`gap` in the file to the new spacing scale, since the file already
follows a consistent base-4 spacing convention and a wholesale mechanical pass would be
a large, high-review-burden diff with no visual or behavioral benefit — later phases'
new components should reach for `--space-*` directly instead.

### 2026-07-09 — PR TBD — Fix: picking a roadmap right before setUser() resolves silently no-op'd and bounced back to onboarding

Reported directly as "the app hangs after picking a roadmap, I have to reload." Root
cause was in `roadmapStore.js`'s `switchRoadmap(templateId)`, not anything UI-visible:
its opening no-op guard (`if (requestedTemplateId === activeTemplateId) return;`) is
meant to skip redundant work when a user re-picks the roadmap they're already on, but
`activeTemplateId` defaults to the placeholder `'java-backend'` at module init, before
any sign-in's `setUser()` call has resolved — and `'java-backend'` also happens to be
`TEMPLATES[0]`, the first card `/onboarding` renders. A user who clicked that first card
before their brand-new sign-in's still-in-flight `setUser()` (a real Firebase read,
observed taking well over a second under real network conditions) had resolved would
trigger this guard as a false positive: `switchRoadmap` returned immediately, seeding
nothing and never setting `onboardingDone`, while `onboarding.js`'s `pickTemplate()`
still unconditionally navigated to `/app` right after. The dashboard would render
briefly on top of an empty, not-actually-onboarded store; moments later the slow
`setUser()` call would resolve with the real `onboardingDone: false` and `main.js`'s
`authApi.onChange` handler would bounce the user straight back to `/onboarding` — every
retry hitting the same race until the in-memory timing happened to close on its own.
The pre-existing `stateCallId` staleness guard (documented in `.claude/rules/
roadmap-store.md`) was never the problem — it works correctly once both async calls
actually participate in bumping the shared counter; the bug was that `switchRoadmap`'s
own no-op guard let it skip past *without* bumping the counter at all, so the guard
never got a chance to protect anything. Fixed by requiring `onboardingDone` to also
already be `true` before treating a same-id pick as a no-op — the guard now expresses
"you're already on this roadmap and have genuinely finished onboarding," matching the
equivalent check `onboarding.js`'s own `isSwitchingTemplate` guard already made at the
UI layer for the same class of race (see the code comment in `pickTemplate()`). A
regression test simulates the exact race (`switchRoadmap('java-backend')` called before
an unresolved `setUser()` promise settles) in `tests/integration/roadmapStore.test.js`.
No schema, Firebase-rules, or public store-contract change — a one-line guard fix plus
a comment explaining why.

### 2026-07-09 — PR TBD — App shell: sidebar + topbar — Phase 2 of the enterprise UI/UX revamp (issue #6)

Second of #6's 10 phases (each its own PR, per the issue's own convention and Phase 1's
precedent). Replaces `dashboard.js`'s old single `.header-top` action row (brand, theme
toggle, sync pill, user chip, Switch template / Create account / Delete account / Sign
out buttons all crammed into one flex row) with a persistent two-column app shell.

Four new components, each independently unit-tested:
- `src/ui/components/avatar.js` — `initialsFor(user)` (pure) + `createAvatar(user, size)`.
  Initials-only; no photo source exists anywhere in the auth stack (no Google sign-in).
- `src/ui/components/dropdown.js` — a generic floating menu (`createDropdown(trigger,
  items, { align })`), keyboard-navigable (Up/Down cycles items, Escape closes and
  returns focus to the trigger, click/focus outside closes). Reusable primitive, not
  sidebar-specific — Phase 3's component library is expected to reach for it again.
- `src/ui/components/sidebar.js` — brand mark (home link), nav (`Dashboard` → `/app`,
  `My Roadmaps` → `/onboarding`), a manual desktop icon-rail collapse toggle (persisted
  to a new `KEYS.SIDEBAR_COLLAPSED` localStorage key, same device-level-preference
  pattern as `KEYS.DAILY_TODOS_COLLAPSED`), and a footer (avatar + email + sign-out
  icon button, plus a `createDropdown`-wrapped identity trigger holding "Delete account"
  for a signed-in — non-anonymous — user only).
- `src/ui/components/topbar.js` — breadcrumb, sync pill, "Create account" CTA (guest
  only), theme toggle, and a hamburger button (CSS-hidden ≥640px) wired to the
  sidebar's own `_toggleMobile()`.

**Spec deviations, all confirmed against the current codebase before implementing:**
the original issue text listed `Resources`/`Settings` nav items and a storage-backend
indicator — dropped, per the issue's own readiness-study comment: neither page exists
yet (confirmed against `main.js`'s route table) and Firebase is the only backend (#5
closed as not planned). "Switch template" is superseded by the sidebar's "My Roadmaps"
nav item (identical destination, `#/onboarding`) — the 8 e2e tests across
`onboarding.test.js`/`customRoadmap.test.js`/`importRoadmap.test.js` that clicked the
old button now click `.nav-item:has-text("My Roadmaps")` instead.

**Responsive**, per the original spec: fixed 240px sidebar ≥1024px; automatic icon-only
56px rail 640–1023px (CSS-only, not persisted — independent of the manual desktop
collapse above); hidden below 640px, opening as a drawer (translateX slide, backdrop,
`body.scroll-locked`) on hamburger tap. `dashboard.js` keeps its existing `.dashboard`
class on the same element as the new `.app-shell-2` layout class (rather than replacing
it) specifically so the many existing e2e/unit tests asserting `.dashboard` as the
dashboard-is-rendered marker needed no changes.

**Real layout bug found and fixed during manual verification, not a pre-existing one:**
`.app-shell-2`'s CSS Grid defaults to `align-items: stretch`, so `.app-sidebar` — a
grid cell sibling of the (very tall, for a long roadmap) main-content column — stretched
to match that column's full height rather than the viewport's. Measured at ~5700px tall
against the Java Backend Engineer template's 484 seeded items, pushing the sidebar
footer far below the visible viewport. Fixed with `align-items: start` on the grid
container plus `position: sticky; top: 0; height: 100dvh; overflow-y: auto` on
`.app-sidebar` itself — pins it to the viewport while `.app-content` scrolls past
underneath, with its own scrollbar as a safety net for a sidebar nav list that someday
outgrows the viewport (not needed by today's two-item nav, but cheap to include now).

Not fixed, and explicitly out of scope for this PR: verification also surfaced that
`router.js` has no scroll-restoration logic at all, so any route change (not just this
one) carries over the previous page's scroll position — confirmed pre-existing
(`router.js` is untouched by this PR, and the same carryover reproduces on unmodified
`main`), not something this PR's sidebar/topbar work introduced. Worth its own
follow-up issue rather than folding into this one.

### 2026-07-10 — PR TBD — Component library expansion — Phase 3 of the enterprise UI/UX revamp (issue #6)

Third of #6's 10 phases. Eight new primitives in `src/ui/components/`, each with its own
unit test file — this phase is the library itself, not integration; none of these are
mounted on any real page yet.

- `skeleton.js` — `createSkeletonText()`/`createSkeletonCard()`, shimmer-animated
  loading placeholders (`@keyframes shimmer`, respects `prefers-reduced-motion`).
- `emptyState.js` — `createEmptyState({ icon, title, message, actionText, onAction })`.
  A single flexible factory rather than the original spec's three hardcoded SVG
  illustrations: this codebase has no illustration assets anywhere — every icon today
  is a plain emoji glyph (`template.icon`, `.daily-todo-icon`, etc.) — so an `icon`
  option plays the same "friendly visual" role without introducing a new asset type.
- `tooltip.js` — `attachTooltip(triggerEl, text)`. Positions above by default, flips
  below when `getBoundingClientRect().top` doesn't leave room (checked on
  `mouseenter`/`focus`, not on mount, since a trigger's position can change after
  attach — e.g. inside a scrollable list).
- `modal.js` — `openModal({ content, ariaLabel, className, closeOnOverlayClick })`.
  Adds a real focus trap (Tab/Shift+Tab cycle within the card's focusable elements),
  Escape close, body scroll lock (`body.scroll-locked`, the same class the sidebar's
  mobile drawer already introduced in Phase 2), and a spring-entry animation
  (`.modal-card-enter`, using Phase 1's `--duration-enter`/`--ease-spring` tokens) on
  top of the existing `.modal-overlay`/`.modal-card` classes `confirmDialog.js` already
  established. Deliberately additive, not a forced migration —
  `confirmDialog.js`/`buildYourOwnGuide.js`/etc. already work correctly and aren't
  touched by this PR; a later phase (or issue #9's feedback widget) can build on
  `openModal()` directly instead of hand-rolling the overlay/card boilerplate again.
- `tabs.js` — `createTabs({ items, initialId })`. Left/Right cycles (wrapping),
  Home/End jump to first/last, full ARIA `tablist`/`tab`/`tabpanel` roles with
  `aria-controls`/`aria-labelledby` cross-references. Not retrofitted onto the existing
  import-roadmap modal — issue #64 deliberately collapsed that modal's two tabs into
  one continuous flow, and reintroducing tabs there would undo that fix.
- `progressRing.js` — `createProgressRing(pct, { size, strokeWidth })`, an animated SVG
  circle (`stroke-dashoffset` transition using `--duration-enter`/`--ease-spring`) with
  an imperative `_setPct()` updater for later phases that need to animate it in place
  rather than re-creating the node. Track/fill colors reuse `--track-bg`/`--brand`,
  matching `.progress-track`/`.progress-fill`'s existing linear equivalent.
- `notificationBadge.js` — `createNotificationBadge(count, { max })`. A plain dot when
  `count` is falsy, otherwise the count capped at `"<max>+"` past `max` (default 99) —
  a three-digit exact count stops being legible in a small circular badge.
- `commandPalette.js` — `openCommandPalette(items, { placeholder })` (built on
  `modal.js` above) plus `bindCommandPaletteShortcut(onOpen)` for the `Cmd+K`/`Ctrl+K`
  binding, and an exported `fuzzyMatch(query, target)` — a dependency-free subsequence
  matcher (every character of the query must appear in the target, in order,
  case-insensitively), scored so a tighter contiguous match beats the same letters
  spread across a longer string, the same intuition fzf/VS Code's Quick Open use
  without needing their full algorithm. Wiring this to real roadmap items/sections/
  phases (the original spec's actual use case) is Phase 4's job once the dashboard
  itself is redesigned.

Verified visually via a throwaway local HTML harness (not committed — deleted before
this PR's diff) mounting all eight components in both themes; caught zero real bugs in
the components themselves (one cosmetic mojibake in the harness's own missing
`<meta charset>`, unrelated to any component logic).

### 2026-07-10 — PR #94 — Dashboard redesign, Phase 4 of enterprise UI/UX revamp (issue #6)

Rewired `src/ui/pages/dashboard.js`'s header markup and phase-card rendering onto the
Phase 1–3 token/component system, replacing `.hero-panel` (marketing tagline + linear
progress bar) entirely. New module: `src/utils/countUp.js` (`animateCountUp`,
requestAnimationFrame-driven, `prefers-reduced-motion`-aware) — used once per stat tile
on the dashboard's first `render()` only; the existing `patchDoneStates()` fast path
(a plain checkbox toggle) updates the same DOM nodes directly with no animation. The
`% Complete` stat tile and every phase-head now reuse `createProgressRing`
(`src/ui/components/progressRing.js`, built in Phase 3, unused until now) instead of
two different progress affordances. `.phase-progress`'s text node stays in the DOM as
an `.sr-only` label so `tests/unit/dashboard.test.js`'s existing assertion on it (and
assistive tech) keep working — the ring is the new visible affordance.

Two scope cuts from the original issue #6 Phase 4 spec, both because the data or
concept they depend on doesn't exist: the stat strip ships 2 tiles (items done, %
complete) not the spec's 4 — streak/est.-time-left need persisted tracking data that
belongs to issue #8 (Progress analytics), explicitly gated on this issue. The roadmap
header extends the existing `.current-roadmap-badge` with a new `.roadmap-meta-row`
("180 items · 38% complete · Last synced 2m ago" — the last-synced timestamp is a
local, UI-layer-only variable set inside `updateSaveBadge()`, no store change) instead
of the spec's separate "Official/read-only" lock-badge section, which is stale
post-#4/#58 (every roadmap, built-in or custom, is equally "yours" and non-destructively
switchable now).

A new-item stagger-entry animation uses a pure before/after id-diff
(`knownItemIds`, updated at the end of every `render()`) entirely in the UI layer — no
`roadmapStore.js` change, since `addItem()` only returns a boolean. Caught and fixed a
real bug during live verification: the first implementation set the stagger delay via
an inline `style="animation-delay:…"` attribute, which `index.html`'s CSP
(`style-src` with no `unsafe-inline`) silently drops app-wide — confirmed via a CSP
console violation and zero visible stagger in a live Playwright-driven guest session.
Replaced with a capped set of discrete `entering-delay-0`..`entering-delay-6` CSS
classes; any future per-row animation delay in this codebase must follow the same
discrete-class pattern, never an inline style. Added `--topbar-h` (`src/styles/app.css`
`:root`), a single shared token keeping `.app-topbar`'s own height and
`.section-label`'s new `position: sticky` offset in lockstep, so a stuck section header
can never sit half-hidden under the topbar.

Verified live: `npm test` (475 passed, 12 new) and `npm run lint` (0 errors) green; a
throwaway Playwright driver (not committed) drove a real guest session through sign-in
→ onboarding → dashboard across all 11 `verify-changes` matrix widths in both themes
(zero horizontal overflow at any width), confirmed `.check-actions` touch-vs-hover
`opacity` behavior and 44px touch targets on an emulated touch device, and confirmed
the CountUp/ring/stagger/sticky-header/search-focus-expand/clear-filters behaviors
render and update correctly before and after a checkbox toggle.

### 2026-07-10 — PR #95 — Auth pages redesign, Phase 5 of enterprise UI/UX revamp (issue #6)

`authShell.js` now wraps its existing card output (unchanged) in a new two-column
`.auth-page` split: a left marketing panel and the card, side by side above the
existing `≤1024px` breakpoint tier, collapsing to a single column (the marketing panel
CSS-hidden) at/below it — reusing that tier rather than inventing a new breakpoint
number, per `.claude/rules/ui-styling.md`'s six-tier scale convention. `authShell()`'s
return shape (`{ node, cleanup, titleEl, subtitleEl }`) is unchanged, so neither
`signIn.js` nor `signUp.js` needed any wiring change for the layout itself — the split
is entirely a wrapping change inside `authShell.js` + `app.css`.

New: `src/ui/components/authMarketingPanel.js` (the left panel — brand mark + 3 value
props, dark brand-gradient background independent of the site's own light/dark theme).
Deliberately **no testimonial**, despite the original issue #6 Phase 5 spec's mockup
calling for one — a fabricated customer quote reads as deceptive on a product moving
toward real paying users; confirmed with the user before implementing, not assumed.

Two new, independently unit-tested `src/ui/utils/` modules, both used by `signIn.js`
and `signUp.js`: `fieldValidation.js` (`isValidEmailFormat()`, pure; and
`attachFieldValidationIcon()`, a small DOM helper returning `{ setState(valid) }` so
callers can drive the same ✓/✕ icon from either a `blur` listener or existing custom
logic — sign-up's confirm-password field drives it from the pre-existing real-time
`checkConfirmMatch()` instead of adding a redundant second listener) and
`buttonLoading.js` (`setButtonLoading()`, replacing three near-identical inline
spinner/label-swap implementations across sign-in/sign-up/reset-password with one
shared helper — promoted the spinner styling itself from the `.save-badge`-scoped
`.spin` class to a new page-agnostic `.btn-spinner`, using `currentColor` for the
spinner's accent instead of a hardcoded brand color so it reads correctly against both
`.btn-primary`'s dark background and `.btn-secondary`'s light one).

One pre-existing gap noted, not fixed here (out of this phase's scope, belongs to
#21's accessibility audit): `.password-toggle`'s touch target measured ~19px tall on
an emulated touch device during verification, well under the 44px WCAG 2.5.5 minimum
issue #36 established for other controls — `.password-toggle` was never added to that
list. Not introduced by this PR (its CSS is untouched), flagged for #21 to pick up.

Verified live: `npm test` (487 passed, 12 new) and `npm run lint` (0 errors) green; a
throwaway Playwright driver (not committed) screenshotted sign-in/sign-up at desktop,
the `1024px` fallback boundary, and mobile, in both themes — confirmed the split layout,
value props, and dark-panel readability render correctly, the blur-validation icons
show the correct ✓/✕ only after first blur, the validation icon and password-toggle
button coexist without overlapping (`has-toggle` offset), and the submit-button
spinner appears and the button disables correctly under a throttled network before
restoring on error. Full 11-width/2-theme `verify-changes` matrix run on both pages —
zero horizontal overflow at any width.

#### Follow-up, same PR — marketing panel redesign + roadmap-switch hang fix

Two rounds of live user feedback on this same PR before merge, both addressed here
rather than as a separate follow-up PR since #95 hadn't merged yet.

**Marketing panel looked sparse and unfinished on wide monitors.** The original cut's
content (brand mark + 3 emoji-icon value props) sat pinned to the top-left of an
increasingly empty flat-gradient column as viewport width grew — confirmed via a
screenshot at ~2000px showing most of the panel as dead space. Rebuilt
`authMarketingPanel.js`: the product's actual tagline ("Engineer your next move.",
already in `index.html`'s meta description) as a large display-font headline instead
of empty space — a real "quote" from the product itself, not the fabricated customer
testimonial the original spec called for and this PR already declined to build; a
one-sentence subhead; the same 3 value props now illustrated with minimal custom SVG
line icons (`ICONS.track`/`sync`/`focus`, Feather/Lucide-style, `currentColor` strokes)
instead of emoji, which render inconsistently across OS/browser combinations and read
as placeholder rather than finished on the one surface whose entire job is a strong
first impression — every other emoji-glyph usage across the app is intentionally
unaffected; and a real stat line derived from `TEMPLATES.length` (never a hardcoded
number that could drift). `app.css`: `.auth-marketing-content` uses
`justify-content: center` to distribute the headline/subhead/features block across the
full available height instead of one small flex item center-aligning in isolation, and
`.auth-marketing` itself gained `align-items: center` so the content column stays
visually balanced in the middle of the panel at any width rather than pinned to the
left edge — this, not shrinking the panel, is what actually fixed "too big/too empty"
at up to 2560px (confirmed via screenshot). A repeating-diagonal-line CSS gradient
(`.auth-marketing-bg-pattern`, no image asset) fills the background at low opacity
instead of a flat void.

**Roadmap switching could hang indefinitely — a real, reproduced regression-adjacent
bug, not the auth redesign.** Traced through `FirebaseAdapter.js`: none of its one-time
`get()`/`set()`/`update()`/`remove()` calls have a timeout, and Firebase's Realtime
Database SDK doesn't provide one — a stalled connection (tested by throttling network
conditions and, separately, by reasoning through `switchRoadmap()`'s unprotected
`await flush()`/`await adapter.saveMeta()` calls) leaves the promise pending forever
with nothing to catch. New `src/services/storage/withTimeout.js` (unit-tested: settles
before deadline → passes through; never settles → rejects at 15s) wraps every one-time
call in `FirebaseAdapter.js`; every caller already try/catches these and falls back to
a local blob or fresh seed (see `.claude/rules/roadmap-store.md`), so this needed zero
changes anywhere else. Also fixed a quieter, related bug in the same pass:
`onboarding.js`'s `pickTemplate()`/`pickCustomRoadmap()` catch blocks silently reset
the UI on failure with no message — the cards just re-enable, indistinguishable from
success unless you're watching closely — now both show an error toast, matching
`handleCreate()`/`handleImport()`'s existing pattern. New unit test in
`onboarding.test.js` covers the toast; `withTimeout.js` has its own dedicated suite.

Verified live: reproduced the hang under throttled network + a deliberately-dirtied
unsaved edit before switching, confirmed normal switching still completes in ~1-3s
after the fix (no regression), and reran the full 11-width/2-theme `verify-changes`
matrix plus dark-mode/sign-up screenshots on the redesigned panel — zero horizontal
overflow, zero console errors. `npm test` (492 passed, 5 new) and `npm run lint`
(0 errors) green.

### 2026-07-10 — PR TBD — Landing page, Phase 6 of enterprise UI/UX revamp (issue #6)

New `src/ui/pages/landing.js` renders at `'#/'` for signed-out visitors — the route
used to be an unconditional redirect to `/signin`. `main.js`'s `'/'` handler now checks
`currentUser` first and bounces an already-authenticated visitor straight to `/app`
before this page ever mounts; `'/'` was also added to the `authApi.onChange` listener's
`publicRoutes` list so the same check re-runs if auth state resolves after the initial
render (the same "flash then redirect" characteristic `/signin` already had before this
change, not a new class of behavior).

Sections: nav (brand + in-page scroll links + sign-in/sign-up actions), hero
(headline/subhead/CTAs beside a decorative dashboard mock), a 2-card features strip, a
3-step "how it works," a real derived stat line, and a CTA footer. The hero's dashboard
preview is built entirely from `el()` divs (a mock card with four progress bars at
fixed widths via a capped set of `.landing-mock-fill-1`..`-4` classes, per the
"never set an inline style" convention) rather than a committed screenshot/PNG asset —
keeps the "no build step, no bundler, no external dependency" convention intact instead
of needing a Playwright-based image-generation step for one hero graphic.

Two deliberate deviations from the original issue #6 Phase 6 spec, both following
precedent already established elsewhere in this issue rather than inventing a new
answer: the features strip stays at 2 cards (template / build-your-own), not the
original 3 — the third ("Drive sync") was dropped along with #5's Google Drive backend
closing as not planned, and inventing a replacement feature just to keep a three-card
grid would be marketing copy for something that doesn't exist. And there's no
fabricated "social proof" quote block — the same call Phase 5's auth marketing panel
already made (a fake testimonial reads as deceptive on a product moving toward real
paying users) — replaced with the same real, `TEMPLATES.length`-derived stat line used
in both places, so the number can never drift out of sync with the actual template
registry.

Nav "Features"/"How it works" links smooth-scroll to in-page sections
(`element.scrollIntoView`, respecting `prefers-reduced-motion` via both a JS
`matchMedia` check and the existing global reduced-motion CSS override) via plain
`<button>` click handlers rather than real `href="#landing-features"` anchors — the
hash router treats any hash change as a route lookup, so a real anchor would 404 into
the `/signin` fallback instead of scrolling.

**Every existing e2e spec's `page.goto('/')` needed updating** (38 call sites across
`auth.test.js`, `brand.test.js`, `customRoadmap.test.js`, `importRoadmap.test.js`,
`onboarding.test.js`, `itemNotes.test.js`, `responsive.test.js`) to
`page.goto('/#/signin')`, since `'/'` no longer auto-redirects to sign-in for a
signed-out session — each of those specs actually wants the sign-in screen, not the new
landing page, so this is a mechanical fixup rather than a behavior change to any of
them. New `tests/e2e/landing.test.js` covers the landing page itself: renders at `'/'`
for a signed-out visitor, both CTA buttons navigate to the correct route, the nav's
scroll-link moves the viewport without changing the route, and the feature-card count.

Verified live: `npm test` (499 passed, 7 new) and `npm run lint` (0 errors) green;
`npx playwright test` (24 passed, 33 skipped — Firebase-emulator-gated) green, including
the 5 new landing specs. Screenshotted the page at desktop (1440px) and mobile (390px)
widths in both themes via a throwaway Playwright driver (not committed) — hero collapses
to a single column with the mock preview reordered above the copy at the existing
`≤1024px` breakpoint tier (reused, not a new number), CTA buttons stack full-width at
`≤480px`, dark theme resolves correctly with no hardcoded colors. Confirmed no console
errors beyond the pre-existing, unrelated `frame-ancestors` CSP-in-meta-tag warning.

### 2026-07-10 — PR TBD — Phase-card FLIP animation + strike-through animation, Phase 7 of enterprise UI/UX revamp (issue #6)

Closes the two remaining gaps in Phase 7's animation inventory found while auditing
issue #6's phases 6-10 against what's already shipped — the rest of Phase 7 (motion
tokens, `prefers-reduced-motion` overrides, stagger-entry, checkbox spring bounce,
sidebar drawer, toast slide-up) had already landed piggybacked into Phase 2's and
Phase 4's PRs. No new files; changes confined to `dashboard.js`, `app.css`, and test
setup.

**`animatePhaseBody(phaseCardEl, opening)`** (new, `src/ui/pages/dashboard.js`)
replaces the phase-body's `display: none/block` + a plain CSS fade with a true FLIP
height animation via `Element.animate()`. `display` toggles can't be transitioned at
all, which is why the fade only ever played on the *fade*, not the height — the box
still snapped open/closed instantly underneath it. Reads `--duration-base`/
`--ease-spring` straight off `getComputedStyle(document.documentElement)` rather than
hardcoding a second copy of Phase 1's tokens, and checks
`window.matchMedia('(prefers-reduced-motion: reduce)')` itself, since a JS-driven WAAPI
call doesn't inherit the global CSS `animation-duration: 0.01ms !important` override the
way a CSS transition/animation does.

**Real bug caught during live verification, not just a design choice:** the function
takes the `.phase-card`, not the `.phase-body`, specifically so it can toggle the `open`
class itself, in the right order. The CSS rule `.phase-card.open .phase-body { display:
block }` means removing the `open` class *before* measuring the body's current height
(for the closing animation) reads a `display: none` box — 0 height — instead of the real
one, so the very first version of this code silently skipped the entire collapse
animation: click, and the card was just already gone by the time the next frame
rendered. Fixed by having `animatePhaseBody` measure the height first, *then* remove the
class (forcing `display: block` back via inline style for the animation's duration,
cleared on `animate().onfinish`) — `tests/unit/dashboardAnimations.test.js` has a
dedicated regression test for this exact ordering.

**A second, related fix.** Before this PR, clicking a single phase-head called the same
full `render()` a filter/search change triggers — tearing down and rebuilding *every*
phase-card on the page just to open the one that was clicked, replaying every other
card's entrance state in the process. Same "flickering the whole list" problem
`patchDoneStates()` already exists to avoid for done-toggles — a UI-layer concern, not a
store one (see the code comment at the `onToggle` callback in `dashboard.js`). Fixed the
same way: the click handler now patches just the affected `.phase-card` in place (flip
`openPhases`, animate its body, update the "Expand/Collapse all" button's label
directly) instead of calling `render()` at all for a plain toggle. The bulk "Expand
all"/"Collapse all" button intentionally keeps its existing full-`render()` behavior,
un-animated — animating many cards open/closed simultaneously was judged not worth the
complexity for a bulk action, versus the single-card case the issue's animation
inventory specifically calls out ("Click phase head").

**Check row strike-through** (`.check-title`, `app.css`) replaced an instant
`text-decoration: line-through` with a `::after` pseudo-element animating
`width: 0% -> 100%` on toggle-done, matching the issue's animation inventory entry
exactly. `.check-title` gained `position: relative; display: inline-block` so the
pseudo-element sizes to the title's own rendered width instead of the flex row's.

**Test infrastructure:** jsdom doesn't implement `Element.animate` (the Web Animations
API) at all — calling it in a unit test throws. `tests/setup.js` gained a minimal stub
(resolves `onfinish` on the next microtask) so any component using WAAPI can be tested
without a 240ms real wait; this is intentionally generic, not scoped to
`animatePhaseBody`, so future components using `.animate()` get it for free.

Verified live via a throwaway Playwright driver (not committed): read real mid-animation
`getBoundingClientRect().height` values during both expand and collapse (confirming an
actual animated transition, not an instant jump), confirmed the reduced-motion path
resolves straight to the final `display`/class state with zero animation frames, and
confirmed the fix for the "measure after the class already changed" bug above by
watching the collapse actually animate instead of vanishing on click.
`npm test` (503 passed, 4 new) and `npm run lint` (0 errors) green.

### 2026-07-10 — PR TBD — Responsive + accessibility pass, Phases 8-9 of enterprise UI/UX revamp (issue #6)

New devDependency: `@axe-core/playwright`. No new source files — changes confined to
`index.html`, `app.css`, `dashboard.js`, `onboarding.js`, and six modal components, plus
new/updated tests.

**Phase 8 (responsive)** turned out mostly already done (#36's breakpoint scale, Phase
2's sidebar drawer, Phase 4's sticky headers/filter chips). Two real gaps closed: the
item panel now slides up full-screen from the bottom instead of side-sliding at
`≤480px` (reusing the existing tier, not a new number), and the filter-chip row scrolls
horizontally instead of wrapping at the same tier.

**Phase 9 (accessibility)** was verified with real tooling, not a read-through —
`tests/e2e/accessibility.test.js` runs `@axe-core/playwright` against
landing/sign-in/sign-up/onboarding/dashboard (the last two gated behind
`FIREBASE_CONFIGURED` like every other guest-session e2e spec), asserting zero
critical/serious violations. Running it for real against the app (not just reading the
issue's checklist) surfaced bugs a manual pass had missed:

**WCAG 4.1.2 — nested focusable content inside `role="checkbox"`/`role="button"`.**
`.check-item` (`dashboard.js`) and `.template-card` (`onboarding.js`'s
`buildCard`/`buildCustomCard`/`buildCreateCard`) both carried their interactive ARIA
role on the *outer* element while containing genuinely separate focusable children (the
Edit/resource-count/add-todo buttons; the hide/delete/info corner button) — an ARIA
checkbox or button is specified as a leaf widget, and axe correctly flags a
`no-focusable-content` violation for both. Fixed by moving the role onto a dedicated
inner element instead of the whole card/row: `.check-box` (not `.check-item`) is now the
actual `role="checkbox"` target, with its own `aria-label` (the item's title) since it no
longer inherits an accessible name from sibling text; a new `.template-card-pick`
button (not `.template-card`) is the "pick this template" target, with the corner
button now a true DOM sibling instead of nested inside another interactive element.
`.template-card` itself keeps its full original visual styling (background, border,
shadow, padding) on what's now a plain, non-interactive wrapper div — `.template-card-pick`
is deliberately unstyled beyond filling the card as transparent flex-column content, and
a new `.template-card:has(.template-card-pick:focus-visible)` selector preserves the
exact same hover/focus lift-and-glow effect the card used to get from its own
`:focus-visible`. Every unit (`onboarding.test.js`) and e2e locator that used to click
the row/card directly was updated to target the new inner button — `patchDoneStates()`
in `dashboard.js` now sets `aria-checked` on `.check-box`, not the row.

**Six ad hoc modals had no real focus trap.** `modal.js`'s `openModal()` (Phase 3)
already had one; `confirmDialog.js`, `newRoadmapModal.js`, `importRoadmapModal.js`,
`addToDailyTodoModal.js`, `buildYourOwnGuide.js`, `dailyTodoGuide.js`, and
`dashboard.js`'s account-deletion modal each had their own copy-pasted Escape-only
`keydown` handler (the deletion modal didn't even have that). Extracted the working
Tab-cycling logic out of `openModal()` into a new exported `attachFocusTrap(containerEl,
{ onEscape })` — every modal now calls this one implementation instead of seven
divergent ones.

**A handful of smaller, concrete fixes**, each confirmed as a real gap rather than
assumed: `aria-expanded` on `.phase-head` (kept in sync inside `animatePhaseBody()`
itself, so every caller gets it free); `aria-live="polite"` on the toast stack (had
none) and the dashboard's save-status badge; `role="combobox"`/`aria-activedescendant`
on the command palette's input; `aria-label` added to the Daily Todos panel's inline
quick-add title input and duration select (a placeholder alone doesn't count as an
accessible name — axe caught this one directly); the active filter chip's inline "✕
clear" control changed from an unreachable bare `<span onClick>` (a real `<button>`
nested inside the chip's own `<button>` isn't valid HTML) to `role="button"` +
`tabindex="0"` + Enter/Space handling; `aria-hidden="true"` added to the decorative
`.chevron`/`.check-mark` glyphs.

**Color contrast.** Manually computed the actual WCAG contrast ratio for every
`--muted`/`--faint` usage against the exact background each is painted over (not just
eyeballed) — `--faint` was as low as 2.4:1 in the worst case. Both tokens darkened
slightly (documented in the `app.css` token comments with before/after hex) to clear
4.5:1 in both themes while staying visibly one step lighter than body text. Separately,
axe's automated `color-contrast` rule reported two more violations
(`.phase-name`/`.badge.P0`) whose reported foreground/background hex values didn't match
`getComputedStyle()`'s actual values at all — a confirmed sampler false positive (likely
from the progress-ring SVG/box-shadow this layout overlaps), not a real bug; that one
axe rule is disabled in the automated test, every other rule stays fully enforced. See
the code comment in `accessibility.test.js` for the exact repro numbers.

Verified live: the full 65-test e2e suite (including 5 new accessibility specs and the
onboarding-restructuring fallout) passed against a real local Firebase emulator, not
just the `FIREBASE_CONFIGURED`-skipped subset that runs without one. A separate
throwaway Playwright driver (not committed) drove the app with `page.keyboard.press()`
only — skip-link is the first Tab stop, `.template-card-pick` is focusable and
Enter-activates it, `.check-box` is focusable and Space toggles `aria-checked`, a modal's
focus stayed trapped across 8 Tabs, and Escape closed it. `npm test` (503 passed) and
`npm run lint` (0 errors) green.

### 2026-07-10 — PR #99 — Animation race-condition fix + always-confirm sign-out (reported live)

Two live bug reports fixed together, one new file (`src/ui/utils/signOut.js`).

**A phase's topic list stayed visually cut off for a couple of seconds after
expanding it.** Root cause: `animatePhaseBody()` (Phase 7's FLIP animation, PR #97)
never canceled a still-running animation on the same `.phase-body` before starting a
new one. Clicking a phase-head twice in quick succession — exactly what a frustrated
user does when an interaction feels slow — started a second animation while the
first's `onfinish` closure was still pending; that stale handler then fired *after*
the second call had already settled its own display/height/overflow state, silently
overwriting it back to the wrong thing. Fixed with
`phaseBodyEl.getAnimations().forEach(a => a.cancel())` at the top of
`animatePhaseBody()` — `cancel()` (unlike letting an animation finish naturally) never
invokes `onfinish`, so the stale handler can no longer fire at all. Testing this
required upgrading `tests/setup.js`'s jsdom `Element.animate`/`getAnimations` stubs
from two independently-faked functions to a linked pair (a `WeakMap`-backed per-element
registry) — the previous stub's `getAnimations()` always returned `[]`, which couldn't
verify cancellation ever actually happened.

**Same fix's sibling, a performance safeguard rather than a correctness bug:**
animating `height` is never compositor-only — it forces a full layout + paint every
frame, which gets genuinely expensive for a phase with a lot of topics. Measured
several built-in template phases well past what a smooth 240ms animation can afford on
a slower device (Core Java: 60 items, Spring and Spring Boot: 63, GenAI and Agentic AI:
44, System Design: 40). A new `LARGE_PHASE_ITEM_THRESHOLD` (40) skips the animation
entirely past that many items, jumping straight to the end state the same way the
existing `prefers-reduced-motion` path already does.

**Sign-out now always confirms, everywhere, and `/#/onboarding` finally has a sign-out
button.** `sidebar.js`'s sign-out handler used to confirm only for an anonymous guest
with unsaved (`dirty`) changes — a real account, or a guest with nothing unsaved,
signed out instantly with no confirmation at all. New `confirmAndSignOut(user, store)`
(`src/ui/utils/signOut.js`) is the one shared implementation both `sidebar.js`'s footer
button and a new button on `onboarding.js`'s top row now call — the onboarding page
(the "all roadmaps" picker) had no sign-out affordance anywhere before this, since the
app-shell sidebar with its own sign-out button only renders on `dashboard.js`. See
`.claude/rules/auth-security.md` for the convention this establishes for any future
sign-out entry point.

Verified live: a Playwright driver rapidly triple-clicked a phase-head (open → close →
open, no waits between clicks — deliberately stressing the exact race) and confirmed
the card settles fully open with its first item never clipped; separately confirmed the
onboarding sign-out button shows a confirmation dialog and the sidebar's now does too
even for a guest with no unsaved changes (previously it wouldn't have). `npm test` (512
passed, 9 new) and `npm run lint` (0 errors) green.

### 2026-07-10 — PR TBD — Resource panel revamp, issue #12 Part B

Closes out issue #12 (Part A, the broken Add-button import fix, shipped separately in
PR #29). New `src/ui/utils/linkDetector.js`: `detectLinkType(url)`, a pure/DOM-free
module matching a URL's hostname/path against 7 known resource types
(youtube/github/notion/google-doc/google-drive/medium/stackoverflow), falling back to
`'article'` for anything else — including any non-http(s) protocol or unparseable
string, so it's safe to call on unvalidated store data. `LINK_TYPE_META` centralizes
each type's display icon/label/badge class so `itemPanel.js`'s resource card and
`dashboard.js`'s resource-count tooltip breakdown both read from one source instead of
duplicating a switch statement.

`itemPanel.js`'s `renderResources()` was rebuilt from a plain editable label+URL row
(`.resource-row`) into a `.resource-card` with a `.link-badge` header — the class
rename means any e2e/unit test asserting on the old selector needed updating
(`tests/e2e/auth.test.js`'s resource-add spec). Piggybacked onto the same function: an
existing resource's URL input now validates via `isValidUrl()` on `blur`, showing an
inline `.resource-url-warning` for an invalid value — this was the one remaining gap
from issue #22's XSS hardening pass, which only ever validated a *newly-added*
resource's URL, not one edited in place afterward.

`dashboard.js`'s checklist-row `resource-count` badge logic was pulled out into a new
module-scope `buildResourceCountBadge(item, onOpen)` (rather than growing the already
lint-flagged `renderItemRow` further) — it now prefixes the badge with the "most
valuable" detected type's icon (video > repo > page > doc > file > article > answer >
link priority order) and attaches a hover/focus tooltip via `attachTooltip()`
(`tooltip.js`, part of Phase 3's component library — this is its first real call site)
showing the full per-type breakdown, e.g. `▶ 2 videos · ⭐ 1 repo · 🔗 1 link`.

No `roadmapStore.js`/Firebase schema change — `resource.label`/`resource.url` are
unchanged; the link type is always derived at render time from the existing `url`
field, never persisted.

**Follow-up, reported live: the first checklist row's resource-count tooltip rendered
with its top sliced off.** Not a z-index/paint-order bug, despite looking like one —
confirmed by cranking `tooltip-bubble`'s z-index to `99999` live with zero effect.
`.section-label` is `position: sticky`, and its containing block is `.phase-card`
(`overflow: hidden` for its rounded corners/priority-accent border, and also
transformed on `:hover`) — a sticky element gets its own layer promoted relative to
that containing block, and Chromium paints that layer ahead of ordinary content inside
the same block *regardless of declared z-index*. Proven by temporarily forcing
`.section-label` to `position: static`: the tooltip then rendered correctly, isolating
the cause to the label's stickiness rather than the tooltip's own stacking. `tooltip.js`
now computes the bubble's candidate "above" rect and checks it against every currently
visible `.section-label`'s bounding rect, flipping to `.tooltip-below` on overlap — in
addition to (not instead of) the existing viewport-room check. `.section-label` is the
only sticky element that can share a positioning context with a tooltip trigger
anywhere in this app today; a future tooltip caller that needs to coexist with a
different sticky element should extend that selector, not redesign the approach.

### 2026-07-11 — PR TBD — Data export & backup: JSON/CSV export, JSON import-restore, `completedAt` (issue #18)

Two new pure modules under `src/core/roadmap/`, alongside — not replacing —
`importValidator.js`/`schemaAdapter.js` (the AI-import pair): `backupSchema.js`
(`buildRoadmapExport`/`buildRoadmapCsv`/`exportFileBaseName`, `EXPORT_SCHEMA_VERSION`)
and `backupValidator.js` (`parseBackupJson`/`validateBackupPayload`/`validateBackupText`/
`diffBackupItems`, `SUPPORTED_BACKUP_SCHEMA_VERSION`). Same parse/validate-split
convention the AI-import pair established, but a structurally different JSON: this one
is a versioned snapshot of a roadmap the user already has (item `done`/`completedAt`/
`resources`/`notes` included) for backup/restore, not a generated-content payload that
seeds a brand-new custom roadmap. See `docs/adr/ADR-008-backup-export-schema-versioning.md`
for the exact-match-reject-no-migration-yet versioning policy and why it was chosen over
a semver/auto-migrate scheme. The two `schemaVersion` numbers are unrelated and
must never be conflated even though both currently read `1`.

`roadmapStore.js` gained `importBackupItems(backupItems)` — a new public method, the
store's own batch equivalent of `addItem()`/`updateItem()`, so the import UI never
pokes `items` directly. It preserves each backup item's own id (unlike `addItem()`'s
always-fresh one) so re-importing the same export merges instead of duplicating, and
re-validates every item against the same title-length/resource/`MAX_ITEMS_PER_ROADMAP`
caps `addItem`/`updateItem` already enforce, since a backup file is untrusted input.
Also added `item.completedAt: number | null`, set by `updateItem()` (via a new
`withDerivedCompletedAt()` helper) the moment a patch flips `done` `false -> true`,
cleared on `true -> false` — applied *after* the existing done-only cosmetic check, so a
plain `{ done }` toggle still never bumps `structuralVersion`. `setItemDoneInTemplate()`'s
cached/cold cross-roadmap paths set the same field via a small `todoCompletionFields()`
helper, alongside the pre-existing `completedViaTodoAt` (a related but distinct field —
the former tracks completion generally, the latter only completion through a linked
Daily Todo). This is a prerequisite for issue #8's progress analytics, which needs a
completion timeline reconstructable from a backup.

New UI: `src/ui/components/importBackupModal.js` (`openImportBackupModal()`, an ad hoc
promise-resolving modal built the same way as `confirmDialog.js`/`importRoadmapModal.js`
— not `openModal()`, whose `close()` has no callback hook for the Escape/outside-click
paths a promise-based modal needs) shows a diff summary ("X items found, Y already
exist, Z new") and a Merge/Overwrite/Cancel choice. `src/ui/utils/backupTransfer.js`
(`downloadTextFile`/`readFileAsText`) are the DOM-only client-side download/file-read
helpers — export needs no server round trip. `sidebar.js`'s account dropdown
(`buildAccountMenu()`, new) gained "Download backup (JSON)"/"Export CSV"/"Import
backup…", available to **every** signed-in identity including an anonymous guest
session (previously the dropdown didn't render at all for a guest) — local-only
progress is exactly the data most at risk of being lost. "Delete account" stays gated
to a non-anonymous user with `onDeleteAccount` provided, unchanged. Placed here rather
than a dedicated settings page since issue #16 (account settings) doesn't exist yet.

A resource's `url` is re-validated against `isValidUrl()` (http/https only) in
`sidebar.js`'s import handler before it ever reaches `importBackupItems()` — the same
save-time guard `itemPanel.js` applies to a manually entered resource — since a backup
JSON file is exactly as untrusted as any other external input. There is no per-item
`uid` anywhere in this store's item shape to "strip" on a cross-account import; only an
informational `exportedByUid` at the payload's top level, never read back on import —
importing into a different account just means every id is unrecognized and everything
imports as new, no special-casing required.

New tests: `tests/unit/backupSchema.test.js`, `tests/unit/backupValidator.test.js`,
`tests/unit/importBackupModal.test.js`, and two new `describe` blocks in
`tests/integration/roadmapStore.test.js` (`completedAt`, `importBackupItems`) covering
done-cycling, merge/add/un-delete/skip/cap behavior, and cross-uid field stripping.
`npm test` (584 passed) and `npm run lint` (0 errors, same 24 pre-existing warnings)
green.

### 2026-07-11 — PR TBD — Periodic backup reminder + clearer restore wording (issue #18 follow-up)

Two gaps found live after issue #18 shipped: nothing in the app ever prompted a user to
actually take a backup (purely opt-in, easy to forget existed), and the restore-backup
confirmation modal's copy read as internal/technical ("item(s)", an em-dash stat line,
tradeoffs crammed into button labels) rather than something an end user skimming it cold
would find clear.

`src/ui/utils/backupReminder.js` (pure aside from `localStorage`/`Date.now()`) is the new
timing logic: `shouldShowBackupReminder(uid, hasRealProgress, now)` returns true once 14
days (`REMINDER_AFTER_MS`) have passed since a user's last JSON backup — or since their
account was first seen, for one who's never taken one, so a brand-new account isn't
nagged on day one — unless a "Not now" dismissal started a 7-day snooze
(`SNOOZE_AFTER_DISMISS_MS`) that hasn't elapsed yet. Three new per-uid `localStorage` keys
(`localStorageKeys.js`, same keyed-by-uid shape as the existing `verifyDismissedKey`)
back it — device-level, never synced to Firebase, never explicitly cleared on sign-out
(harmless, since each key already carries the uid). `src/ui/components/
backupReminderBanner.js` (`createBackupReminderBanner({ user, store })`) is the banner
itself, deliberately built the same way as the existing `verificationBanner.js` — a
plain function returning a node or `null`, decided once at mount, no subscription/timer
to clean up — wired into `dashboard.js` right next to it. Shown for an anonymous guest
session too, same reasoning issue #18's export/import menu items already used: local-only
progress is exactly the data most at risk of being lost.

`exportBackupJson`/`exportBackupCsv`/`importBackupFromFile` were pulled out of
`sidebar.js` into a new shared `src/ui/utils/backupActions.js` — the reminder banner's
"Download backup" button and the account dropdown's own menu item now call one shared
implementation instead of `sidebar.js` growing a second copy. Only `exportBackupJson`
calls the new `markBackupTaken()` — a CSV export never resets the reminder clock, since
CSV is one-way/lossy and isn't a restorable backup.

`importBackupModal.js`'s copy was rewritten end to end: "item(s)" → "topic(s)" (matching
every other user-facing string in the app — `itemPanel.js`'s "Edit topic", the
800-topic-limit toast — the one place in the whole export/import surface that hadn't
matched), the diff summary is now a plain sentence (`summarySentence()`, handles the
all-new and all-already-restored cases with distinct, more natural phrasing instead of
an awkward "0 new" clause) instead of a stat-line concatenation, and Merge/Overwrite's
actual tradeoff is spelled out in two full sentences above the buttons rather than packed
into the button text itself — the buttons now just name the action
(`mergeButtonLabel()` still adapts its count phrasing, "Overwrite my whole roadmap with
this backup" instead of a parenthetical).

New tests: `tests/unit/backupReminder.test.js`, `tests/unit/backupActions.test.js`,
`tests/unit/backupReminderBanner.test.js`, updated wording assertions in
`tests/unit/importBackupModal.test.js`. Verified live via Playwright against
`npm run dev`: a fresh guest account shows no reminder; backdating the account's
first-seen timestamp 15 days and reloading shows it; clicking "Download backup" from the
banner both downloads the file and dismisses it; the reworded restore modal reads
correctly with a real 485-topic backup file. Screenshots committed to
`docs/screenshots/issue-18-export-import/`. `npm test` (608 passed) and `npm run lint`
(0 errors, same 24 pre-existing warnings) green.

### 2026-07-11 — PR TBD — Account settings page (issue #16)

New `src/ui/pages/settings.js` at `#/settings`, reusing the same `app-shell-2`
sidebar+topbar chrome `dashboard.js` established in Phase 2 rather than inventing a
second page shell. Reachable from `sidebar.js`'s nav (a new "Settings" `NAV_ITEMS` entry
— the original Phase 2 comment explaining why Settings was left out is now updated,
since it's real) and from the account dropdown's own menu (a new "Settings" item ahead
of the existing backup/export ones).

Signed-in users get four sections: Profile (email, an inline-expanding "Change email"
form, an inline-expanding "Change password" form, an email-verified badge), Preferences
(theme select, and a "default filter" select), Data (the existing `exportBackupJson()`
action from issue #18), and a Danger zone (delete account). A guest instead sees a single
simplified "Create a free account" card — no profile or danger-zone sections, since a
guest has neither an email/password credential nor an account to delete this way.

**`authApi.updateEmail(newEmail, currentPassword)` / `authApi.updatePassword(newPassword,
currentPassword)`** (`src/services/firebase.js`) reuse `deleteAccount()`'s existing
reauthenticate-first pattern (`EmailAuthProvider.credential` +
`reauthenticateWithCredential`) — Firebase requires a freshly reauthenticated session for
any of these three "sensitive" operations and throws `auth/requires-recent-login`
otherwise. `updateEmail` calls `verifyBeforeUpdateEmail`, not the deprecated direct
`updateEmail` — the new address only actually takes effect once its verification link is
clicked, matching the issue's spec ("Your email won't change until verified") and
required by newer Firebase projects, which reject a bare `updateEmail()` call outright.
Both are guarded at the API layer by a new `assertHasPasswordCredential(user)`
(`src/services/accountGuards.js`) — the same defense-in-depth precedent as
`assertAccountDeletable`, since an anonymous guest has no password credential to
reauthenticate with and the API layer shouldn't rely solely on settings.js never
rendering the profile section for one.

**`showDeleteModal()` moved out of `dashboard.js` into `src/ui/components/
deleteAccountModal.js`** (`openDeleteAccountModal()`) — the sidebar's account dropdown
and the new settings page's danger zone both need to open the identical "type your
password to confirm" flow, so it's a shared component now instead of a page-local
export the settings page would otherwise have had to import cross-page. Its tests moved
from `dashboard.test.js` to a new `deleteAccountModal.test.js` alongside it.

**Default filter preference** (`KEYS.DEFAULT_FILTER`, `localStorageKeys.js`) is read by
a new tiny `src/ui/utils/defaultFilterPreference.js` (`readDefaultFilterPreference()`),
pulled into its own module rather than left inline in `settings.js` specifically so
`dashboard.js`'s `renderDashboard` can read it without a page-to-page import (same
reasoning `deleteAccountModal.js` was extracted for). `renderDashboard`'s
`activeFilter` init became `ui.filter || readDefaultFilterPreference()` — the roadmap's
own sticky per-session `ui.filter` (`KEYS.UI_STATE`) still wins once it's ever been set;
the settings preference only actually applies the first time a roadmap is opened, before
that.

New tests: `tests/unit/settings.test.js` (guest vs. signed-in view, expand/submit both
inline forms, mismatched-confirm-password guard, default-filter and theme selects),
`tests/unit/deleteAccountModal.test.js` (moved from `dashboard.test.js`),
`tests/unit/defaultFilterPreference.test.js`, plus new `assertHasPasswordCredential`
cases in `accountGuards.test.js` and an updated `sidebar.test.js` for the new nav item
and dropdown entry. Verified live against the Firebase Auth/Database emulator via a
throwaway Playwright driver (not committed): guest view shows only the CTA card; a
signed-in account's Profile/Preferences/Data/Danger-zone sections all render; expanding
and submitting both the change-email and change-password forms actually call
`authApi.updateEmail`/`authApi.updatePassword` and show the expected toast.

**Follow-up fix, reported live (real browser window, not devtools emulation) at several
narrow desktop-browser widths (~420–620px), in both themes:** a real blank gutter down
the left side of `#/settings`, roughly a third of the viewport, with the page's actual
content squeezed into the remainder. Root cause turned out to be a pre-existing, shared
app-shell bug that this page's specific content shape was the first to expose visibly,
not anything unique to `settings.js` itself. `.app-shell-main { grid-column: 2; }`
(`app.css`, unconditional) is only correct while `.app-shell-2`'s explicit grid actually
has 2 columns. At the ≤639px breakpoint the grid collapses to one explicit column
(`.app-sidebar` goes `position: fixed`, out of flow) — but `.app-shell-main` staying
pinned to "column 2" (which no longer exists in the explicit grid) forces the browser to
synthesize an implicit second column to satisfy that placement, splitting the viewport
between a phantom auto-sized column and the real content instead of giving the content
the full `1fr`. Confirmed via `getComputedStyle(...).gridTemplateColumns` returning two
track values instead of one at these widths. This phantom column happened to resolve to
`0px` on `dashboard.js`'s particular content shape (invisible, so the bug went
unnoticed there for as long as `.app-shell-main{grid-column:2}` has existed) but resolved
to a real nonzero width on `settings.js`'s. Fixed by adding `.app-shell-main { grid-column: 1; }`
inside the `≤639px` media block — the only explicit column that exists there — confirmed
via a width sweep (300–900px) checking `.app-shell-main`'s real `getBoundingClientRect()`,
not just the computed grid-template-columns string. `npm test` (622 passed) and
`npm run lint` (0 errors, same 24 pre-existing warnings) still green after the fix.

### 2026-07-11 — PR TBD — Centralized icon system: fix Settings gear sizing bug + standardize icon sizes/technology app-wide (issue #107)

Two new modules, both under directories the `pr-checklist` CI job watches:
`src/ui/utils/svg.js` (`svgEl`/`svgIcon`, a shared low-level SVG builder) and
`src/ui/components/icons.js` (a curated named icon set behind one
`createIcon(name, { size })` factory, throwing on an unknown name or size rather than
silently rendering nothing). Together they replace two separate sources of drift: four
independently copy-pasted `svgEl` helpers (`brand.js`, `landing.js`,
`authMarketingPanel.js`, `progressRing.js` — de-duplicated onto the shared helper with no
visual change) and ~10 one-off CSS wrapper classes each hardcoding their own icon pixel
size with no shared scale, the direct cause of the reported bug: `.nav-item-icon` (the
sidebar's Dashboard/My Roadmaps/Settings icons) was the one wrapper class that never set
an explicit `font-size`, so the Settings gear glyph silently inherited `.nav-item`'s 13px
body-text size instead of a deliberate icon size.

New `--icon-size-xs/sm/md/lg` tokens (`app.css` `:root`, 16/20/24/32px) plus a base
`.icon`/`.icon-xs`/`.icon-sm`/`.icon-md`/`.icon-lg` class pair are the single source of
truth every icon-wrapper class in `app.css` now reads from (`.nav-item-icon`,
`.btn-icon`, `.stat-tile-icon`, `.daily-todo-nav-icon`, `.daily-todo-icon`,
`.empty-icon`, `.template-card-icon`, plus a few more found during the migration:
`.notes-indicator`, `.completed-via-todo-indicator`, `.daily-todo-info-btn`,
`.daily-todo-delete`) — a wrapper class holding a `createIcon()` result needs no
`font-size`/`width`/`height` of its own (the svg's own `.icon-{size}` class handles
sizing), so most of these lost their independent pixel value entirely rather than being
reworked to reference a token. `createIcon()` sizes via a discrete modifier class, not an
inline style — index.html's CSP has no `unsafe-inline` for `style-src` (see
`.claude/rules/auth-security.md`), so a `.style.setProperty('--icon-size', …)` approach
(tried first) would have been silently dropped by the browser exactly like the
`animation-delay` inline-style bug from issue #6 Phase 4.2.

Every functional/navigational glyph previously a plain Unicode/emoji character now goes
through `createIcon()`: `sidebar.js` (nav items — this is the fix for the reported bug —
sign-out, collapse), `topbar.js` (hamburger), `emptyState.js` and `dashboard.js`'s own
hand-rolled empty state (search icon, replacing the default 🔍 prop and the dashboard's
`⌕` override), `dailyTodoPanel.js` (heading timer, delete, chevron, info),
`dashboard.js` (notes indicator, add-todo timer, completed-via-todo timer+check,
phase-card chevron, stat-tile check, custom-roadmap fallback — this last one is the one
call site with genuinely mixed content: `currentTemplate.icon` is a decorative emoji
*string* for a built-in template but a `createIcon('edit')` *node* for a custom
roadmap's fallback, so the render call branches on `typeof icon === 'string'` rather
than forcing one representation on both), `onboarding.js` (create, AI-import, info,
delete, hide, sign-out), `itemPanel.js`'s close button, and
`verificationBanner.js`'s dismiss button. Decorative, data-driven glyphs — per-template
icons (`src/data/templates/index.js`) and resource-type badges (`linkDetector.js`) —
are explicitly unchanged and still emoji, per scope; their *sizing* was still folded
into the same token pass via `.template-card-icon { font-size: var(--icon-size-lg); }`.

New unit tests: `tests/unit/svg.test.js`, `tests/unit/icons.test.js` (every icon name
resolves to a valid 24x24 `<svg>` with the expected attrs; an unknown name or size
throws). `tests/unit/emptyState.test.js` updated for the new icon-name prop (was a raw
emoji string prop before). No E2E spec asserted on the old glyph text content — every
existing locator that touches an affected element already targets a CSS class, not text,
so none needed updating. New "Icon system" section added to
`.claude/rules/ui-styling.md` documenting the three pieces above and when to reach for
`createIcon()` vs. emoji for any future icon.

### 2026-07-11 — PR TBD — Progress analytics data layer: activityLogStore + analyticsEngine, no UI yet (issue #8, part 1 of 3)

First of three PRs for issue #8 (Progress analytics — heatmap, charts, streaks,
velocity, share card). This one ships only the data layer: no new route, no new page,
nothing rendered. `item.completedAt` (the issue's originally-planned prerequisite) had
already shipped as part of issue #18 by the time this work started — confirmed via a
codebase survey before implementation began, so that half of the original issue spec was
dropped from this PR entirely rather than redone.

A new fourth store, `src/services/activityLogStore.js`, tracks a flat
`{ [YYYY-MM-DD]: count }` map of items completed per day — same Store pattern precedent
as `dailyTodoStore.js` (debounced local+Firebase sync, echo/dirty guards, sign-out
privacy guard, its own duplicated `stableStringify`), synced to a new
`users/{uid}/activityLog` Firebase path (new explicit `.validate` rule block in
`firebase/database.rules.json`, sibling to `dailyTodos` — the `$other` catch-all under
`users/$uid` required this) and a new `KEYS.ACTIVITY_LOG` localStorage key. It exists
separately from `item.completedAt` specifically because it survives an item later being
unchecked, where `completedAt` does not — see the new
`docs/adr/ADR-009-analytics-data-model.md` for the full decision writeup. Entries older
than 365 days are pruned on every load; pruning forces the store `dirty` so the trim
actually flushes to Firebase instead of silently living only in memory (and being
overwritten right back by a stale, un-pruned remote echo — a real bug caught by this
PR's own integration tests, not a hypothetical).

`roadmapStore.js`'s `createRoadmapStore()` gained an optional `onCompletionToggle(delta)`
constructor hook (`delta` is `+1`/`-1`, defaults to a no-op) fired exactly once per
genuine `done` transition — from `updateItem()` directly, and from all three branches of
`setItemDoneInTemplate()`. `main.js` wires it to
`activityLogStore.recordCompletion()`/`recordUncompletion()`; `roadmapStore.js` itself
never imports `activityLogStore.js`, keeping it independently testable with zero args
exactly as every pre-existing test already does.

New `src/core/analytics/` directory — pure, DOM-free, store-free functions:
`dateKey.js` (shared local-calendar-day key, used by both `activityLogStore.js` and
every module below so they can never disagree about day boundaries), `streaks.js`,
`velocity.js`, `heatmapData.js`, `projection.js`, and the composing `analyticsEngine.js`
(`computeAnalytics`/`computeOverview`/`computePhaseBreakdown`/`computePriorityBreakdown`).
`analyticsEngine.js` also backfills pre-feature history: `buildEffectiveActivityLog()`
merges a log derived from every item's `completedAt`/`updatedAt` underneath the real
`activityLog` — the real log always wins for any day it has an entry for (even an
explicit `0`), so a since-unchecked completion is never resurrected by the backfill, and
an account with months of prior progress doesn't open the eventual Progress page to an
empty heatmap.

New tests: `tests/integration/activityLogStore.test.js` (local persistence,
increment/decrement floor-0, pruning, sign-out guard, Firebase echo/dirty guard —
mirrors `tests/integration/dailyTodoStore.test.js`'s structure), `tests/unit/analytics/`
(one file per pure module: `dateKey`, `streaks`, `velocity`, `heatmapData`, `projection`,
`analyticsEngine`), and a new `onCompletionToggle` describe block appended to
`tests/integration/roadmapStore.test.js` covering both `updateItem()` and all three
`setItemDoneInTemplate()` branches. PR2 (Progress page UI: heatmap, stat cards,
Chart.js-via-pinned-CDN line/bar charts, phase/priority breakdowns, projection card) and
PR3 (canvas share card, sidebar nav entry) follow as separate PRs against this one's
base, per the issue's own suggested phasing.

### 2026-07-11 — PR TBD — Progress page UI: heatmap, charts, phase/priority breakdowns, projection card (issue #8, part 2 of 3)

Second of three PRs for issue #8, stacked on part 1's data layer. Adds the `#/progress`
route (`src/ui/pages/progress.js`) rendering everything `analyticsEngine.js` computes:
four stat tiles, an activity heatmap, a cumulative-progress line chart, a daily-velocity
bar chart, a phase-breakdown list, a priority×phase table, and a projected-completion
card. No sidebar nav entry yet and the "Share progress" button is a disabled
placeholder — both are part 3.

Two new components: `src/ui/components/heatmap.js` (plain HTML/CSS Grid, not the issue's
literal "pure SVG" sketch — `attachTooltip()` can't append into an SVG shape element, and
this app's CSP forbids inline `style` entirely, which rules out per-cell arbitrary
positioning either way; CSS Grid's `grid-auto-flow: column` auto-placement handles the
52-53 variable column count with only 7 discrete row classes, no per-column classes
needed) and `src/ui/components/chartWrapper.js` (lazily dynamic-`import()`s Chart.js from
a pinned-version jsdelivr URL, only on first chart creation — `index.html`'s CSP
`script-src` gained `cdn.jsdelivr.net`; a dynamic `import()` can't carry Subresource
Integrity the way the Firebase SDK's `modulepreload` tags can, so this is the first CDN
script in the app with a documented, deliberate SRI gap — see the "CDN loading
exceptions" section appended to `docs/adr/ADR-002-csp-sri-security.md`).

The phase-breakdown row's "click to open that phase on the dashboard" behavior needed a
small cross-page mechanism that didn't exist: a new `KEYS.SCROLL_TO_PHASE` sessionStorage
signal (`progress.js` writes the phase title + navigates to `#/app`; `dashboard.js`'s new
`applyScrollToPhaseSignal()` reads, clears, opens, and scrolls to it on mount), and a new
`data-phase-title` dataset attribute on `.phase-card` (alongside the existing index-based
`data-phase`) so a phase can be targeted by its stable title from outside the file. See
`.claude/rules/roadmap-store.md`'s new section for the full mechanism.

Two real bugs found live during manual verification (a guest sign-in walkthrough against
this app's actual configured Firebase project, not just unit tests — jsdom has no real
`<canvas>` or layout engine to catch either of these):
1. **Chart.js "Canvas is already in use."** Mounting the page fires both
   `roadmapStore`/`activityLogStore` subscriptions' first callback synchronously
   (`subscribe()`'s documented contract), which raced two concurrent
   `createLineChart()`/`createBarChart()` calls onto the same `<canvas>` before either
   had finished. Fixed by serializing every chart render through one promise chain
   (`chartQueue`) and destroying the previous chart instance *before* creating the next
   one, not after — creating first and destroying after is exactly backwards; Chart.js
   refuses to attach a second instance to an already-occupied canvas.
2. **The whole page rendered wider than the viewport on a phone-width screen**, with the
   heatmap/charts' ~800px of intentionally-scrollable content dragging the entire layout
   along with it instead of scrolling within their own containers. Root cause: `.app-shell-2`'s
   grid columns (and their `≤1023px`/`≤639px` overrides) were a bare `1fr`, and
   `.progress-content` had no explicit `grid-template-columns` at all — both default to a
   content-based automatic minimum size, so genuinely wide content overrides the
   container's real width regardless of `min-width: 0` on the grid *item* alone (already
   present on `.app-shell-main`, and added to `.progress-card`, neither sufficient by
   itself). `dashboard.js`/`settings.js` never had content wide enough to expose this
   pre-existing gap in shared shell CSS. Fixed with `minmax(0, 1fr)` everywhere a bare
   `1fr` track appeared in these rules — see the new rule appended to
   `.claude/rules/ui-styling.md` for the general "any `1fr` track meant to contain
   wide content needs an explicit minimum" principle, verified via real
   `getBoundingClientRect()`/`getComputedStyle().gridTemplateColumns` checks in a
   phone-width Playwright run (`docs/screenshots/issue-8/progress-mobile.png`), not just
   a visual screenshot.

New tests: `tests/unit/progress.test.js`, `tests/unit/heatmap.test.js`,
`tests/unit/chartWrapper.test.js`; `tests/unit/icons.test.js` updated for the two new
icon shapes (`flame`, `trendingUp`). PR3 (share card, sidebar nav entry) follows next.

### 2026-07-11 — PR TBD — Social share card + sidebar nav entry (issue #8, part 3 of 3)

Final PR for issue #8, stacked on part 2. Two new components: `src/ui/components/shareCard.js`
(`generateShareCard(analytics, activityLog)`, a pure Canvas 2D drawing function — no DOM
mutation beyond the canvas it returns) and `src/ui/components/shareModal.js`
(`openShareModal(analytics, activityLog)`, the preview/caption/action-buttons UI wrapping
it in a real `openModal()` dialog). The card reads its gradient stops from the app's own
`--brand-700`/`--brand-600`/`--brand-500` CSS custom properties via `getComputedStyle()`
at draw time rather than duplicating hex values, so it can never silently drift from the
real theme if those tokens change. `brand.js` gained an exported `BRAND_NAME` constant
(previously module-local) specifically so `shareCard.js`'s `ctx.fillText()` calls — which
need the raw string, not a DOM node — don't introduce a second hardcoded `'Ascent'`
literal outside the one file root `CLAUDE.md` permits it in.

Download PNG (`Blob` + `URL.createObjectURL` + `<a download>`, the same pattern
`backupTransfer.js`'s `downloadTextFile()` already established for JSON/CSV export) is
always available; Copy image (`navigator.clipboard.write`) and Share… (`navigator.share`)
are both feature-detected and hidden entirely when unsupported, rather than shown and
failing — an unsupported browser's fallback is simply the always-visible inline preview
image, satisfying the issue's own "fallback" requirement with no extra code path.

Sidebar nav gained a "Progress" item (`sidebar.js`'s `NAV_ITEMS`, between Dashboard and
My Roadmaps — the issue's own "between Dashboard and Resources" no longer applies, since
no Resources nav item exists) with a new bar-chart `progress` icon; a `share` icon was
also added for the modal's own visual polish. Both follow the exact `ICON_SHAPES`
pattern issue #107 established.

New tests: `tests/unit/shareCard.test.js` (stubs `HTMLCanvasElement.prototype.getContext`
and `document.fonts` locally within the test file — jsdom implements neither without the
optional `canvas` npm package, which this repo intentionally doesn't depend on, so a real
rasterizer was never an option here), `tests/unit/shareModal.test.js` (mocks
`generateShareCard` itself, testing the modal's own wiring — caption pre-fill, each
button's feature-detected visibility, and that each action calls the right browser API
with the right arguments), plus new `sidebar.test.js`/`icons.test.js` cases. Verified live
against the real dev Firebase project (guest sign-in → pick a template → Progress nav
link → Share progress button) — screenshot in `docs/screenshots/issue-8/share-modal.png`.
Issue #8 is fully shipped across this PR and its two predecessors.

### 2026-07-11 — PR TBD — In-app feedback & bug reporting widget (issue #9)

A persistent floating feedback widget, reachable from every page. New component map
additions: `src/ui/components/feedbackWidget.js` (the floating trigger, mounted once in
`main.js` directly on `document.body`, outside the router — the one exception to the
"wire cleanup into the route's cleanup return" convention, since this node must survive
every route change untouched), `feedbackModal.js` (the multi-step type-select → form →
success flow, one long-lived `.modal-overlay`/`.modal-card` pair reused across steps so
`attachFocusTrap()` keeps working across transitions), `feedbackForm.js` (shared field/
radio-group/screenshot/system-info primitives), `screenshotCapture.js` (lazy html2canvas
loader — same pinned-jsdelivr-version pattern `chartWrapper.js` established for Chart.js
in issue #8, see `docs/adr/ADR-002-csp-sri-security.md`), and `myReports.js` (report
history, both a tab inside the feedback modal and a standalone entry from the sidebar
account menu).

`src/services/feedbackStore.js` is deliberately **not** a fifth `create*Store()` next to
`roadmapStore.js`/`dailyTodoStore.js`/`activityLogStore.js` — a report is a fire-and-forget
write with nothing to keep in sync afterward, so it's a thin wrapper around two Firebase
calls (`submitReport`, `listenMyReports`) instead of a subscribe/notify/debounced-sync
store. Every report writes to two paths in one multi-path `update()`: `reports/{reportId}`
(full payload including any screenshot, `.read: false` — write-only for every client;
the developer's only access is the Firebase console, which bypasses security rules
entirely) and `users/{uid}/reports/{reportId}` (a summary without the screenshot, to save
quota, powering "My reports"). `firebase/database.rules.json` gained both the new
top-level `reports/{reportId}` block and a `users/{uid}/reports/{reportId}` block under
the existing per-user rules — see `docs/adr/ADR-010-feedback-storage.md` for why Firebase
over an external form service, and `.claude/rules/roadmap-store.md`'s new "In-app
feedback & bug reporting" section for the full write-only data-flow writeup.

Rate limiting (`src/services/feedbackRateLimit.js`, max 3/24h + 1/60s burst) and draft
autosave (`KEYS.FEEDBACK_DRAFT`) are both plain `localStorage`, client-side only — rate
limiting is explicitly a good-faith UX guard, not a security boundary, since Realtime
Database rules can't express a time-windowed write count.

New tests across all three layers: `tests/unit/reportSchema.test.js`,
`tests/unit/metadataCollector.test.js`, `tests/unit/feedbackRateLimit.test.js`,
`tests/unit/screenshotCapture.test.js` (a fake injectable canvas factory, since jsdom has
no real `<canvas>` 2D backend — same constraint `shareCard.test.js` hit in issue #8),
`tests/unit/feedbackWidget.test.js`, `tests/unit/feedbackModal.test.js`,
`tests/unit/myReports.test.js`, `tests/integration/feedbackStore.test.js` (mocks the
Firebase Realtime Database SDK directly, same CDN-stub pattern
`tests/unit/storage/adapterFactory.test.js` established), and `tests/e2e/feedback.test.js`.
The full submit flow, "My reports" history read-back, and the `reports/` `.read: false`
rule were all verified live against a real Firebase emulator (`firebase emulators:start
--only auth,database --project demo-ascent-test`) — `GET /reports` with no `ns` query
param silently hits a default fake namespace with no rules loaded and returns `200 null`
regardless of the real rules (a genuine emulator REST-API gotcha, not a rules bug); with
the correct `?ns=<project>-default-rtdb` it correctly returns `401 Permission denied`.
`sidebar.js`, `dashboard.js`, `progress.js`, `settings.js`, and `dashboardAnimations.js`'s
existing unit tests all needed a new CDN-URL mock added alongside their existing
`firebase.js` mock, since they transitively import `sidebar.js` → `myReports.js` →
`feedbackStore.js`, which imports the Firebase Realtime Database SDK directly (not just
through `firebase.js`) — the default ESM loader can't resolve a bare `https://` import
in Node, so every test file touching that import chain needs the stub.

### 2026-07-12 — PR TBD — Theming correctness audit + enforcement (issue #116)

A live screenshot report of `.feedback-type-card`/`.my-report-summary` rendering
near-black text on a dark navy background (issue #9/#115) prompted an audit of whether
the app had any mechanism that would have caught it before a human did. It didn't:
`tests/e2e/accessibility.test.js` disabled axe-core's `color-contrast` rule app-wide
(the only automated check that catches exactly this class of bug), there was zero
automated dark-theme coverage, and no CSS/design-token linting existed at all.

The audit itself (every literal hex/`rgb()` color in `app.css` outside the two `:root`
token blocks, every custom `<button>`-like class not in the `.btn` family, and
`chartWrapper.js`'s theme-awareness) found the two live bugs above already fixed by a
hotfix, one new instance (`.notes-indicator`, same root cause — a bare `<button>` whose
only content is a `currentColor` SVG icon with no explicit `color`), and confirmed
`chartWrapper.js` hardcoded its brand line color and left Chart.js's default (light-tuned)
axis/gridline colors untouched. Every other literal color outside the `:root` blocks
turned out to be the legitimate "fixed color on a fixed background" pattern, now
annotated with a `/* intentional: ... */` comment explaining why.

Re-enabling `color-contrast` in CI (below) then caught a real bug the static audit
missed: `.badge.P0`–`.badge.P3` and `.filter-chip[data-p="…"].active` set fixed white
text on `--p0`–`--p3`, correct in light theme (dark/saturated token values) but wrong in
dark theme, where those same tokens are light pastels tuned for border/dot visibility,
not for hosting white text (`.badge.P1` measured 1.66:1 in the CI run). Fixed with a
`:root[data-theme='dark']` override switching both to `var(--soft)` text (>6:1 against
all four dark-theme priority tokens) — a reminder that a rule reading a token isn't
automatically theme-safe if that token's dark-mode value was tuned for a different
purpose than the rule assumes.

Two enforcement mechanisms, so the next gap doesn't ship silently again:
- `accessibility.test.js`'s blanket `disableRules(['color-contrast'])` is gone.
  `color-contrast` now runs enabled on every page; the two confirmed sampler false
  positives (`.phase-name`, `.badge.P0`) are excluded from the whole axe scan on the
  dashboard test only, via `AxeBuilder#exclude()`, not a rule-wide disable. A second
  `describe` block runs the same suite with `ascent-theme` forced to `'dark'` before
  navigation — the light-mode-only pass would never have caught the original bug.
- New `scripts/lint-theme.mjs`, wired into the `lint` CI job alongside `npm run lint`
  (no `stylelint`/build-step dependency, per this repo's no-bundler constraint): fails on
  an `app.css` color literal outside `:root` with no adjacent `/* intentional: ... */`
  comment, or a custom `el('button', { className: '...' })` outside the `.btn` family
  with no explicit `color` rule in `app.css`. `tests/unit/lintTheme.test.js` covers the
  script's own logic with fixture CSS/JS strings (with and without violations) so the
  check itself doesn't silently stop working.

New convention documented in `.claude/rules/ui-styling.md` ("Every custom interactive
element must explicitly set `color`") with the re-scoped axe exception list alongside it.

### 2026-07-12 — PR TBD — PWA: manifest, service worker, offline caching, install prompt (issue #19)

A new root `sw.js` — a plain ES module service worker, no build step or Workbox, matching
this app's no-bundler constraint — is registered from `src/services/serviceWorkerRegistration.js`
after `window.load`. Its two cache strategies live in `src/services/sw/cacheStrategies.js` as
dependency-free pure functions (`cacheFirst(request, cache, fetcher)`,
`networkFirst(request, cache, fetcher)`, `isFirebaseApiRequest(url)`) rather than inline in
`sw.js` directly — jsdom has no real `caches`/service-worker environment, so this is the only
way to unit-test the actual cache logic (`tests/unit/cacheStrategies.test.js`, mocking the
`fetch`/`Cache` surface). Same-origin static assets go through `cacheFirst`; Firebase Realtime
Database and Auth REST hosts (`firebaseio.com`, `googleapis.com` — matched by hostname, never
the Firebase SDK's own CDN URLs, which have their own caching) go through `networkFirst`, so an
offline user sees their last-synced data instead of a hard failure. A navigation request that
fails with no cache falls back to a new styled `public/offline.html` instead of a blank page.
`sw.js`'s own `CACHE_VERSION` constant must be bumped on any deploy that changes static assets
— the same "bump to invalidate" convention `ROADMAP_VERSION` already established
(`src/data/templates/java-backend.js`), not a new pattern.

`public/manifest.json`'s `start_url` gained a `?source=pwa` query param for install-attribution
analytics; `index.html` gained the three `apple-mobile-web-app-*` meta tags iOS needs for a
standalone (chrome-free) home-screen launch — Android/desktop installability already worked off
the pre-existing manifest + icons from an earlier pass, so most of Phase A of the issue was
already in place before this PR. Install-prompt capture (`src/services/pwaInstall.js`) stashes
the one-shot `beforeinstallprompt` event (it doesn't refire on demand) and exposes
`isInstallable()`/`onInstallabilityChange()`/`promptInstall()`/`dismissInstallPrompt()`; a new
"Install Ascent" row in Settings → Preferences (`src/ui/pages/settings.js`) shows only while
installable and writes `KEYS.PWA_INSTALL_DISMISSED` on both dismiss and successful install so it
never reappears — same one-shot-dismiss pattern as the backup-reminder banner.

**Deliberately deferred, not shipped in this PR**: `manifest.json` maskable icons and install-
dialog `screenshots`. The existing 192×192/512×512 PNGs have no safe-zone padding, so tagging
them `purpose: "maskable"` as-is would let OS icon masks crop the logo incorrectly — worse than
not declaring maskable support at all; screenshots need an actual capture pass, not a config
change. See `docs/adr/ADR-011-pwa-offline-strategy.md` for the full strategy rationale.

### 2026-07-12 — PR TBD — What's New notification bell + in-app changelog (issue #20)

A new `src/data/changelog.json` (imported directly as an ES module via `with { type: 'json' }`,
per `docs/api.md`'s schema) is the single source of truth for both `APP_VERSION`
(`src/data/changelog.js`, a `Math.max()` over every entry's `version` — parallel to
`ROADMAP_VERSION`) and the drawer's content, so bumping the version and writing the announcement
copy happen in one file, one PR. Version comparison and schema validation
(`src/core/changelog/version.js`) are pure, dependency-free functions, same "pure core" pattern
`importValidator.js`/`backupValidator.js` already established — kept out of `changelog.js`
itself so they're independently unit-testable against fixture data, not just the real file.

The topbar gains a bell icon (`src/ui/components/notificationBell.js`'s `createChangelogBell()`,
wired into `createTopbar()` in `dashboard.js`/`settings.js`/`progress.js` — the three pages that
already share this topbar) showing a red dot whenever `APP_VERSION` is newer than
`KEYS.LAST_SEEN_CHANGELOG_VERSION` (`src/services/changelogSeen.js`, a plain localStorage
read/write pair — device-level, not per-account, same precedent as `theme.js`). Clicking it opens
`openChangelogDrawer()` (`src/ui/components/changelogDrawer.js`) — a right-side slide-in panel
reusing `itemPanel.js`'s `.panel-overlay`/`.item-panel` shell verbatim, entries grouped by
version (newest first) with a colored dot per item type (`feat`/`fix`/`improvement`, matching the
label taxonomy) — and immediately marks the current `APP_VERSION` as seen, clearing the dot
without a full topbar re-render (`bell.setUnread(false)`). No polling, no auto-show on boot — the
badge is the only passive signal, matching the issue's explicit "not intrusive" requirement.

**A JSON module import (`with { type: 'json' }`) is fetched by the browser exactly like an XHR
under CSP's `connect-src`, not `script-src` — a real, boot-blocking bug this issue caught.**
`index.html`'s CSP had no `'self'` in `connect-src` (only third-party Firebase/local-emulator
origins), so loading `changelog.js` — reachable from every page eagerly, since `main.js` isn't
route-code-split — silently failed the module graph, breaking sign-in itself in a live browser
check even though `npm test`/`npm run lint` both stayed green (jsdom/ESLint neither enforce CSP).
Fixed by adding `'self'` to `connect-src`. Also required bumping ESLint's `ecmaVersion` from the
pinned `2022` to `'latest'` in `eslint.config.js` — the older parser didn't understand import
attribute syntax at all and failed with a hard parse error, not a lint warning. **Any future
static-data-as-a-JSON-module import must be verified with a real browser load, not just
`npm test`/`npm run lint`** — this class of bug is invisible to both.

### 2026-07-12 — PR TBD — Phase C: "New" feature badges (issue #20 follow-up)

Closes out issue #20's explicitly-deferrable Phase C. `changelog.json` items may now carry an
optional `featureKey` string (e.g. `"pwa-install"` on the PWA-install entry) identifying a
specific UI element to badge — `src/data/changelog.js`'s `getFeatureIntroducedVersion(featureKey)`
looks up which changelog `version` introduced it. `src/core/changelog/featureBadge.js`'s
`isFeatureBadgeActive()` is the pure eligibility function (no DOM/localStorage): a badge is only
ever eligible **after** the user has opened the What's New drawer for the introducing entry —
never before — then stays visible for `FEATURE_BADGE_DURATION_MS` (7 days) from the moment it's
first actually shown, or until explicitly dismissed, whichever comes first. Kept separate from
`version.js` since this reasons about a different "seen" axis (per-feature badge state, not
per-device changelog-read state).

`src/services/featureBadgeSeen.js` is the localStorage-backed wrapper (`KEYS.FEATURE_BADGE_STATE`,
a `{ [featureKey]: { firstShownAt, dismissed } }` map, same device-level/never-synced precedent as
`changelogSeen.js`) — `shouldShowFeatureBadge(featureKey)` records `firstShownAt` the first time a
badge becomes eligible so the 7-day window starts from the real first render, not from whatever
timestamp a later call happens to see. `src/ui/components/featureBadge.js`'s `createFeatureBadge()`
returns `null` when ineligible (fits the existing `.filter(Boolean)` children-array convention
used throughout the app) or a `<span class="feature-new-badge">New</span>` pill otherwise;
`dismissFeatureBadge()` is called from the feature's own interaction handler.

Wired into the one existing concrete example the issue names — the Settings → Preferences
"Install Ascent" row (`src/ui/pages/settings.js`) — `changelog.json`'s `"pwa-install"` featureKey
badges that row's label once its introducing entry has been seen, and both the row's "Install
app" and "Dismiss" buttons call `dismissFeatureBadge('pwa-install')` before their existing
behavior. Any future feature announced in `changelog.json` with a real UI element to point at can
opt in the same way: add `featureKey` to its changelog item, drop `createFeatureBadge(key)` into
that element's `el()` children (filtered for `null`), and call `dismissFeatureBadge(key)` from
its interaction handler.

### 2026-07-12 — PR TBD — Retire manual roadmap creation; merge onboarding cards; two-column AI-creation modal (issue #100)

`src/ui/components/newRoadmapModal.js` (and its test) is deleted — the standalone "start
truly blank" entry point on `/onboarding` is retired, since it handed a first-time user a
zero-phase roadmap with no guidance, a strictly worse experience than the already-existing
AI-assisted path. `onboarding.js`'s two separate cards ("Create your own roadmap" /
"Import roadmap") collapse into one "Create your own roadmap" card, which now opens
`importRoadmapModal.js`'s `openCreateRoadmapModal()` (renamed from
`openImportRoadmapModal()`) directly. Dashboard-level manual phase/section/item CRUD is
completely untouched — this issue only removes the *standalone* empty-seed entry point,
not the editing tools every custom roadmap (AI-created or not) already used to fine-tune
itself afterward.

The creation modal itself is redesigned from a single stacked-scroll flow (issue #64) into
a two-column "Build your prompt" / "Paste the AI's answer" grid (`.import-modal-grid`,
`app.css`) at a new `min-width: 1025px` tier, collapsing back to the original single-column
flow below it — each column scrolls independently, and Import/Cancel now live in a
`.modal-card`-level footer outside the grid so they're always reachable. Two real
correctness fixes rode along: (1) "Copy prompt" is now disabled until the topic field is
non-empty — previously a user could copy the prompt with its literal placeholder text and
no warning; (2) `parseImportJson()` (`src/core/roadmap/importValidator.js`) now strips a
single leading/trailing fenced code block before parsing, recovering from the most common
real-world AI-output failure mode (assistants wrapping JSON in ` ```json ` fences despite
being told not to). A new `buildImportFixPrompt(errors)` (`src/data/importPrompt.js`, same
module/versioning discipline as `buildImportPrompt`) composes a ready-to-copy message a
user can hand back to their AI assistant when validation fails, restating the schema
contract and listing the specific errors — surfaced via a new "Copy fix-it message for
your AI" button next to a plain-language error summary, with the original technical error
list kept behind a "Show technical details" disclosure. `buildYourOwnGuide.js` is rewritten
from "two alternative starting methods" (add manually / generate with AI) to a single flow
(generate with AI, then fine-tune manually afterward), matching the onboarding change.

See `.claude/rules/roadmap-store.md`'s "Manual 'start truly blank' roadmap creation was
retired" and "AI-assisted roadmap creation" sections, and `.claude/rules/ui-styling.md`'s
"A two-column modal with a shared header/footer outside the grid" section, for the full
writeup.

### 2026-07-12 — PR TBD — Creation-modal revamp: resource links, more filters, always-visible Copy step, redesigned card (issue #100 follow-up)

Live feedback on the just-shipped two-column modal (previous entry) drove a second pass,
no new files added — pure follow-up to the same components. Four pieces:

1. **Readability + layout fix.** `.import-prompt-block`'s font size went from 12px to the
   app's `--text-sm` token (13px). More substantially, the "Copy it" step (heading, Copy
   prompt button, hint text) used to live inside the same scrollable area as the topic
   field and customization filters — on a shorter window it could be scrolled out of view
   entirely, unreachable on first open without knowing to scroll. Fixed by restructuring
   `.import-column-build` into a flex column with a scrollable `.import-column-scroll`
   child (`flex: 1; min-height: 0; overflow-y: auto`) and a sibling `.import-copy-sticky`
   block that sits outside the scrolling area in normal flow — not `position: sticky`,
   which would need its own containing-block reasoning; a plain flex sibling is simpler
   and just as effective. See `.claude/rules/ui-styling.md`'s new "sticky-by-layout"
   section for the reusable pattern.
2. **Numbered step badges + entrance animation.** Each of the six build/paste steps
   (`buildStepHeading()`, `importRoadmapModal.js`) now renders a small circular numbered
   badge (`.import-step-badge`) instead of plain "1. …" text, with a short staggered
   fade-in (`.import-step-heading.entering`/`.entering-delay-N`, reusing the existing
   `item-entering` keyframes and `--stagger-base` token `.check-item` already
   established — no new keyframes needed).
3. **Two more optional filters.** "Weekly time commitment" (single-select chips) and
   "Preferred resource types" (the first **multi**-select field in this modal —
   `buildMultiChipGroup()`, a new sibling to the existing `buildChipGroup()`) join the
   existing four, each appending one line to `buildImportPrompt()`'s instructions block
   exactly like the others — no schema change, no `IMPORT_PROMPT_VERSION` bump.
4. **Resource links in the generated schema.** The real substantive addition: the import
   JSON schema now accepts a third item shape — `{ title, priority?, resources? }` —
   alongside the existing plain-string and tuple forms, where `resources` is an array of
   up to 5 `{ label, url }` pairs. `buildImportPrompt()` instructs the AI to include real,
   working links (YouTube, official docs, articles/blogs, courses) and never fabricate a
   URL. `validateImportPayload()` (`src/core/roadmap/importValidator.js`) validates each
   resource against the same rules `limits.js`'s `isValidResource` already enforces
   everywhere else a resource enters the store (label/url length caps, http(s)-only URL —
   a local `isHttpUrl()` duplicate of `src/ui/dom.js`'s `isValidUrl()`, kept as a
   duplicate rather than a cross-layer import so this module stays DOM-free).
   `adaptImportToRoadmap()` maps validated resources straight onto `item.resources`, so an
   AI-generated topic with resources renders identically to one whose links were added by
   hand — the existing resource-count badge/type-icon/"Open" link in `dashboard.js`/
   `itemPanel.js` needed zero changes.
5. **Card redesign.** `.template-card-create` (the "Create your own roadmap" card) went
   from a plain dashed-border box to a brand-tinted background/border/glow plus a new
   "AI-powered" pill (`.template-card-ai-badge`) — real feedback called the old version
   easy to miss among the built-in template cards. Every value used is an existing
   theme-aware token (`--brand-light`/`--brand-light-border`/`--shadow-brand`), no new
   color literals.

See `.claude/rules/roadmap-store.md`'s updated "AI-assisted roadmap creation" and "Prompt
customization inputs" sections, and `.claude/rules/ui-styling.md`'s new "sticky-by-layout"
section, for the full writeup.

### 2026-07-12 — PR TBD — Fix real-world validation false-positives on resource URLs/priority casing; restore CI (issue #100 follow-up)

Real-world testing of the resources feature above surfaced two problems:

1. **Roadmaps were failing validation intermittently** — "item is invalid" errors spread
   across many unrelated topics, sometimes on the first and second generation attempt.
   Traced to two AI-output quirks previously treated as hard failures: a resource URL
   missing its `https://` scheme (very common — `docs.docker.com` "looks complete" to a
   model without it), and a priority value with different casing/whitespace (`p0`,
   ` P0 `). Fixed by normalizing priority (trim + uppercase, `normalizePriority()` in
   `importValidator.js`, applied everywhere a priority is checked) and by moving resource
   URL *protocol* correctness entirely out of validation and into
   `adaptImportToRoadmap()`'s new `sanitizeResources()` — auto-prepends `https://` to a
   bare-domain URL, silently drops a resource whose URL is still invalid after that,
   never fails the whole topic over one bad link. A secondary symptom this also fixes:
   some AI assistants, after repeated "fix it and resend" round-trips, gave up and
   stopped including resources at all — with roadmaps succeeding on the first real
   attempt far more often, resources now come through as originally generated.
2. **CI was red on the PR** — two unrelated causes, both now fixed: (a) ESLint's
   theme-correctness check (`scripts/lint-theme.mjs`) flagged `.import-step-badge`'s
   `color: #fff` for missing the required `/* intentional: ... */` comment (issue #116's
   convention) — added, same pattern as `.reset-success-icon`/`.template-card-delete:hover`
   above it in `app.css`. (b) `tests/e2e/customRoadmap.test.js` was missed when manual
   "start truly blank" creation was retired — it still drove the deleted title/description
   modal to seed its test roadmaps. Rewritten to seed via the AI-import flow (a minimal
   valid paste) instead; the actual manual phase/section/topic CRUD the file exists to
   test (dashboard-level, untouched by #100) is unchanged.

See `.claude/rules/roadmap-store.md`'s new "A single malformed resource URL or oddly-cased
priority must never fail the whole roadmap" section for the full writeup.

### 2026-07-12 — PR TBD — Corrupted-text detection; "Resources" filter chip (issue #100 follow-up)

Two more real-world reports on the same AI-import flow, both traced and fixed:

1. **Data corruption, not a display bug.** A pasted roadmap rendered several topic titles
   as garbled text mixing readable words with URL-encoded JSON fragments (`Learn](https://
   example.com%22]},{%22title%22:%22Learn) the command line`). Ran the exact reported
   payload through `validateImportPayload()`/`adaptImportToRoadmap()` directly and got
   clean output — proving the corruption was already present in what got pasted, most
   likely some AI chat UI's "select and copy rendered text" auto-linkifying a raw URL
   inside the JSON code block and splicing markdown-link syntax into neighboring text.
   Since the result is still syntactically valid JSON, it passed every existing check.
   `importValidator.js` gained `looksCorrupted()`/`findItemCorruption()` — a heuristic
   marker scan (`%22`, `"title":`, etc.) run on every title/section-name/phase-name/
   resource-label/resource-url *before* normal shape validation, producing a specific,
   actionable error naming the exact field and suggesting the "copy raw" fix, instead of
   either silently importing garbage or a generic "item is invalid". Refactored
   `isValidItem()`/`findItemCorruption()` into smaller named helpers (`isValidTupleItem()`,
   `isValidObjectItem()`, `extractItemTitleText()`, `findCorruptedResourceIndex()`) while
   at it, to stay under the repo's complexity lint threshold.
2. **New "Resources" filter chip** (`dashboard.js`) — real feedback that there was no way
   to see every resource link in a roadmap without opening each topic's edit panel one at
   a time. A fifth chip alongside All/P0-P3; `matchesActiveFilter()` (shared by
   `filterItems()`/`priorityCounts()`) treats it as "has ≥1 resource". Active, it expands
   each matched row's resources inline (`renderInlineResources()`) as clickable,
   type-colored links — reusing `linkDetector.js`'s existing per-type icon/color and
   `.check-body`'s existing `flex-wrap: wrap` (a `flex-basis: 100%` wrapper drops the list
   onto its own line with zero structural change to the row). A new `link` icon shape was
   added to `icons.js` for the chip itself.

See `.claude/rules/roadmap-store.md`'s new "Corrupted-text detection" and "'Resources'
filter chip" sections for the full writeup.

### 2026-07-12 — PR TBD — Icon system unification: Phosphor Icons replace all emoji (issue #136 Phase 2)

Continuing Phase 1's screenshot-audit-driven design revamp. `src/ui/components/icons.js`'s
`createIcon()` (functional/navigational chrome) is re-drawn onto real Phosphor Icons
(Regular weight, MIT licensed) source paths in their native `256x256` viewBox, replacing
this app's original hand-drawn `24x24` stroke icons — same names, same call sites, same
`--icon-size-*` token contract. `src/ui/utils/svg.js`'s `svgIcon()` gained an optional
`viewBox` parameter (defaulting to `24 24`, unchanged for any future hand-drawn icon) to
support this.

A new module, **`src/ui/components/decorativeIcon.js`**, holds a second icon factory,
`createDecorativeIcon(name, { size })`, over Phosphor's **Duotone** weight (a faint
`opacity: 0.2` base path plus a full-opacity detail path, both `currentColor`) — this is
the reversal of issue #107's original "emoji is fine for decorative content" carve-out.
Every previously-emoji decorative glyph now routes through it: `src/data/templates/index.js`'s
7 template `icon` fields, `src/ui/utils/linkDetector.js`'s `LINK_TYPE_META` (8 resource
types), and `src/ui/utils/customRoadmapIcon.js`'s `pickCustomRoadmapIcon()` (16-icon hash
rotation for custom/imported roadmap cards) — all three modules kept their existing "return
a plain string" contract, now returning a `decorativeIcon.js` name instead of a glyph, so
none of them gained a DOM/component dependency. Call sites that used to interpolate an
emoji glyph directly into a `text:` string or a tooltip string (`dashboard.js`'s resource
badges, `itemPanel.js`'s resource-type label) were changed to render a real `<svg>` child
node instead; the one exception is `attachTooltip()`'s breakdown string (plain text only,
no DOM), which dropped its icon glyphs entirely rather than trying to inline an SVG into
text.

Rationale for the reversal: cross-platform emoji rendering (a coffee-cup emoji is a
different illustration style/color/weight on every OS) was an acceptable tradeoff before
the product's own quality bar moved toward "sellable enterprise product" (root
`CLAUDE.md`) — a live screenshot audit (issue #136) found the built-in-template
emoji/SVG-icon mismatch on the onboarding picker's card grid to be the single most visible
"not enterprise" tell in the app.

See `.claude/rules/ui-styling.md`'s revised "When to use `createIcon()` vs.
`createDecorativeIcon()`" section for the full policy.

### 2026-07-12 — PR TBD — Component consistency pass (issue #136 Phase 3)

New module **`src/ui/components/select.js`** — `createSelect(options, { value, ariaLabel,
className })` — a custom-styled listbox that mirrors a native `<select>`'s API (`.value`
get/set with no `change` dispatch on programmatic set, `.addEventListener('change', fn)`
on user-driven selection, `.disabled` proxy) so every existing `el('select', ...)` call
site only needed its element-construction line swapped, not its surrounding logic.
Keyboard-operable per the ARIA combobox/listbox pattern (Arrow keys, Home/End, Enter/Space,
Escape, type-ahead); the trigger is a real `<button>` so a wrapping `<label>` associates it
exactly like a native `<select>` did. The listbox itself is appended straight to
`document.body` while open and removed on close (a portal) rather than living inside its
caller's DOM subtree — found live that `itemPanel.js`'s `.item-panel` has a permanent
`transform` for its slide-in animation, which per the CSS spec hijacks the positioning
context of any `position: fixed` descendant, so a naively-nested listbox rendered offset
from its trigger by roughly the panel's own position. The portal approach sidesteps this
bug class structurally for every current and future call site, rather than requiring each
one to be audited for a transformed ancestor. Converted every bare `<select>` in the app:
`itemPanel.js`'s Priority field, `dailyTodoPanel.js`'s and `addToDailyTodoModal.js`'s
duration dropdowns, `importRoadmapModal.js`'s Goal/context field, and `settings.js`'s Theme
and Default filter selects — each caller now also calls `select._cleanup()` (removes the
shared `document` click listener and detaches the portal listbox) from its own teardown
path, per the existing component-cleanup convention.

`app.css` gained a shared "metadata chip" box-model scale — `--chip-height`/
`--chip-padding-x`/`--chip-radius` (`:root`) — now read by `.badge`, `.resource-count`, and
the template card's `-current-badge`/`-started-badge`/`-ai-badge` pills, so every small
inline badge in the app shares identical height/padding/corner-radius regardless of its
own font-size; each component's colors stay semantically distinct. `.priority-tag` reads
only `--chip-height` (for row alignment) and deliberately keeps its bare-text treatment,
since adding a background would need its own WCAG contrast pass against every `--p0`–`--p3`
pair in both themes.

See `.claude/rules/ui-styling.md`'s new `createSelect()` and chip-scale sections for the
full API/usage rules.

### 2026-07-13 — PR TBD — Sign-out data loss fix; roadmap-switch speed + loading feedback (issue #121 item 6 + live reports)

Two related, live-reported bugs, both traced to `roadmapStore.js`'s `switchRoadmap()`.

**Data loss on sign-out.** `confirmAndSignOut()` (`src/ui/utils/signOut.js`) called
`authApi.signOut()` immediately on confirm, with no regard for `queueSave()`'s 500ms
debounce — an edit still queued at that moment (most visibly right after
`createCustomRoadmap()`'s AI-import flow) silently failed to reach Firebase once the auth
token was invalidated, and was then wiped from local storage too by `setUser()`'s
sign-out privacy guard. Fixed by flushing a dirty real account's pending roadmap changes
*before* calling `authApi.signOut()`.

**Slowness + no loading feedback.** `switchRoadmap()` — the shared path both "open an
already-started roadmap" and "create one via AI import" go through — used to await up to
three independent Firebase round trips sequentially (flush the outgoing template, read
the incoming template's saved progress, write the switch's meta patch), even though none
depends on another's result. Now run concurrently via `Promise.all`; `createCustomRoadmap()`'s
own `customRoadmaps` meta write is folded into that same call via a new optional
`extraMeta` param instead of a separate round trip first. Two named helpers
(`flushOutgoingRoadmap()`, `saveSwitchMeta()`) were extracted out of `switchRoadmap()`
itself to keep its own ESLint complexity from growing further (it was already over the
`warn` threshold pre-existing this change; extraction brought it down, not up).

Once the round trips are fast, a fast operation still needs to *look* fast: the "Create
your own roadmap" onboarding card gained the same spinner overlay
(`buildPickingOverlay('Importing…')`) the template-picker cards already had for
`pickTemplate()`/`pickCustomRoadmap()` ("Opening…") — previously the only feedback during
`createCustomRoadmap()`'s Firebase work was a dim-and-disable, indistinguishable from
unresponsive lag. `confirmDialog()` (`src/ui/components/confirmDialog.js`) gained a new
optional `onConfirm` callback, used by the sign-out fix above: passing it keeps the dialog
open with a `setButtonLoading()` spinner on the confirm button until the callback
resolves, instead of closing instantly and leaving the user watching nothing happen.
Every pre-existing `confirmDialog()` call site omits it and is unaffected.

See `.claude/rules/roadmap-store.md`'s "A dirty real account must be flushed" and
"`switchRoadmap()`'s three network round trips run concurrently" sections for the full
reasoning, and `docs/api.md`'s `switchRoadmap`/`createCustomRoadmap` entries for the
updated signatures.

### 2026-07-13 — PR #TBD — Guest data-loss risk indicator + nudge (issue #123)

New module `src/ui/components/guestDataRiskNudge.js` (`maybeShowGuestDataRiskNudge`) plus
a pure helper `src/ui/utils/guestDataRisk.js` (`shouldShowGuestRiskNudge`/
`markGuestRiskNudgeShown`, one-shot dismiss-and-remember state under
`guestRiskNudgeShownKey(uid)`, `localStorageKeys.js`). `dashboard.js` calls it once on
mount; it shows a `confirmDialog` (reusing the existing primitive, not a new one) at most
once per guest account, once at least 5 topics are completed, offering to navigate to
`/signup`. `sidebar.js` also grew a small always-on `.app-sidebar-guest-risk` indicator
(tooltip via `attachTooltip`) next to the "Guest session" label — purely presentational,
no new store state. See `.claude/rules/auth-security.md` for the full writeup.

### 2026-07-13 — PR #TBD — Unwired components decided: two wired in, one kept as-is, one closed not-planned (issue #125)

Resolved the four dangling "not yet wired into any page" components/adapter left over from
issue #6 Phase 3 and issue #5. `commandPalette.js` is now wired into `topbar.js` — a search
icon button plus a Cmd/Ctrl+K shortcut (`bindCommandPaletteShortcut`, cleaned up via the
existing `topbar._cleanup` → route-cleanup chain, same as every other subscription in this
app) opens it with a static navigation item list (Dashboard/All roadmaps/Progress/Settings);
searching live roadmap content is out of scope, left for a follow-up. `skeleton.js` is now
wired into `progress.js`'s two chart cards, shown until the first Chart.js CDN import
resolves (`chartWrapper.js`), then swapped for the real `<canvas>` — the only load state in
the app slow enough to warrant it. `emptyState.js` replaced a hand-rolled equivalent div in
`dashboard.js`'s "no matching topics" state (identical markup, now going through the shared
primitive instead of a duplicate). `tabs.js` was audited against every current page and kept
unwired — no real tab-shaped UI exists to adopt it into without a redesign (settings.js's
sections are a deliberate single-scroll layout; the import modal deliberately collapsed its
own tabs in issue #64) — it stays as a documented, tested primitive. `LocalStorageAdapter.js`
is closed as **not planned**, same precedent as Google Drive sync (#5/#71) — the file stays
(tested, harmless, a real future guest-only-local-mode feature could still pick it up) but
`.claude/rules/roadmap-store.md` no longer describes it as open-ended scaffolding.

### 2026-07-13 — PR #TBD — CI actually enforces coverage thresholds; router/confirmDialog/toast get direct unit tests (issue #128)

`ci.yml`'s `test-unit` job ran plain `npm test` (`vitest run`), not `npm run test:coverage`
(`vitest run --coverage`) — `coverage.thresholds` in `vitest.config.js` is only evaluated
when coverage collection is enabled, so the configured `statements: 20, branches: 15,
functions: 20, lines: 20` gate had never actually run in CI since it was written, and the
"Upload coverage" artifact step was silently uploading an empty/missing `coverage/` directory
on every run. Fixed by pointing the job at the already-defined `test:coverage` script — no
new script needed. Running it locally with the new tests below in place measures real
repo-wide coverage for the first time (79.5%/73.7%/78.3%/81.0% statements/branches/
functions/lines), comfortably above the configured thresholds with no adjustment needed.
Also added the three still-missing direct unit test files for foundational, widely-reused UI
modules previously exercised only incidentally through other pages' tests: `router.js`
(`registerRoute`/`navigate`/`startRouter`, including hashchange-triggered re-dispatch,
per-route cleanup-before-next-render, and listener teardown via the returned `stop()`),
`toast.js` (type-based class, show/auto-dismiss timing via Vitest fake timers, multi-toast
stacking without cross-toast interference), and new cases in the pre-existing
`confirmDialog.test.js` (the `danger` styling branch, overlay-click dismissal, and Escape
dismissal via the shared `attachFocusTrap` — both dismissal paths are genuinely implemented,
so no follow-up gap to file). Both `router.test.js` and `toast.test.js` reset the module
registry (`vi.resetModules()`) and re-import fresh per test, since both modules hold
module-level singleton state (`router.js`'s `routes` Map/`currentCleanup`, `toast.js`'s
shared stack `root` node) that would otherwise leak listeners/DOM references across tests.

### 2026-07-13 — PR #TBD — Split roadmapStore.js's setUser into named onboarding-detection phases (issue #129)

`setUser` was 786-line `createRoadmapStore`'s single worst ESLint complexity offender —
complexity 56 (5.6x the gate's max of 10, and 4x the next-highest warning anywhere in the
codebase), 154 lines. Behavior-preserving extraction only, no logic change: the six
conceptual phases already documented in `.claude/rules/roadmap-store.md`'s onboarding-order
paragraph are now separate functions instead of one large function body. Most are pure
module-scope functions taking explicit params and returning explicit results (rather than
closing over `setUser`'s locals) — `freshStateForNewUid()`, `readOnboardingLocalFallback()`,
`resolveMetaExtras()`, `fetchRemoteMetaSafely()`, `resolveOnboardingState()` (plus its own
sub-helpers `fetchLegacyRoadmapSafely()`/`isAlreadyOnboardedLegacy()`/
`backfillLegacyOnboardingMeta()`), `migrateLegacyBlankTemplateIfNeeded()` (plus
`fetchStoredBlankRoadmap()`/`resolveBlankMigrationContent()`/
`persistBlankMigrationToFirebase()`), and the orchestrator
`determineOnboardingAndActiveRoadmap()`. A `STALE` sentinel (`Symbol('stale')`, exported)
replaces the old inline `if (isStale()) return;` early-returns at each extracted `await`
boundary, threaded back up through the chain so `setUser` still aborts correctly when a
newer `onAuthStateChanged` call has taken over mid-flight — the stale-call-guard discipline
(`.claude/rules/roadmap-store.md`) is preserved at every boundary, not just the top level.
The one remaining piece, `loadActiveRoadmap()` (the post-onboarding-determined item/phase
load), stays a factory closure like the pre-existing `flushOutgoingRoadmap()`/
`saveSwitchMeta()`, since it delegates straight to `fetchTemplateData`/`resolveRoadmapItems`,
themselves closures over `adapter`/`uid`/`roadmapCache`. Result: `setUser`'s own complexity
drops to 13 and its line-count warning disappears entirely (~60 lines); `createRoadmapStore`
itself drops from 786 to 712 lines (still flagged, not attempted further — a genuine
factory-function split is out of scope for this issue). `tests/integration/roadmapStore.test.js`
passes unchanged (1043 → 1059 total repo tests, no existing test modified) — new
`tests/unit/roadmapStoreOnboardingHelpers.test.js` exercises each extracted phase directly
against the documented account shapes (post-#58, pre-#58-legacy-onboarded,
pre-#51-identity, brand-new), independently callable for the first time.

### 2026-07-13 — PR #TBD — Roadmap sharing: read-only published snapshot link (issue #131)
Adds the first public, unauthenticated-reachable data path in this app.
`src/core/roadmap/shareSchema.js` (pure, `buildRoadmapShareSnapshot()`) builds a frozen
snapshot (title/phases/items with done/priority/resources, never notes/completedAt) from a
`roadmapStore` snapshot; `src/services/shareStore.js` is a thin Firebase wrapper
(`publishRoadmapShare`/`revokeRoadmapShare`/`listMyShares`/`getSharedRoadmap`), same
"doesn't fit `StorageAdapter`" shape as `feedbackStore.js`. Snapshots live at a new
top-level `sharedRoadmaps/{shareId}` Firebase path (`crypto.randomUUID()` ids) —
deliberately not nested under `users/{uid}`, so the read-only sharing feature never needs a
rule letting one uid read another's data; `firebase/database.rules.json` gives this one path
`".read": true` plus a narrow create-or-owner-delete-only `".write"` (see
`.claude/rules/auth-security.md`). The owner's own published-link index lives at the new
`users/{uid}/meta/shareIds` (string array, same shape as `hiddenTemplateIds`). UI:
`src/ui/components/shareRoadmapModal.js` ("Share this roadmap…", `sidebar.js`'s account
menu) generates/copies/lists/revokes links; `src/ui/pages/sharedRoadmapView.js` renders the
new `#/shared?id=...` route — zero interactive affordances, a clear "this link has been
revoked" state for a missing/revoked `shareId`. `router.js` gained a small wildcard-prefix
match (`registerRoute('/shared*', ...)`) rather than real `:param` support, since this is
the only call site that needs a dynamic segment and the id is carried as a query string on
the hash. See `.claude/rules/roadmap-store.md`'s "Roadmap sharing" section for the full
data-model rationale, and `docs/api.md` for the `sharedRoadmaps/{shareId}` schema.

### 2026-07-13 — PR #TBD — Local push notifications for Daily Todo deadlines, Phase A only (issue #132)

`sw.js` (issue #19's service worker) gains its first `notificationclick` handler,
alongside a new pure `src/services/sw/notificationHelpers.js` module (client-focus/target-
URL logic, unit-tested the same way `cacheStrategies.js` already is). Notifications
themselves are scheduled client-side, not pushed from a server — this app has no backend
compute layer at all (no Cloud Functions, confirmed by `firebase.json`), so a real
"notify even with the app fully closed" push was scoped out as a deliberately deferred
Phase B. `src/core/dailyTodo/reminderScheduling.js` (pure fire-time math) plus
`src/services/reminderScheduler.js` (the stateful `setTimeout`/`Notification`/
`ServiceWorkerRegistration` piece, subscribed to `dailyTodoStore` once at app startup in
`main.js`) reconcile one live timer per active, not-yet-reminded todo on every store
change — completing or deleting a todo cancels its pending reminder. Opt-in only, via a
new bell toggle in `dailyTodoPanel.js`'s heading row that calls
`Notification.requestPermission()` on click (never on load); the resulting boolean is a
new device-level `KEYS.DAILY_TODO_REMINDERS_ENABLED` entry in `localStorageKeys.js`. See
`.claude/rules/roadmap-store.md`'s new "Local 'Remind me' reminders" section for the full
scoping rationale and why Phase B needs its own issue.

### 2026-07-14 — PR #157 (follow-up) — Fixed a real dead-click-zone bug on onboarding.js's template cards

Found while chasing a real, reproducible CI E2E flake on `feat/issue-132-local-push-notifications`
(a template-card click intermittently no-op'd, no console error). Root-caused with a raw
DOM `click` listener: `.template-card`'s own ~20-24px padding around the nested
`.template-card-pick` button has no click handler (deliberate, per issue #6 Phase 9's WCAG
4.1.2 fix) — a click landing there does nothing. That fix's own code comment already said
the outer card "can still have a plain (non-ARIA) `onClick` for mouse convenience," but it
was never implemented. `buildCard()`, `buildCustomCard()`, and `buildCreateCard()` now each
add a fallback `onClick` on the outer card, gated on `e.target === cardEl` so it only fires
for a click landing in the dead padding zone and never double-fires for clicks that bubble
from the button or another child control. Confirmed fixed against the real Firebase Auth/DB
emulator (was ~50% flaky before, 100% pass across 40+ repeated runs after).

### 2026-07-14 — PR #TBD — ICS calendar export for Daily Todos + print/PDF export for a roadmap (issue #133)

Two independent export surfaces added to the account menu (`sidebar.js`), both
client-side only. `src/core/dailyTodo/icsExport.js` (`buildTodosIcs()`) is a pure module
building a valid RFC 5545 `VCALENDAR`/`VEVENT` string for every active Daily Todo —
`DTSTART`/`DTEND` derived from `expiresAt` as a 15-minute block, a stable per-todo `UID`
so re-exporting into the same calendar app updates rather than duplicates, and explicit
line-folding for any `SUMMARY` over 75 octets. `src/ui/utils/printRoadmap.js` builds a
plain `.print-roadmap` DOM snapshot (title/phase/section/topic/priority/done-state/
resource-URLs-as-text, notes excluded unless explicitly opted in) and appends it to
`document.body` just for the duration of `window.print()`, driven entirely by a new
`@media print` block in `app.css` (`body.print-mode` hides everything else) — no new
PDF-generation dependency, per root `CLAUDE.md`'s "no build step, no bundler" constraint.
`exportTodosIcs()`/`triggerRoadmapPrint()` (`src/ui/utils/backupActions.js` and
`printRoadmap.js` respectively) sit alongside the existing `exportBackupJson`/
`exportBackupCsv` helpers for consistency, though neither is a store-level method — both
are pure reads over an existing snapshot.

### 2026-07-14 — PR #161 — Spaced-repetition review reminders, Phase A (issue #134)

New pure module `src/core/roadmap/reviewSchedule.js` (`isReviewDue`/`getReviewDueItems`,
`REVIEW_INTERVAL_DAYS`/`REVIEW_INTERVAL_MS`) computes which completed roadmap topics are
due for review — a fixed 14-day interval, deliberately not a full spaced-repetition
algorithm (no per-item ease factors or growing intervals). One new item field,
`item.lastReviewedAt: number | null`, set only via a new `dashboard.js` "Mark reviewed"
row action (`store.updateItem(id, { lastReviewedAt })`) — needed no `roadmapStore.js`
change, since `updateItem()`'s existing cosmetic-check already treats any non-`done`
patch key as structural. `dashboard.js` gained a sixth filter chip (`'REVIEW'`) and a new
header pill (`.review-due-nav-badge`, `topbar.js`'s actions row, alongside the Daily Todo
countdown badge) showing the due count and jumping to the `REVIEW` filter on click.

### 2026-07-14 — PR #162 — ZeBeyond-inspired visual revamp, replacing the earlier Neura/M3 direction (issue #155)

Presentation-layer-only, scoped to the landing page, auth screens, and the dashboard's
core shell (sidebar/topbar) — settings/progress/modals are a planned fast-follow, not
touched here. Replaces this issue's earlier "Neura-style"/Material Design 3 direction
(app.css elevation/shape/state-layer tokens, `progressRing.js`'s `variant: 'dotted'`
gauge, `chartWrapper.js`'s `--brand-deep` read), which never merged and has been fully
reverted rather than retuned, per an explicit decision to replace rather than extend it
once new reference material (a Dribbble "ZeBeyond" case-study/marketing site) came in.

`app.css`'s dark-theme `--soft`/`--panel`/`--panel-2`/`--surface-3`/`--line`/
`--line-strong` move from a navy-tinted dark to a neutral near-black scale, matching the
reference's page/card backgrounds; the existing mint/teal `--brand`/`--brand-dark` are
kept as-is since they already matched the reference closely. New shared classes:
`.eyebrow` (uppercase kicker label), `.text-gradient-brand` (gradient headline accent
text), `.tag-chip`/`.tag-chip-accent` (two-tone tag-chip pair on the existing chip
box-model scale), `.icon-tile`, `.btn-cta` (a bright pill CTA button scoped to
marketing contexts, not a change to `.btn-primary`), a floating-pill treatment folded
into `.landing-nav` directly, `.icon-btn-group` (groups the topbar's search/
notification/theme-toggle buttons in a bordered pill), and `.bg-grid-glow` (a decorative
diagonal-grid + radial-glow layer behind the landing hero/CTA and the auth marketing
panel, replacing the panel's old solid brand-gradient fill). The sidebar's active nav
item becomes pill-shaped. See `.claude/rules/ui-styling.md`'s "Visual design language"
section for the full token/class reference.

### 2026-07-14 — PR #TBD — Lazy per-route code loading, Phase 1 of network-speed perf (issue #137)

`main.js` previously imported every page module (`signIn.js`/`signUp.js`/`dashboard.js`/
`onboarding.js`/`settings.js`/`progress.js`) statically at the top of the file, evaluated
before the router ever decided which route was active — a signed-out visitor loading the
landing page (`/`) ended up fetching nearly the entire authenticated app's transitive
import graph (`roadmapStore.js`/`dailyTodoStore.js`/`activityLogStore.js`, every storage
adapter, `firebase.js`, all template data, most of `src/ui/components/`) despite never
needing any of it. Those six page modules are now behind a dynamic `import()` resolved
inside each route's registration, the same lazy-load technique `chartWrapper.js` (issue
#8) already uses for Chart.js — `main.js`'s `guardApp()` wrapper became `async` and a new
`lazyGuard(loadModule, renderKey)` helper does `await loadModule()` then calls the
resolved module's named export. No change to `router.js` itself — `startRouter()` already
`await`s whatever a route's render function returns. `landing.js` and
`sharedRoadmapView.js` (the two signed-out-reachable pages) are unchanged/still eager,
since they're each already reasonably self-contained and are exactly the modules a
signed-out visitor does need. A static import-graph count (`main.js`'s own transitively
statically-reachable `.js` file count) confirms the reduction: 116 → 46. `tests/unit/main.test.js`
is new — it mocks every dependency `main.js` imports and confirms a lazy route's dynamic
`import()` resolves to the real render function (not just a stub) and that the previous
route's returned cleanup still runs on navigation, since a dynamic-import-based route that
silently failed to wire up a working cleanup wouldn't be caught by `router.js`'s own tests
(which only ever register plain `vi.fn()` renderers). Phases 2-4 of issue #137 (resource
hints/caching headers, a CI Lighthouse budget, and a network-throttling dimension for
`.claude/skills/verify-changes/`) are tracked separately and not part of this PR.

### 2026-07-14 — PR #TBD — Resource-loading hints and caching headers, Phase 2 of network-speed perf (issue #137)

Two independent, small pieces, both following Phase 1 (lazy per-route loading, above).
(1) `firebase.json`'s hosting `headers` array gains a rule for `/public/**` — the same
`Cache-Control: public, max-age=31536000, immutable` that `/src/**` and `**/*.css`
already had — since `public/`'s icons/`manifest.json`/`og-image.png` are exactly as
content-stable and were previously falling through to Firebase Hosting's own default
caching instead of a deliberate one. (2) `main.js` gained `preloadDashboardModule()`, a
one-shot (idempotent) helper appending a `<link rel="modulepreload" href="…/ui/pages/
dashboard.js">` to `document.head`, called from `authApi.onChange`'s handler at the exact
point it decides to redirect an already-onboarded, just-authenticated user to `/app` —
`dashboard.js` is the single most-visited authenticated route, so Phase 1's "never fetch
it eagerly" tradeoff would otherwise become "always fetch it with a visible extra
round-trip on every sign-in" with no mitigation. A user who bookmarks directly to `/app`
never triggers this call site — that route's own lazy `import()` (Phase 1) is already
the earliest possible fetch, so there's nothing to warm ahead of it there. The existing 3
Firebase-SDK `modulepreload` tags in `index.html` were re-checked against Phase 1's
changes and remain the correct, unchanged set. `tests/unit/main.test.js` gained a second
test asserting the hint is appended exactly once (not duplicated on a second auth-state
resolution, e.g. a token refresh) and only once the redirect condition is actually met.

### 2026-07-14 — PR #TBD — CI performance budget via Lighthouse CI, Phase 3 of network-speed perf, closing out issue #137

New `lighthouse` job in `.github/workflows/ci.yml`, running on every PR alongside
`lint`/`security`/`test-unit`/`test-e2e`: `treosh/lighthouse-ci-action` against a local
`npm run dev` server, targeting `/` (the landing page, signed-out-reachable, Phase 1's
lazy-loading main target). Config lives in new root `lighthouserc.json`
(`collect`/`assert`/`upload` sections, the standard `@lhci/cli` shape the action wraps)
rather than inline in the workflow YAML, so the same config can be run locally
(`npx @lhci/cli autorun`, with a server already running on port 4173) during development
without touching CI. Thresholds — `interactive` ≤ 9000ms, `total-blocking-time` ≤ 600ms,
`resource-summary:script:size` ≤ ~880KB (all three `error`-level, fail the job),
`resource-summary:total:size` ≤ ~1.1MB (`warn`-level) and `categories:performance` ≥ 0.5
— were derived from a real Lighthouse run against the post-Phase-1/2 landing page (6.0s
TTI, 0ms TBT, 637KB script weight, 0.65 performance score, default Lighthouse
mobile-simulated throttling), each with headroom added for CI-runner variance, per the
issue's explicit instruction to set initial thresholds from a real measurement rather
than an arbitrary number. `upload.target: temporary-public-storage` gives each run a
shareable report URL in the job log without needing a hosted LHCI server. This job is
**not yet a required check** in GitHub branch protection — unlike `test-unit`/`test-e2e`
(issue #30's precedent the issue asked this job to follow), flipping that on is a
repo-settings change outside this PR's diff and is called out separately for the repo
owner to action once this job's own results look stable across a few real PRs.

**The sign-in page (`/#/signin`) is a known, deliberate gap, not silently dropped.** The
issue's own scope asked for both signed-out-reachable pages. `/#/signin` consistently
failed Lighthouse's `NO_FCP` ("page did not paint any content") check in this exact CI
environment across multiple independent fix attempts — a Chromium-binary mismatch fix
(pinning `CHROME_PATH` to the same `playwright install --with-deps chromium` binary
`test-e2e` already verifies works reliably here), a navigation-timeout-headroom fix
(`maxWaitForFcp`/`maxWaitForLoad` raised from Lighthouse's defaults to 60s/90s), and a
dev-server-isolation fix (a dedicated `python3 -m http.server` per URL, ruling out
single-threaded-server connection contention between back-to-back runs) — none changed
the outcome: `/` passes reliably and quickly (~12-13s) on every run, while `/#/signin`
never once painted, consistently timing out right at whatever ceiling was configured.
`/#/signin` renders correctly, quickly, and repeatably in every local test (direct
`lighthouse` CLI, `@lhci/cli autorun`, individually and back-to-back with `/`), which
rules out an actual app bug in the sign-in page or its dynamic-import path (issue #137
Phase 1) — the failure is specific to Lighthouse's default "navigation" mode driving a
**first-ever, hash-fragment-only URL** in this particular CI browser/environment
combination. The most likely real fix — not yet attempted, tracked in issue #168 — is an
LHCI `puppeteerScript`/user-flow that navigates to `/` first (a URL Lighthouse already
handles fine here) and then triggers the in-app hash-route change client-side, rather
than asking Lighthouse to `page.goto()` a hash URL as the very first navigation in a
fresh browser context. Shipping `/`-only now rather than continuing to iterate blind on
CI-only failures with no new local repro to work from.

### 2026-07-14 — PR #TBD — CSP fix for Firebase Auth's internal script load, issue #137 Lighthouse follow-up (issue #168)

`index.html`'s CSP `script-src` gained `https://apis.google.com`, fixing a console error
(and Lighthouse `errors-in-console`/`inspector-issues` score-0 findings) present on every
page load: the Firebase Auth SDK internally loads `https://apis.google.com/js/api.js` as
part of its own cross-tab auth-state/iframe persistence machinery, regardless of whether
the app calls any Google-OAuth-specific API (this app only uses email/password +
anonymous auth). Same named-host allowlist pattern already used for `gstatic.com`/
`cdn.jsdelivr.net` — see `docs/adr/ADR-002-csp-sri-security.md`'s new "`apis.google.com`
allowlist entry" section. No source module changed. Also recorded, decision-only, the
unminified/unused-CSS-JS Lighthouse findings from the same run as a known, accepted cost
of the no-bundler architecture decision — see section 2's stack table above; no bundler
or minification was implemented.

A real `npx lighthouse` re-run (not just a manual DevTools console spot-check) against
the fixed page found the `script-src` allowlist entry alone was insufficient: once the
`apis.google.com` script actually executes, it opens a hidden cross-tab auth-state iframe
against the Firebase project's own `<project-id>.firebaseapp.com` domain, which
`default-src 'self'` was blocking (no `frame-src` had been set). Added
`frame-src https://*.firebaseapp.com` (wildcarded per-project, matching the existing
`https://*.firebaseio.com` pattern in `connect-src`) — verified `inspector-issues` moves
from score 0 to score 1 (clean) after this second directive. `errors-in-console` still
reports the pre-existing, already-documented `frame-ancestors`-in-`<meta>`-tag notice
(issue #168's own "noted, not actioned" finding, a browser-spec limitation, not a
regression from this change).

### 2026-07-14 — PR #TBD — Design token retune, Phase A of issue #155's v2 redefinition (lime/near-black direction)

Issue #155's ZeBeyond pass (PR #162, entry above) shipped and closed, then was reopened
same-day with new reference material scoped to a 5-phase, whole-app pass. This is Phase
A: token layer only, `src/styles/app.css`'s `:root[data-theme='dark']` block. Two
changes: (1) the near-black scale tightened one more step
(`--soft`/`--panel`/`--panel-2`/`--surface-3`/`--line`/`--line-strong`, plus the
derived `--emphasis-text`/`--surface-glass`/`--border-glass`) to the reference's exact
`#080808` base; (2) a new parallel `--accent-lime`/`--accent-lime-dark`/
`--accent-lime-light`/`--accent-lime-light-border` token family was added rather than
retuning `--brand`/`--brand-dark` in place, since `--brand-dark` alone is read by ~20
call sites outside this pass's current scope (Phase D territory) and at least one
(`.toast-success`'s white-on-solid-fill) would break contrast if it became lime. No
component wired to the new tokens yet — that's Phase B onward. Every value
live-verified for WCAG contrast; full writeup and the retune-vs-parallel-family
decision rationale in `.claude/rules/ui-styling.md`'s "Visual design language v2"
section.

### 2026-07-14 — PR #TBD — New shared component classes, Phase B of issue #155's v2 redefinition (lime/near-black direction)

Phase B: `.kpi-tile`/`.kpi-tile-hero`/`.card-arrow-badge`/`.filter-chip-counted` added
to `src/styles/app.css`, and `chartWrapper.js` gained `createBucketedBarChart()`/
`createChartLegend()`. Built and visually verified in isolation (a throwaway,
uncommitted local HTML harness importing the real `app.css` + `dom.js`/`icons.js`/
`chartWrapper.js`, screenshotted in both themes) — no page consumes any of it yet,
that's Phase C/D. `.kpi-tile` is a deliberately new name, not `.stat-tile` (the issue's
own bullet name for it), since `.stat-tile` already exists as a different,
in-production dashboard component (issue #6 Phase 4.1) and reusing the name would have
collided with it rather than extended it. The bucketed-bar-chart tooltip is portaled to
`document.body`, matching `select.js`/`dropdown.js`'s established floating-element
convention — an earlier version appended it as a sibling of the `<canvas>` instead and
positioned it with viewport-relative coordinates against a non-document positioning
ancestor, visibly mispositioning it; caught and fixed during this phase's own isolated
visual verification, before any page could have inherited the bug. `chart.destroy()`
is wrapped to also remove the portaled tooltip node so the existing `chart?.destroy()`
call-site pattern (`progress.js`) stays leak-free with no caller change required. Full
class/function list and reasoning in `.claude/rules/ui-styling.md`'s "Visual design
language v2" section.

### 2026-07-14 — PR #TBD — Landing/auth/shell recolor, Phase C of issue #155's v2 redefinition (lime/near-black direction)

Phase C: swapped the ZeBeyond mint-based classes on `landing.js`, `authMarketingPanel.js`,
and `sidebar.js` (`.eyebrow`, `.text-gradient-brand`, `.tag-chip-accent`, `.icon-tile`,
`.btn-cta`, `.feature-card-icon`, `.step-card-icon`, `.landing-proof-text`,
`.nav-item.active`) over to Phase A's `--accent-lime` token family, scoped to
`:root[data-theme='dark']` only — no structural/markup change, colors only, light theme
unchanged. `.auth-marketing-eyebrow`'s fixed literal moved from ZeBeyond's `#5eead4` to
`#f0f941` unconditionally, since that panel is always-dark regardless of site theme.
Visually verified in both themes against a real dev server (landing full-page, sign-in)
— screenshots in the PR. No page outside this scope touched; Settings/Progress/modals
remain Phase D's job.

### 2026-07-14 — PR #TBD — Progress page stat strip on the new KPI tile component, Phase D1 of issue #155's v2 redefinition (lime/near-black direction)

Phase D1: `progress.js`'s `renderStatTile()`/`renderStatCards()` rebuilt on Phase B's
`.kpi-tile`/`.kpi-tile-hero` component in place of the older `.stat-tile` row —
`dashboard.js`'s own `.stat-tile` strip is a different page/component and untouched.
"Items complete" is the hero-highlighted tile. New CSS: `.kpi-tile-total` (inline
caption after the number) and `.mini-bar-fill`/`.mini-bar-track` overrides scoped to
`.kpi-tile-hero` so the existing progress-bar SVG reads correctly against a solid
accent fill. `tests/unit/progress.test.js`'s stat-tile-count assertion updated to match
(`.kpi-tile`/`.kpi-tile-hero` selectors). Visually verified against a real dev server +
guest session in both themes. Deliberately scoped to only this one stat strip — the
issue's Phase D also names `settings.js` and ~12 modals, which are large enough to
warrant a separate Phase D2 rather than one oversized PR; tracker issue #11 reflects
this split.

### 2026-07-14 — PR #TBD — Settings page recolor, Phase D2 of issue #155's v2 redefinition (lime/near-black direction)

Phase D2: `.settings-verified` (`app.css`) — the sole accent-colored class unique to
`settings.js` — recolored to `--accent-lime-dark` in dark theme, falling back to mint
in light theme, same scoped-override pattern Phase C used. No other change needed on
this page (its cards/rows already read Phase A's near-black scale via tokens; every
other class is neutral gray/ink). Deliberately scoped to just this one class — the
~12 modals the issue's Phase D also names are tracked as a further Phase D3, not this
PR; tracker issue #11 reflects the split.

### 2026-07-15 — PR #TBD — First modal recolors (importRoadmapModal + feedbackModal), Phase D3 part 1 of issue #155's v2 redefinition (lime/near-black direction)

Phase D3 part 1: `.import-step-badge` (`importRoadmapModal.js`'s numbered step circles)
and `.feedback-type-card`/`.feedback-reference` (`feedbackModal.js`) recolored to Phase
A's `--accent-lime` family in dark theme, mint fallback in light. `.import-step-badge`
required swapping its text color alongside its fill (`var(--soft)`, not the base rule's
fixed white) since white-on-lime fails contrast — the only one of the three needing
that treatment, since the other two are border/outline-only recolors with no
text-contrast implication. Picked by grepping every modal for actual `--brand`-colored
elements first — most modals in this app are neutral gray/ink with nothing to recolor.
The remaining ~10 modals are tracked as further Phase D3 PRs; tracker issue #11
reflects the split.

### 2026-07-15 — PR #TBD — Full completion: remaining Phase D3 recolors + Phase E verification, issue #155's v2 redefinition (lime/near-black direction) fully shipped

Closes out issue #155 v2 in full. Recolored every remaining `--brand`-family selector
app-wide (~45 across every page/modal/shared component) to Phase A's `--accent-lime`
family in dark theme — two patterns throughout: a straight border/outline/text swap
for anything with no text-contrast implication, and a fill+text swap (near-black text,
not white) for every fixed-white-on-solid-brand badge/icon, including
`.check-item.done .check-box` (the app's single most-used interactive element) and
`.toast-success` (the exact call site Phase A's own comment named as the reason not to
retune `--brand-dark` globally — handled here as a scoped override instead). `--focus`
(the app-wide translucent focus-ring glow) was retuned directly rather than
per-selector, since it's purely decorative and never hosts text. `.brand`/`.brand-mark`
(the product logo) deliberately stay untouched — product identity, not an accent, same
as every earlier phase. Full reasoning and the complete selector list in
`.claude/rules/ui-styling.md`'s "Visual design language v2" section.

Phase E: `tests/e2e/accessibility.test.js`'s full suite re-run against a real Firebase
emulator (`npx firebase emulators:start --only auth,database --project demo-ascent` +
`FIREBASE_CONFIGURED=1`), not just guest-session-limited local checks — 16/16
accessibility tests passing, both themes, every page/modal the suite covers. Surfaced
and fixed 6 pre-existing axe sampler false positives in `CONTRAST_FALSE_POSITIVE_
SELECTORS` (`.resource-count`, `.btn-ghost`, `.field-label`, `.priority-tag`,
`.section-label`, `.kpi-tile`/`.kpi-tile-hero`/`.kpi-tile-label`), none caused by this
design pass — each is live-verified in the file's own code comments. Full E2E suite
(103 tests): 100 passed, 2 passed on retry (pre-existing flakes, issue #141), one
(`roadmapSharingRules.test.js`) failed consistently but is a Firebase security-rules
test unrelated to this diff (confirmed via `git diff` — `firebase/database.rules.json`
untouched). Responsive spot-check at 375/768/1024/1440px (dark theme) confirmed no
layout regression, expected since this entire pass (Phases A–E) never touched a layout
property, only color values.

### 2026-07-15 — PR #TBD — Branded, restyled printed/PDF roadmap export (issue #160)

Restyle of an existing module (`src/ui/utils/printRoadmap.js`, `app.css`'s `@media
print` block), not a new one — issue #133's plain black-on-white print output now
mirrors the on-screen phase/priority visual language and carries the Ascent brand.
Blocked on issue #155 on purpose (per that issue's own note) so this only had to
target #155's final color/card/badge token set once, not twice.

Phase colored left-border accents and priority pill badges (`.print-phase-P0`-`P3`,
`.print-priority-badge`) reuse the *light-theme* `--p0`-`--p3` hex values as fixed
print-safe literals, never a theme-token read — a printed page is always white paper
regardless of the app's active on-screen theme (issue #133's original rule, carried
forward). Section headings became uppercase/letter-spaced/bordered instead of a plain
`<h3>`. A repeating branded header (`createBrandMark()` logo/wordmark + tagline) and
footer ("Generated by ascent-app.com") were added via `position: fixed` elements
inside `.print-roadmap` — confirmed empirically (not assumed) to repeat on every
physical page via a real Chromium `page.pdf()` render of a 47-page, 19-phase, 484-item
roadmap (brand text present on the first, middle, and last page). See
`.claude/rules/ui-styling.md`'s new "Branded print/PDF export" section for the full
technique writeup and why a `position: fixed` header/footer was chosen over a CSS
`@page` margin box. No change to what data is printed, or the existing "Include
notes" default-off opt-in (issue #133) — this is a pure visual/branding restyle.

### 2026-07-15 — Issue #135 — Monetization model decision document

Docs-only change, no code. Added `docs/monetization-decision.md`, promoted from
issue #126 item 4, enumerating realistic pricing models (free forever, freemium,
one-time purchase, subscription) and what each implies given Ascent's current
no-backend-compute architecture. Recommends one-time purchase over subscription
if monetization is ever pursued, since Ascent has already declined a backend
commitment once before (Google Drive sign-in, #5/#71) and any freemium/subscription
tier requires webhook-receiving server-side compute this app doesn't have today.
No decision is finalized — this only ensures the open question is tracked with an
artifact instead of silently deferred. Added an "Open product decisions" pointer
section above so this isn't the only place the question is recorded.

### 2026-07-15 — Issue #180 — Lightweight time tracking per topic / Daily Todo

New pure module `src/core/time/timeTracking.js` (`computeElapsedSeconds`/
`accumulateElapsed`/`formatTimeSpent`, no DOM/store access) backs a start/pause timer
control added to `itemPanel.js` (roadmap topics) and `dailyTodoPanel.js` (Daily Todos).
Both persist a new `timeSpentSeconds: number` item/todo field through the exact same
per-item patch mechanism every other field already uses — `roadmapStore.updateItem()`
(via `itemPanel.js`'s existing `onSave`) for topics, and a new dedicated
`dailyTodoStore.addTimeSpent(id, seconds)` adder for todos, since a running timer only
ever wants to add elapsed seconds, never overwrite the total. No new storage backend or
Firebase schema change beyond the one new field. A running timer's session start is
deliberately local-only UI state (never synced live across devices), matching Daily
Todos' own device-local live-countdown precedent — only the stopped, accumulated result
syncs. `/progress` gained a 5th stat tile summing time across the active roadmap and
every Daily Todo. See `.claude/rules/roadmap-store.md`'s "Lightweight time tracking"
section for the full design writeup.

### 2026-07-16 — Issue #181 — Phase/roadmap completion celebration + badge share-card variant

New pure module `src/core/roadmap/completionCelebration.js` (`isRoadmapComplete`/
`getCompletedPhaseTitles`, no DOM/store access) detects when a phase or the whole
roadmap has just reached 100%, reusing `analyticsEngine.js`'s existing
`computeOverview`/`computePhaseBreakdown` rather than duplicating `dashboard.js`'s own
filtered progress math. New `src/services/celebrationShownStore.js` wraps a device-local
localStorage flag (`celebrationShownKey(uid)`, `localStorageKeys.js`) so a phase/roadmap
only ever celebrates once. `dashboard.js`'s existing `render()`/`patchDoneStates()` hooks
call into this on every snapshot — no new store field, no new subscription. New
`src/ui/components/confetti.js` (`triggerConfetti()`) is a CSS-only, self-removing,
`prefers-reduced-motion`-aware full-viewport flourish. `shareCard.js` gained a
`generateBadgeCard(kind, label, now?)` sibling to `generateShareCard()`, and
`shareModal.js` was refactored to share its Download/Copy/Share modal chrome between
`openShareModal()` (existing) and a new `openBadgeShareModal(kind, label)`, which the
celebration opens automatically. See `.claude/rules/roadmap-store.md`'s "Phase/roadmap
completion celebration" section and `.claude/rules/ui-styling.md`'s "fixed-overlay,
self-removing CSS animation burst" section for the full design writeup.

### 2026-07-16 — Issue #122 — Server-side data caps for Firebase database rules

`firebase/database.rules.json` previously enforced almost none of this app's own
client-side data caps server-side — a roadmap item's title/notes/resource fields had no
`.validate` rule at all, `meta.customRoadmaps` had no length or array-size cap, and
`activityLog`/`reports.screenshotB64` were similarly unbounded, meaning a raw REST write
against a user's own uid-scoped path could bypass every cap the app's own UI enforces.
Added matching `.validate` rules: `items/{itemId}.title`/`.notes`/`.resources.{i}.label`/
`.url` under both `roadmap` and `roadmaps/{templateId}`; `meta.customRoadmaps.{index}`'s
`title`/`description` plus an array-size cap via the same `$index.matches(...)`
index-whitelist idiom `favoriteRoadmapIds` (issue #177) already established (RTDB rules
still can't reliably call `numChildren()`); `activityLog.$date` key-shape + value-range
validation; and a size cap on the top-level `reports/{reportId}.screenshotB64`. Two caps
remain deliberately client-side only (a per-roadmap item count, and feedback-report rate
limiting) — Realtime Database rules structurally cannot express either without a Cloud
Function. New `src/core/roadmap/limits.js` constants (`MAX_CUSTOM_ROADMAP_TITLE_LENGTH`/
`MAX_CUSTOM_ROADMAP_DESCRIPTION_LENGTH`) back a clamp (not reject) in
`roadmapStore.js`'s `createCustomRoadmap()`, so a legitimate write can never exceed its
own new server-side cap. New `tests/e2e/dataCapRules.test.js` rules-emulator suite
(same pattern as `roadmapSharingRules.test.js`) asserts each cap actually rejects an
oversized write and still accepts a compliant one — verified against a real local
Firebase emulator during development, not just assumed to parse (a `.validate` rule that
fails to parse silently serves the emulator's permissive default for the *entire*
namespace, the same trap `favoriteRoadmapIds`' rule already found and documented). See
`.claude/rules/auth-security.md`'s "Server-side data caps" section for the full
per-field cap list and reasoning.

### 2026-07-16 — Issue #127 — SEO & social-preview baseline

Two new files, `robots.txt` and `sitemap.xml`, live at the actual repo/hosting root
(sibling to `index.html`), **not** under `public/` — despite `public/` holding every
other static asset (`favicon.svg`, `og-image.png`, `manifest.json`, etc.), this repo's
`firebase.json` sets `"public": "."`, meaning the whole repo root is the Hosting root
and `public/` is just an ordinary subdirectory within it, served at `/public/*`. A
crawler only ever checks `/robots.txt` at the true domain root, so putting it under
`/public/robots.txt` would have silently made it undiscoverable — confirmed by serving
both locally and checking they resolve at `/robots.txt`/`/sitemap.xml`, not
`/public/robots.txt`. `index.html` gained `twitter:card`/`twitter:title`/
`twitter:description`/`twitter:image` meta tags and a `WebApplication` JSON-LD
`<script type="application/ld+json">` block — verified live (real browser load) to
produce zero CSP `script-src` violations, since a non-executable script `type` is
exempt from that directive. No `firebase.json` header change was needed: since these
two files sit at the root rather than under `/public/**`, they never match that
directory's `immutable, max-age=31536000` caching rule and fall through to the
generic `**` block's default (non-immutable) caching, which is exactly what a
domain/sitemap-content-can-change file needs.

### 2026-07-16 — Issue #210 — Graphify local knowledge graph for AI-assistant context

Adopted [Graphify](https://github.com/Graphify-Labs/graphify) (`uv tool install graphifyy`)
to build a queryable code graph of the repo — 1427 nodes / 3122 edges / 124 communities —
so future AI sessions can run `graphify query "<question>"` against `graphify-out/graph.json`
instead of re-reading files from scratch. `graphify-out/graph.html`, `GRAPH_REPORT.md`,
`graph.json`, and `manifest.json` are committed; `cost.json`, the extraction `cache/` dir,
and the machine-specific `.graphify_python`/`.graphify_root` interpreter/path files are
gitignored (per Graphify's own recommendation plus this repo's own no-machine-specifics
convention). `docs/screenshots/`, `.playwright-mcp/`, and root-level `*.png` are excluded
via `.graphifyignore` — historical per-issue bug screenshots don't represent architecture
and would have cost ~124 extra vision-extraction subagent dispatches for no graph value.
`graphify install --project` also auto-registered `.claude/settings.json` `PreToolUse`
hooks that nudge Claude Code toward `graphify query` instead of raw `grep`/`Read` on
source files when a graph exists — verified against the installed package's own source
(`graphify/cli.py`'s `_run_hook_guard`) to be a local-only, fail-open text nudge with no
network calls or tool-blocking; that file is already gitignored (`.claude/settings.json`,
"machine-specific, not a repo convention") so the hook doesn't propagate to other clones.
Regenerate the graph with `graphify update .` after significant code changes, or re-run
the full `/graphify .` pipeline for a from-scratch rebuild.

### 2026-07-16 — Issue #130 — Daily Realtime Database backup workflow

Added `.github/workflows/db-backup.yml`, a new scheduled GitHub Actions workflow (daily
cron + `workflow_dispatch`) that exports the entire Firebase Realtime Database via
`firebase database:get /`. Closes the operational gap where the only existing backup
path was issue #18's user-initiated, per-user export — there was no operator-side
recovery mechanism for accidental rules deploys, compromised credentials, or platform
incidents. Reuses the existing deploy service-account secret rather than
provisioning a second one (see §6a for the reasoning). Because this repo is public,
the export is AES-256 encrypted with a new `BACKUP_ENCRYPTION_KEY` secret before being
uploaded as a build artifact — an earlier plaintext-artifact version of this workflow
was caught and revised before merge, since GitHub Actions artifacts on a public repo
are downloadable by anyone with read access and the export contains every user's data.
See §6a "Database backup & disaster recovery" for the full retention policy and
decrypt-then-restore procedure.

### 2026-07-16 — Graphify auto-update workflow

Added `.github/workflows/graph-update.yml` so the committed knowledge graph
(`graphify-out/`, issue #210) never goes stale between manual `graphify update .`
runs — it fires on every push to `main`, re-extracts (AST-only, no LLM/API key, since
this repo is code-only) and, if the graph changed, opens a PR with the updated
`graph.json`/`graph.html`/`GRAPH_REPORT.md`/`manifest.json`/`wiki/` files rather than
pushing straight to `main`. The direct-push design was the first draft and was
rejected before merge: an unattended job with `contents: write` running an unpinned
third-party package (`graphifyy` from PyPI) and pushing its own output straight to
`main` with no review is a real supply-chain exposure, not a hypothetical one — if
that package were ever compromised upstream, the workflow would be a standing,
privileged execution path. Fixed by pinning `graphifyy==0.9.17` (bump deliberately,
not via `--upgrade`) and using `peter-evans/create-pull-request` to route every graph
update through a normal, reviewable PR instead.

### 2026-07-17 — Custom roadmap lost-update race + save-retry hardening (issue #153)

Fixed a critical, reported data-loss bug: two overlapping `switchRoadmap()`/
`createCustomRoadmap()`/`deleteCustomRoadmap()` calls (e.g. importing two custom
roadmaps within a few seconds) could each compute the array to persist to
`meta.startedTemplateIds` from the same stale snapshot before either had reassigned
it — whichever call's whole-array Firebase write landed last silently erased the
other's id, which then caused that roadmap to re-seed empty and get overwritten with
nothing on its next save. Fixed with `roadmapStore.js`'s new `serializeMetaMutation()`
— a single in-module promise queue every array-field mutation (`startedTemplateIds`/
`customRoadmaps`/`favoriteRoadmapIds`) is now chained behind, so a later mutation
always computes from every previously-queued mutation's already-applied result,
sidestepping the "which write lands on Firebase last" race entirely rather than
trying to win it. Three related fixes shipped in the same PR: `flush()` no longer
reads the shared `items`/`templatePhases`/`activeTemplateId` again after its own
network write settles (which could stamp a different, newly-active template's data
into the wrong template's `roadmapCache` slot if a `switchRoadmap()` completed mid-
flight); a failed save is now automatically retried with exponential backoff
(`scheduleSaveRetry()`) instead of failing once and never retrying, backing the
dashboard save badge's "retrying…" copy with an actual retry and a manual "Retry now"
button; and `onboarding.js` now subscribes to live store updates (`dashboard.js`/
`progress.js` already did) instead of reading the store once and never re-rendering.
Also closed a related process gap: `firebase/database.rules.json` used to be manual-
deploy-only (`.github/workflows/deploy.yml` deployed hosting only) — it now deploys
automatically on every push to `main`, alongside hosting, so the live rules can no
longer silently drift from the repo with no CI signal. See
`.claude/rules/roadmap-store.md` for the full technical writeup and
`tests/integration/roadmapStore.test.js` for the regression tests (verified to fail
against the pre-fix code).

### 2026-07-17 — PR #217 — CI enforcement of sw.js CACHE_VERSION + shorter static-asset cache lifetime (issue #185)

This app has no build step and no content-hashed filenames (a deliberate, repeatedly-
revisited decision — see issue #137's own "Out of scope" section), so `firebase.json`'s
static-asset `Cache-Control` headers were the only lever available, and `sw.js`'s
`CACHE_VERSION` constant (bumped manually by whoever writes a PR) was the only thing
invalidating the service worker's own `cacheFirst` runtime cache of those same paths.
Nothing enforced that bump: a PR could change `src/**` without touching `sw.js`, pass
CI, and merge — a returning visitor's browser HTTP cache and service-worker cache would
then both keep serving the old JS/CSS for up to the full `max-age`, paired against a
freshly-deployed `index.html` (always `no-cache`), producing a silent HTML/JS
module-graph mismatch. Fixed with the combination the issue itself flagged as
preferred, rather than picking just one:
- **`.github/workflows/ci.yml`'s `pr-checklist` job** gained a new step, following the
  exact pattern of its existing `CHANGELOG.md`/`docs/architecture.md` diff checks: fails
  a PR that touches `src/**` if `sw.js` has no diff on its `const CACHE_VERSION` line.
  Real enforcement, and it keeps the perf win from #137's caching work intact — no
  reliance on the PR author remembering to test after the bump.
- **`firebase.json`'s `/src/**` and `**/*.css` headers** changed from
  `public, max-age=31536000, immutable` to `public, max-age=86400, must-revalidate` —
  a same-day safety net. Even if the `CACHE_VERSION` check were ever bypassed or a
  non-PR path pushed a change, a browser's plain HTTP cache (independent of the service
  worker) now only serves stale static assets for at most a day, not a year. `/public/**`
  (fonts/icons/manifest — genuinely immutable, versionless static binaries this repo
  doesn't rename) keeps its original 1-year `immutable` value; this is scoped to the
  actually-changing `/src/**` and CSS paths.

No change to `sw.js`'s own bump convention or `cacheStrategies.js` — this closes the
enforcement gap around the convention that already existed (issue #19), it doesn't
replace it.

### 2026-07-17 — PR #221 (pending) — "Alpenglow" visual redesign, PR 1 of 2: token layer + component restyle (issue #206)

Full-replace of `app.css`'s `:root`/`:root[data-theme='dark']` token layer with the
"Alpenglow" gold→rose gradient identity, superseding (not extending) issue #155's
"lime/near-black" direction — the same supersession pattern #155 itself used against its
own ZeBeyond predecessor (see `.claude/rules/ui-styling.md`'s design-language history).
Unlike #155's incremental phased rollout (which kept old token names live via aliases
while re-valuing them in place), this pass renamed every token to the issue's exact
spec'd names (`--color-text`, `--space-6`, `--radius-md`, etc.) and mechanically
updated every call site across the file in the same PR — a deliberate scope decision
made with the user mid-implementation after an initial parallel-namespace approach was
rejected as leaving permanent `-ag`-suffixed names in production CSS. The full
old-token → new-token mapping (`--ink` → `--color-text`, `--accent-lime`/`--brand`/
`--brand-dark` all converging on `--color-brand-gold` since Alpenglow has only two
brand hues, `--accent-2`'s old "AI-assisted" violet collapsing into `--color-brand-rose`
per an explicit user decision, etc.) is documented in `.claude/rules/ui-styling.md`'s
new Alpenglow section, including every case flagged as an imprecise/ambiguous mapping
rather than silently guessed.

Every component category the issue's §3 named was restyled against the new tokens:
buttons (`.btn-primary`'s filled-gold hover-lift + shadow, `:focus-visible`-only focus
rings), cards (hover-lift scoped to genuinely clickable cards only — removed from
`.phase-card`/`.stat-tile`, kept on `.template-card`; the active-roadmap card's
`border-image: var(--gradient-alpenglow) 1` top-only accent via zero-width side slices),
checklist rows (`.check-box`'s checked state moved from a gold to a `--color-success`
fill), form fields (focus glow via `color-mix(in srgb, var(--color-brand-gold) 20%,
transparent)`, matching the file's existing opacity-token idiom), modals (the one
deliberate fixed-value overlay scrim, per `scripts/lint-theme.mjs`'s intentional-comment
convention), badges/chips (priority pills moved from a flat saturated fill to a 15%-tint
background + full-opacity text via `color-mix()`), the nav sidebar (left-edge
`inset box-shadow` accent bar replacing the old flat-fill active state — zero layout
shift) and toasts (`border-left` accent bar by type, plus a shape change from a 999px
pill to `--radius-md` since a pill doesn't suit a straight edge bar). Empty states
(Progress page, dashboard's no-matching-filter state, `itemPanel.js`'s "no resources
yet") got action-oriented copy per `.claude/rules/content-style.md` plus a small
`var(--gradient-alpenglow)` accent dot — never a full-bleed fill, per the issue's "rare
to stay meaningful" rule. The Progress page's circular "Complete" stat ring and
`brand.js`'s `createBrandIcon()` (previously a fixed teal/cyan fill, explicitly
untouched by every prior #155 phase as "product identity, not an accent") both now
render `var(--gradient-alpenglow)` as an inline SVG `<linearGradient>` stroke — the one
deliberate exception to that precedent, made explicitly by this issue's §7.

Caught and fixed during a final review pass (post-mechanical-rename artifacts, not
present in the issue spec itself): `chartWrapper.js`'s bucketed-bar-chart and line/bar
chart color helpers were still reading the now-deleted `--accent-lime`/`--muted`/
`--line`/`--brand` token names via `cssVar()`, which would have silently fallen through
to hardcoded stale-lime/teal literal fallbacks forever (the token rename made these
`getComputedStyle` lookups return empty, not an error) — repointed to the new token
names plus updated fallback literals, with `tests/unit/chartWrapper.test.js`'s two
token-name-asserting tests updated to match. `.text-gradient-brand` (landing hero
headline accent) was similarly still hand-mixing the new gold token with an orphaned
`--brand-cyan` remnant in its light-theme rule and had gone flat gold-to-gold in its
dark-theme override — simplified to read `var(--gradient-alpenglow)` directly in both
themes, and the now-fully-unused `--brand-cyan` token definition was removed.

Icon replacement (§4), the card-action overflow menu (§4.1), and the motion system (§5)
are out of scope for this PR by the issue's own explicit two-PR split — PR 2 depends on
this PR's token layer landing first and is tracked separately.

### 2026-07-19 — Issue #211 — OS-agnostic local dev setup

`npm run dev`/`npm start` shelled out directly to `python3 -m http.server 4173`,
assuming a macOS/Linux dev machine with Python 3 pre-installed under the exact
`python3` command name. This broke `npm run dev` outright on any Windows machine
without Python installed, and even where Python is present, Windows commonly exposes
it as `python`/the `py` launcher rather than `python3` — a portability gap in the one
command every contributor runs first. Replaced with `scripts/dev-server.mjs`, a small
zero-dependency Node `http`/`fs`-based static file server (path traversal guarded via
`path.normalize()` + a root-prefix check), so `npm run dev` needs nothing beyond the
Node/npm already required for `npm test`/`npm run lint` and behaves identically on
every OS. Audited `scripts/generate-brand-assets.mjs`, `lint-icons.mjs`, and
`lint-theme.mjs` for the same class of OS-specific assumption — all three already use
`path.join`/`path.resolve` exclusively and contain no Unix-only shell built-ins, so no
changes were needed there. `README.md`'s "Getting started" now gives an explicit
Windows (PowerShell) alternative for the one step (`cp` → `Copy-Item`) that genuinely
differs by OS; every other step, including the dev server itself, is now identical
across platforms.

### 2026-07-19 — PR #231 — Removed Lighthouse CI job, moved to a manual local check

The `lighthouse` job (added issue #137 Phase 3, see the 2026-07-14 entries above)
continued to fail intermittently with `NO_FCP` ("the page did not paint any content")
on PR #231, despite that Phase 3 work already landing three independent, evidence-based
mitigations: a real Playwright Chromium binary (ruling out `@lhci/cli`'s own bundled
launcher), a real static server (`npx serve`, ruling out `python3 -m http.server` as a
bottleneck), and a 3-attempt retry loop. A fourth attempt on PR #231 itself — adding
`--disable-setuid-sandbox --no-zygote` to `lighthouserc.json`'s `chromeFlags`, both
documented mitigations for headless Chrome under containerized CI — also failed to
reproduce a clean run. With every concrete, checkable cause already eliminated across
four separate attempts, this reads as an inherent property of running headless Chrome
on GitHub Actions' shared runners, not something fixable from this repo's CI config —
and the job was never a required status check for merging in the first place (`main`'s
branch protection only requires ESLint/Secret scan/Unit & integration tests/PR
description check/E2E tests). Removed the `lighthouse` job from `ci.yml` entirely
rather than leave a permanently-red, non-blocking check in every PR's check list.
`lighthouserc.json`'s assertions are unchanged and unaffected — running it is now a
manual step, documented in `CLAUDE.md`'s "Verifying changes" section and
`CONTRIBUTING.md`, and is expected to run cleanly locally (no reported local failures
of this check, only in CI).

### 2026-07-19 — Issue #17 — First-time feature tour

Added `src/ui/components/featureTour.js` — a one-time, sequential spotlight
walkthrough of the dashboard, gated behind a new `tourDone` field on `roadmapStore.js`
(resolved the same remote-then-local way `onboardingDone` already is, not the array
precedent `hiddenTemplateIds`/`favoriteRoadmapIds` use — see `.claude/rules/
roadmap-store.md`'s "First-time feature tour" entry for the full contract, backfill
rule, and why `resetTour()` is deliberately in-memory-only). The original 2026-era spec
targeted a `.header-top` action row and a `.progress-card` dashboard widget that no
longer exist — every spotlight target was re-mapped against the current DOM before
implementation (`.phase-card`, `.check-item`/`.resource-count`, the sidebar's Progress
and My Roadmaps nav items, the top bar's theme toggle) and a 6th step (the already-wired
Ctrl/Cmd+K command palette) was added as a natural capstone. The spotlight/ring/popover
implementation reuses two existing conventions rather than inventing new ones —
`attachFocusTrap()` (`modal.js`) per step, and this app's "every floating/positioned
element is a portal" rule — see `.claude/rules/ui-styling.md`'s `featureTour.js` entry
for the box-shadow-as-spotlight technique and the new `z-index: 1100+` tier (above every
other floating element in the app, since the tour can be re-triggered mid-session over
an already-open modal). `dashboard.js` starts it once, only when
`onboardingDone === true && tourDone === false`; a "Take a tour" item in the sidebar's
account menu (dashboard's own instance only — every spotlight target is dashboard-only)
replays it anytime via `store.resetTour()`.

### 2026-07-19 — Issue #239 — Corrected stale "current product stage" narrative

§1's "Current product stage" line still read "Phase 0 complete, working through
Phase 1" — accurate when first written but never updated since, even as the project
went on to finish Phases 1–3 and reach the final stretch of Phase 4 (Launch). Found
during a pre-launch audit cross-referencing this doc, `README.md`, and
`docs/roadmap.md` against the master tracker (issue #11), which had itself stayed
current the whole time. Rewrote §1 to state the actual stage (feature-complete through
Step 7, Step 8 in its final stretch) and, rather than re-describing every phase in
prose again, point directly at issue #11 as the single source of truth — the
duplicated, manually-maintained summary in these three docs is exactly what let them
go stale with no CI signal (none of the existing `pr-checklist` doc-sync checks look
at prose "status" summaries). Same treatment applied to `README.md`'s "Project status"
section and `docs/roadmap.md`, which now lists only the genuinely open tracker items
(#17, #240) instead of a snapshot from when the file was first written. No application
code changed.
