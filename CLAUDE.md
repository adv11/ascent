# Ascent

Ascent ("Engineer your next move.") is a personal roadmap tracker for anyone learning,
revising, or tracking progress toward a goal — students, professionals, or career
switchers. New sign-ups pick a starter template (Issue #51): Java Backend Engineer
(the original roadmap — Java, Spring Boot, microservices, GenAI/agentic AI, system
design), Frontend Developer, Data Scientist, or a blank slate. It's moving from a
personal tool toward a sellable product, so treat correctness and polish here as
customer-facing, not a side project.

## Stack

- Vanilla JavaScript, native ES modules, **no build step, no framework, no bundler**.
  `npm run dev` / `npm start` just serves the static files with `python3 -m http.server 4173`.
- Firebase Authentication (email/password + anonymous "guest" sessions) and Firebase
  Realtime Database for per-user roadmap sync; security rules in `firebase/database.rules.json`.
  Project credentials live in `src/services/firebase.config.js`, which is **gitignored**
  — copy `src/services/firebase.config.example.js` to that path and fill in your own
  Firebase project's values before running locally. Never put real credentials back into
  a tracked file.
- **Vitest** for unit/integration tests (`tests/unit/`, `tests/integration/`); **Playwright** for E2E (`tests/e2e/`). Run `npm test` before pushing — all checks must be green. Run `npm run lint` to enforce security and quality rules. Never merge a PR with failing checks.

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

## File map

```
index.html                    entry HTML; has an inline no-FOUC theme bootstrap script
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
src/data/templates/blank.js         retired starter template (issue #4 follow-up) — kept only for roadmapStore.js's one-time migration, not in TEMPLATES
src/services/firebase.js      Firebase Auth (authApi) + auth/database singletons for FirebaseAdapter
src/services/authCleanup.js   pure, dependency-injected anonymous-sign-out cleanup logic (issue #24) — no Firebase imports, unit-testable without a real project
src/services/accountGuards.js pure `assertAccountDeletable(user)` guard used by `deleteAccount()` (issue #53) — no Firebase imports, same reasoning as authCleanup.js
src/services/firebase.config.js          gitignored — your real Firebase project config
src/services/firebase.config.example.js  committed template for the file above
src/services/localStorageKeys.js  canonical `ascent-*` localStorage/sessionStorage key strings
src/services/migration.js     one-time migration off the pre-rename `switchprep-*` key prefix
src/services/roadmapStore.js  in-memory roadmap store: subscribe/notify, local + adapter save, onboarding detection
src/services/dailyTodoStore.js  in-memory Daily Todos store (issue #56) — a separate, flat, rolling-deadline list; same subscribe/notify + debounced save pattern as roadmapStore.js, deliberately without structuralVersion
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
src/ui/components/dailyTodoPanel.js  "Today's Todos" card (issue #56) — add form, live countdown, collapsed Missed section, delete-when-finished, info button; mounted on onboarding.js (roadmap-agnostic), not dashboard.js
src/ui/components/dailyTodoGuide.js  informational modal reachable from the Daily Todos card's ℹ button — explains the rolling-deadline/Missed/delete model (issue #56 follow-up)
src/ui/components/itemPanel.js   slide-in panel for editing a topic + its resources + notes
src/ui/components/toast.js       transient toast notifications
src/ui/components/buildYourOwnGuide.js  informational modal — "How do I build my own roadmap?"
src/ui/components/newRoadmapModal.js    "Create your own roadmap" title/description modal (issue #4)
src/ui/components/importRoadmapModal.js "Import roadmap" — Generate with AI / Paste & Import tabs (issue #4)
src/data/importPrompt.js        versioned AI-import prompt template — IMPORT_PROMPT_VERSION, buildImportPrompt()
src/core/roadmap/importValidator.js  pure validator for AI-import roadmap JSON — parseImportJson, validateImportPayload, validateImportText
src/core/roadmap/schemaAdapter.js    pure converter: validated import JSON -> { phases, items } roadmapStore shape
src/core/roadmap/limits.js           MAX_TITLE_LENGTH/MAX_RESOURCE_LABEL_LENGTH/MAX_RESOURCE_URL_LENGTH/isValidResource (issue #53) — dependency-free so itemPanel.js can import the caps without pulling in roadmapStore.js's Firebase-backed adapter chain
src/core/dailyTodo/limits.js         MAX_TODO_TITLE_LENGTH/MAX_ACTIVE_TODOS/MIN_DURATION_MS/MAX_DURATION_MS/DURATION_PRESETS/clampDurationMs (issue #56) — dependency-free, same reasoning as core/roadmap/limits.js
src/ui/utils/dailyTodo.js            pure time helpers for Daily Todos (issue #56) — isExpired/remainingMs/formatRemaining/remainingBand, no DOM/Firebase dependency
src/styles/app.css            the entire design system (tokens, components, both themes)
docs/architecture.md          living architecture guide + Build Log (canonical deep-dive doc)
firebase/database.rules.json  Realtime Database security rules
public/                       favicon.svg, generated PWA icons/OG image, manifest.json
scripts/generate-brand-assets.mjs  dev-only Playwright script that rasterizes favicon.svg into public/*.png
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

**Daily Todos store (`src/services/dailyTodoStore.js`, issue #56) — a second instance of
the Store pattern above, not a first one to design from scratch.** Same mutable map +
`subscribe`/`notify` + 500ms debounced `queueSave()` (local immediately, storage adapter
after the debounce) + Firebase-echo guard (`stableStringify`-based, duplicated rather than
imported from `roadmapStore.js` so the two stores stay independent) + sign-out privacy
guard (a uid transition clears this store's own local data too — see "Sign-out contract"
below, which applies here just as much as to the roadmap). The one thing it deliberately
does **not** carry over is `structuralVersion`: that optimization exists specifically to
avoid tearing down/rebuilding every phase-card on a roadmap `done` toggle, and this list is
flat and small (≤20 active items, `MAX_ACTIVE_TODOS`) with no equivalent expensive
re-render to protect — a plain re-render on every store change is fine here. Each todo's
`expiresAt` is a rolling deadline computed once at creation
(`createdAt + durationMs`, `durationMs` chosen per-todo by the user from presets or a
custom hours value — `src/core/dailyTodo/limits.js`) and stored, never recomputed, so a
device clock/timezone change can't retroactively move a deadline. Expiry itself
(`isExpired`/`remainingMs`/`formatRemaining`/`remainingBand`, `src/ui/utils/dailyTodo.js`)
is a pure, derived value computed on read — there is no server cron on this static-hosted
app to run a background "mark expired" job, so a missed (expired, not done) todo just
stops rendering as active and moves into a collapsed "Missed" section instead of ever
being auto-deleted — deletion is always an explicit, confirmed user action instead (see
`removeTodo(id)` below). Never deleted *automatically* is not the same as *never
deletable*: `removeTodo(id)` permanently drops a todo from the store, but only the UI
exposes it — a ✕ button that appears on a `done` or missed (never an active) row, gated
behind `confirmDialog({ danger: true })` since it has no undo, unlike toggling `done`.
Without this, the Missed section and the done-but-still-visible rows in the active list
would both grow forever with no way to clean them up. `dailyTodoPanel.js` also gets a
corner ℹ button (`openDailyTodoGuide()`, `src/ui/components/dailyTodoGuide.js`, same
pattern as `buildYourOwnGuide.js`) explaining the rolling-deadline/preset-duration/
Missed/delete model in place, since this feature has no other onboarding. **Placement:
the Daily Todos card lives on `onboarding.js` — the "Pick a starting roadmap"/"Switch
your starter roadmap" screen — not on `dashboard.js` at all.** It was tried on the
dashboard first (rendered inside the header, above the roadmap hero) but that still read
as belonging to whichever roadmap happened to be active, since the dashboard *is*
per-roadmap. Since Daily Todos data is genuinely global to the user (never touched by
which roadmap is active, or by starting/switching/hiding one), it now renders on the one
screen that is itself roadmap-agnostic — right after the page heading, above the
template grid. `main.js`'s `guardApp` already threads `dailyTodoStore` through to every
route's ctx (originally added for the dashboard instance), so `onboarding.js` picking it
up needed no wiring change there — just `createDailyTodoPanel(dailyTodoStore)` mounted
in `renderOnboarding`'s own returned node, with `dailyTodoPanel?._cleanup?.()` added to
its existing cleanup return alongside `themeToggleBtn._cleanup?.()`. If you ever consider
moving it again, dashboard.js is specifically the wrong place — it's the roadmap view.

**Cross-roadmap awareness — the header badge, not the editor, on `dashboard.js`.**
Since a signed-in user spends most of their time on the dashboard rather than the
onboarding picker, `dashboard.js` re-imports `dailyTodoStore` for exactly one purpose: a
small pill (`.daily-todo-nav-badge`, next to the theme toggle) showing the soonest active
todo's live countdown (`"⏱ 46m left"`, or `"⏱ 46m left · 3 due"` once more than one is
active), reusing the same `isExpired`/`remainingMs`/`formatRemaining`/`remainingBand`
helpers and the same ok/warn/danger status-color families the todo list's own countdown
uses. It's read-only and link-only (`<a href="#/onboarding">`) — no add/done/delete
affordance lives here, only in `dailyTodoPanel.js` itself — so this is not a second copy
of the editor, just a notification that one exists. Hidden entirely (`hidden` attribute,
not just emptied) when there's no active todo. Subscribes to `dailyTodoStore` and ticks
its own 30s `setInterval` (matching `dailyTodoPanel.js`'s own cadence), both cleaned up
in `renderDashboard`'s existing route-cleanup return — same "Component subscription
cleanup" rule as everything else with a subscription or timer.

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
(`blank.js` is no longer one of the 7 — see "Manual roadmap creation" below for why it
was retired; the file itself stays in the repo, migration-only.) Templates are loaded
via dynamic `import()` so a signed-out visitor's sign-in page never downloads roadmap
content for templates they haven't picked. `roadmapStore.js`'s `setUser(user)` is
**async**: on every sign-in it does a one-time `dbApi.getMeta` read to decide
`onboardingDone`/`activeTemplateId`/`startedTemplateIds` — `meta.startedTemplateIds`
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

**Manual roadmap creation — `croadmap-...` ids (`roadmapStore.js`, issue #4).** A
user can build their own roadmap from scratch via "Create your own roadmap" (the first
card in `/onboarding`'s grid, opening `src/ui/components/newRoadmapModal.js`) instead of
picking a built-in template. `createCustomRoadmap({ title, description })` generates an
id in the shape `croadmap-<timestamp>-<random>` — `isCustomRoadmapId(id)` (exported from
the store) is the *only* thing anywhere in the codebase that distinguishes a custom
roadmap from a built-in template id, and it's deliberately a different prefix than
`addItem()`'s `custom-` item ids (a different id namespace entirely — item.id, not
templateId — but a shared prefix would be a confusing coincidence to debug). A custom
roadmap's metadata (`{ id, title, description, createdAt }`) lives in a new `customRoadmaps`
array (`users/{uid}/meta.customRoadmaps`, plus a local `KEYS.CUSTOM_ROADMAPS` fallback) —
separate from `startedTemplateIds`, which a custom roadmap's id is *also* added to, so it
flows through the exact same `switchRoadmap`/`roadmapCache`/Firebase-per-path machinery
issue #58 built for built-in templates. The one structural difference: a built-in
template's `phases` skeleton is fixed content from its template module and is never
persisted (the store just re-derives it from `getTemplatePhases()` every time), but a
custom roadmap has no template module — its `phases` (with generated `phase-...`/
`section-...` ids, so they can be renamed/deleted unambiguously by id rather than by
title) are the *only* record of what the user built, and get persisted/resolved through
the exact same cache → Firebase → local-blob → seed path as `items` (see
`resolveRoadmapItems`), and folded into the same echo/structural-version comparison in
`attachRoadmapListener` (comparing `{ items, phases }` together, not `items` alone) so a
custom roadmap's user-added structure gets the same echo-guard and multi-device sync
guarantees `items` already had. `addPhase`/`renamePhase`/`removePhase`/`addSection`/
`renameSection`/`removeSection` are silent no-ops when `activeTemplateId` isn't a custom
id — a built-in template's phase/section skeleton is fixed, never user-editable.
Renaming a phase or section re-files every item under it to the new title (so they don't
become orphaned); removing one soft-deletes every item under it (there's no phase/section
left for them to render under). `dashboard.js` only renders the "+ Add phase"/"+ Add
section"/rename/delete controls when `store.isCustomRoadmapId(activeTemplateId)` is true.
`deleteCustomRoadmap(id)` permanently removes a custom roadmap (Firebase node + local
blob + meta entry) — never usable on a built-in template id, which can only ever be
hidden (see `hideTemplate` above), never deleted. If it's the currently active roadmap,
it switches to the default built-in template (`java-backend`) first so the app is never
left without an active roadmap.

**AI-assisted roadmap import (`src/data/importPrompt.js`, `src/core/roadmap/`, issue
#4).** A second entry point next to "Create your own roadmap" — "Import roadmap"
(`src/ui/components/importRoadmapModal.js`) opens a two-tab modal instead of an empty
roadmap. **Tab 1, "Generate with AI"**: a read-only, versioned prompt block
(`buildImportPrompt(topic)`, `IMPORT_PROMPT_VERSION`) with an editable topic line that
live-updates the prompt, and a "Copy prompt" button (`navigator.clipboard.writeText`,
falling back to a hidden-textarea + `execCommand('copy')` for older/non-secure
contexts). **Tab 2, "Paste & Import"**: a textarea validated 300ms after each keystroke
via `validateImportText()` (`src/core/roadmap/importValidator.js`) — a **pure** function
(no DOM, no store, no Firebase) that parses the JSON and checks it against schema
version 1 (`SUPPORTED_SCHEMA_VERSION`): `schemaVersion === 1`, non-empty `title`,
non-empty `phases` array where every phase has a `title`/`priority ∈ {P0-P3}`/non-empty
`sections` array, every section has a `title`/non-empty `items` array, every item is
either a plain string (inherits the phase's priority) or a `["title","priority"]` tuple,
and the total item count is ≤ 500 — returning an array of per-field error strings
(`phases[i].sections[j].items[k] is invalid`, etc.), empty meaning valid. Only once
valid does `adaptImportToRoadmap()` (`src/core/roadmap/schemaAdapter.js`) — equally
pure — convert the validated data into the exact `{ phases, items }` shape a custom
roadmap needs (generating `phase-...`/`section-...`/`custom-...` ids the same way
`addPhase`/`addSection`/`addItem` do), and the "Import roadmap" button enables. The
validator and adapter are deliberately two separate pure modules: bumping the import
wire format to a future schema version means adding a new adapter function, never
touching the validator's rules or the other way around. The modal resolves
`{ title, phases, items } | null` — the caller (`onboarding.js`'s `handleImport()`)
passes it straight to `store.createCustomRoadmap({ title, phases, items })`, the exact
same function the manual "Create your own roadmap" flow calls (just with the `phases`/
`items` arguments populated instead of omitted). `roadmapStore.js` makes this work via a
one-shot `pendingCustomSeeds` map: `createCustomRoadmap` stashes the seed keyed by the
freshly generated id right before calling `switchRoadmap(id)`, and `fetchTemplateData`
consumes (and deletes) it instead of returning the usual empty seed for a custom id — a
manually-created roadmap simply has no entry there and falls through to the empty seed
unchanged. From that point on an imported roadmap is indistinguishable from a manually
built one — same Firebase path, same phase/section rename/delete controls, same
`deleteCustomRoadmap` cleanup.

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
hide (×) button (no exceptions, since issue #4 follow-up retired "blank" — the one card
that used to be exempt); clicking it (after a `confirm()`) calls `store.hideTemplate(id)`,
which appends to `hiddenTemplateIds` and persists it to `users/{uid}/meta/hiddenTemplateIds`
(plus a local fallback) — **this is a per-user preference, never a deletion of the
template or a change visible to any other user.** `getTemplate`/`buildSeedItems`/
`getTemplatePhases` never consult it; it only filters which cards `onboarding.js`
renders. A "Show hidden templates (N)" toggle reveals hidden cards with a "Restore"
button (`store.unhideTemplate(id)`) instead of the normal pick/hide affordances.
"Create your own roadmap" (never hideable — it's an action card, not a pickable
template) carries a corner ℹ info button instead, opening the "build your own" guide
(`src/ui/components/buildYourOwnGuide.js`) — this is where blank's old info button
moved to. The guide now covers both real paths: manual (`"+ Add phase"`/`"+ Add
section"`/`"Add a custom topic…"`) and AI-assisted (an "Open Import roadmap" button that
closes the guide and calls the same `handleImport()` the "Import roadmap" card uses) —
do not let it drift back to describing a manual copy-paste-into-an-AI-chat workflow now
that real automated import exists.

**"blank" template retirement and migration (`roadmapStore.js`, `src/data/templates/`,
issue #4 follow-up).** Once manual roadmap creation (CRUD, above) and AI-assisted import
(below) both existed, the "Start blank" built-in template — four fixed, uneditable
Learn/Practice/Build/Review phases, exactly one per account, never hideable — became a
strict subset of "Create your own roadmap": a custom roadmap can do everything blank
could and is fully editable besides. It was removed from `TEMPLATES` accordingly.
`blank.js` itself is untouched and still directly importable (via a new migration-only
export, `getLegacyBlankTemplateData()`) — only its entry in the `TEMPLATES` array is
gone, so `getTemplate('blank')`/`buildSeedItems('blank')`/`getTemplatePhases('blank')`
now fall back to `TEMPLATES[0]` for it like any other unrecognized id. Anyone who
already started "blank" is migrated forward automatically on their next `setUser()` —
before `fetchTemplateData(activeTemplateId)` would otherwise be called with the now-
meaningless `'blank'` id — into a real custom roadmap (`croadmap-...` id, titled "My
roadmap"): reads whatever is actually stored at `users/{uid}/roadmaps/blank` (Firebase
first, then the local blob), falling back to `getLegacyBlankTemplateData()`'s fixed
phases/empty seed only for whichever half (items or phases) is missing — pre-PR-#60
accounts never had `phases` persisted at all. `activeTemplateId`/`startedTemplateIds`
are swapped to point at the new id and the corrected meta is saved to Firebase in the
same pass, so the account is never re-migrated (or duplicated) on a later sign-in. The
old `users/{uid}/roadmaps/blank` node is never deleted — same never-delete-just-
stop-reading precedent as every other legacy path in this file. See the
"blank-template migration" describe block in `tests/integration/roadmapStore.test.js`.

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
bumps when they actually differ. `phases` is folded into this same comparison (issue #4)
rather than checked separately, so a custom roadmap's user-added phases/sections get the
identical echo-guard and multi-device sync behavior `items` already had — for a built-in
template `phases` never differs, so this is a no-op there. If this comparison is ever
removed or replaced with an unconditional bump, the
checklist flicker comes back — it'll just be delayed by a save round-trip instead of
happening immediately on click, which makes it easy to miss in casual testing.

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
row must follow this pattern or it will silently toggle the row's checkbox — this is
exactly the bug that was fixed for the resource badge.

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

**Anonymous Firebase Auth users must be explicitly deleted when they exit without linking, to prevent orphaned data (issue #24).** A guest session's anonymous UID can never be re-authenticated once the session ends, so if it's never linked to a real account (`authApi.linkGuest`), its roadmap data would otherwise sit in the database forever with no way to read, export, or delete it. `authApi.signOut()` (`src/services/firebase.js`) delegates to `signOutWithCleanup()` (`src/services/authCleanup.js` — a pure, dependency-injected function with no Firebase imports, kept separate specifically so it's unit-testable without a real Firebase project) which checks `user.isAnonymous` first: for an unlinked guest it removes `users/{uid}` from the database and then deletes the Auth record (same data-before-Auth-record order as `deleteAccount()`, and for the same reason), instead of a plain sign-out. A linked guest is no longer anonymous by the time they sign out, so that path is unaffected. If the cleanup call throws (e.g. a stale token), it falls back to a plain sign-out — never block the user from leaving the app over a cleanup failure. See `docs/adr/ADR-005-anonymous-user-lifecycle.md`.

**Realtime Database rules — no path other than `roadmap`/`roadmaps`/`meta`/`dailyTodos` may be written under `users/{uid}`, and `reports/{uid}` is reserved for issue #9.** `firebase/database.rules.json` has a `$other: { ".validate": "false" }` catch-all under `users/$uid` specifically to stop a buggy or malicious client from writing arbitrary data outside the known shape (still auth-scoped to that uid, just unbounded before this). If you add a genuinely new top-level field under a user's data, add an explicit `.validate` rule for it — never rely on the `$other` catch-all rejecting it silently as "good enough." Realtime Database rules cannot count a map's children, so a per-roadmap item cap is enforced client-side instead, in `roadmapStore.js`'s `addItem()` (the one place items are created) — it returns `false` instead of mutating anything once a roadmap already holds 800 non-deleted items (lowered from 1,000 in issue #53 — no real roadmap organically approaches even 800 topics); callers must check this return value and surface an error rather than assuming success. The same client-side-cap pattern applies to `dailyTodoStore.js`'s `addTodo()` (issue #56) — active (not-done, not-expired) todos are capped at `MAX_ACTIVE_TODOS` (20).

**Client-side length caps on title/resource fields (`src/core/roadmap/limits.js`, issue #53) — the client-side half of issue #24's server-side Firebase rules.** `MAX_TITLE_LENGTH` (200), `MAX_RESOURCE_LABEL_LENGTH` (120), and `MAX_RESOURCE_URL_LENGTH` (2048) live in their own dependency-free module — never define these constants directly in `roadmapStore.js`, since `itemPanel.js` needs to import just the numbers without pulling in `roadmapStore.js`'s Firebase-backed storage-adapter chain (`adapterFactory.js` → `FirebaseAdapter.js` → `firebase.js`'s `https://` SDK imports), which breaks under Node's ESM loader in any test that doesn't mock `firebase.js`. `roadmapStore.js`'s `addItem()`, `updateItem()`, `addResource()`, and `updateResource()` — the only places these fields are ever written — reject (returning `false`, mutating nothing) a value over these caps; callers must check the return value, same convention as the item-count cap above. `itemPanel.js`'s Save/Add-resource handlers and `dashboard.js`'s quick-add row surface a friendly message using the same constants before the store call is even attempted — always keep the UI-layer message and the store-layer cap using the same imported constant, never a hardcoded number in either place.

**ESLint code-cleanliness gates (`eslint.config.js`, issue #53).** `complexity: 10`, `max-depth: 4`, `max-lines-per-function: { max: 80 }`, and `max-params: 4` run as `warn` on every PR via the existing `lint` CI job. They are intentionally `warn`, not `error` — several files (`itemPanel.js`, `signUp.js`, `onboarding.js`, `importRoadmapModal.js`, and parts of `roadmapStore.js` carrying many documented invariants) still exceed them and are out of this issue's scope. When you touch a function that's already flagged, prefer extracting a **named, module-scope function** (grep-able, independently unit-testable) over just shortening lines — see `renderFilterChips`/`renderPhaseCard` in `dashboard.js`, `buildSignInForm`/`buildResetForm` in `signIn.js`, and `applyRemoteSnapshot` in `roadmapStore.js` for the pattern. Don't flip these to `error` without first re-auditing the whole repo's violation count — they were left at `warn` specifically because zero violations was never reached repo-wide.

**Component subscription cleanup — always unsubscribe on DOM removal, or clear the timer.** Any component that calls `onThemeChange()`, subscribes to any other module-level store or service, or starts a `setInterval`/`setTimeout` that outlives a single render, must capture the returned unsubscribe function (or the timer id) and clean it up when the component is torn down. The pattern: attach the cleanup to the element as `el._cleanup = unsubscribe` (or a function that calls `clearInterval`/`clearTimeout`), have the component factory return `{ node, cleanup }` (or expose `_cleanup` for callers to collect), and wire the cleanup into the route's cleanup return in `main.js`. Failing to do this leaks dead DOM references, fires callbacks on removed nodes, or leaves a timer running forever — see Issue #27 (subscriptions) and `dailyTodoPanel.js`'s 30s countdown `setInterval` (issue #56, the same hazard applied to a timer instead of a subscription). Never add a subscription or a long-lived timer without a paired teardown path.

**Card/grid layout — every card in a row must be equal height, with variable-length content, not the grid's stretch behavior, being the thing you design around.** A CSS grid's cells stretch equally by default (`align-items: stretch`), but a card only visually fills that cell if the card element itself is sized to `height: 100%` and stacks its content as a flex column — otherwise each card sizes to its own content and rows visibly mismatch the moment one card's text runs longer than its neighbors (this exact bug hit `.template-card` in the onboarding template picker, `src/ui/pages/onboarding.js` / `src/styles/app.css` — same-row cards rendered at different heights because the card had no `height: 100%` and used `display: grid` with content-sized rows instead of a flex column). The required pattern for any new card-grid component:
- Grid container: `display: grid; grid-template-columns: repeat(auto-fit, minmax(<min>, 1fr)); align-items: stretch;` so it reflows responsively across breakpoints without a bespoke media query per card count.
- Card element: `height: 100%; display: flex; flex-direction: column;` so it actually fills the stretched cell.
- Any footer/action element (badge, button, count) that should stay flush to the card's bottom regardless of how long the body text is: `margin-top: auto` on that element — never rely on equal source text length to keep footers visually aligned.
- Every element that should stay left-aligned inside the flex column needs an explicit `align-self: flex-start` (or `text-align: left` for text content) — a bare `<button>` left in a stretched flex column centers its text by default (the browser's UA stylesheet), which is an easy regression to introduce when converting a card from `display: grid` (where `justify-self: start` did this job) to `display: flex`.
Verify visually at at least three viewport widths (mobile ~390px, tablet ~820px, desktop ~1440px) before calling a card-grid change done — unit tests run in jsdom and cannot catch layout/height mismatches.

**Responsive breakpoint scale — six tiers, not two (`src/styles/app.css`, issue #36).**
`≤375px` (small phone) / `≤480px` (phone) / `≤768px` (tablet portrait) / `≤1024px`
(tablet landscape / small laptop) / the untuned base styles for laptop–desktop /
`≥1600px` (large/ultra-wide desktop, a `min-width` tier) replaces the old ad-hoc
`920px`/`640px` pair — see the comment block above the `@media` rules at the bottom of
`app.css` for the full rationale. Add new breakpoint-specific rules to the existing tier
whose intent matches (don't invent a seventh number); if none fits, ask whether the new
rule is really about screen width at all, since touch/hover capability (below) is a
separate axis and should never be inferred from width.

**Touch vs. hover capability must be detected with `(hover: …)`/`(pointer: …)` media
features, never with a viewport-width media query as a stand-in (issue #36).** A
touchscreen laptop, Surface, or iPad in landscape has a desktop-sized viewport but no
reliable `:hover` — width-based detection gets this wrong in both directions (it also
wrongly assumes every *narrow* viewport is touch-only, which breaks a narrow desktop
browser window resized by a mouse user). `.check-actions` (the per-row Edit/resource
controls, hidden via `opacity: 0` and revealed on `:hover`/`:focus-within`) is forced
visible under `@media (hover: none), (pointer: coarse)` — not under a `max-width` query.
Any future hover-reveal control must follow the same pattern. Touch targets
(`.btn-icon`, `.btn-sm`, `.filter-chip`, `.check-item`) are raised to a ~44×44px minimum
(WCAG 2.5.5) under `@media (pointer: coarse)` for the same reason — a mouse user at a
narrow window shouldn't get oversized targets, and a touch user at a wide one should.
See `docs/adr/ADR-006-responsive-breakpoints-touch-hover.md`.

**No focusable field may render under 16px font-size on a phone/tablet viewport
(`≤1024px`, issue #36).** iOS Safari auto-zooms the whole page when a focused input's
computed font size is under 16px — jarring on every tap into `.field-input.compact` (the
dense rename/add-topic rows) or `.search-input`. Fixed with a `≤1024px` override
bumping `.field-input`/`.field-input.compact`/`.search-input`/`.import-paste-area` to
`font-size: 16px` — scoped to that width tier (not unconditional) specifically so the
denser desktop field styling is untouched, since desktop Safari/Chrome don't have this
zoom behavior. Any new focusable field class must be added to that override.

**`100vh` does not track a mobile browser's real visible height — use `100dvh` with a
`100vh` fallback.** Mobile Safari/Chrome collapse and expand their address bar, so a
fixed-height container sized with `100vh` alone can be cut off or jump when the browser
chrome resizes. Every full-height container (`.app-shell`, `.auth-page`,
`.onboarding-page`, `.dashboard`) declares `min-height: 100vh;` immediately followed by
`min-height: 100dvh;` — the second declaration wins in browsers that support `dvh` and
is silently ignored (falling back to the first) in ones that don't. Never remove the
`100vh` line when adding a `100dvh` one; they're a pair, not a replacement.

**Safe-area insets on fixed chrome (`viewport-fit=cover`, issue #36).** `index.html`'s
viewport meta includes `viewport-fit=cover` (required for `env(safe-area-inset-*)` to
resolve to anything nonzero) — this matters most because `public/manifest.json` sets
`"display": "standalone"`, so an installed PWA has no browser chrome to keep content
clear of a notch/Dynamic Island/gesture bar on its own. `.dashboard-header`, `.auth-page`,
`.onboarding-page` pad their top/left/right with `max(<base>, env(safe-area-inset-*))`;
`.item-panel` (fixed, full-height, right-edge) pads top/right/bottom directly; `.save-badge`
and `.toast-stack` (fixed near the bottom) add `env(safe-area-inset-bottom)` to their
`bottom` offset. Any new `position: fixed` element that touches an edge of the viewport
needs the same treatment.

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

**`firebase.config.js` is gitignored on purpose.** It holds client-side Firebase
identifiers (`apiKey`, `authDomain`, etc.) that are visible to any user who opens
DevTools — they are not secrets in the traditional sense, but keeping the file out of
git prevents accidental commitment of production credentials during local development.
CI injects the production config from the `FIREBASE_CONFIG` GitHub Secret at deploy time.

**Required GitHub secrets/variables** (set in repo → Settings → Secrets and variables → Actions):
- `FIREBASE_SERVICE_ACCOUNT` (secret) — Firebase service account JSON for deploy auth
- `FIREBASE_CONFIG` (secret) — contents of `src/services/firebase.config.js` for production
- `FIREBASE_PROJECT_ID` (variable) — project ID (non-sensitive; use GitHub Variables, not Secrets)

Also update `.firebaserc` with the real project ID before running `firebase deploy` locally.

## Verifying changes

```
npm run lint           # must exit 0
npm test               # must exit 0
npm run dev            # serves at http://localhost:4173
```

Manual browser check: sign in as guest, toggle several checklist items across phases (confirm no unrelated phase-cards flash), click a "N resources" badge (confirm it opens the edit panel and does not toggle the item), toggle the theme button on both auth screens and the dashboard (confirm it persists across reload).

**Cross-device / responsive verification matrix (issue #36).** Required whenever a
change touches `app.css`, `index.html`, or any page/component's layout — not just for
issue #36 itself:
- **Widths (DevTools device emulation, both themes):** 320, 375, 390, 414, 768, 820,
  1024, 1280, 1440, 1920, 2560.
- **Touch/hover:** with DevTools' device toolbar set to a touch-capable emulated
  device, confirm `.check-actions` (the row Edit/resource controls) is visible without
  hovering. With emulation off (plain mouse), confirm it's hidden until hover/focus.
- **Touch targets:** at an emulated touch width, confirm `.btn-icon`/`.btn-sm`/
  `.filter-chip`/checklist rows visually measure ~44×44px (DevTools' box-model
  inspector on the computed style, not just eyeballing).
- **Mobile browser chrome:** simulate the address-bar collapse/expand (scroll down
  then up in an emulated mobile viewport) and confirm no fixed element (item panel,
  toasts, save badge) jumps or gets cut off.
- **Real devices, in addition to emulation, before merging:** one pass on real iOS
  Safari and one on real Android Chrome — DevTools emulation does not reproduce iOS's
  input auto-zoom or a real notch/gesture-bar safe area.
