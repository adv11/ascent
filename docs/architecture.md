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

**Current product stage (2026-07):** Phase 0 (Foundation & Standards) complete.
Working through Phase 1 (hosting ✅, auth improvements ✅, brand rename ✅, starter
templates + onboarding ✅ — core architecture hardening continues).

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
