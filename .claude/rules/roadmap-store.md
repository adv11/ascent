---
paths:
  - "src/services/roadmapStore.js"
  - "src/services/dailyTodoStore.js"
  - "src/services/activityLogStore.js"
  - "src/services/storage/**"
  - "src/core/roadmap/**"
  - "src/core/dailyTodo/**"
  - "src/core/analytics/**"
  - "src/data/templates/**"
  - "src/data/importPrompt.js"
  - "src/data/roadmap.js"
  - "src/ui/pages/dashboard.js"
  - "src/ui/pages/onboarding.js"
  - "src/ui/components/dailyTodoPanel.js"
  - "src/ui/components/dailyTodoGuide.js"
  - "src/ui/components/addToDailyTodoModal.js"
  - "src/ui/components/importRoadmapModal.js"
  - "src/ui/components/importBackupModal.js"
  - "src/ui/components/newRoadmapModal.js"
  - "src/ui/components/sidebar.js"
  - "src/ui/components/backupReminderBanner.js"
  - "src/ui/utils/backupTransfer.js"
  - "src/ui/utils/backupActions.js"
  - "src/ui/utils/backupReminder.js"
  - "tests/unit/backupSchema*"
  - "tests/unit/backupValidator*"
  - "tests/unit/importBackupModal*"
  - "tests/unit/backupActions*"
  - "tests/unit/backupReminder*"
  - "src/ui/components/buildYourOwnGuide.js"
  - "src/ui/components/itemPanel.js"
  - "src/ui/utils/customRoadmapIcon.js"
  - "src/ui/utils/dailyTodo.js"
  - "tests/unit/roadmapStore*"
  - "tests/integration/roadmapStore*"
  - "tests/integration/dailyTodoStore*"
  - "src/services/feedbackStore.js"
  - "src/services/feedbackRateLimit.js"
  - "src/core/feedback/**"
  - "src/ui/components/feedbackWidget.js"
  - "src/ui/components/feedbackModal.js"
  - "src/ui/components/feedbackForm.js"
  - "src/ui/components/screenshotCapture.js"
  - "src/ui/components/myReports.js"
  - "tests/unit/reportSchema*"
  - "tests/unit/metadataCollector*"
  - "tests/unit/feedbackRateLimit*"
  - "tests/integration/feedbackStore*"
---

# Roadmap & Daily Todos store — data model, invariants, feature history

This file is the roadmap/todo domain's institutional memory: the store contracts, the
guards that prevent real regressions that have already happened once, and the reasoning
behind the multi-roadmap/custom-roadmap/import/daily-todo feature set. Relocated from
`CLAUDE.md` (issue #86) with no content changes — see `docs/adr/ADR-007-agent-memory-architecture.md`.

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
uses. It's read-only and link-only (`<a href="#/onboarding">`) — no done/delete/edit
affordance lives here, only in `dailyTodoPanel.js` itself; the one exception is the
row-level "link a topic to a todo" button below, which only ever *creates* a todo, never
edits/completes/deletes one. Hidden entirely (`hidden` attribute, not just emptied) when
there's no active todo. Subscribes to `dailyTodoStore` and ticks its own 30s
`setInterval` (matching `dailyTodoPanel.js`'s own cadence), both cleaned up in
`renderDashboard`'s existing route-cleanup return — same "Component subscription
cleanup" rule (root `CLAUDE.md`) as everything else with a subscription or timer.

**Linking a roadmap topic to a Daily Todo, and completing either one from the other
(issue #56 follow-up).** Every checklist row (`renderItemRow`, `dashboard.js`) has a ⏱
button, next to Edit, opening `openAddToDailyTodoModal()`
(`src/ui/components/addToDailyTodoModal.js` — same promise-based `{ ... } | null` contract
as `openNewRoadmapModal()`) to ask how long you have; the topic's own title comes
pre-filled (and editable — the todo doesn't have to be phrased exactly like the topic).
Confirming calls `dailyTodoStore.addTodo()` with `linkedTemplateId`/`linkedItemId` set to
the row's `(activeTemplateId, item.id)` pair, plus a `linkedItemTitle` display-time
snapshot — **never just the topic's title**, since the same title can exist in more than
one roadmap (the "Marketing Fundamentals" topic in a built-in template and a custom
roadmap's own topic of the same name are different items) and only the id pair
disambiguates which one a given todo actually points at.

Completing that side of the link is where the real complexity lives, entirely in
`dailyTodoPanel.js`'s `handleToggleDone()` and `roadmapStore.setItemDoneInTemplate()`:
- **Checking** a linked todo (issue #56's original ask) asks for confirmation first
  (`confirmDialog`, non-danger, naming the target roadmap: `"This will also mark this
  topic done in <Roadmap Name>."`) — a cross-cutting side effect on data the user isn't
  necessarily looking at deserves an explicit heads-up, same reasoning as any other
  consequential confirmDialog in this app. Cancelling resets the checkbox's visual state
  (the browser already flipped it before the handler ran) and touches nothing.
- **Unchecking** a completed linked todo syncs back silently, no confirmation — this is
  the safe, reversible direction, consistent with how every other done/not-done toggle
  in the app already works.
- Either direction calls `roadmapStore.setItemDoneInTemplate(templateId, itemId, done)`
  — new, and the one genuinely new piece of surface area in `roadmapStore.js` for this
  feature: it marks an item done/not-done in **any** template, not just the one currently
  active, without ever silently switching the user's active roadmap out from under them.
  Three cases, cheapest first: (1) the target template is already active — delegates to
  `updateItem()` with the extra `completedViaTodoAt` bookkeeping folded into the same
  patch, so the row's badge (below) gets its `structuralVersion` re-render for free, same
  precedent as the `notes` field; (2) the target template is cached (visited this
  session, just not on screen right now) — patches `roadmapCache` in place and persists
  (local blob + `adapter.saveRoadmap`) directly, touching neither `activeTemplateId` nor
  `structuralVersion`, since nothing currently rendered needs to change; (3) the target
  template is cold (never touched this session) — one-shot reads it (Firebase first,
  local blob fallback), patches, and persists the same way. Resolves `{ ok: false }` if
  the item can't be found anywhere (its topic, or the whole roadmap, was deleted after
  the todo was linked to it) — the todo still completes either way (the user's intent to
  finish *something* should stand even if the link has gone stale), just with a softer
  warning toast instead of the normal success one.
- A completed link gets a small ⏱✓ indicator on the topic's own row
  (`.completed-via-todo-indicator`, tooltip `"Completed via Today's Todo on <date>"`) —
  a **new, dedicated field** (`item.completedViaTodoAt`), never appended to the topic's
  own free-text `notes` field, so an auto-generated annotation never mixes with something
  the user actually typed. Cleared automatically the moment either side is unchecked
  again — `dashboard.js`'s own checklist-row toggle (`toggleDone()`) clears it when a
  user unchecks a topic directly (not via the linked todo), and
  `setItemDoneInTemplate(..., false)` clears it on the todo-driven uncheck path — so the
  badge can never show a stale completion date on a topic that's since been reset. Note
  the coupling only ever runs one direction structurally: `dailyTodoStore.js` never
  imports `roadmapStore.js` (a todo can exist with no roadmap at all); it's
  `dailyTodoPanel.js`, the UI layer, that's handed both stores and orchestrates between
  them. Toggling a linked topic's `done` state directly on the dashboard (bypassing the
  todo) does **not** reach back and flip the linked todo itself — only the
  `completedViaTodoAt` annotation is kept honest that way, not full bidirectional sync of
  `done` in both directions; if that's ever needed, it has to be built deliberately, not
  assumed to already exist.

**Undoing a linked todo before it's completed, and a soft-delete edge case (issue #56
follow-up).** The ✕ delete button (`handleDelete` in `dailyTodoPanel.js`) is available on
every todo regardless of state — active, done, or missed — not just done/missed as
originally built. This is deliberately how you "undo" a topic linked by mistake: deleting
an **active** linked todo never calls `roadmapStore.setItemDoneInTemplate` at all (only
completing one does), and the confirm dialog's message says so explicitly
("...The linked roadmap topic is untouched either way.") rather than leaving that
implicit. `setItemDoneInTemplate` also treats a soft-deleted item
(`item.deleted === true`, set by `removeItem()` — the item is still physically present in
the map, just never rendered again) the same as a genuinely missing one in all three of
its cases (active/cached/cold), resolving `{ ok: false }` instead of silently "succeeding"
against a topic the user can no longer see or interact with — without this, completing a
linked todo whose source topic had been deleted would report success with zero visible
effect.

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

**Every one-time Firebase read/write in `FirebaseAdapter.js` is wrapped in a 15s
timeout (`src/services/storage/withTimeout.js`, issue #6 Phase 5 follow-up).**
Firebase's Realtime Database SDK has no built-in timeout — a stalled WebSocket
connection (a strict content/tracker blocker holding the connection open-but-silent, a
flaky network, a corporate proxy) leaves a bare `get()`/`set()`/`update()`/`remove()`
promise pending forever, with no rejection to catch. This was a real, reported bug:
`switchRoadmap()`'s `await flush()` (which itself awaits `adapter.saveRoadmap()`) and
`await adapter.saveMeta()` have no timeout of their own, so a stalled connection left
`onboarding.js`'s `pickTemplate()`/`pickCustomRoadmap()` stuck in a "picking" state
indefinitely — every card disabled, no error, no way out but a page reload. Every
caller of `getRoadmap`/`getMeta`/`getLegacyRoadmap`/`saveRoadmap`/`saveMeta` already
try/catches the call and falls back to a local blob or a fresh seed (see the
"Watch the Firebase echo" and initial-load sections below) — so turning an infinite
hang into a timely rejection needed zero changes to that fallback logic, only to
`FirebaseAdapter.js` itself. `listenRoadmap`/`listenDailyTodos` (subscriptions, not
one-shot promises) are deliberately **not** wrapped — a stalled listener just means no
update arrives, and the existing stale-listener guard already handles a listener being
replaced. If you add a new one-time Firebase call to `FirebaseAdapter.js`, wrap it with
`withTimeout()` too — an unwrapped one silently reintroduces this exact hang.
`onboarding.js`'s `pickTemplate()`/`pickCustomRoadmap()` catch blocks also now show an
error toast on failure (previously silent — the cards just quietly re-enabled with no
explanation, indistinguishable from success without noticing); keep that pairing if you
add another `switchRoadmap()` call site.

`FirebaseAdapter` carries `dbApi`'s exact former logic with no behavior change. Since
which backend applies is resolved per sign-in (not a fixed, once-per-app-load choice),
`roadmapStore.js`'s `adapter` binding is a `let` reassigned via
`getStorageAdapter(nextUser)` at the top of every `setUser()` call, not a `const` fixed
once at store creation. `LocalStorageAdapter` is a complete, unit-tested implementation
of the same contract over its own dedicated keys, but is **not wired into
`roadmapStore.js`** — and, per issue #125's decision, this is now closed as **not
planned** rather than left as open-ended scaffolding, same precedent as Google Drive
sync just below: the file stays (it's tested, harmless, and a real "true guest-only local
mode" feature could still pick it up later), but there is no active plan to wire it in.
`adapterFactory.js` unconditionally returns `firebaseAdapter` and is expected to keep
doing so.

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
(`blank.js` is no longer one of the 7 — see "'blank' template retirement" below for why it
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

**Manual "start truly blank" roadmap creation was retired in issue #100 —
`src/ui/components/newRoadmapModal.js` no longer exists.** The standalone entry point
that seeded a zero-phase roadmap for the user to build entirely by hand is gone; every
custom roadmap is now created via the AI-assisted flow below, with `phases`/`items`
already populated at creation time. **Everything else in this section is unchanged**:
the underlying `createCustomRoadmap({ title, description?, phases?, items? })` contract,
`croadmap-...` id generation, and every dashboard-level manual phase/section/item CRUD
control (`+ Add phase`, `+ Add section`, `Add a custom topic…`, rename/delete, `itemPanel.js`
edit) it described are exactly as they were — those remain how *any* custom roadmap
(AI-created or not) gets fine-tuned afterward, never removed. The "seeds empty" code
path inside `createCustomRoadmap` (omitting `phases`/`items`) is now dead — nothing calls
it that way anymore — and can be trimmed as a follow-up cleanup; it was left in place by
issue #100 as a non-blocking cleanup, not an oversight.

**Custom roadmap ids (`roadmapStore.js`, issue #4).** A custom roadmap —
whether created via the AI-assisted flow (below) or, historically, via the now-retired
manual flow above — gets an id in the shape `croadmap-<timestamp>-<random>` —
`isCustomRoadmapId(id)` (exported from
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
hidden (see "Per-user hidden templates" below), never deleted. If it's the currently active roadmap,
it switches to the default built-in template (`java-backend`) first so the app is never
left without an active roadmap.

**Onboarding card affordances — the delete button must never look like the hide
button (issue #61).** A custom/imported roadmap card's `×` (`buildCustomCard`,
`onboarding.js`) permanently deletes the roadmap; a built-in template card's `×`
(`buildCard`) only hides it, a reversible per-user preference. They used to share the
same `template-card-hide` class and neutral glyph, so the difference was invisible
until after the click, when the `confirmDialog` copy finally said so. The custom card's
button now has its own `template-card-delete` class (`app.css`) — a trash icon (🗑),
styled with the existing `--danger`/`--danger-border` tokens at rest, not just on
hover — so the destructive affordance signals up front. Never restyle
`template-card-delete` to look neutral, and never give the built-in hide button
danger styling — the whole point is that a user can tell them apart at a glance.
Also, every custom/imported roadmap card used to render the identical generic `✎`
regardless of title, unlike a built-in template's unique per-topic icon (`template.icon`).
`pickCustomRoadmapIcon(id)` (`src/ui/utils/customRoadmapIcon.js`, pure, dependency-free)
derives a stable icon from a hash of the roadmap's id — same id always yields the same
icon, across sessions and devices, with no new UI and no `customRoadmaps` schema
change. If a real icon-picker UI is ever built, this hash-based default is what an
unset `icon` field should fall back to, not a re-introduced fixed glyph.

**AI-assisted roadmap creation (`src/data/importPrompt.js`, `src/core/roadmap/`, issues
#4/#64, redesigned in #100).** Since issue #100 retired manual "start truly blank"
creation and merged onboarding's two cards into one, this is the *only* way to start a
custom roadmap — the single "Create your own roadmap" card (`onboarding.js`) opens
`openCreateRoadmapModal()` (`src/ui/components/importRoadmapModal.js`, renamed from
`openImportRoadmapModal()`). **Layout**: a two-column "Build your prompt" / "Paste the
AI's answer" grid at the ≥1025px breakpoint tier (`.import-modal-grid`,
`.claude/rules/ui-styling.md`'s breakpoint scale), collapsing to the original
single-column top-to-bottom flow issue #64 established below that tier — each column
scrolls independently, with a shared header/footer outside the grid so Import/Cancel
stay reachable without scrolling either column. **Left column**: a topic field, the four
optional customization inputs (below), a read-only versioned prompt block
(`buildImportPrompt(topic, options)`, `IMPORT_PROMPT_VERSION`) with an editable topic
line that live-updates the prompt, and a "Copy prompt" button
(`navigator.clipboard.writeText`, falling back to a hidden-textarea +
`execCommand('copy')` for older/non-secure contexts) — **disabled until the topic field
is non-empty** (issue #100 fix: previously a user could copy the prompt with the literal
placeholder text `[describe what this roadmap should cover]` and no warning). **Right
column**: the paste textarea, validated 300ms after each keystroke via
`validateImportText()` (`src/core/roadmap/importValidator.js`) — a **pure** function (no
DOM, no store, no Firebase) that parses the JSON (`parseImportJson()` first strips a
single leading/trailing fenced code block, ```` ```json ... ``` ````, with or without the
language tag, since many AI assistants wrap their output that way despite being told not
to — issue #100) and checks it against schema version 1 (`SUPPORTED_SCHEMA_VERSION`):
`schemaVersion === 1`, non-empty `title`, non-empty `phases` array where every phase has
a `title`/`priority ∈ {P0-P3}`/non-empty `sections` array, every section has a
`title`/non-empty `items` array, every item is a plain string (inherits the phase's
priority), a `["title","priority"]` tuple, or — since issue #100's resources support — an
object `{ title, priority?, resources? }` (`priority` optional, inherits the phase's like
the plain-string form; `resources` optional, up to 5 `{ label, url }` pairs, each checked
structurally — non-empty, length-capped label/url — but **not** for URL protocol
correctness). Every priority value (phase, tuple item, object item) is normalized
(`normalizePriority()`: trim + uppercase) before the `∈ {P0-P3}` check, so `"p0"`/`" P0 "`
from an AI response are accepted rather than rejected outright. **Resource URL protocol
safety is deliberately not checked at this validation layer** — see the "a good roadmap
could fail validation entirely over one malformed resource URL" fix below for why; it
moved to conversion time (`adaptImportToRoadmap()`). The total item count is ≤ 500 across
all shapes — returning an array of per-field error strings
(`phases[i].sections[j].items[k] is invalid`, etc.), empty meaning valid. On error, the UI
shows a plain-language summary
("N things need fixing before this can be imported") plus a **"Copy fix-it message for
your AI"** button — `buildImportFixPrompt(errors)` (`src/data/importPrompt.js`, same
module/versioning discipline as `buildImportPrompt`, pure, no `IMPORT_PROMPT_VERSION`
bump since it doesn't touch the schema contract) composes a ready-to-copy message
restating the schema-version-1 contract, listing the errors verbatim, and asking for the
complete corrected JSON (not a diff/patch). The original technical error list is kept,
collapsed by default behind a "Show technical details" toggle. Only once valid does
`adaptImportToRoadmap()` (`src/core/roadmap/schemaAdapter.js`) — equally pure — convert
the validated data into the exact `{ phases, items }` shape a custom roadmap needs
(generating `phase-...`/`section-...`/`custom-...` ids the same way
`addPhase`/`addSection`/`addItem` do; the object item form's `resources` array is
**sanitized**, not just mapped, onto `item.resources` — `sanitizeResources()` auto-
prepends `https://` to a bare-domain URL (`docs.docker.com` → `https://docs.docker.com`,
a very common AI-output pattern) and drops any resource whose URL still isn't a valid
http(s) link after that, rather than failing the whole item. Once sanitized, an imported
topic with resources renders identically to one whose links were added by hand through
`itemPanel.js`, no separate rendering path), and the "Import roadmap" button (in the
shared footer) enables. The validator and adapter are deliberately two separate pure modules:
bumping the import wire format to a future schema version means adding a new adapter
function, never touching the validator's rules or the other way around. The modal
resolves `{ title, phases, items } | null` — the caller (`onboarding.js`'s
`handleCreate()`) passes it straight to `store.createCustomRoadmap({ title, phases,
items })`. `roadmapStore.js` makes this work via a one-shot `pendingCustomSeeds` map:
`createCustomRoadmap` stashes the seed keyed by the freshly generated id right before
calling `switchRoadmap(id)`, and `fetchTemplateData` consumes (and deletes) it instead of
returning the usual empty seed for a custom id. From that point on a created roadmap is
indistinguishable from any other custom roadmap — same Firebase path, same phase/section
rename/delete controls, same `deleteCustomRoadmap` cleanup.

**A single malformed resource URL or oddly-cased priority must never fail the whole
roadmap (issue #100 follow-up, found via real-world testing).** Early real-world use of
the resources feature above found roadmaps failing "item is invalid" across many
unrelated topics, sometimes on the first *and* second generation attempt, tracing back to
two harmless AI-output quirks that used to be treated as hard validation failures: a
resource URL missing its `https://` scheme (`docs.docker.com` instead of
`https://docs.docker.com` — very common, since a URL "looks complete" to a model without
the scheme), and a priority value with different casing/whitespace (`p0`, ` P0 `). Both
are now handled defensively instead of rejected: priorities are normalized
(`normalizePriority()`, `importValidator.js`) before every `∈ {P0-P3}` check anywhere in
the validator, and resource URL protocol correctness moved entirely out of validation —
`adaptImportToRoadmap()`'s `sanitizeResources()` auto-corrects a bare-domain URL and
silently drops (rather than fails the topic over) one that's still invalid after that.
**One consequence worth knowing**: because URL protocol is no longer checked at
validation time, `validateImportPayload()` alone can no longer be used as a security
gate against a malicious resource URL — that check now only happens in
`adaptImportToRoadmap()`, which is why `validateImportText()`'s `data` must never be
treated as safe-to-render without going through the adapter first (already true today —
the modal only ever calls `adaptImportToRoadmap()` on the resolved value, never renders
`validateImportText()`'s raw `data`). A secondary, previously-unexplained symptom this
also fixes: after several "fix it and resend" round-trips (issue #100's fix-it-message
flow), some AI assistants gave up and stopped including resources at all in their retry —
with roadmaps now succeeding on the first real attempt far more often, resources come
through as originally generated instead of being silently dropped by a frustrated model.
**No longer silent (issue #121 item 3):** dropping an invalid resource URL used to leave
zero signal anywhere that it happened — a topic could end up with `resources: []` after
import with no way to tell that from the AI simply not including any. `sanitizeResources()`
now returns `{ resources, droppedCount }` instead of just the filtered array;
`adaptImportToRoadmap()` sums this across every item into a top-level
`droppedResourceCount`, threaded through `importRoadmapModal.js`'s resolved
`{ title, phases, items, droppedResourceCount }` value to `onboarding.js`'s
`handleCreate()`, which shows an info toast (`"Roadmap imported — N resource link(s)
skipped (invalid URL)."`) instead of the plain success toast whenever it's nonzero. This
only covers the "dropped-URL" half of item 3's two root causes — the other half (an item
shape that structurally can't carry `resources` at all, e.g. a plain string or tuple item)
is unaddressed; see issue #121 for the full investigation.

**Corrupted-text detection — a real, reported data-corruption bug (issue #100 follow-up).**
Some AI chat UIs auto-linkify raw URLs found inside a code block when a user selects and
copies *rendered* text instead of using the tool's own "copy raw"/"copy code" button —
this splices markdown-link syntax and URL-encoded JSON fragments into neighboring text
(a title ends up looking like `Learn](https://example.com%22]},{%22title%22:%22Learn) the
command line`). The result is still syntactically valid JSON (quotes stay balanced), so
it sailed straight past every check above and rendered as garbled topic titles on the
dashboard — a genuine data-corruption bug, not a display bug (confirmed by running the
exact reported payload through `validateImportPayload()`/`adaptImportToRoadmap()`
directly and observing clean output, i.e. the corruption was already present in what got
pasted, not introduced by our code). `importValidator.js`'s `looksCorrupted(text)` checks
a title/section-name/phase-name/resource-label/resource-url against a short list of
markers (`%22`, a stray `"title":`, `"url":`, `"resources":`, etc.) that are essentially
never legitimate in real roadmap content; `findItemCorruption()` runs this check on every
item *before* `isValidItem()`'s normal shape validation, so a corrupted item gets a
specific, actionable error (`...title looks corrupted (contains encoded/JSON-like text) —
... try the AI's "copy code"/"copy raw" button, or ask it to resend the JSON`) instead of
either silently importing garbage or the previous generic "item is invalid". Phase titles
and section titles get the identical check. This is a heuristic, not a formal grammar —
if you ever need a sixth marker, add it to `CORRUPTION_MARKERS` rather than writing a new
detection path.

**Corrupted-text detection, confirmed against a real ChatGPT payload (issue #121 item 1).**
Issue #100's hypothesis above was confirmed, not disproven, by a live captured payload: a
"Music Development" roadmap pasted from ChatGPT's web UI reproduced the exact
`looksCorrupted` errors reported (41 of them, one real payload, verified via
`tests/unit/fixtures/chatgptCorruptedPayload.js`). Every corrupted field was literal
markdown-link syntax (`[label](url%22},{%22...)`) spliced into JSON string values —
ChatGPT's renderer auto-linkified the bare `https://` URLs it found inside the JSON, and
copying the *rendered* response (not via ChatGPT's own "copy code" button) captured that
markdown-link source text instead of raw JSON. The identical prompt handed to Claude in the
same session did not trigger this and imported cleanly on the first attempt — this is a
ChatGPT-web-UI-specific rendering behavior, not a generic AI-output quirk, and not a false
positive or bug in `looksCorrupted()`/`parseImportJson()` (both were already correctly
rejecting genuinely corrupted data). Per issue #121's own decision tree for this finding
("if confirmed as a ChatGPT-UI copy-mechanism issue: add explicit, provider-specific
guidance... rather than relying on the generic hint"), the fix is UI guidance, not a
validator/recovery change: `importRoadmapModal.js`'s `corruptionHint` element shows a
ChatGPT-specific callout whenever any validation error contains `'looks corrupted'`, above
the generic per-error `CORRUPTION_HINT` text that stays in "technical details". A
best-effort *repair* pass (recovering the clean substring instead of rejecting) was
explicitly **not** attempted — the issue itself flagged that a repair heuristic needs its
own dedicated test fixtures and risks silently producing a wrong-but-plausible title, which
is harder for a user to notice than today's hard rejection; if repair is ever built, it
needs that same rigor, not a quick addition here.

**The remedy half of the guidance above was itself wrong, proven by a second live report
(issue #121 item 1 follow-up) — a screenshot of the reporter's own corrupted paste showed
they had used ChatGPT's own copy button (bottom-of-message toolbar in their session's UI,
not necessarily "top-right of the code block" as originally assumed) and still hit the
identical corruption; manually selecting the raw text inside the code block with a mouse
or trackpad and copying that selection imported cleanly on the first try — the exact
opposite of what the original callout told users to do.** ChatGPT's web UI evidently still
routes at least one of its copy affordances through the same rendered/markdown path that
introduces the corruption in the first place, regardless of which button or UI layout is
involved — a copy button is not reliably safe to recommend for this provider. Both
`corruptionHint`'s ChatGPT-specific callout and `importValidator.js`'s generic
`CORRUPTION_HINT` now tell the user to manually select and copy the raw text instead of
using any copy button, not the other way around. **Do not flip this guidance back to
recommending a copy button without a new confirmed report** — it has now been wrong in
both directions, which means neither direction should be trusted from reasoning about the
UI alone; only a fresh captured repro (screenshot or saved payload) should change it again.

**Cross-provider/edge-case test matrix — automated coverage plus its real limit (issue
#121 item 2).** `tests/unit/fixtures/aiProviderPayloads.js` covers the structural edge
cases the issue named that don't require a live AI session to test: a roadmap just under
the 500-item cap with resources on every item, non-ASCII/unicode titles at every level
(Japanese, Arabic, accented Latin — confirming `looksCorrupted()`'s ASCII-specific
markers never false-positive on real non-English content), and a payload mixing all three
allowed item shapes in one section. Also covers a multi-round "fix it and resend" sequence
converging to zero errors without regressing to a prior one. Unlike
`chatgptCorruptedPayload.js` (a real captured transcript), these are deliberately
synthetic — this repo's CI/dev environment has no live access to ChatGPT/Gemini/
Claude/Copilot chat sessions to capture real transcripts from, so a genuine cross-provider
manual matrix (paste the same generated prompt into each, record pass/fail) is still a
human-in-the-loop follow-up, not something an automated suite can close out on its own.
If a future report captures a real payload from a provider other than ChatGPT, add it
alongside `chatgptCorruptedPayload.js` rather than only extending the synthetic fixtures.

**"Resources" filter chip — see all resource links "in one go" (issue #100 follow-up).**
Real feedback: once AI-generated roadmaps commonly carry resource links, there was no way
to see every one without opening each topic's edit panel individually. `dashboard.js`'s
`renderFilterChips()` gained a fifth chip, `'RESOURCES'`, alongside `ALL`/`P0`-`P3` —
`matchesActiveFilter()` (shared by `filterItems()`/`priorityCounts()`) treats it as "has
at least one resource" rather than a priority comparison. When it's the active filter,
`renderItemRow()` also renders `renderInlineResources(item)` — every resource as a
clickable, type-colored `<a>` (reusing `linkDetector.js`'s `detectLinkType()`/
`LINK_TYPE_META`, the same per-type icon/color the edit panel and count-badge tooltip
already use) directly under the title, via `flex-basis: 100%` inside `.check-body`'s
existing `flex-wrap: wrap` row — no structural change to the row needed. This is strictly
additive: the collapsed count badge (opens the full edit panel) and every other filter
chip are unaffected. Every inline link's `href` is `isValidUrl()`-guarded exactly like
`itemPanel.js`'s own resource links (roadmap-store.md's "Resource URLs must be validated
before use" rule) — an invalid URL renders as `href="#"` with its default-navigation
click suppressed, never a raw unvalidated value.

**Prompt customization inputs (issue #64 Part 2, extended in #100).** Below the topic
field, the generate section renders six optional inputs — Experience level
(Beginner/Intermediate/Advanced, a chip group reusing `.filter-chip` styling), Target
timeframe (No deadline/1 month/3 months/6 months/1 year, the same chip pattern), Weekly
time commitment (issue #100: `< 2 hrs/week` … `10+ hrs/week`, same single-select chip
pattern), Goal/context (a `<select>`: Interview prep/On-the-job upskilling/Academic or
exam prep/Personal project or hobby), Preferred resource types (issue #100: YouTube
videos/Articles & blogs/Official docs/Online courses — the one **multi**-select field
among these six, `buildMultiChipGroup()` in `importRoadmapModal.js` rather than
`buildChipGroup()`, since a user may want more than one kind of link), and a freeform
"Already know" text input — each feeding `buildImportPrompt(topic, options)`'s `options`
param. Every field is optional (topic remains the only required input) and each appends
exactly one line to the prompt's free-text instructions block when set (`Experience
level: …`, `Preferred resource types: …` as a comma-joined list, etc.), omitted entirely
when unset/blank/empty-array — never an empty or placeholder line, matching how the
topic line's own placeholder already worked. This is deliberately additive to the
*instructions*, never the JSON schema contract above them in `importPrompt.js` (the
schema block's own resources-support addition, above, is a separate, structural change to
the contract, not a `buildOptionLines()` instruction line) — `importValidator.js`
/`schemaAdapter.js` needed zero changes for these six option fields, and none of them
required an `IMPORT_PROMPT_VERSION` bump, so a prompt copied before any of them existed
still parses identically today. If you add a seventh customization field, follow the
same pattern: one optional input, one omitted-when-unset line in `buildOptionLines()`
(`src/data/importPrompt.js`), never a change to the schema block itself.

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

**`switchRoadmap()`'s three network round trips run concurrently, not sequentially — a
real, reported slowness bug (issue #121 item 6).** The outgoing-template flush (above),
`resolveRoadmapItems()`'s read of the incoming template's saved progress, and the meta
write recording the new `activeTemplateId`/`startedTemplateIds` each touch a different
Firebase path and none of their inputs depends on another's result, but the original
implementation `await`ed them one after another — meaning opening an already-started
roadmap, or creating one via AI import, paid for up to three sequential round trips
before the UI could move on. `flushOutgoingRoadmap()` and `saveSwitchMeta()` (extracted
out of `switchRoadmap()` itself to keep its own complexity under the ESLint gate) are
started together and awaited via a single `Promise.all`. `saveSwitchMeta()` takes an
optional `extraMeta` object merged into the same `saveMeta` call — `createCustomRoadmap()`
uses this to fold its own `customRoadmaps` patch into `switchRoadmap()`'s one meta write
instead of doing a separate `saveMeta` round trip first (the previous behavior). If you
add a fourth independent Firebase call to this path, add it to the same `Promise.all`
rather than `await`ing it separately — don't reintroduce a sequential chain here.

**The `Promise.all` above still had a sequential prerequisite step in front of it — the
actual remaining cause of issue #121 item 6's live-escalated "still slow" report.**
`fetchTemplateData(templateId)` (a dynamic `import()` for a built-in template — real
network/parse time on a slow connection or a cold module cache) was `await`ed to
completion *before* `switchRoadmap()` even built the three-way `Promise.all` above, and
`setUser()` (the path a fresh sign-in/page load actually goes through, not
`switchRoadmap()`) had the identical shape: `await fetchTemplateData(...)` followed by
`await resolveRoadmapItems(...)`, fully sequential. Neither dependency is real:
`resolveRoadmapItems()`'s own Firebase read (`adapter.getRoadmap`) doesn't need
`baseItems`/`basePhases` until the final merge step, only the cache-hit/dirty-local-blob
short-circuits and the fallback branches do. `resolveRoadmapItems(templateId,
templateDataPromise)` now takes `fetchTemplateData()`'s *unresolved* promise instead of
its already-`await`ed value — it starts `adapter.getRoadmap()` immediately and only
`await`s the template-data promise where a branch actually needs the result (skipped
entirely for a cache hit whose `phases` is already populated, the common, already-fast
case). Both call sites (`setUser()`, `switchRoadmap()`) now do
`const templateDataPromise = fetchTemplateData(id);` without awaiting it, so the module
import and the Firebase read run concurrently instead of stacked. See
`tests/integration/roadmapStoreConcurrency.test.js` for a regression test that fails
against the old sequential code and passes against this fix (verified by reverting the
fix locally and confirming the test catches it). If you add a third thing that depends on
`baseItems`/`basePhases`, pass it the still-pending promise the same way rather than
`await`ing `fetchTemplateData()` up front again — that's exactly how this regressed once
already (the three-round-trip fix above shipped first and still left this one sequential
step in front of it).

**Perceived speed still needs its own fix — a fast operation with no loading feedback
still reads as lag.** Fixing the round trips above only helps once picking a card is
actually fast; there's a real, reported UX bug for however long a slow-network 500ms+
round trip has to run: `onboarding.js`'s picker cards already show a spinner overlay
(`buildPickingOverlay()`, `.template-card-picking-overlay` in `app.css`) for
`pickTemplate()`/`pickCustomRoadmap()` ("Opening…") — the "Create your own roadmap" card
did not have the same treatment for `handleCreate()`'s `store.createCustomRoadmap()` call,
leaving only the shared `setBusy()` dim-and-disable as feedback, which reads as
unresponsive rather than "in progress." `buildPickingOverlay(label)` now takes an optional
label (default `'Opening…'`) and `handleCreate()` toggles `.picking` on the create card
itself with `'Importing…'`, the same class/CSS every other card already uses — no new CSS
needed, `.template-card-create` is still a `.template-card`. If you add a fourth card type
or another `store.switchRoadmap()`/`store.createCustomRoadmap()` call site, give it the
same `.picking` overlay rather than relying on `setBusy()` alone.

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
(above) both existed, the "Start blank" built-in template — four fixed, uneditable
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

**Cross-page "open and scroll to this phase" signal — `KEYS.SCROLL_TO_PHASE` (issue #8).**
The Progress page's phase-breakdown row (`src/ui/pages/progress.js`) needs to send a user
to a specific phase on the dashboard when clicked — there's no query-string support in
`router.js` (exact-string route matching only) and no stable non-index phase identifier
to target from outside `dashboard.js` before this. The fix is a one-shot `sessionStorage`
signal, same "read once, then clear" precedent `verificationBanner.js`'s dismiss key
already established: `progress.js` writes the target phase's title to
`sessionStorage[KEYS.SCROLL_TO_PHASE]` and calls `navigate('/app')`;
`dashboard.js`'s `applyScrollToPhaseSignal()` reads and immediately clears it once on
mount, looks up the already-rendered `.phase-card[data-phase-title="…"]` (a new dataset
attribute added to `renderPhaseCard`'s output alongside the existing index-based
`data-phase`, specifically so a phase can be targeted by its stable title rather than
re-deriving `groupItems()`'s index ordering from outside the file), opens it if not
already open (`openPhases.add(pi)` + a plain `render()`, not the animated toggle path —
same precedent as the "Clear all filters" button's own direct `persistUi()` + `render()`),
and scrolls it into view. If you ever need another cross-page "arrive here already primed
to X" signal, follow this same pattern rather than adding query-string routing.

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
following the same click-guard (`e.stopPropagation()`) convention (root `CLAUDE.md`) as
the resource badge.

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
This same guard also applies to `dailyTodoStore.js` (see "Daily Todos store" above) — see
`.claude/rules/auth-security.md` for the auth-side half of the sign-out flow.

**A dirty real account must be flushed *before* `authApi.signOut()` is called, not after —
a real, reported data-loss bug.** `queueSave()`'s 500ms debounce means an edit made just
before sign-out (most visibly, right after `createCustomRoadmap()`'s AI-import flow, whose
own `switchRoadmap()` call ends in a debounced `queueSave()`, not an immediate flush) can
still be queued when the user clicks "Sign out." `authApi.signOut()` invalidates the auth
token immediately, so a write that fires (or was still in flight) after that point silently
fails — and this same "Sign-out contract" guard above then wipes local storage right after,
so the edit is gone from both places with nothing surfaced to the user. `confirmAndSignOut()`
(`src/ui/utils/signOut.js`) fixes this at the source: if any dirty store's `getSnapshot().dirty`
is true and the account isn't a guest (`user.isAnonymous`), it passes a flush of every dirty
store as `confirmDialog()`'s `onConfirm` callback rather than `await`ing it after the dialog
already resolved — this both flushes **before** `authApi.signOut()` is called (while the auth
token is still valid) and keeps the dialog open with a spinner on the "Sign out" button
(`confirmingText: 'Signing out…'`) for however long the flush takes, instead of the dialog
closing instantly and the user watching nothing happen. A guest is deliberately left
alone — guest data never reaches Firebase regardless of timing, and the existing dirty-guest
confirm-dialog copy already warns about that. `confirmDialog()`'s `onConfirm` param
(`src/ui/components/confirmDialog.js`) is generic, not sign-out-specific: pass it whenever
confirming kicks off async work the user needs to see is actually happening — it disables
both buttons, swaps the confirm button to `setButtonLoading()`'s spinner state, and only
closes/resolves `true` once the callback resolves; every pre-existing `confirmDialog()` call
site (delete roadmap, delete account, hide template, etc.) omits it and keeps its original
instant-close-on-click behavior unchanged.

**A failed flush must never be silently swallowed — issue #143, the gap the paragraph above
didn't cover.** The original fix above only handled a *successful* flush; if `store.flush()`
(or `dailyTodoStore.flush()`, see below) rejected — a real possibility, since every one-time
Firebase write is wrapped in a 15s timeout specifically because stalled connections are a
known failure mode (see "Every one-time Firebase read/write..." above) — `onConfirm`'s `catch`
block used to only `console.error` the failure and let execution fall through: `confirmDialog`
still resolved `true`, `authApi.signOut()` still ran, and the uid-transition guard still wiped
local storage right after. A save failure silently became permanent data loss with zero
signal to the user. `flushDirtyStores()` (`signOut.js`) now returns whether every flush
succeeded (via `Promise.allSettled`, so multiple stores flush concurrently and one failing
doesn't cancel the other); if any failed, `onConfirm` opens a **second, stacked**
`confirmDialog()` (`confirmSignOutDespiteFailedFlush()`) explicitly asking the user to choose:
**"Sign out anyway"** (danger-styled, resolves the outer `onConfirm` normally — an informed,
explicit choice to proceed and lose the unsaved changes) or **"Stay signed in"** (throws inside
`onConfirm`, which — per `confirmDialog.js`'s own documented `onConfirm` contract — re-enables
the *outer* dialog's buttons and keeps it open instead of closing, so clicking "Sign out" again
simply retries the whole flush once the connection recovers, and "Cancel" backs out of
sign-out entirely). Sign-out only ever proceeds past a failed save once the user has
explicitly said so — never automatically, never silently.

**`dailyTodoStore.js` shares the identical debounced `queueSave()` race and is now covered
too (issue #143 follow-up).** Previously documented here as a known, unfixed gap —
`confirmAndSignOut(user, store, dailyTodoStore)` takes an optional third param, flushed
alongside the roadmap store whenever it's dirty (both run concurrently, same
`flushDirtyStores()` call). Every call site now passes it: `sidebar.js`'s `createSidebar()`
takes a `dailyTodoStore` prop threaded straight through (its three render call sites —
`dashboard.js`, `progress.js`, `settings.js` — already receive it in their route `ctx` from
`main.js`, just weren't destructuring/passing it before), and `onboarding.js`'s own sign-out
button (which already had a `dailyTodoStore` reference for its Daily Todos panel) passes the
same one. If you add a fifth store with the same debounced-write shape, wire it into
`confirmAndSignOut()` the same way rather than leaving it as a documented-but-unfixed gap
again.

**A related latent bug found during the issue #143 investigation: `switchRoadmap()` could
leave a dirty template's edit with no timer ever queued to flush it.** `flushOutgoingRoadmap()`
deliberately swallows its own failure (a stalled outgoing flush must not block the switch
itself) — correctly leaving that template's `roadmapCache` entry at `dirty: true`. But
`switchRoadmap()`'s own end only called `queueSave()` when activating a template for the very
first time (`!alreadyStarted`) — an already-started template loaded via `resolveRoadmapItems()`
never did, even though that function can also return `dirty: true` for an already-started
template (exactly the cache entry a prior failed outgoing flush leaves behind). Switching back
into it left the in-memory `dirty` flag `true` with no timer queued to actually flush it — the
edit would silently sit unflushed until some unrelated mutation happened to call `queueSave()`
again. Fixed by checking `dirty` itself rather than `!alreadyStarted` (a fresh seed's `dirty` is
always `true` anyway, so the fresh-seed case behaves identically) — see the "re-queues a save
for a template left dirty by a failed outgoing flush" test in
`tests/integration/roadmapStore.test.js`.

**The flush-before-sign-out fix above only helps if `dirty` is actually `true` by the time
`confirmAndSignOut()` reads it — a second, still-reproducible way to lose a just-imported
roadmap (found by re-testing live, over the real Firebase websocket protocol).**
`switchRoadmap()` doesn't set `dirty = true` until its own internal `Promise.all` resolves
and it reaches `queueSave()` — while a switch (e.g. `createCustomRoadmap()`'s AI-import
flow) is still in flight, `store.getSnapshot().dirty` still reflects whatever it was
*before* the switch started, often `false`. `onboarding.js`'s picker cards are correctly
disabled for the whole duration via `setBusy()`/`picking`, but the page's own top-row
"Sign out" button (separate from the app-shell sidebar's — see the "no sign-out affordance"
note elsewhere in this file) was never included in that disable pass. Clicking it mid-import
read a stale `dirty: false`, so the flush-before-`signOut()` fix never triggered — the auth
token was invalidated while `switchRoadmap()` was still mid-flight, and the new roadmap's
items/phases were silently never written (only its `customRoadmaps` meta entry survived,
from the part of the switch that had already completed by then — the roadmap "existed" in
the picker but loaded empty on the next sign-in). Fixed by wiring `signOutBtn` into
`setBusy()` alongside the cards. **The general lesson**: any UI affordance that can trigger
`authApi.signOut()` must be disabled for the full duration of any in-flight
`switchRoadmap()`/`createCustomRoadmap()` call, not just the controls that obviously look
busy — `store.getSnapshot().dirty` is a point-in-time snapshot, not a "is there pending
work" signal, and only becomes accurate once the in-flight call has progressed far enough
to set it. If you add another page or component with its own sign-out entry point, gate it
on the same busy flag your page already uses for its own async store calls.

**Realtime Database rules — no path other than `roadmap`/`roadmaps`/`meta`/`dailyTodos`/`activityLog`/`reports` may be written under `users/{uid}`.** `firebase/database.rules.json` has a `$other: { ".validate": "false" }` catch-all under `users/$uid` specifically to stop a buggy or malicious client from writing arbitrary data outside the known shape (still auth-scoped to that uid, just unbounded before this). If you add a genuinely new top-level field under a user's data, add an explicit `.validate` rule for it — never rely on the `$other` catch-all rejecting it silently as "good enough." Realtime Database rules cannot count a map's children, so a per-roadmap item cap is enforced client-side instead, in `roadmapStore.js`'s `addItem()` (the one place items are created) — it returns `false` instead of mutating anything once a roadmap already holds 800 non-deleted items (lowered from 1,000 in issue #53 — no real roadmap organically approaches even 800 topics); callers must check this return value and surface an error rather than assuming success. The same client-side-cap pattern applies to `dailyTodoStore.js`'s `addTodo()` (issue #56) — active (not-done, not-expired) todos are capped at `MAX_ACTIVE_TODOS` (20).

**In-app feedback & bug reporting (`src/services/feedbackStore.js`, `src/core/feedback/`, `src/ui/components/feedbackWidget.js`+friends, issue #9) — a fire-and-forget write, not a fifth instance of the Store pattern above.** Every other store in this file (`roadmapStore`/`dailyTodoStore`/`activityLogStore`) is bidirectional, subscribe/notify, debounced-sync account state that has to survive offline edits and echo guards. A feedback report is the opposite shape: a user fills a form once, it either submits or it doesn't, and there's nothing to keep in sync afterward — so `feedbackStore.js` is a thin, stateless wrapper around two Firebase calls (`submitReport()`, `listenMyReports(uid, callback)`), not a `createFeedbackStore()` factory with `subscribe`/`queueSave`/a Firebase-echo guard. It imports `database` from `firebase.js` directly rather than going through `src/services/storage/` — the `StorageAdapter` interface is shaped around **one document per (uid, templateId)** with offline-first local fallback (`.claude/rules/roadmap-store.md`'s "Storage adapter abstraction" above); `reports/{reportId}` is a top-level, per-report, write-only path with no per-user local cache or offline queue, which doesn't fit that contract and isn't worth bending it for a single fire-and-forget write.

**Two Firebase paths, one `update()` call.** `submitReport()` generates a push key under `reports/` and writes both `reports/{reportId}` (the full payload, including `screenshotB64` — developer-only, `.read: false`, reviewed via the Firebase console) and `users/{uid}/reports/{reportId}` (`buildReportSummary()`'s copy with `screenshotB64` stripped — the user's own "My reports" history, to save quota) in a single multi-path `update(ref(database), { [...]: ..., [...]: ... })`, so a client never observes one path written without the other. `firebase/database.rules.json`'s `reports/{reportId}` validate rule requires `userId === auth.uid`, so a client can't forge a report under someone else's identity even though the path itself isn't uid-keyed; `users/{uid}/reports/{reportId}` additionally rejects any write containing `screenshotB64` (`".validate": "false"` on that specific child) as a second enforcement layer beyond the client just not sending it.

**Both `reports/{reportId}` and `users/{uid}/reports/{reportId}` are creation-only — `".write"` requires `!data.exists()` on both paths.** A guessable-enough push key plus a bare `auth != null`/`auth.uid == $uid` write rule would otherwise let any authenticated client overwrite (or delete, since a Realtime Database write with `null` is a delete) an *existing* report at that path — not just create a new one. Flagged by an automated security review after the initial rules landed with only the `userId === auth.uid` create-time check; fixed by adding `!data.exists()` to both `.write` rules, so a second write attempt against an already-populated `reportId` is rejected regardless of who's asking, including the original submitter. There is deliberately no client-facing update/delete path for a report post-submission — every status transition (`new` → `under_review`/`in_progress`/`resolved`/`wont_fix`) is a manual Firebase-console edit by the developer, which bypasses rules entirely and is unaffected by this. If a genuine client-side edit/delete need ever arises (e.g. "delete my own report"), it needs its own explicit, narrower rule — never widen these two back to a bare existence-agnostic `auth != null`.

**Rate limiting is client-side and good-faith only (`src/services/feedbackRateLimit.js`).** Realtime Database rules have no way to express "reject if this uid has written N times in the last M seconds" — `canSubmit()`/`recordSubmit()` read/write a plain timestamp array under `KEYS.FEEDBACK_RATE`, checked by the UI before ever attempting a write. This is a UX nicety (stop an accidental double-submit, gently throttle spam), not a security boundary — a motivated user can always clear localStorage and resubmit. Don't treat it as one when reasoning about abuse; if real server-side throttling is ever needed, it requires a Cloud Function, which this static-hosted app doesn't currently have.

**Draft autosave, not a queued-offline-write.** `KEYS.FEEDBACK_DRAFT` holds the in-progress form state (whichever type is open) so closing the modal mid-fill never loses it — written on every field change, read on next modal open, cleared only on a successful submit. This is unrelated to `roadmapStore.js`'s `dirty`/`queueSave` local-first-then-flush pattern above; a feedback draft that never gets submitted just sits in localStorage forever with no sync attempt, since there's no "eventually consistent with Firebase" state for a report that was never sent.

**Data export/backup and JSON restore (issue #18).** `src/core/roadmap/backupSchema.js`
(`buildRoadmapExport`/`buildRoadmapCsv`/`exportFileBaseName`) and
`src/core/roadmap/backupValidator.js` (`parseBackupJson`/`validateBackupPayload`/
`validateBackupText`/`diffBackupItems`) are a second pure validator/schema pair
alongside `importValidator.js`/`schemaAdapter.js` above — same parse/validate split,
same `schemaVersion` pattern, but a completely different JSON shape: this one
snapshots/restores a roadmap the user already has, item-by-item (including `done`/
`completedAt`/`resources`/`notes`), not a generated roadmap-shape payload that seeds a
brand-new custom roadmap. Never conflate `EXPORT_SCHEMA_VERSION` with
`SUPPORTED_SCHEMA_VERSION` — they version unrelated formats and happen to both currently
be `1`. Export only ever includes the active roadmap's non-deleted items (soft-deleted
ones are tombstones, not something a backup should resurrect) and is entirely
client-side — `URL.createObjectURL(new Blob(...))` via `downloadTextFile()`
(`src/ui/utils/backupTransfer.js`), no server involved. CSV export is deliberately
one-way (no CSV import) — a flat row has no resource-object slots to round-trip, so
re-importing a CSV would silently drop every resource link.

Restore goes through a new `roadmapStore.importBackupItems(backupItems)` — the store's
own batch equivalent of `addItem()`/`updateItem()`, so UI call sites never mutate
`items` directly, same contract every other store mutation already has. It deliberately
**preserves each backup item's own id** rather than generating a fresh one the way
`addItem()` does: restoring the same export back into the same account needs to
recognize "this item already exists" by id so a repeated import merges instead of
duplicating, and the diff-summary confirmation (`openImportBackupModal()`,
`src/ui/components/importBackupModal.js`, using `diffBackupItems()`) counts
new-vs-existing the same way. It re-validates every item against the same caps
`addItem`/`updateItem` enforce (title length, resource label/url length, the
`MAX_ITEMS_PER_ROADMAP` cap) since a backup file is untrusted input, not just re-trusting
`validateBackupPayload()`'s shape check. There is no per-item `uid` to "strip" on a
cross-account import — an item never carried one to begin with, only an informational
`exportedByUid` at the payload's top level, never read back on import — so importing
into a different account just means every id is unrecognized and everything imports as
new; no special-casing needed. Resource URLs are untrusted input here exactly like
anywhere else a URL enters the store (see "Resource URLs must be validated" above) —
`sidebar.js`'s import handler strips any resource whose `url` fails `isValidUrl()`
before it ever reaches `importBackupItems()`, the same save-time guard `itemPanel.js`
applies to a manually entered resource; `roadmapStore.js` itself still only checks
`isValidResource()` (label/url length), matching every other store-level resource
mutation's existing behavior. The confirmation modal offers **Merge** (add new,
update matching-id existing, leave everything else untouched) or **Overwrite** (also
soft-deletes — via the existing `removeItem()`, never a direct mutation — anything
currently in the roadmap that isn't in the backup file); both still only ever call
public store methods.

Placement: export/import lives in the account dropdown (`sidebar.js`'s `buildAccountMenu()`)
rather than a dedicated settings screen, since issue #16 (account settings page) doesn't
exist yet — move it there once it does. Available to every signed-in identity,
**including an anonymous guest session** (not gated behind `!user.isAnonymous` the way
"Delete account" is) — local-only progress with no Firebase account behind it is exactly
the data most at risk of being lost. `exportBackupJson`/`exportBackupCsv`/
`importBackupFromFile` (`src/ui/utils/backupActions.js`) hold this logic, not `sidebar.js`
itself — extracted so `backupReminderBanner.js`'s "Download backup" CTA (below) and the
dropdown's own menu item share one implementation instead of drifting apart.

**Periodic backup reminder — nudging, not nagging (issue #18 follow-up).** Nothing
prompted a user to actually take a backup — export/import above was purely opt-in and
easy to forget existed entirely. `src/ui/components/backupReminderBanner.js`
(`createBackupReminderBanner({ user, store })`) is a dismissible banner, same shape as
`verificationBanner.js` — a plain function returning a node or `null`, decided once at
mount, no subscription/timer of its own — shown on the dashboard once
`REMINDER_AFTER_MS` (14 days, `src/ui/utils/backupReminder.js`) has passed since a
user's last JSON backup, or since their account was first seen if they've never taken
one; never shown for a roadmap with no real progress (`item.done || item.custom`, same
check `roadmapStore.js`'s own internal `hasRealProgress` makes). "Download backup"
exports immediately and dismisses; "Not now" starts a `SNOOZE_AFTER_DISMISS_MS` (7 day)
quiet window rather than closing it forever. All three timestamps
(`backupFirstSeenAtKey`/`lastBackupAtKey`/`backupReminderDismissedAtKey`,
`localStorageKeys.js`) are keyed per-uid — same pattern as `verifyDismissedKey` above —
device-level, never synced to Firebase, never explicitly cleared on sign-out (harmless,
since each key already carries the uid and a stale timestamp for a different account
does nothing). Only `exportBackupJson` calls `markBackupTaken()` — a CSV export never
does, since CSV is one-way/lossy and isn't a restorable backup. Shown for an anonymous
guest session too, same reasoning as the dropdown items themselves.

`item.completedAt: number | null` (prerequisite for issue #8's progress analytics) is
set automatically by `updateItem()` — `Date.now()` the moment a patch flips `done`
`false -> true`, `null` the moment it flips back — via a `withDerivedCompletedAt()`
helper applied *after* the existing cosmetic-check runs against the caller's own patch
keys, so a plain `{ done }` toggle from the dashboard checklist stays cosmetic (no
`structuralVersion` bump) exactly like it always has; `completedAt` is a derived,
internal side effect, never something a caller sets directly. A missing field means
"never completed" — same backward-compat precedent as `item.notes`. `addItem()` seeds
`completedAt: null` on every new item. `setItemDoneInTemplate()`'s cached/cold
cross-roadmap paths (its active-template path already goes through `updateItem()`) set
the same field alongside the existing `completedViaTodoAt` via a small
`todoCompletionFields()` helper — the two fields are related but distinct:
`completedViaTodoAt` only tracks completion through a linked Daily Todo (cleared the
moment either side is unchecked, per the "Linking a roadmap topic" section above), while
`completedAt` tracks completion generally, through any path.

**`activityLogStore.js` and the `onCompletionToggle` hook (issue #8, part 1 — data layer
only, no UI yet).** A fourth store alongside `roadmapStore.js`/`dailyTodoStore.js`
(`src/services/activityLogStore.js`), same Store pattern precedent as `dailyTodoStore.js`
above, tracking a flat `{ [YYYY-MM-DD]: count }` map of items completed per day at
`users/{uid}/activityLog` (a new explicit `.validate` rule block in
`firebase/database.rules.json`, sibling to `dailyTodos`) plus `KEYS.ACTIVITY_LOG`
locally. It exists **separately from `item.completedAt` specifically because it survives
an item later being unchecked** — `completedAt` is cleared to `null` the moment `done`
flips back to `false`, so a day's real completion count would otherwise be lost the
instant a user un-checks something; `activityLog` is append-only for past days (only the
current day is ever written) — see `docs/adr/ADR-009-analytics-data-model.md`.
`createRoadmapStore()` takes an optional `onCompletionToggle(delta)` hook (`delta` is `+1`
or `-1`; defaults to a no-op so every existing call site, including every test calling
`createRoadmapStore()` with no args, is unaffected) fired exactly once per genuine
done-transition — from `updateItem()` directly, and from all three branches of
`setItemDoneInTemplate()` (its active-template branch already delegates to `updateItem()`
so it gets this for free; its cached/cold cross-roadmap branches compute the same
`completionDelta()` themselves before returning `{ ok: true }`). Deliberately **not** a
direct import of `activityLogStore.js` into `roadmapStore.js` — `main.js` is the one place
that wires `onCompletionToggle: delta => delta > 0 ? activityLogStore.recordCompletion() : activityLogStore.recordUncompletion()`,
keeping `roadmapStore.js` importable and unit-testable with zero knowledge of the
analytics feature. If you add a new call site that flips `done` without going through
`updateItem()`/`setItemDoneInTemplate()`, it must call `onCompletionToggle` itself or
activity tracking silently misses it. The pure computation layer
(`src/core/analytics/`: `streaks.js`/`velocity.js`/`heatmapData.js`/`projection.js`/
`analyticsEngine.js`) reads `activityLogStore`'s snapshot but never writes to it, and
merges it with a backfill derived from items' `completedAt` (`buildEffectiveActivityLog()`
in `analyticsEngine.js`) so an account with months of progress from before this feature
existed doesn't see an empty heatmap — the real `activityLog` always wins for any day it
has an entry for, so a since-unchecked completion is never resurrected from the backfill.

**Client-side length caps on title/resource fields (`src/core/roadmap/limits.js`, issue #53) — the client-side half of issue #24's server-side Firebase rules.** `MAX_TITLE_LENGTH` (200), `MAX_RESOURCE_LABEL_LENGTH` (120), and `MAX_RESOURCE_URL_LENGTH` (2048) live in their own dependency-free module — never define these constants directly in `roadmapStore.js`, since `itemPanel.js` needs to import just the numbers without pulling in `roadmapStore.js`'s Firebase-backed storage-adapter chain (`adapterFactory.js` → `FirebaseAdapter.js` → `firebase.js`'s `https://` SDK imports), which breaks under Node's ESM loader in any test that doesn't mock `firebase.js`. `roadmapStore.js`'s `addItem()`, `updateItem()`, `addResource()`, and `updateResource()` — the only places these fields are ever written — reject (returning `false`, mutating nothing) a value over these caps; callers must check the return value, same convention as the item-count cap above. `itemPanel.js`'s Save/Add-resource handlers and `dashboard.js`'s quick-add row surface a friendly message using the same constants before the store call is even attempted — always keep the UI-layer message and the store-layer cap using the same imported constant, never a hardcoded number in either place.
