# Ascent — Agent Instructions

Ascent ("Engineer your next move.") is a personal roadmap tracker for anyone learning,
revising, or tracking progress toward a goal — students, professionals, or career
switchers. New sign-ups pick a starter template (Issue #51): Java Backend Engineer
(the original roadmap — Java, Spring Boot, microservices, GenAI/agentic AI, system
design), Frontend Developer, Data Scientist, or a blank slate. It's moving from a
personal tool toward a sellable product, so treat correctness and polish here as
customer-facing, not a side project.

> **Keep this file in sync with `CLAUDE.md`.** Whenever `CLAUDE.md` is updated, apply
> the same change here. They must never diverge.

---

## MANDATORY WORKFLOW

These rules apply to every issue and every PR. They are not optional — every step must be done, every time.

### Label taxonomy (every GitHub issue must have all three)

**Type** (≥ 1): `type:feat` `type:fix` `type:refactor` `type:test` `type:docs` `type:chore` `type:design` `type:security` `type:perf`

**Priority** (exactly 1): `priority:critical` `priority:high` `priority:medium` `priority:low`

**Domain** (≥ 1): `domain:auth` `domain:storage` `domain:roadmap` `domain:ui` `domain:import` `domain:a11y` `domain:brand` `domain:infra` `domain:security`

### Raising a new GitHub issue

1. First line of body: label category line — `` `type:X` `priority:Y` `domain:Z` ``
2. Body must include: What/Why, Scope, Testing requirements, Doc changes checklist, Blocked by / Blocks / Safe to run in parallel, GitHub milestone
3. **Immediately after** `gh issue create`: fetch the live tracker body (`gh issue view 11 --json body`) and add the new issue at the correct Step with status `⬜ Not started`

### Starting work on an issue

1. Fetch the live tracker body and set the issue status → `🔄 In progress`
2. Branch off up-to-date main: `git fetch origin && git checkout -b <type>/issue-<N>-slug origin/main`

### Before opening a PR — all four required, no exceptions

1. `npm test` — zero failures
2. `npm run lint` — zero errors
3. `git fetch origin && git rebase origin/main` — branch must be on top of latest main
4. `git push --force-with-lease origin <branch>`

### Opening the PR

1. Follow `.github/PULL_REQUEST_TEMPLATE.md` in full: What / How / Testing / Docs updated / Screenshots / Linked issue
2. Use `Refs #N` (not `Closes #N`) when the issue spans multiple PRs; use `Closes #N` only when this PR fully resolves the issue
3. The `tracker-sync.yml` workflow **automatically** updates the tracker table row and reference table when the PR is opened or merged — no manual update needed for those two events

### After a PR merges

1. The `tracker-sync.yml` workflow automatically sets status → `✅ Done — merged PR #N` and updates the reference table
2. **Still manual**: update the Step banner text (the `> …` line above the table) if the step state changed — automation updates rows/refs only, not free-text banners
3. Note in the tracker if any blocked issue in the next Step is now unblocked

### Docs that must ship with every code PR

| Doc | When required |
|---|---|
| `CHANGELOG.md` | Always — add an entry under `[Unreleased]` |
| `CLAUDE.md` | If any convention, pattern, or rule changed |
| `AGENTS.md` | Keep in sync with `CLAUDE.md` whenever `CLAUDE.md` changes |
| `docs/architecture.md` | If structure, CI pipeline, data-flow, or test setup changed — **also add a Build Log entry** |
| `docs/api.md` | If a public store or service contract changed |

### Parallel work (running multiple issues at once)

Claude Code supports working on multiple issues simultaneously using **git worktrees + parallel agents**. Each issue gets its own worktree (isolated directory + branch), so branches never share working files and there are no mid-work conflicts.

**When it is safe**: issues that touch different files and have no "Blocked by" relationship in tracker #11. Check the "Blocked by / Safe to run in parallel" column before starting.

**When it is NOT safe**: two issues that both modify the same file (e.g. both touching `app.css` or `dashboard.js`) will produce merge conflicts — do those sequentially.

**How to invoke**: tell Claude _"work #X and #Y in parallel"_. Claude will spawn two worktree agents in a single message. Each agent runs the full workflow independently (lint → test → rebase → PR → tracker update) and returns its own PR.

**Each parallel agent still follows every step of this MANDATORY WORKFLOW** — lint, test, rebase, PR template, tracker update. Parallel does not mean skipping steps.

---

## Stack

- Vanilla JavaScript, native ES modules, **no build step, no framework, no bundler**.
  `npm run dev` / `npm start` serves static files with `python3 -m http.server 4173`.
- Firebase Authentication (email/password + anonymous "guest" sessions) and Firebase
  Realtime Database for per-user roadmap sync; security rules in `firebase/database.rules.json`.
  Project credentials live in `src/services/firebase.config.js`, which is **gitignored**
  — copy `src/services/firebase.config.example.js` and fill in your own Firebase project values.
  Never put real credentials in a tracked file.
- **Vitest** for unit/integration tests (`tests/unit/`, `tests/integration/`); **Playwright** for E2E (`tests/e2e/`). Run `npm test` before pushing — all checks must be green. Run `npm run lint` to enforce security and quality rules. Never merge a PR with failing checks.

## File map

```
index.html                    entry HTML; CSP meta tag, SRI modulepreload for Firebase SDK, external themeBootstrap
src/main.js                   boot: migrate localStorage keys, init theme, auth gate, hash router wiring
src/data/roadmap.js           backward-compat shim — re-exports the java-backend template, no logic
src/data/templates/index.js   starter template registry — TEMPLATES, getTemplate, buildSeedItems(id), getTemplatePhases(id)
src/data/templates/java-backend.js  the original roadmap (Java/Spring Boot/…), moved here verbatim
src/data/templates/frontend.js      Frontend Developer starter template
src/data/templates/data-science.js  Data Scientist starter template
src/data/templates/genai-agentic-ai.js  GenAI / Agentic AI Engineer starter template
src/data/templates/math-grade12.js      12th Grade Mathematics starter template
src/data/templates/piano.js             Learning Piano starter template
src/data/templates/marketing.js         Marketing starter template
src/data/templates/blank.js         retired starter template (issue #4 follow-up) — migration-only, not in TEMPLATES
src/services/firebase.js      Firebase Auth (authApi) + auth/database singletons for FirebaseAdapter
src/services/firebase.config.js          gitignored — your real Firebase project config
src/services/firebase.config.example.js  committed template for the file above
src/services/localStorageKeys.js  canonical `ascent-*` localStorage/sessionStorage key strings
src/services/migration.js     one-time migration off the pre-rename `switchprep-*` key prefix
src/services/roadmapStore.js  in-memory roadmap store: subscribe/notify, local + adapter save, onboarding detection
src/services/storage/StorageAdapter.js       storage backend interface (issue #5) — required + optional methods
src/services/storage/FirebaseAdapter.js      Realtime Database implementation (formerly firebase.js's dbApi)
src/services/storage/LocalStorageAdapter.js  standalone localStorage implementation — not yet wired into roadmapStore.js
src/services/storage/adapterFactory.js       getStorageAdapter(user) — always resolves to FirebaseAdapter today; the one seam a future second backend would plug into
src/services/theme.js         dark/light theme state (localStorage + system preference)
src/services/themeBootstrap.js  synchronous classic script — sets data-theme before CSS loads (no-FOUC)
src/ui/router.js              tiny hash router (registerRoute/navigate/startRouter)
src/ui/dom.js                 el() DOM-builder helper, debounce, isValidUrl
src/ui/pages/signIn.js        sign-in screen
src/ui/pages/signUp.js        sign-up screen
src/ui/pages/onboarding.js     one-time starter template picker (route: /onboarding)
src/ui/pages/dashboard.js     the roadmap dashboard (the whole app, really)
src/ui/components/authShell.js   shared chrome for signIn/signUp (brand row + theme toggle + card)
src/ui/components/brand.js       canonical brand mark/wordmark — createBrandMark()/createBrandIcon()
src/ui/components/themeToggle.js reusable dark/light toggle button
src/ui/components/itemPanel.js   slide-in panel for editing a topic + its resources + notes
src/ui/components/toast.js       transient toast notifications
src/ui/components/buildYourOwnGuide.js  informational modal — "How do I build my own roadmap?"
src/ui/components/newRoadmapModal.js    "Create your own roadmap" title/description modal (issue #4)
src/ui/components/importRoadmapModal.js "Import roadmap" — Generate with AI / Paste & Import tabs (issue #4)
src/data/importPrompt.js        versioned AI-import prompt template — IMPORT_PROMPT_VERSION, buildImportPrompt()
src/core/roadmap/importValidator.js  pure validator for AI-import roadmap JSON
src/core/roadmap/schemaAdapter.js    pure converter: validated import JSON -> { phases, items } roadmapStore shape
src/styles/app.css            the entire design system (tokens, components, both themes)
docs/architecture.md          living architecture guide + Build Log (canonical deep-dive doc)
firebase/database.rules.json  Realtime Database security rules
public/                       favicon.svg, generated PWA icons/OG image, manifest.json
scripts/generate-brand-assets.mjs  dev-only Playwright script that rasterizes favicon.svg into public/*.png
tests/unit/                   Vitest unit tests
tests/integration/            Vitest integration tests
tests/e2e/                    Playwright E2E tests
tests/__mocks__/firebase.js   vi.fn() stubs for authApi/dbApi
tests/setup.js                jsdom shims (matchMedia, localStorage)
.github/workflows/ci.yml      GitHub Actions CI pipeline
.github/PULL_REQUEST_TEMPLATE.md  PR body template
eslint.config.js              ESLint flat config (security + quality rules)
playwright.config.js          Playwright config (Chromium, webServer via npx serve)
```

## Conventions to follow

**`el(tag, attrs, children)`** (`src/ui/dom.js`) is the only DOM-construction helper —
there's no JSX/templating. `attrs.className`/`dataset`/`text` are special-cased;
any `onX` key becomes an `addEventListener`. Build UI by composing `el()` calls, not by
writing HTML strings.

**Never use `innerHTML` — not directly, not via any helper.** All text must flow through
`textContent` (via `el()`'s `text:` key or `node.textContent = …`). The `html` key was
removed from `el()` (Issue #22) — it was an undocumented escape hatch that routed
directly to `node.innerHTML`. If a future genuine need for trusted HTML arises (e.g.
rendering sanitised Markdown), introduce a separate named helper with an explicit
doc comment so the danger is visible at every call site. Never silently re-add `html:`
to `el()`.

**Resource URLs must be validated before use as `href`.** Any URL coming from the store
(Firebase, localStorage) must pass `isValidUrl()` before being set as an anchor `href`.
`isValidUrl()` accepts only `http:` and `https:` protocols — this blocks `javascript:`
and `data:` URI injection. Apply this at both render time and save time.

**Store pattern** (`src/services/roadmapStore.js`): a mutable `items` map for whichever
template is currently active, `subscribe(callback)`/`notify()` for pub-sub, and a 500ms
debounced `queueSave()` that persists to `localStorage` immediately and to the active
storage adapter (see below) after the debounce. Snapshots carry `saveState`
(`saving`/`saved`/`local`/`synced`/`error`), a `structuralVersion` counter,
`activeTemplateId`, `startedTemplateIds` (issue #58), `onboardingDone`, and `phases`
(the current template's phase/section skeleton — see below).

**Storage adapter abstraction (`src/services/storage/`, issue #5, part 1).**
`roadmapStore.js` never imports `firebase.js` directly for roadmap/meta reads and
writes — it calls whichever adapter `getStorageAdapter(user)` (`adapterFactory.js`)
returns for the *currently signed-in user*. Today that's always `firebaseAdapter`: this
is a deliberate single seam (not dead abstraction) so a future second backend would only
mean adding a branch inside `adapterFactory.js`, never touching `roadmapStore.js` or any
feature built on top of it. `StorageAdapter` is the base contract (required:
`listenRoadmap`/`saveRoadmap`/`getRoadmap`/`deleteRoadmap`/`getMeta`/`saveMeta`, all
`(uid, templateId, ...)`-shaped; optional with safe defaults: `getLegacyRoadmap` —
Firebase-only migration data —, `now()` — the adapter's own write-timestamp
representation —, and `destroy()`). `listenRoadmap`'s callback receives the plain
roadmap payload (or `null`) — **never** a backend-specific wrapper: `attachRoadmapListener`
used to call `snapshot.exists()`/`snapshot.val()` directly on whatever the callback
received, leaking Firebase's `DataSnapshot` shape through what was meant to be a generic
interface. Fixed by having `FirebaseAdapter.listenRoadmap` unwrap its own snapshot
internally before invoking the callback. This interface is shaped around what
`roadmapStore.js` actually calls (multi-user, multi-template, plus a separate `meta`
document), not a naive single-roadmap MVP shape — see `docs/architecture.md` §5.12 for
why.

`FirebaseAdapter` carries `dbApi`'s exact former logic with no behavior change. Since
which backend applies is resolved per sign-in (not a fixed, once-per-app-load choice),
`roadmapStore.js`'s `adapter` binding is a `let` reassigned via
`getStorageAdapter(nextUser)` at the top of every `setUser()` call, not a `const` fixed
once at store creation. `LocalStorageAdapter` is a complete, unit-tested implementation
of the same contract over its own dedicated keys, but is **not yet wired into
`roadmapStore.js`** — scaffolding for a later PR (true guest-only local mode, or an
explicit offline-cache adapter), not forgotten work.

**Google Sign-In / Google Drive sync was tried and dropped, not forgotten.** Issue #5
originally planned a `GoogleDriveAdapter` (part 2) and a full "Sign in with Google" flow
(part 3) as an opt-in second backend. Part 2 merged but was always unreachable in
production (no UI ever created a Google-authenticated user); part 3 (the actual
sign-in UI/OAuth wiring) never merged. After two days spent chasing real-world OAuth
issues (popup timing, CSP, GIS silent refresh), the decision was made that it wasn't
worth the ongoing cost right now — both were removed entirely (code, tests, docs) and
issues #5/#71 were closed. Firebase is the only backend and the only sign-in method.
If Google Drive sync is revisited later, `adapterFactory.js`'s single seam is exactly
what a new adapter would plug into — this was not undone.

**Starter templates and onboarding (`src/data/templates/`, `src/ui/pages/onboarding.js`)**
— Issue #51. `src/data/templates/index.js` is the template registry (`TEMPLATES`,
`getTemplate(id)`, `buildSeedItems(id)`, `getTemplatePhases(id)`); every registered
template module (`java-backend.js`, `frontend.js`, `data-science.js`,
`genai-agentic-ai.js`, `math-grade12.js`, `piano.js`, `marketing.js` — 7 total) exports
its own `PHASES` + `buildSeedItems()` in the same shape as the original `roadmap.js`.
(`blank.js` is no longer one of the 7 — retired, see below; file kept, migration-only.)
Templates are loaded via dynamic `import()` so a signed-out visitor's sign-in page never
downloads roadmap content for templates they haven't picked. `roadmapStore.js`'s
`setUser(user)` is **async**: on every sign-in it does a one-time `dbApi.getMeta` read to
decide `onboardingDone`/`activeTemplateId`/`startedTemplateIds` — `meta.startedTemplateIds`
wins if present (issue #58's per-template shape); otherwise it falls back through legacy
detection (see the multi-roadmap paragraph below) and backfills the new meta shape with
no forced migration step. Only when `onboardingDone` is false does `main.js` route to
`/onboarding`; picking a card there calls `store.switchRoadmap(templateId)`, which (since
issue #58) seeds a not-yet-started template or loads an already-started one, marks
onboarding done, and starts syncing — never destroying any other template's progress.
Always await `store.setUser(...)` before making a routing decision on its result — the
onboarding-vs-`/app` redirect in `main.js` depends on this resolving first.
`dashboard.js`'s `groupItems()` takes `store.getSnapshot().phases` instead of a
hardcoded import specifically so a template (or custom roadmap) whose phases have zero
items still renders a phase-card for each one; do not revert it to a static import.
A "Switch template" link in the dashboard header re-enters `/onboarding` at any time —
reached this way (`onboardingDone` already `true`), the page shows a "← Back to my
roadmap" link; since issue #58, picking any card there is non-destructive (no
confirmation dialog), because switching only ever loads or seeds that template's own
data, never touching another template's. First-time onboarding (`onboardingDone === false`)
shows no back link either, since there's nothing to switch away from yet.

**Multi-roadmap support — concurrent progress per template (`roadmapStore.js`, issue #58).**
Each template a user has started gets its own Firebase node,
`users/{uid}/roadmaps/{templateId}` (`version`/`updatedAt`/`templateId`/`items`), tracked
in `users/{uid}/meta.startedTemplateIds` (array) with `meta.activeTemplateId` naming the
one currently displayed. The store replaces the old single `items`/`templateId` trio with
`activeTemplateId`, `startedTemplateIds`, and an in-memory `roadmapCache` (keyed by
templateId) that makes switching back to an already-visited template instant — no network
read — within the same session; switching to a template not yet visited this session
still reads Firebase/local storage first (cache-first, not cache-only). Locally,
`KEYS.ROADMAPS` (`ascent-roadmaps-v1`) replaces the old single `KEYS.ROADMAP` blob with a
`{ [templateId]: { version, dirty, items } }` shape; `KEYS.TEMPLATE_ID` now means the
*active* template id. `switchRoadmap(templateId)` (replacing `initFromTemplate`) handles
both first-time picks and later switches with the same logic: a not-yet-started template
seeds fresh and is appended to `startedTemplateIds`; an already-started one is loaded
(cache → Firebase → local blob → seed, in that order) and never re-seeded. **Only one
Firebase listener is open at a time** (switching detaches the old one and attaches a new
one on the newly active template's path) — keeping listeners open for every started
template concurrently is an explicit non-goal for this issue, not an oversight. The old
singular `users/{uid}/roadmap` path is never written to again post-migration — it's a
read-only safety net; `setUser` migrates a legacy account (one lacking
`meta.startedTemplateIds`) by copying that path forward into
`users/{uid}/roadmaps/{templateId}` and writing the new meta shape, the first time such
an account signs in after this shipped.

**Manual roadmap creation — `croadmap-...` ids (`roadmapStore.js`, issue #4).** A user
can build their own roadmap from scratch via "Create your own roadmap" (first card in
`/onboarding`'s grid, opening `src/ui/components/newRoadmapModal.js`). `createCustomRoadmap`
generates an id shaped `croadmap-<timestamp>-<random>` — `isCustomRoadmapId(id)` (exported
from the store) is the only thing distinguishing a custom roadmap from a built-in template
id; deliberately not the same prefix as `addItem()`'s `custom-` item ids (a different id
namespace — item.id, not templateId). Metadata (`{ id, title, description, createdAt }`)
lives in a `customRoadmaps` array (`users/{uid}/meta.customRoadmaps` + local
`KEYS.CUSTOM_ROADMAPS`), separate from `startedTemplateIds` (which the id is also added
to) — so it flows through the same `switchRoadmap`/`roadmapCache`/per-path Firebase
machinery issue #58 built. Unlike a built-in template's fixed, never-persisted `phases`
skeleton, a custom roadmap's `phases` (with generated `phase-...`/`section-...` ids) are
the only record of what the user built, persisted/resolved through the same
cache → Firebase → local-blob → seed path as `items`. `addPhase`/`renamePhase`/
`removePhase`/`addSection`/`renameSection`/`removeSection` are no-ops unless
`activeTemplateId` is a custom id — built-in phase/section skeletons are fixed. Renaming
re-files every item under the old title; removing soft-deletes every item under it.
`dashboard.js` only shows the add/rename/delete phase/section controls when
`store.isCustomRoadmapId(activeTemplateId)`. `deleteCustomRoadmap(id)` permanently
deletes (never usable on a built-in id, which can only be hidden) — switches to
`java-backend` first if it was the active roadmap.

**AI-assisted roadmap import (`src/data/importPrompt.js`, `src/core/roadmap/`, issue
#4).** "Import roadmap" (`src/ui/components/importRoadmapModal.js`) is a second entry
point next to "Create your own roadmap" — a two-tab modal. Tab 1 ("Generate with AI")
shows a versioned, copyable prompt (`buildImportPrompt(topic)`, `IMPORT_PROMPT_VERSION`)
with a "Copy prompt" button (Clipboard API, falling back to `execCommand('copy')`). Tab
2 ("Paste & Import") validates the pasted text 300ms after each keystroke via
`validateImportText()` (`src/core/roadmap/importValidator.js`, pure — no DOM/store/
Firebase): valid JSON, `schemaVersion === 1`, non-empty `title`, non-empty `phases`
array with valid `title`/`priority`/`sections` per phase, valid `title`/`items` per
section, every item a string or `["title","priority"]` tuple, ≤ 500 total items —
returns an array of per-field error strings, empty means valid. Only then does
`adaptImportToRoadmap()` (`src/core/roadmap/schemaAdapter.js`, equally pure) convert it
into `{ phases, items }` (generating the same `phase-...`/`section-...`/`custom-...` ids
`addPhase`/`addSection`/`addItem` do) and enable "Import roadmap". Validator and adapter
are deliberately separate: a future schema version means a new adapter, not touching the
validator's rules. The modal resolves `{ title, phases, items } | null`;
`onboarding.js`'s `handleImport()` passes it straight to
`store.createCustomRoadmap({ title, phases, items })` — the same function manual
creation calls, just with `phases`/`items` populated. `roadmapStore.js` wires this via a
one-shot `pendingCustomSeeds` map: `createCustomRoadmap` stashes the seed keyed by the
new id right before `switchRoadmap(id)`, and `fetchTemplateData` consumes (and deletes)
it instead of the usual empty seed for a custom id — manual creation has no entry there
and falls through unchanged. From then on an imported roadmap is indistinguishable from
a manually built one.

**Flush-before-switch — an edit made just before switching must never be silently
dropped or attributed to the wrong template.** Because `flush()` always saves whatever
`items`/`activeTemplateId` are current *at the moment it actually runs* (not captured at
`queueSave()` time), a debounced save queued against the outgoing template that fires
*after* `switchRoadmap()` has already reassigned those variables would otherwise save the
new template's data (redundant, harmless) while never flushing the outgoing template's
real edit to its own path. `switchRoadmap()` checks `dirty` for the outgoing template
and, if set, cancels the pending timer and `await`s `flush()` **before** reassigning
`activeTemplateId` — see the "flush-before-switch" describe block in
`tests/integration/roadmapStore.test.js`. If you ever add another path that can change
`activeTemplateId`, it must do the same.

**Stale-listener guard replaces the old #51 cross-template payload tag.** Since each
template now has its own Firebase path, `attachRoadmapListener(templateId)`'s `onValue`
callback closes over the `templateId` it was attached for and drops any invocation once
that no longer matches the current `activeTemplateId` — structurally stronger than
comparing a `remote.templateId` payload tag (the old #51 fix, no longer needed for this
purpose), since it can't be fooled by a callback that was already queued before `off()`
took effect. See the "stale listener guard" describe block in
`tests/integration/roadmapStore.test.js`.

**Per-user hidden templates — `hiddenTemplateIds`.** Every built-in template card has a
hide (×) button, no exceptions (issue #4 follow-up retired "blank", the one card that
used to be exempt); clicking it (after a `confirm()`) calls `store.hideTemplate(id)`,
which appends to `hiddenTemplateIds` and persists it to `users/{uid}/meta/hiddenTemplateIds`
(plus a local fallback) — **this is a per-user preference, never a deletion of the
template or a change visible to any other user.** `getTemplate`/`buildSeedItems`/
`getTemplatePhases` never consult it; it only filters which cards `onboarding.js`
renders. A "Show hidden templates (N)" toggle reveals hidden cards with a "Restore"
button (`store.unhideTemplate(id)`) instead of the normal pick/hide affordances.
"Create your own roadmap" (never hideable — an action card, not a pickable template)
has a corner ℹ info button instead, opening the "build your own" guide
(`src/ui/components/buildYourOwnGuide.js`) — where blank's old info button moved to.
The guide covers both real paths now: manual and AI-assisted (an "Open Import roadmap"
button handing off to the same `handleImport()` the "Import roadmap" card uses) — keep
it that way, don't let it drift back to describing a manual copy-into-an-AI-chat
workflow now that real automated import exists.

**"blank" template retirement and migration (`roadmapStore.js`, `src/data/templates/`,
issue #4 follow-up).** Once manual creation (CRUD, above) and AI import (below) both
existed, "Start blank" (four fixed, uneditable phases, one per account, never hideable)
became a strict subset of a custom roadmap — removed from `TEMPLATES` accordingly.
`blank.js` stays importable via a migration-only export, `getLegacyBlankTemplateData()`
— `getTemplate('blank')` etc. now fall back to `TEMPLATES[0]` like any unrecognized id.
Anyone who already started "blank" is migrated forward on their next `setUser()` (before
`fetchTemplateData` would otherwise be called with the now-meaningless `'blank'` id)
into a real custom roadmap (`croadmap-...`, titled "My roadmap"): reads whatever's
actually stored at `users/{uid}/roadmaps/blank` (Firebase then local blob), falling back
to `getLegacyBlankTemplateData()` only for whichever half (items/phases) is missing
(pre-PR-#60 accounts never persisted `phases`). `activeTemplateId`/`startedTemplateIds`
are corrected and saved in the same pass so it's never re-migrated later. The old
`roadmaps/blank` node is never deleted — same precedent as every other legacy path here.

**`setUser`/`switchRoadmap` stale-call guard — `stateCallId`.** Firebase's
`onAuthStateChanged` can fire in quick succession (e.g. delete-account immediately
followed by a fresh sign-up with the same email), and a user can also switch templates
while a sign-in is still resolving. Because both functions do one or more `await`s
before mutating store state, an older call can still be in flight when a newer one
finishes — without a guard, the older call would resolve later and clobber the newer,
correct state with stale data. `roadmapStore.js` captures a `stateCallId` snapshot at
the top of each call and checks it's still current after every `await`; if a newer call
has already started, the older one aborts without touching `items`/`activeTemplateId`/
`startedTemplateIds`/`onboardingDone`. Any new `await` added to either function must be
followed by the same staleness check before it mutates state.

**`structuralVersion` — do not regress this.** It exists specifically to fix a checklist
flicker bug: toggling `done` on an item does *not* bump `structuralVersion` (see
`updateItem` in `roadmapStore.js`), because a done-toggle never changes which items are
visible or how they're grouped. `dashboard.js`'s `handleSnapshot` only runs the full
`render()` (which tears down and rebuilds every phase-card) when `structuralVersion`
changes; otherwise it calls the lightweight `patchDoneStates()`, which patches stats and
the affected row's classes in place. If you add a new mutation that changes the *set or
shape* of items (add/remove/reorder/edit fields other than `done`), bump
`structuralVersion` for it. If you add a mutation that's purely cosmetic on an existing
row, don't — and prefer extending `patchDoneStates()` over adding more full re-renders.

**Personal notes per topic — `item.notes` (issue #15).** Every item may carry a plain-text
`notes` field, capped at 5,000 characters; a missing field and `''` both mean "no notes"
(backward compat — seed items are never retrofitted with `notes: ''`, the same precedent
as `resources`). A `notes` patch is **not cosmetic** — it bumps `structuralVersion` (see
above) because the row's notes indicator badge needs to re-render. Never add `'notes'` to
`updateItem`'s cosmetic-check. `itemPanel.js`'s Notes textarea autosaves independently of
the title/priority/resources "Save changes" button — an 800ms-debounced call to `onSave`
with just `{ notes }` — and flushes any pending save synchronously on close so an edit
made in the narrow window before the debounce fires is never lost. `dashboard.js` renders
a `data-action="notes"` 📝 indicator on a row only when `item.notes` is non-empty,
following the same click-guard (`e.stopPropagation()`) convention as the resource badge.

**Watch the Firebase echo.** `dbApi.listenRoadmap`'s `onValue` callback fires on every
write to the path, *including the echo of writes this client just made* (every debounced
save round-trips back through the listener ~500ms-1s after a click). It must not bump
`structuralVersion` on that echo — `roadmapStore.js` compares the incoming remote
`{ items, phases }` pair against the current in-memory one with a key-order-independent
`stableStringify` (Realtime Database returns keys sorted; our in-memory map is
insertion-order, so a plain `JSON.stringify` compare produces false positives) and only
bumps when they actually differ. `phases` is folded into this comparison (issue #4) so a
custom roadmap's user-added phases/sections get the same echo-guard as `items` — a no-op
for built-in templates, whose `phases` never differs. If this comparison is ever removed
or replaced with an unconditional bump, the checklist flicker comes back.

**Never apply a remote snapshot while a local edit is still unflushed (issue #58
hardening).** `attachRoadmapListener`'s callback returns immediately, without touching
`items`, whenever `dirty` is `true` — a queued-or-in-flight local edit is provably newer
than anything the listener can be echoing, whether that's a delayed echo of an older
write of ours or a genuine external update. This exists because Firebase's echoed
payload does not always byte-for-byte match what we computed before sending (its own
normalization), so string-matching an echo against what we last flushed cannot be
trusted as the sole defense — a delayed echo of an *older* write of ours could otherwise
fail to match and get misapplied as "genuinely different, newer" data, silently
reverting an edit made in the narrow window before it flushed. Found via real E2E
testing against live Firebase (not caught by the mocked unit/integration suite, which
can't reproduce genuine network-timing non-determinism) — reproduced most easily by
switching to a template that hasn't been started yet and immediately checking an item,
since seeding + first flush + first listener attach all happen in that same narrow
window. Also keeps a small bounded history of recently-flushed content strings
(`recentFlushedStrs`, not just the single latest one) so an out-of-order echo of an
*already-confirmed* older flush (arriving once `dirty` is back to `false`) is still
recognized as our own and doesn't cause a spurious `structuralVersion` bump. See the
"out-of-order echo guard" describe block in `tests/integration/roadmapStore.test.js`.
The same hazard existed on the initial-load path too (issue #67): `resolveRoadmapItems`
used to prefer a successful remote read over the local blob unconditionally, so a page
reload that beat the debounced `flush()` could let a stale remote snapshot silently
overwrite a dirty (not-yet-confirmed) local edit. It now checks `localBlob.dirty` before
ever attempting a remote read — see the "resolveRoadmapItems — dirty local blob outranks
stale remote" describe block in the same test file.

**`data-action` click-guard convention** (`dashboard.js` `renderItemRow`): a checklist
row toggles `done` on click, but child controls that need their own click behavior
(Edit button, the resource-count badge) are marked `data-action="…"` and call
`e.stopPropagation()` in their own handler. Any new interactive element nested inside a
row must follow this pattern or it will silently toggle the row's checkbox.

**Sign-out contract — never load one user's localStorage into another user's session.**
`roadmapStore.js`'s `setUser(nextUser)` detects when the active uid changes (sign-out,
sign-in as a different user). Whenever `uid` transitions from a non-null value to any
other value, it calls `clearLocal()` (removes `LOCAL_KEY`, the keyed `KEYS.ROADMAPS`
blob, and `UI_KEY`, among other per-user keys) and resets in-memory `items` to
`buildSeedItems()` before the incoming user's session starts. The incoming user's own
local data (`readLocalRoadmaps()`, hidden templates, etc.) is only ever read after `uid`
is updated to the new value. The initial boot call has `uid = null`, so the guard is
skipped on first load. Do not restructure `setUser` in a way that removes this guard or
that reads local data before clearing — that would silently re-introduce the privacy leak.

**Theming**: The no-FOUC theme bootstrap lives in `src/services/themeBootstrap.js` —
a classic `<script src="...">` (no `defer`/`async`/`type="module"`) that reads
`localStorage` and sets `data-theme` on `<html>` synchronously before CSS loads. It was
extracted from an inline IIFE so the Content Security Policy (Issue #25) can omit
`'unsafe-inline'`. Do not convert it to a module or add `defer`/`async` — that breaks
the synchronous timing guarantee and causes a flash of the wrong theme. Because it runs
before `migrateLocalStorageKeys()` ever gets a chance to, it reads `ascent-theme` first
and falls back to the pre-rename `switchprep-theme` key so existing users don't get a
flash of the wrong theme on their first post-rename load. `src/services/theme.js`
owns `getTheme()` / `setTheme()` / `toggleTheme()` / `onThemeChange()`, persisted under
`KEYS.THEME` (`localStorageKeys.js`, currently `ascent-theme`); until the user makes an
explicit choice, it follows `prefers-color-scheme` live. All colors in `app.css` are CSS custom properties defined
once under `:root` (light) and re-defined under `:root[data-theme='dark']` — never hardcode
a color in a component rule; add or reuse a token instead so both themes stay correct.

**Brand rules.** Never hard-code the product name as a string in any `.js` file —
import `createBrandMark()` / `createBrandWordmark()` / `createBrandIcon()` from
`src/ui/components/brand.js` instead. The only permitted occurrences of the literal
string `'Ascent'` in source are inside `brand.js` itself and inside `index.html`'s meta
tags/title. All `localStorage`/`sessionStorage` keys must come from
`src/services/localStorageKeys.js`'s `KEYS` object (or `verifyDismissedKey()`) — never
write a raw `ascent-*` string in any other file. This is what makes a future rename (or
a white-labeled variant) a one-file change instead of a repo-wide grep; see Issue #7
and `docs/adr/ADR-004-product-rename.md`.

**SRI + CSP — mandatory when loading CDN scripts.** `index.html` locks the three Firebase
SDK modules with `<link rel="modulepreload" integrity="sha384-...">` Subresource Integrity
hashes. When upgrading the Firebase SDK version, four things must change in lockstep:
(1) all three import URLs in `src/services/firebase.js`, (2) all three `href` attributes
in the `<link rel="modulepreload">` tags, (3) all three `integrity` attributes in those
same tags, (4) the hash table in `docs/adr/ADR-002-csp-sri-security.md`. Missing any one
of these will cause a hash mismatch and the app will fail to boot. Regenerate hashes with:
`curl -s <url> | openssl dgst -sha384 -binary | base64`. The Content Security Policy
in `index.html` must stay consistent with any new CDN domains added; update both the CSP
meta tag and the `firebase.json` hosting headers.

**Password utility module — `src/ui/utils/password.js`.** Two shared exports used by both auth pages:
- `scorePassword(s)` — pure function returning 0–4. 0 means empty or < 6 chars; 1 = base (≥6 chars), +1 each for ≥8 chars, ≥12 chars, mixed case, digit, special character (capped at 4). No external library — do not replace with a dependency.
- `makePasswordToggle(input)` — factory that creates an absolutely-positioned `<button class="password-toggle">` that toggles `input.type` between `'password'` and `'text'` and updates `aria-label` to "Show password" / "Hide password". Caller must wrap the input in a `<div class="field-input-wrap">` (CSS `position: relative; display: grid;`) — the `.field-input` inside automatically gets `padding-right: 52px` via the cascade.

**Password reset uses Firebase's default action URL (Option A).** `authApi.sendResetEmail(email)` calls `sendPasswordResetEmail(auth, email)` and relies on Firebase's hosted action page for the "Set new password" form — no custom reset-confirm route exists in-app. Do not implement a custom reset form (`#/reset-password?oobCode=...`) unless explicitly requested. The sign-in page manages the reset request inline (same card, no route navigation) by swapping `bodySlot` content and updating `titleEl`/`subtitleEl` from the `authShell` return value. The success state deliberately shows the same UI regardless of whether the email belongs to an existing account — this prevents account-existence enumeration.

**Account deletion must delete `users/{uid}` from Realtime Database before calling `deleteUser()`.** Reversing this order leaves orphaned data in the database — once the Auth record is gone, the security rules block cleanup because there is no longer an authenticated user. `authApi.deleteAccount(password)` re-authenticates first (`reauthenticateWithCredential`) to obtain a fresh token before the deletion. If Firebase throws `auth/requires-recent-login`, surface the error message from `authErrorMessage` (already mapped) rather than attempting deletion. Never auto-delete without explicit password confirmation from the user.

**Component subscription cleanup — always unsubscribe on DOM removal.** Any component
that calls `onThemeChange()`, or subscribes to any other module-level store or service,
must capture the returned unsubscribe function and call it when the component is torn
down. The pattern: attach the unsubscribe to the element as `el._cleanup = unsubscribe`,
have the component factory return `{ node, cleanup }` (or expose `_cleanup` for callers
to collect), and wire the cleanup into the route's cleanup return in `main.js`. Failing
to do this leaks dead DOM references and fires callbacks on removed nodes — see Issue #27.
Never add a subscription without a paired teardown path.

**Card/grid layout — every card in a row must be equal height, with variable-length content, not the grid's stretch behavior, being the thing you design around.** A CSS grid's cells stretch equally by default (`align-items: stretch`), but a card only visually fills that cell if the card element itself is sized to `height: 100%` and stacks its content as a flex column — otherwise each card sizes to its own content and rows visibly mismatch the moment one card's text runs longer than its neighbors (this exact bug hit `.template-card` in the onboarding template picker, `src/ui/pages/onboarding.js` / `src/styles/app.css` — same-row cards rendered at different heights because the card had no `height: 100%` and used `display: grid` with content-sized rows instead of a flex column). The required pattern for any new card-grid component:
- Grid container: `display: grid; grid-template-columns: repeat(auto-fit, minmax(<min>, 1fr)); align-items: stretch;` so it reflows responsively across breakpoints without a bespoke media query per card count.
- Card element: `height: 100%; display: flex; flex-direction: column;` so it actually fills the stretched cell.
- Any footer/action element (badge, button, count) that should stay flush to the card's bottom regardless of how long the body text is: `margin-top: auto` on that element — never rely on equal source text length to keep footers visually aligned.
- Every element that should stay left-aligned inside the flex column needs an explicit `align-self: flex-start` (or `text-align: left` for text content) — a bare `<button>` left in a stretched flex column centers its text by default (the browser's UA stylesheet), which is an easy regression to introduce when converting a card from `display: grid` (where `justify-self: start` did this job) to `display: flex`.
Verify visually at at least three viewport widths (mobile ~390px, tablet ~820px, desktop ~1440px) before calling a card-grid change done — unit tests run in jsdom and cannot catch layout/height mismatches.

**Never use the native `window.confirm()` — use `confirmDialog()` (`src/ui/components/confirmDialog.js`).** The browser's built-in confirm dialog can't be styled, breaks the app's own dark/light theming, and reads as unpolished in a customer-facing product. `confirmDialog({ title, message, confirmText, cancelText, danger })` returns a `Promise<boolean>` and renders the same `.modal-overlay`/`.modal-card` chrome as every other modal in the app (matches `showDeleteModal()` in `dashboard.js` and `openBuildYourOwnGuide()`), with Escape-to-cancel and click-outside-to-cancel built in. Pass `danger: true` for anything destructive/irreversible (delete, sign-out with unsaved changes, replacing a roadmap) to get the red confirm button; leave it `false` for reversible actions (e.g. hiding a template, which can be undone from "Show hidden templates"). Every call site does `if (!await confirmDialog({...})) return;` — same control flow as the old `confirm()`, so there's no excuse to reach for the native one out of convenience. Tests reach the dialog via `document.querySelector('.modal-overlay [data-action="confirm"|"cancel"]')` (Vitest/jsdom) or `page.locator('.modal-overlay[aria-label*="..."] [data-action="confirm"]')` (Playwright) — never via `page.on('dialog', ...)`, which only intercepts the native API this component replaced.

**Brand mark is a home link on every authenticated/onboarding-adjacent page.** Clicking the "Ascent" logo/wordmark (`createBrandMark()`) always navigates somewhere predictable instead of sitting inert — `<a class="brand" href="#/signin">` on the sign-in/sign-up pages (already existed), and `<a class="brand" href="#/onboarding">` on the dashboard and onboarding pages (`src/ui/pages/dashboard.js`, `src/ui/pages/onboarding.js`), since `/onboarding` is the "all roadmaps" picker — the closest thing this app has to a home/index page. `.brand`'s CSS (`text-decoration: none; color: inherit;`) was already anchor-ready; only the wrapping element needed to change from a plain `<div>` to an `<a>`. Never make the brand mark a dead `<div>` on a page that has a sensible "home" to link to.

**The active roadmap must always be visible, and a started template must never be shown as re-seedable.** Two coordinated pieces, both in response to real user confusion about "which roadmap am I on": (1) the dashboard hero (`src/ui/pages/dashboard.js`) always renders a `.current-roadmap-badge` with the active template's icon and name, sourced from `getTemplate(store.getSnapshot().activeTemplateId)` (`src/data/templates/index.js`) — never let the dashboard render without this, even for the seeded/default template; (2) the "Switch your starter roadmap" picker (`src/ui/pages/onboarding.js`) marks the currently-active template's card with a `.template-card-current` highlight and a "Current" badge, and any other *started* (but not active) template with a `.template-card-started` / `.template-card-started-badge` "In progress" badge — both live inside `.template-card-footer` so neither disturbs the equal-height card layout above. `pickTemplate()` treats clicking the active card as a no-op navigation back to `/app`; clicking any other card (started or not) calls `store.switchRoadmap(id)` directly with **no confirmation dialog**, since issue #58 made every switch non-destructive — an already-started template loads its own saved progress, a not-yet-started one seeds fresh, and neither ever touches another template's data. If you add another place that lists templates or lets a user pick one, carry all three badge states and the no-dialog switch with it.

**Living architecture doc (`docs/architecture.md`) — keep the Build Log current.** Every PR that adds, removes, or significantly restructures a module must append a dated entry to the `## Build Log` section of `docs/architecture.md`. Format:

```
### YYYY-MM-DD — PR #N — <short title>
What changed architecturally and why.
```

This is the developer-facing history (distinct from `CHANGELOG.md`, which is user-facing). The CI `pr-checklist` job enforces this: if a new file is added under `src/services/`, `src/ui/components/`, or `src/ui/pages/` and `docs/architecture.md` has no diff, the PR will fail. Issue templates are in `.github/ISSUE_TEMPLATE/` (four GitHub issue forms: `feature.yml`, `bug.yml`, `chore-refactor.yml`, `docs.yml`) — blank issues are disabled.

## Deploying

Every push to `main` auto-deploys to Firebase Hosting via `.github/workflows/deploy.yml`.
Every PR gets a temporary 7-day preview URL posted as a PR comment.

**For a manual deploy:**
```bash
firebase deploy            # deploys hosting + database rules
firebase deploy --only hosting
firebase deploy --only database
```

**`firebase.config.js` is gitignored on purpose.** CI injects the production config from
the `FIREBASE_CONFIG` GitHub Secret at deploy time. Do not commit a real config file.

**Required GitHub secrets/variables:**
- `FIREBASE_SERVICE_ACCOUNT` (secret) — service account JSON for deploy auth
- `FIREBASE_CONFIG` (secret) — production `src/services/firebase.config.js` contents
- `FIREBASE_PROJECT_ID` (variable) — project ID (non-sensitive)

## Verifying changes

```
npm run lint           # must exit 0
npm test               # must exit 0
npm run dev            # serves at http://localhost:4173
```

Manual browser check: sign in as guest, toggle several checklist items across phases
(confirm no unrelated phase-cards flash), click a "N resources" badge (confirm it opens
the edit panel and does not toggle the item), toggle the theme button on both auth
screens and the dashboard (confirm it persists across reload).
