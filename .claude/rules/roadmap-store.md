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

**Local "Remind me" reminders — Phase A only, no server push (issue #132).** `dailyTodoPanel.js`'s heading row has a bell toggle (`.daily-todo-reminder-btn`, matching the info/collapse buttons' box+icon size) that requests `Notification` permission on click — never on page load, since an unprompted permission dialog is a well-known dark pattern users reflexively deny. Whether reminders are on is a single boolean, `KEYS.DAILY_TODO_REMINDERS_ENABLED` (`localStorageKeys.js`), device-level like `DAILY_TODOS_COLLAPSED` — this is deliberately a **single-device, best-effort** reminder, not a synced preference, matching this feature's existing "no Firebase Cloud Messaging or cross-device push precedent" note above. `src/core/dailyTodo/reminderScheduling.js` (`computeReminderFireAt`/`shouldScheduleReminder`) is the pure math — fire time is always `expiresAt - REMINDER_LEAD_MS` (15 minutes, `src/core/dailyTodo/limits.js`), null/false for a done, already-expired, or already-past-its-lead-time todo. `src/services/reminderScheduler.js`'s `initReminderScheduler(store)` is the one stateful piece: it subscribes to `dailyTodoStore` (called once at app startup in `main.js`, app-lifetime, same "never unmounted" precedent as `feedbackWidget.js`) and reconciles one live `setTimeout` per active, reminder-eligible todo on every store snapshot — a todo that becomes done, gets deleted, or was never eligible has its timer cancelled in the same pass, so a notification can never arrive for a todo that's already been resolved. When a timer fires, it calls `navigator.serviceWorker.ready` then `registration.showNotification()` — `sw.js`'s own `notificationclick` handler (a plain `self.clients.matchAll()`/`openWindow()` pair, with the client-selection/target-URL logic pulled into a pure, testable `src/services/sw/notificationHelpers.js` module, same "pure helper next to the actual service worker" pattern `cacheStrategies.js` established for issue #19) focuses an already-open app window or opens a new one at `/#/onboarding` — the Daily Todos panel's own placement, per the "Placement" note above. **There is no server-side piece here at all** — no Cloud Functions, no FCM device-token registration, no scheduled backend job scanning deadlines across users. If a "notify me even with the app/browser fully closed" push is ever built, that's Phase B, a materially different backend-architecture decision requiring its own issue — do not bolt FCM registration onto this module as an incremental addition; see the issue's own scoping writeup for why.

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

**`setItemDoneInTemplate`'s cold (never-cached) branch writes through a targeted per-item path, not a full items-map overwrite — a silent lost-update race, issue #184.** Unlike the cached branch above it, this branch used to read the whole remote roadmap (`adapter.getRoadmap`), patch one item into a copy of its `items` map, and call `adapter.saveRoadmap(uid, templateId, { ...items: nextItems })` — a plain read-modify-write with none of the `dirty`/echo/stale-listener guards this file documents elsewhere. Two Daily Todos linked to two different items in the same not-yet-cached roadmap, completed within the same network round trip (two taps a second apart, or the same account open on two devices), would each compute their own `nextItems` from the identical stale snapshot; whichever `saveRoadmap` landed last silently reverted the other item's `done` flag with no error surfaced anywhere. Fixed with `StorageAdapter.updateRoadmapItemFields(uid, templateId, itemId, fields)` — `FirebaseAdapter`'s override is a real multi-path `update()` keyed by `items/{itemId}/{field}`, touching only that one item's own children and the roadmap's `updatedAt` scalar, never the sibling `items` map or any other item's node. Two concurrent calls for two *different* itemIds now write to entirely separate database paths and can't race at all; two concurrent calls for the *same* itemId still last-write-wins on that item's fields, which is expected concurrent-edit behavior, not the bug this fixes. `setItemDoneInTemplate` falls back to a full `saveRoadmap()` only when the item was never actually synced to Firebase for that roadmap (the remote read found no `items` map at all, e.g. a guest's local-only progress) — there's no existing remote node to merge fields into in that case, so a full write is required regardless. `StorageAdapter`'s own `updateRoadmapItemFields` default is a plain read-modify-write (correct but not itself race-free) so a future backend gets a working implementation for free without needing this same scoped-write treatment on day one. If you add a fourth branch or a new cross-roadmap mutation path, route its remote write through `updateRoadmapItemFields()` the same way rather than reintroducing a full-map `saveRoadmap()` call for a single-item change. **The cached branch (roadmap visited this session, just not currently active) had the identical bug, gated on "cached" instead of "cold" — closed in issue #232, not left as the "above it" exception this paragraph originally described.** It now calls `adapter.updateRoadmapItemFields(uid, templateId, itemId, patch)` first, falling back to `saveRoadmap()` only when that resolves `null` (item never synced to Firebase for this roadmap) — same contract as the cold branch, just skipping the upfront `getRoadmap()` read since the cached branch already has the item's current shape in `roadmapCache` without needing a fresh remote fetch to build `patch`/`patchedItem`. All three branches (active/cached/cold) now avoid a full-map overwrite for a single-item change.

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
no forced migration step. **`setUser`'s onboarding-detection order is split into named,
independently unit-tested phase functions (issue #129 — was complexity 56, now 13):**
`freshStateForNewUid()` (the uid-transition privacy wipe), `readOnboardingLocalFallback()`
(local-storage signals read before the remote meta fetch), `fetchRemoteMetaSafely()`,
`resolveMetaExtras()` (hidden-templates/custom-roadmaps resolution),
`resolveOnboardingState()` (the startedTemplateIds-present-vs-legacy-migration branch
described in this paragraph — itself split further into `fetchLegacyRoadmapSafely()`,
`isAlreadyOnboardedLegacy()`, `backfillLegacyOnboardingMeta()`),
`migrateLegacyBlankTemplateIfNeeded()` (the retired-'blank'-template migration below,
split into `fetchStoredBlankRoadmap()`/`resolveBlankMigrationContent()`/
`persistBlankMigrationToFirebase()`), and `determineOnboardingAndActiveRoadmap()` (the
orchestrator combining the previous two so `setUser` only checks one `STALE` sentinel and
one "did a blank migration happen" branch instead of two of each). `setUser` itself is
now just an orchestrator over these plus `loadActiveRoadmap()` (a factory closure, not
module-scope, since it delegates to `fetchTemplateData`/`resolveRoadmapItems`). Every
`await` boundary inside these phase functions still takes and checks the same `isStale()`
closure `setUser` builds from its own `stateCallId` — see "`setUser`/`switchRoadmap`
stale-call guard" below; a `STALE` sentinel (`Symbol('stale')`, exported) is what a phase
function returns to signal "abort, a newer call already took over" up through the chain.
Only when `onboardingDone` is false does `main.js` route to
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

**Draft autosave for the "Create your own roadmap" modal — mirrors `KEYS.FEEDBACK_DRAFT`
(issue #328).** `importRoadmapModal.js`'s topic textarea and its five customization
inputs (experience level, timeframe, goal, weekly time commitment, resource types,
"already know") persist to `KEYS.CREATE_ROADMAP_DRAFT` on every field change and are
read back once on modal open to prefill every field — the exact same precedent this
file's own "Draft autosave, not a queued-offline-write" entry (below, under "In-app
feedback & bug reporting") documents for `feedbackModal.js`'s `KEYS.FEEDBACK_DRAFT`:
device-level, never synced to Firebase, cleared only on a successful submit/import,
never on Cancel/Escape/outside-click. The one deliberate difference from that precedent:
the pasted AI-response textarea (`pasteArea`) is never persisted — it's regenerable from
the same draft's topic/options by re-running the external AI, and persisting arbitrary
large pasted text risks silently hitting the browser's storage quota. Chip-group fields
(experience level, timeframe, weekly time, resource types) and the goal `<select>` read
the restored draft's values *before* their controls are constructed, so each control's
own initial "active"/selected state reflects the loaded draft with no separate rehydration
step needed.

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

**Oversized-paste guard, `MAX_IMPORT_TEXT_LENGTH` (issue #325).** Before any of the above
validation runs, `parseImportJson()` checks `rawText.length` against
`MAX_IMPORT_TEXT_LENGTH` (300,000 characters, `importValidator.js` — same "own,
dependency-free constant" precedent as `MAX_TITLE_LENGTH`/`MAX_RESOURCE_LABEL_LENGTH` in
`limits.js`, though this one lives directly in `importValidator.js` since nothing else
needs to import it) and returns a dedicated error — "This is too large to import — check
you copied only the roadmap JSON, not the whole conversation." — instead of ever calling
`JSON.parse()`. This exists because the paste textarea's `input` handler debounces only
300ms, not per-keystroke-skips-while-large; a several-MB accidental paste (a whole chat
transcript, a full webpage's HTML) run through `JSON.parse()` synchronously on the main
thread on every keystroke (backspacing/re-pasting re-triggers it) can visibly freeze the
tab, with no upfront size ceiling to stop it before this issue. 300,000 characters is
comfortably above any real roadmap's JSON size even at the `MAX_ITEMS` (500) cap with
resources on every item — `tests/unit/fixtures/aiProviderPayloads.js`'s near-cap fixture
serializes to well under 100,000 characters, leaving generous headroom. Deliberately
**not** an HTML `maxlength` attribute on the textarea itself — that would silently
truncate a legitimate large-but-valid paste mid-character, corrupting otherwise-good
JSON; the fix is a length check before parsing, not a truncating input constraint.

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

**Duplicate-topic detection — informational, never blocking (issue #327).** A known LLM
failure mode is repeating the same (or a case/whitespace-varied) topic title across two
different phases/sections with nothing to flag it — `importValidator.js`'s
`findDuplicateTitles(data)` is a **pure** function (no DOM/store/Firebase access) scanning
every item title across the whole payload (all phases, sections, items, in whichever of
the three item shapes it's found in), case-insensitive and trimmed, exact match only — no
fuzzy/Levenshtein matching, a larger, more error-prone undertaking left for a future
follow-up if this simple version proves insufficient. This deliberately does **not**
participate in `validateImportPayload()`'s error list — unlike every other check in that
file, a duplicate must never fail import, since a legitimately repeated topic name (e.g.
"Practice problems" recurring by design as a section title in several phases) is entirely
possible. `adaptImportToRoadmap()` (`schemaAdapter.js`) calls `findDuplicateTitles(data)`
against the original payload (never the freshly-generated `items` map, whose per-item ids
would defeat any title comparison) and returns `duplicateTitleCount` alongside
`droppedResourceCount` in the exact same top-level shape — `{ phases, items,
droppedResourceCount, duplicateTitleCount }` — threaded through `importRoadmapModal.js`'s
resolved value to `onboarding.js`'s `handleCreate()`, following the identical "info toast,
not a blocking error" precedent issue #121 already established for dropped resource URLs.
`importRoadmapModal.js`'s own success-path `summaryMsg` also calls `findDuplicateTitles()`
directly (during live validation, before the "Import roadmap" click) so the count shows up
immediately as an extra sentence appended to "Looks good — N topics found." (e.g. "3 topics
look like duplicates across phases — you can review and merge them after importing."),
never as a separate error state. Out of scope, matching issue #121's dropped-resource
precedent: automatically merging or removing duplicates — the user decides, using the
existing manual phase/section/item CRUD tools.

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

**Unfilled placeholder / AI refusal detection — a sibling heuristic to corrupted-text
detection above, same file, same treatment (issue #326).** A payload can be schema-shaped
and non-empty at every field yet still not be a real roadmap: `buildImportPrompt()`
(`src/data/importPrompt.js`) uses its own literal placeholder strings (`<roadmap title>`,
`<phase title>`, `<section title>`, `<item title>`, `<https:// link>`, `<short resource
name>`) as schema illustrations inside the prompt template it hands the user to copy — a
weaker model can echo the template's shape back with these left unfilled, and every check
`looksCorrupted()` performs accepts that as valid, since every field is still a non-empty
string under the length cap. The sibling failure mode is an AI refusal ("I'm sorry, but I
can't help with that…") wrapped just enough to satisfy the schema. `importValidator.js`'s
`placeholderOrRefusalError(text, fieldPath)` checks a title against `PLACEHOLDER_MARKERS`
(the exact literal strings above — never a generic `<...>` regex, so a legitimate title
containing angle brackets, e.g. "Intro to `<T>` generics in Java," can never
false-positive) and `REFUSAL_OPENERS` (a short list of recognizable multi-word openers —
`"i cannot"`, `"i'm sorry, but"`, `"as an ai language model"` — matched case-insensitively
against the trimmed string's start, never a bare "I" prefix, so a legitimate title
starting with "I," e.g. "Iterators in Python," can never false-positive either). Called
from the same three places `looksCorrupted()`/`findItemCorruption()` are — the top-level
`title`, `validateTitledNodeTitle()` (shared by phase and section titles), and
`findItemCorruption()` (every item shape's title) — and checked *first*, before
`looksCorrupted()`, since an unfilled placeholder or a wrapped refusal is a more specific,
more actionable problem than either "looks corrupted" or a bare "is invalid"/"is
required". This is a heuristic over exact literal strings and recognizable phrase
openers, not a general content-quality/plausibility model (detecting a roadmap that's
schema-valid but nonsensical or off-topic requires real semantic understanding this app
has no backend LLM call to provide) — deliberately out of scope, see the issue.

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

**First-time feature tour — `tourDone` (issue #17).** A single per-user boolean,
resolved the same remote-then-local way `onboardingDone` itself is (not the array
precedent `hiddenTemplateIds`/`favoriteRoadmapIds` use below): `resolveMetaExtras()`
returns `tourDone: remoteMeta?.tourDone === true || readLocalTourDone()`, and `setUser()`
assigns it alongside the other meta-extras fields, persisting the local fallback
(`KEYS.TOUR_DONE`, `localStorageKeys.js`) the same "only ever write a positive value"
way `persistLocalOnboarding()` does — there's nothing useful to write on the `false`
path, since a missing key already means "not done." `completeTour()`/`resetTour()`
(exported from the store) follow `toggleFavoriteRoadmap()`'s mutate → persist-local →
`notify()` → best-effort `saveMeta()` shape; `resetTour()` is the one deliberate
exception — it's in-memory only (no `persistLocalTourDone()`/`saveMeta()` call at all),
since a manual "Take a tour" replay (`sidebar.js`'s account-menu item, dashboard-only —
see below) shouldn't flip a genuinely-completed account back to "never toured" until the
replay itself is skipped or finished, at which point the tour's own `onEnd` callback
calls `completeTour()` again to re-persist `true`.

**Backfill for existing accounts — never auto-fire the tour for someone who already
has a roadmap.** Every account that existed before this shipped would otherwise default
`tourDone` to `false` (a missing meta field, same as any brand-new field) and see the
tour auto-start the next time they open the dashboard — wrong for anyone who's already
past onboarding. `backfillTourDoneIfNeeded(onboarding)` runs once per sign-in, right
after `setUser()` finishes loading the active roadmap's items (needs `items` in memory
to check `hasRealProgress()`), and sets `tourDone = true` (persisting local + remote,
same as `completeTour()`) whenever either condition holds: the account already has real
progress in the roadmap that just loaded (`hasRealProgress(items)` — a `custom` or
`done` item, the exact same check `isAlreadyOnboardedLegacy()` uses elsewhere in this
file), or `onboardingDone` was itself reached via a legacy migration path this sign-in
(`onboarding.migratedLegacyItems` or `onboarding.blankMigration` truthy) rather than a
genuine fresh template pick made from here forward. Only an account that both starts
with zero real progress *and* reached `onboardingDone` via a real fresh pick keeps
`tourDone`'s honest `false` default — that's the only shape that should ever auto-start.
**Gating and manual replay live in `dashboard.js`, not the store**: `renderDashboard()`
calls `startTour()` (`featureTour.js`) once, only when `store.getSnapshot()` shows
`onboardingDone === true && tourDone === false`, right after the dashboard's first
render (never on `/onboarding` itself). Only the dashboard's own `createSidebar()` call
passes an `onStartTour` prop (wiring the account menu's "Take a tour" item) — every
other page's sidebar instance (`progress.js`/`settings.js`/`onboarding.js`) omits it,
since every one of the tour's spotlight `querySelector` targets is dashboard-only and
would resolve to nothing anywhere else. See `.claude/rules/ui-styling.md`'s
`featureTour.js` entry for the spotlight/portal/focus-trap implementation itself.

**Favorite roadmaps — `favoriteRoadmapIds` (issue #177).** A parallel per-user array,
same shape/persistence precedent as `hiddenTemplateIds` immediately above: up to
`MAX_FAVORITE_ROADMAPS` (3, exported from `roadmapStore.js`) roadmap ids, no distinction
between a built-in template id and a `croadmap-...` custom id (matching how
`startedTemplateIds` already treats them uniformly), persisted to
`users/{uid}/meta/favoriteRoadmapIds` plus a local `KEYS.FAVORITE_ROADMAPS` fallback —
resolved in `resolveMetaExtras()` (remote wins, falling back to the local blob) and reset
alongside every other per-user array on a uid transition (`freshStateForNewUid()`,
`clearLocal()` — see the "Sign-out contract" below). `store.toggleFavoriteRoadmap(id)`
adds the id if under the cap, removes it if already present, and is a no-op — returning
`{ ok: false, capped: true }` rather than mutating anything — if adding a 4th would
exceed it; callers must check the return value, same convention as `addItem()`'s
item-count cap. `firebase/database.rules.json` enforces the same cap server-side on the
`favoriteRoadmapIds` node — **not** via `newData.numChildren() <= 3`, which was tried
first and found to fail to even parse on this repo's pinned `firebase-tools` version
(`No such method/property 'numChildren'`, reproduced against a real local emulator —
`.validate` support for `numChildren()` is inconsistent across CLI/rules-engine
versions). A failed-to-parse rules file doesn't just reject the one path — the whole
Database Emulator refuses to start, which silently broke every E2E test in CI, not just
ones touching favorites, since they all depend on the same emulator instance. Fixed with
the standard index-whitelist idiom instead: `$index.matches(/^[0-2]$/)` restricts a
write to only index keys `"0"`/`"1"`/`"2"`, capping the array at exactly 3 entries with
no `numChildren()` dependency. If you add another array-length cap to this file, verify
it against a real local emulator (`npx firebase emulators:start --only database`) before
assuming any particular rules-language method actually compiles — see #122's finding
that this repo had previously under-enforced server-side caps on similar user-controlled
arrays; don't repeat that gap for a future array field. `deleteCustomRoadmap()` also
strips the deleted id from `favoriteRoadmapIds` (both in-memory and the Firebase/local
persistence) so a deleted custom roadmap can never linger as a "favorite" pointing at
nothing. `onboarding.js`'s picker grid renders a star toggle (`.template-card-favorite`,
`data-action="favorite"`, the same click-guard convention as the hide/delete/info corner
buttons — placed at the same top-right corner, directly left of whichever of those
three a given card also has, not the top-left corner: top-left was tried first and
collides with the decorative template icon that also renders there in the card's normal
content flow, found live via screenshot) on every custom and built-in card, and sorts the "Create
your own roadmap" action card first (never a favorite target — it isn't a roadmap to
pick), followed by every pickable card with favorited ones first (`Array#sort`, stable,
so order is otherwise unchanged). Toggling re-renders the whole visible grid rather than
patching a single card in place, since a toggle can also move where the card sits.

**Custom-roadmap count cap — `MAX_CUSTOM_ROADMAPS` (issue #324).** Before this,
`createCustomRoadmap()` had no upper bound at all on how many custom roadmaps a single
account could accumulate — the only other constraint was `database.rules.json`'s
`meta.customRoadmaps` index-shape rule, which allows indices `0`-`999` (up to 1,000
entries), a shape constraint against stray keys rather than a deliberate product cap. Each
of those could independently hold up to 500 items (`MAX_ITEMS`, `importValidator.js`) —
a real, unmitigated storage/cost exposure once this became a live, public product.
`MAX_CUSTOM_ROADMAPS` (25, `core/roadmap/limits.js`) is checked against
`customRoadmaps.length` specifically, **never** `startedTemplateIds.length` — the 7
built-in starter templates are never added to `customRoadmaps` and must never count
toward this limit. `createCustomRoadmap()` throws a tagged `Error` (`error.code =
'capped'`) rather than returning `{ ok: false }`, matching the existing "throws on
invalid input" contract the empty-title check right above it already has — a caller that
doesn't care about the distinction can keep treating this like any other rejected
creation. `onboarding.js`'s `handleCreate()` catches `error.code === 'capped'` and shows a
dedicated `confirmDialog()` popup (not a toast — a hard limit the user needs to actually
notice and act on, not something that can quietly disappear before it's read) explaining
the limit and pointing at deleting an older/unused custom roadmap. This reuses
`confirmDialog()`'s new `cancelText: null` info-only mode (`confirmDialog.js`) — a single
"Got it" button, no Cancel, for a purely informational pop-up with nothing to actually
decline. `database.rules.json`'s `meta.customRoadmaps.$index` rule is tightened to match
(`$index.matches(/^([0-9]|1[0-9]|2[0-4])$/)`, indices `0`-`24`) — if `MAX_CUSTOM_ROADMAPS`
is ever retuned, this regex must be updated in lockstep, the same "client and server caps
must stay in sync" discipline `favoriteRoadmapIds`' own cap above already documents.
Deliberately **no accompanying creation-rate cooldown** alongside this count cap: two
legitimate custom roadmaps created back-to-back is already a real, tested scenario
(issue #153's overlapping-`createCustomRoadmap()` race-condition fix, see the "lost-update
race" section below) — a time-based cooldown would reject the second one outright instead
of handling it correctly, which is what that fix exists to do.

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

**Global topic search across every roadmap — `getAllRoadmapsForSearch()` (issue #283).**
The command palette's nav-item-only search (issue #125) was scoped that way
deliberately, with searching live roadmap topics called out as its own follow-up issue —
this is that follow-up. `roadmapStore.js` exports `getAllRoadmapsForSearch()`, a
**read-only** cross-roadmap query helper: it resolves `[{ id, title, items, phases }]`
for every roadmap in `startedTemplateIds` (built-in + custom), by reusing the exact same
`fetchTemplateData()`/`resolveRoadmapItems()` cache-first resolution `switchRoadmap()`
already uses (cache → Firebase → local blob → seed) — run concurrently across every
roadmap via `Promise.all`, same discipline as `switchRoadmap()`'s own network calls
(issue #121 item 6), since none of these reads depend on each other. It deliberately
**never writes to `roadmapCache` or any other store state** — unlike every other
`resolveRoadmapItems()` caller (`setUser`/`switchRoadmap`), which always follows up by
assigning the result into `roadmapCache`/`items`, this one only reads: opening the
command palette must never mutate a roadmap the user hasn't actually switched to, even a
not-yet-visited one that would otherwise get cached as a side effect of being read.

The actual matching is `src/core/roadmap/globalTopicSearch.js`'s
`searchTopicsAcrossRoadmaps(roadmaps, query)` — a **pure** function (no DOM/store/
Firebase access), following this file's existing `core/roadmap/*.js` convention, taking
`getAllRoadmapsForSearch()`'s resolved shape directly. It searches topic title, phase,
section, notes, and resource label/url — deliberately wider than `dashboard.js`'s own
per-roadmap `searchQuery` (title/phase/section only), which stays exactly as it is; the
two are separate searches for separate purposes (fast local filter vs. "where did I put
that across every roadmap I have"), not one generalizing into the other. `topbar.js`
wires the two together via `commandPalette.js`'s new `crossRoadmapSearch` option (see
`.claude/rules/ui-styling.md`'s command-palette entries for the UI-layer half) and
handles selecting a result: `store.switchRoadmap(match.roadmapId)` (a no-op if already
active) followed by a one-shot `sessionStorage[KEYS.OPEN_ITEM]` signal that
`dashboard.js`'s `applyOpenItemSignal()` consumes — same "read once, then clear"
precedent as `KEYS.SCROLL_TO_PHASE` above, opening the target topic via the existing
`openItemPanel({ item, onSave, onDelete })` entry point every row-level edit action
already uses. Because a no-op `switchRoadmap()` never fires a store `notify()`, the
same-roadmap-already-active case additionally dispatches a plain
`window.dispatchEvent(new CustomEvent('ascent:open-item'))` so an already-mounted
dashboard picks up the signal immediately, without a real navigation. If you add another
cross-roadmap read (a second global search facet, a "recently completed across all
roadmaps" widget, etc.), reuse `getAllRoadmapsForSearch()`'s read-only,
`fetchTemplateData()`/`resolveRoadmapItems()`-backed pattern rather than building a
second bespoke multi-roadmap fetch path.

**Further ESLint complexity cleanup beyond issue #129's setUser split (issue #279) —
more of the same extraction discipline, not a new pattern.** `resolveRoadmapItems()`'s
merge branches share one new helper, `buildMergedResolution({ sourceItems, sourcePhases,
baseItems, basePhases, dirty })` (module-scope, pure), and its remote-read branch calls
`fetchRemoteRoadmapSafely(templateId)` instead of building/catching the promise inline.
`setUser()`'s uid-transition wipe is now `maybeResetForNewUid(nextUid)` (a closure over
the store's own mutable state, same shape as the file's other phase functions, not a
pure module-scope function — it has to reassign `items`/`activeTemplateId`/etc.
directly) and its blank-migration apply step is `applyBlankMigrationIfNeeded(onboarding)`.
`resolveOnboardingState()` itself split into `newShapeOnboardingState(remoteMeta)` (the
already-on-issue-#58-shape branch) and `resolveLegacyOnboardingState(...)` (everything
else — the legacy-detection/migration path). `switchRoadmap()`'s tail split into
`detachAndCacheOutgoingRoadmap()` and `attachIncomingRoadmapAndNotify()`. `updateItem()`'s
length/shape caps moved into `isValidItemPatch(patch)`. `activityLogStore.js`'s and
`dailyTodoStore.js`'s `setUser()` got the identical `maybeResetForNewUid`/
`resolveLocalEntries`-or-`resolveLocalItems` split (the latter two are pure — no closure
state, unlike the roadmapStore.js's version of `maybeResetForNewUid`); `activityLogStore.js`'s
`setUser()` additionally split into `detachListeners()`/`queuePendingSaves()`, and
`dailyTodoStore.js`'s `addTodo()` split into `validateTodoInput()`/`buildTodoRecord()`.
None of this changes any store's external contract — every helper is either
closure-private or serves a single already-documented function above; look there for the
actual behavior, not here.

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

**A lost-update race on `startedTemplateIds`/`customRoadmaps`/`favoriteRoadmapIds` could silently destroy a just-created custom roadmap — a critical, reported data-loss bug (issue #153).** `switchRoadmap()`'s `saveSwitchMeta()` write (and the equivalent whole-array writes in `createCustomRoadmap()`/`deleteCustomRoadmap()`) replaces the *entire* array field — Realtime Database's `update()` has no array-diffing. Two of these calls racing in back-to-back (the reported repro: importing two custom roadmaps within a few seconds) used to each read the shared `startedTemplateIds` variable and compute their own "append my id" snapshot *before either had reassigned it* — whichever call's write happened to land on Firebase last would overwrite the array with its own incomplete snapshot, permanently erasing the other call's id even though its actual roadmap data (and its `customRoadmaps` meta entry — see below for why that field alone was never affected) was untouched. **The downstream catastrophe**: once a custom roadmap's id is missing from `startedTemplateIds`, `switchRoadmap()`'s `alreadyStarted` check goes false, so opening that card again takes the fresh-seed branch — which "never reads Firebase for a template that isn't started yet" — loading it as empty. The very next debounced `queueSave()` then does a **full `set()` overwrite** of the real roadmap data with that empty seed. Not data becoming invisible — data being actively destroyed on the next save. `customRoadmaps` itself was never affected by this same race, because `createCustomRoadmap()` appends to it synchronously, before any `await`, at the very top of the function — JS's single-threaded execution guarantees a second overlapping call's synchronous prefix always sees the first call's already-applied append. `startedTemplateIds`, by contrast, used to be computed *inside* `switchRoadmap()` and only reassigned to the shared variable after that function's own internal `await Promise.all(...)` resolved — a second call racing in before that reassignment saw the stale, pre-update array.

**The fix: `serializeMetaMutation(run)`, a single in-module promise queue every array-field mutation is chained behind, not a broader redesign.** `switchRoadmap()` (`createCustomRoadmap()`'s and `deleteCustomRoadmap()`'s own array mutations funnel through the exact same call, since `createCustomRoadmap()` activates through `switchRoadmap()` and `deleteCustomRoadmap()` calls it directly) now computes `nextStartedTemplateIds` and reassigns the shared `startedTemplateIds` variable **inside** the queued closure, immediately before calling `saveSwitchMeta()` — not at the top of the function, before any `await`, like the old code did. Because `serializeMetaMutation` chains each mutation's completion (not just its *start*) behind the previous one via `.then()`, a second overlapping call's closure only begins executing — and therefore only computes its snapshot — after the first call's own closure has both applied its in-memory change *and* had its `saveMeta()` write settle. This guarantees a later write can never be a stale subset of an earlier one, sidestepping the "which network write lands last" race entirely rather than trying to win it. The existing `stateCallId`/`isStale()` guard (documented above) is unrelated and unaffected by this fix — that guard only ever protected *local render state* (`items`/`activeTemplateId`) from a stale call clobbering a newer one after the fact; it never protected the *already-dispatched* remote `saveMeta()` write, which is what this fix actually addresses. `deleteCustomRoadmap()` no longer computes its `customRoadmaps`/`startedTemplateIds`/`favoriteRoadmapIds` filters up front either — the filtering itself now happens inside the same queued closure, against whatever the shared arrays are at the moment that closure actually runs. See the "lost-update race on startedTemplateIds/customRoadmaps" describe block in `tests/integration/roadmapStore.test.js` — these tests fail against the pre-fix code (verified by temporarily reverting the change and confirming the second overlapping call's meta write reports only its own id) and pass against the fix. If you add a fourth call site that mutates any of these three arrays and calls `saveMeta()`, route it through `serializeMetaMutation()` the same way — reading-then-writing one of these arrays outside the queue silently reintroduces this exact race.

**`flush()`'s post-await bookkeeping used to read shared, possibly-reassigned state — a second, independent bug found during the same investigation (issue #153 root cause #3).** `flush()` captures `templateId = activeTemplateId` synchronously before its only `await` (`adapter.saveRoadmap()`), which is correct — but it used to read the shared `items`/`templatePhases`/`dirty`/`activeTemplateId` variables *again*, unconditionally, after that `await` resolved. If a `switchRoadmap()` to a *different* template completed while an earlier, slower `flush()` call was still awaiting its own network write (a realistic scenario once the retry mechanism below means a flush can legitimately take longer than a fast subsequent switch), those post-await lines would stamp the *new* template's live data into the *old* template's `roadmapCache` slot, mislabeled `dirty: false` — poisoning the cache for the template the flush was actually supposed to be about. Fixed by capturing `items`/`templatePhases` into local variables (`flushedItems`/`flushedPhases`) at the same synchronous point `templateId` already was, and using those captures for every post-await read; the live `dirty`/`persistLocal()` update is also now gated on `activeTemplateId === templateId` still holding, so a flush for a template that's no longer active only ever touches its own cache slot, never the (now-different) live in-memory state. See the "flush() post-await state capture" describe block in `tests/integration/roadmapStore.test.js`.

**A failed save used to be a dead end — the save badge's "retrying…" claim was false until this fix (issue #153 root cause #2).** `queueSave()`'s debounced `flush()` call used to be wrapped in exactly one `.catch()` that logged the error and set `saveState: 'error'` — nothing ever re-queued a save after that. `dashboard.js`'s badge nonetheless said "Save failed — retrying…", which was never true; the badge (and the sync pill, which confusingly still said "Ready") would sit in that state indefinitely until the user happened to make another edit. `scheduleSaveRetry()`/`attemptFlushWithRetry()` (`roadmapStore.js`) now back that claim with real exponential backoff (2s, 4s, 8s… capped at 30s), notifying `{ saveState: 'error', retryAttempt, retryInMs }` on every failed attempt so the UI can show an accurate countdown. `dashboard.js`'s badge shows `Save failed — retrying in Ns…` plus a "Retry now" button (`store.retrySaveNow()`, exported from the store) that cancels the pending backoff timer and retries immediately — useful once a user notices their connection is back rather than waiting out the full delay. `queueSave()` resets the retry-attempt counter (`clearSaveRetry()`) on every new edit, so an in-progress backoff sequence doesn't compound with a fresh, unrelated edit's own first attempt.

**`onboarding.js` now subscribes to store updates like every other data-driven page (issue #153 root cause #4).** `dashboard.js` and `progress.js` both call `store.subscribe(...)`; `onboarding.js` used to read `store.getSnapshot()` exactly once, synchronously, at the top of `renderOnboarding()`, and build static DOM from that one-time snapshot — any scenario where the store's `customRoadmaps`/`startedTemplateIds`/`hiddenTemplateIds`/`favoriteRoadmapIds` changed after that initial render (a slow `createCustomRoadmap()`/`switchRoadmap()` call settling in the background, or a meta re-fetch) left the page stale until the user force-navigated away and back — this matches a separately-reported historical symptom ("roadmaps not visible on the main onboarding screen, but visible after clicking the roadmaps icon"). The fix subscribes once at mount and, on a snapshot whose relevant arrays actually differ (a plain `JSON.stringify` compare — cheap and sufficient, these arrays are small), updates the page's own local copies and re-renders only `renderVisibleGrid()`/`renderHiddenToggle()` — not the whole page — via the same functions the initial render already calls. It skips entirely while `picking` is `true` (a pick/create/delete action in flight), so a live update can never yank a card out from under an in-progress click. `settings.js` was audited too but deliberately left unchanged — nothing on that page currently renders data derived from `store.getSnapshot()` (its `Data`/`Danger zone` sections only pass `store` through to action callbacks like `exportBackupJson`), so there is no live staleness bug to fix there yet; wire up the same pattern if a future change adds store-snapshot-derived content to that page.

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

**Spaced-repetition review reminders — Phase A, fixed-interval only (issue #134).**
`src/core/roadmap/reviewSchedule.js` (`getReviewDueItems(items, now)`/`isReviewDue(item,
now)`) is a pure module computing which completed topics are "due for review": a
non-deleted, `done: true` item whose `item.completedAt` (or `item.lastReviewedAt` if
set — see below) is older than `REVIEW_INTERVAL_MS` (14 days, `REVIEW_INTERVAL_DAYS`, a
named constant). **This is deliberately not a full spaced-repetition algorithm** — no
per-item ease factors, no growing intervals, a single fixed global interval for every
item — see the issue for why a true SM-2-style model was scoped out of this first
version; don't assume more sophistication exists here than actually does.
`item.lastReviewedAt: number | null` is the one new item field (missing/`null` both mean
"never reviewed since completion" — same backward-compat convention as
`notes`/`completedViaTodoAt`), set only when a user clicks the dashboard's "Mark
reviewed" action on a review-due row (`store.updateItem(id, { lastReviewedAt: Date.now()
})`) — **never** re-derived from `completedAt` alone, so a topic cycles review-due ->
reviewed -> review-due-again over time without ever touching `done`/`completedAt`. No
`updateItem()` change was needed for this: the existing cosmetic-check
(`Object.keys(patch).every(key => key === 'done')`) already treats any patch key other
than `done` as non-cosmetic, so a `{ lastReviewedAt }` patch bumps `structuralVersion` for
free, same as `notes`. `dashboard.js` surfaces this as a sixth filter chip, `'REVIEW'`
(alongside `ALL`/`P0`-`P3`/`RESOURCES` — `matchesActiveFilter()` delegates to
`isReviewDue()`), plus a header pill (`.review-due-nav-badge`, next to the Daily Todo
countdown badge in `topbar.js`'s actions row, same cross-roadmap-badge precedent) showing
the due count; clicking it jumps straight to the `REVIEW` filter rather than a separate
page. `renderItemRow()`'s "Mark reviewed" button only renders on a currently review-due
row, following the same `data-action`/`e.stopPropagation()` click-guard convention as
every other nested row control. A `done` toggle (`patchDoneStates()`'s fast path, not just
the full `render()`) also refreshes the header pill, since checking/unchecking an item
can flip it in or out of review-due state via `completedAt` alone. **This feature had no in-UI explanation of what "Review due" means until a follow-up fix** — unlike Daily Todos/"Build your own roadmap" (both have an ℹ guide modal), the `REVIEW` chip and header pill were undiscoverable, real feedback found live. Fixed with `attachTooltip()` on the chip (hover/focus, explaining the 14-day/"Mark reviewed" mechanic) and a fuller native `title` on the header pill — no new guide modal, since the explanation is one sentence and doesn't warrant `buildYourOwnGuide.js`'s heavier pattern. If this feature ever grows real configurability (a user-adjustable interval, etc.), promote it to a proper guide modal at that point rather than stretching the tooltip.

**Pattern/concept tags — `item.tags`, grouping review-due reminders by shared tag (issue
#182).** Every item may carry an optional `tags: string[]` field (missing/empty array
both mean "no tags" — same backward-compat convention as `notes`/`lastReviewedAt`),
freeform user-entered short labels edited from `itemPanel.js`'s "Tags" field (a single
comma-separated text input, not a bespoke chip-entry widget — the lightest-weight shape
that fits alongside the existing Title/Priority/Notes fields). Capped client-side at
`MAX_TAGS_PER_ITEM` (5) tags of at most `MAX_TAG_LENGTH` (30) characters each
(`core/roadmap/limits.js`'s `isValidTags()`), enforced the same way `isValidResource()`
already gates `patch.resources` inside `updateItem()` — an invalid `tags` patch fails
the whole `updateItem()` call, mutating nothing, same "callers must check the return
value" convention as the title-length/resource-shape caps. `normalizeBackupItem()`
(backup/restore path) defaults an incoming item's `tags` to `[]` if it fails
`isValidTags()`, same defaulting precedent as `resources`/`notes`. `tags` is **not**
listed in the `updateItem()` cosmetic-check exemption (only `done` is), so a `{ tags }`
patch bumps `structuralVersion` for free, same as `notes`/`lastReviewedAt`.
`reviewSchedule.js` gains `groupReviewDueItemsByTag(items, now)` — a pure function (no
DOM/store access, same convention as `getReviewDueItems()`/`isReviewDue()` above) that
takes the existing review-due set and buckets it by shared tag: a tag only forms a real
group once **2 or more** due items share it; anything left over (no tags, or a tag no
other due item currently shares) renders as its own singleton group (`{ tag: null,
items: [item] }`). A multi-tag item can legitimately appear in more than one group — it
only falls back to a singleton if *none* of its tags matched another due item. This
does **not** change the underlying fixed-interval due-date algorithm in any way — it is
purely a grouping/presentation layer on top of the existing `getReviewDueItems()`
output, per the issue's explicit scope. `dashboard.js` surfaces this as a summary banner
(`.review-tag-group-banner`, one line per tag group) shown only while the `REVIEW`
filter chip is active, plus a separate, always-available tag filter-chip row
(`collectAllTags()` collects every distinct tag across the roadmap, sorted
alphabetically) reusing the existing `.filter-chip`/`.filter-row` CSS as-is — a
lighter-weight, unpersisted, single-select AND condition layered on top of the sticky
`activeFilter` priority chips, not a second sticky-session filter. No AI tag suggestion
and no global tag-management page (rename/merge/delete across every item) — both
explicitly out of scope for this issue, tags are edited per-item only.

**Lightweight time tracking — `item.timeSpentSeconds`, a plain cumulative counter, not a
Pomodoro/focus-enforcement feature (issue #180).** Both a roadmap topic and a Daily Todo
gained an optional `timeSpentSeconds: number` field (missing/`undefined` both mean "never
tracked" — same backward-compat convention as `notes`/`lastReviewedAt`) recording total
elapsed time a start/pause control (`itemPanel.js`'s "Time tracked" field;
`dailyTodoPanel.js`'s per-row timer button) has accumulated. `src/core/time/timeTracking.js`
is the pure math module (`computeElapsedSeconds`/`accumulateElapsed`/`formatTimeSpent`) —
no DOM/store access, mirroring `reviewSchedule.js`'s "pure computation, UI wires it up"
split above. **A running timer's session start (`runningSince`/`startedAt`) is
deliberately local-only UI state, never written to the store or synced live across
devices/tabs** — matching Daily Todos' own live countdown precedent (device-locally
computed from a stored `expiresAt`, not pushed device-to-device) and the issue's explicit
scoping. Only the *stopped* result (the new cumulative total) is persisted, through the
exact same per-item patch mechanism every other field already uses: `itemPanel.js` calls
`onSave({ timeSpentSeconds })` (→ `roadmapStore.updateItem()`, same path as `notes`/
`lastReviewedAt` — no store change was needed there, since `updateItem()`'s cosmetic-check
already treats any non-`done` patch key as structural) on pause and again on panel close if
a session is still running (mirroring the notes-autosave-flush-on-close pattern immediately
above it in that file); `dailyTodoPanel.js` calls a new, dedicated
`dailyTodoStore.addTimeSpent(id, seconds)` — an *adder*, not a generic patch function like
`updateItem()`, since a todo timer only ever wants to add elapsed seconds, never overwrite
the total, and the panel's `node._cleanup` flushes any still-running per-todo timer before
unmount for the same "never silently drop a session" reason. Never build a "resume where
you left off across devices" feature on top of this without a new design — the running
state genuinely does not exist anywhere the store or Firebase can see it. `/progress`
sums `timeSpentSeconds` across the active roadmap's `items` and every Daily Todo into a
5th `.kpi-tile` stat (`progress.js`'s `renderStatCards()`) — computed fresh on every
render, not cached, since even the item-count cap (800) and todo cap (20 active) make
that cheap. **A reset (⟲) icon-button next to `itemPanel.js`'s timer toggle (issue
#203)** zeroes `timeSpentSeconds` back to 0, gated behind `confirmDialog({ danger: true
})` since it's unrecoverable — same click-guard-free pattern as the toggle button itself
(both sit directly in `.timer-row`, no nested-interactive-content concern since neither
is inside a `role="checkbox"`/`role="button"` ancestor). If a session is currently
running, `resetTimer()` clears `runningSince`/`timerTickTimer` first (same teardown
`stopTimer()` does) rather than letting a still-running session's next tick resurrect a
nonzero total — reset always leaves the display at "0s", never a stale in-progress
value. Persists through the exact same `onSave({ timeSpentSeconds })` call every other
timer mutation already uses; no store-level change was needed.

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

**Streak freeze / grace day (issue #179) — `activityLogStore.js`'s `streakFreezes` state, a sibling to `entries`, not a piece of `roadmapStore.js`'s `meta`.** Protects `computeStreaks()`'s `current` streak (never `longest`, per the issue's explicit scoping) from breaking on a single missed day, matching the near-universal Duolingo "streak freeze" precedent the issue names. `streakFreezes` is `{ available, usedDates, lastGrantedAt }` — `available` is capped at `MAX_STREAK_FREEZES` (1, `streaks.js`), `usedDates` is the append-only list of dateKeys a freeze has already been spent on, `lastGrantedAt` tracks when the last token was granted so a new one can be granted every `FREEZE_GRANT_INTERVAL_MS` (7 days) once `available` drops below the cap. Two **pure** functions in `src/core/analytics/streaks.js` do all the decision-making (unit-testable with no store/DOM, same discipline as `computeStreaks` itself): `maybeGrantStreakFreeze(streakFreezes, now)` grants a token if the interval has elapsed and the cap isn't reached (a `null` `lastGrantedAt` — a brand-new account — establishes a baseline instead of granting immediately, so day-one doesn't start with a freeze already banked); `maybeAutoApplyStreakFreeze(activityLog, streakFreezes, now)` spends one token on **yesterday's** date the moment it's found missed, but only if there was an actual streak going into it (the day before yesterday was itself active or already frozen) — there's nothing to protect otherwise. `computeStreaks(activityLog, now, frozenDates)` (its third param, new for this issue, defaulting to `[]` so every existing call site with two args is unaffected) treats any date in `frozenDates` as if it had a real completion for the purpose of `current`, never `longest`. Automatic, not a manual toggle — the issue's own chosen UX, closest to the Duolingo precedent and needing no extra UI. `activityLogStore.js`'s `setUser()` runs both pure functions once per sign-in (via a `resolveStreakFreezes()` helper, extracted to keep `setUser`'s own complexity down per the ESLint gate) right after `entries`/pruning are resolved, since `maybeAutoApplyStreakFreeze` needs `entries` to decide whether yesterday was genuinely missed. If a spend happens, `activityLogStore.consumeJustAppliedFreeze()` (one-shot, cleared on read) lets `progress.js` show a one-time confirmation toast on mount, never re-shown on a later render/reload. Persistence mirrors `entries`' own pattern exactly but as an **independent** dirty/save-timer/flush trio (`freezesDirty`/`freezesSaveTimer`/`flushFreezes()`) rather than sharing `entries`' own, since the two live on separate Firebase paths (`users/{uid}/streakFreezes`, not nested under `activityLog` — `$date` under `activityLog` is a `$date: isNumber()` wildcard, incompatible with a nested object) and change on very different cadences (streaks: every completion; freezes: a grant every 7 days, a spend on a missed day). `KEYS.STREAK_FREEZES` (`localStorageKeys.js`) is the local-fallback key, cleared alongside `KEYS.ACTIVITY_LOG` on the same uid-transition sign-out guard every other store in this file already has. `firebase/database.rules.json`'s `streakFreezes` node validates only `available` in `hasChildren` (not `usedDates`) — an empty `usedDates: []` array never actually creates a real child node in Realtime Database (same "empty array/object silently drops on write" gotcha `sharedRoadmaps/{shareId}`'s own rule already documents above), so requiring it in `hasChildren` would reject every brand-new account's first write.

**Client-side length caps on title/resource fields (`src/core/roadmap/limits.js`, issue #53) — the client-side half of issue #24's server-side Firebase rules.** `MAX_TITLE_LENGTH` (200), `MAX_RESOURCE_LABEL_LENGTH` (120), and `MAX_RESOURCE_URL_LENGTH` (2048) live in their own dependency-free module — never define these constants directly in `roadmapStore.js`, since `itemPanel.js` needs to import just the numbers without pulling in `roadmapStore.js`'s Firebase-backed storage-adapter chain (`adapterFactory.js` → `FirebaseAdapter.js` → `firebase.js`'s `https://` SDK imports), which breaks under Node's ESM loader in any test that doesn't mock `firebase.js`. `roadmapStore.js`'s `addItem()`, `updateItem()`, `addResource()`, and `updateResource()` — the only places these fields are ever written — reject (returning `false`, mutating nothing) a value over these caps; callers must check the return value, same convention as the item-count cap above. `itemPanel.js`'s Save/Add-resource handlers and `dashboard.js`'s quick-add row surface a friendly message using the same constants before the store call is even attempted — always keep the UI-layer message and the store-layer cap using the same imported constant, never a hardcoded number in either place. Issue #122 (the rest of #24's server-side rules, previously left unenforced for `items`/`customRoadmaps`/`activityLog`/`reports`) added two sibling constants to the same module, `MAX_CUSTOM_ROADMAP_TITLE_LENGTH`/`MAX_CUSTOM_ROADMAP_DESCRIPTION_LENGTH` — `createCustomRoadmap()` clamps (`.slice()`) to these rather than rejecting, since a custom roadmap's title/description usually comes from AI-generated import content, not something a user typed and would expect an error for. See `.claude/rules/auth-security.md`'s "Server-side data caps" entry for the full new-rule list and which caps (item count, feedback rate limiting) remain deliberately client-side only. The AI-import path (`src/core/roadmap/importValidator.js`'s `validateImportPayload()`) shares this exact same `MAX_TITLE_LENGTH` constant for every title field it checks (item title in all three item shapes, phase title, section title) — issue #186 found it previously checked only for non-empty, with no upper bound at all, letting an absurdly long AI-generated title pass validation and get persisted as-is through `createCustomRoadmap()`. The error message follows this validator's own structured/technical convention (`.claude/rules/content-style.md`'s documented exception), e.g. `phases[2].sections[0].title exceeds 200 characters`, not a prose sentence.

**Roadmap sharing — a frozen, read-only published snapshot, not a live pointer (issue #131).** "Share this roadmap…" (`sidebar.js`'s account menu, `shareRoadmapModal.js`) writes a public snapshot to a new **top-level** Firebase path, `sharedRoadmaps/{shareId}` — deliberately **not** nested under `users/{uid}`, so it never needs a rule letting one uid read another's `users/{uid}/...` subtree (every other rule in `firebase/database.rules.json` is uid-scoped; see `.claude/rules/auth-security.md`'s note on this being a narrow, deliberate exception). `shareId` is `crypto.randomUUID()` — a random, unguessable token, not a sequential or user-derived id. `src/core/roadmap/shareSchema.js`'s `buildRoadmapShareSnapshot(snapshot, { uid, title })` is a **pure** function (no DOM/store/Firebase) building the snapshot: `title`/`phases`/`items` with `done`/`priority`/`resources` per item — **`notes` and `completedAt` are never included**, even though `backupSchema.js`'s `buildRoadmapExport()` (the export/backup format this is structurally closest to) includes both. This is the one field a user might not want a stranger with the link reading, and there's no per-topic redaction UI in v1 — the share modal's copy says so explicitly ("Notes are never included in a shared link."). Resource URLs are re-validated with `isValidUrl()` at snapshot-build time (not just trusted from the store) — this is the one place a roadmap's data becomes readable by an unauthenticated client, so the usual "validate at render, validate at save" rule (see "Resource URLs must be validated" above) gets a third checkpoint here. `src/services/shareStore.js` (`publishRoadmapShare`/`revokeRoadmapShare`/`listMyShares`/`getSharedRoadmap`) is a thin, mostly-stateless wrapper directly over the Firebase SDK, same "doesn't fit the `StorageAdapter` contract" precedent as `feedbackStore.js` above — this is a one-shot publish/revoke/list flow over a non-per-template path, not bidirectional synced account state. The owner's own list of published shares is tracked in `users/{uid}/meta/shareIds` (a plain string array, same shape as `hiddenTemplateIds`/`startedTemplateIds`); publishing writes both `sharedRoadmaps/{shareId}` and the updated `shareIds` array in one multi-path `update()`, same "never observe one path written without the other" precedent `feedbackStore.js`'s `submitReport()` established. **Republishing always mints a new `shareId` and leaves any previously-published snapshot exactly as it was** — a share link never silently mutates out from under someone already viewing it; "always show my current progress" would be a distinct, separately-scoped follow-up, not this feature. Revoking deletes the `sharedRoadmaps/{shareId}` node outright (no soft-delete/tombstone — there's nothing sensitive left to retain a record of) and drops the id from `shareIds`; the link 404s immediately after, rendered by `src/ui/pages/sharedRoadmapView.js` (route `#/shared?id=...`, unauthenticated-reachable, registered via `router.js`'s new wildcard-prefix match — see its own comment for why a `*`-suffixed pattern was simpler than adding real `:param` support for this one call site) as a clear "this link has been revoked" state, never a raw blank page. The rendered view has zero interactive affordances (no checkboxes, no edit controls) by construction — it maps the snapshot straight to text/links, never wiring up a click handler that could toggle `done` or open an edit panel.

**`sharedRoadmaps/{shareId}`'s `.validate` rule deliberately does *not* list `phases`/`items` in its `hasChildren([...])` check — a real bug, found and fixed via direct emulator testing, not a stylistic choice.** Realtime Database silently drops an empty array/object on write — there is no way to persist an "empty container" as a real child node, so a value like `phases: []` or `items: {}` never actually creates a `phases`/`items` key at all. The rule originally listed both in `hasChildren`, which meant publishing a share for a genuinely empty custom roadmap (no phases added yet) would fail validation with a generic, indistinguishable-from-a-`.write`-rejection `permission_denied` — caught only by testing the rule directly against a real emulator with a realistic (non-empty) vs. empty payload side by side, since the app's own test payloads in `tests/e2e/roadmapSharingRules.test.js` always use non-empty phases/items and would never have hit this. `hasChildren` now only requires the fields that are always scalar and therefore always present: `schemaVersion`/`ownerUid`/`templateId`/`title`/`publishedAt`. If you ever add another array/object-typed required field to this schema, do not add it to `hasChildren` unless you're certain it can never legitimately be empty — check the RTDB emulator directly (`.settings/rules.json?ns=<instance>` with `Authorization: Bearer owner` shows the currently-*loaded* ruleset, useful for confirming a namespace mismatch isn't silently serving the emulator's permissive default instead of your actual rules file — see the debugging note this issue's PR review surfaced).

**Weekly progress digest banner — derived content, device-local "already shown" guard, same shape as the celebration entry below (issue #284).** `src/core/analytics/progressDigest.js`'s `computeProgressDigest(activityLog, now, frozenDates)` is pure (no DOM/store access) and is built directly on `computeStreaks()` — the digest's `streakDays` and the Progress page's own `analytics.streaks.current` can never disagree, since both trace back to the identical function. `hasDigestContent(digest)` gates whether there's anything worth showing at all (a week with zero completions and no active streak renders nothing). The "already shown this week" guard (`src/ui/utils/progressDigest.js`'s `shouldShowProgressDigest`/`markProgressDigestShown`) is a new per-uid keyed localStorage timestamp, `progressDigestLastShownKey(uid)` (`localStorageKeys.js`) — same **device-local only, never synced to Firebase** pattern as `celebrationShownKey`/`guestRiskNudgeShownKey` immediately below: seeing the digest once more on a second, previously-unvisited device is harmless, and there's no per-account synced "already dismissed" precedent anywhere else in this file either. Unlike the celebration flag, this one uses a rolling 7-day interval rather than a one-shot boolean, since a digest is meant to recur weekly, not fire exactly once ever. `src/ui/components/progressDigestBanner.js` follows `backupReminderBanner.js`'s exact dismissible-banner shape — a plain function returning a node or `null`, decided once at mount from `store`/`activityLogStore` snapshots, no subscription or timer of its own, wired into `dashboard.js` next to `verificationBanner`/`backupReminderBanner`. The guard is marked "shown" the moment the banner actually renders (not on dismissal), so a reload within the same week never re-shows it either way — but a week with nothing to summarize (`hasDigestContent()` false) leaves the guard untouched, so the banner can still appear later that same week the moment there's real activity to report.

**Phase/roadmap completion celebration — derived detection, device-local "already shown" guard (issue #181).** `src/core/roadmap/completionCelebration.js`'s `isRoadmapComplete(items)`/`getCompletedPhaseTitles(items)` are pure functions (no DOM/store access, reusing `computeOverview()`/`computePhaseBreakdown()` from `analyticsEngine.js` rather than duplicating `dashboard.js`'s own filtered/visible-item progress math) — completion is derived state, computed fresh on every call, never persisted to the roadmap item itself. `dashboard.js` calls both from its existing `render()`/`patchDoneStates()` hooks (see that file's own store-subscription notes above) rather than adding a new subscription or full re-render path: `patchDoneStates()` — which already runs on every plain done-toggle — is the only place a celebration can trigger for real; `render()` (full/structural re-renders, including the very first mount) only *seeds* the "already shown" flag silently, so a roadmap that was already 100% complete before this session started doesn't celebrate on load. The "already celebrated" flag (`src/services/celebrationShownStore.js`, `celebrationShownKey(uid)` in `localStorageKeys.js`) is deliberately **device-local only, never synced to Firebase** — same reasoning as `guestRiskNudgeShownKey`/`DAILY_TODO_REMINDERS_ENABLED`: finishing a roadmap on one device and seeing the celebration replay once on a second, previously-unvisited device is harmless, and there's no per-account synced equivalent of "already dismissed" state anywhere else in this file either. Phase identity for this flag is the phase **title string**, not an index — `computePhaseBreakdown()`'s output has no stable id and is sorted by completion percentage, so an index would silently point at the wrong phase after any completion-order change.

**Roadmap comparison view — `roadmapStore.js`'s `getRoadmapSnapshotForComparison(templateId)`, the one new read-only store helper (issue #285).** "Compare roadmaps" (`src/ui/components/roadmapComparisonModal.js`, opened from `progress.js`) supports two modes: (a) the active roadmap vs. its own original starter template's fresh seed content, and (b) the active roadmap vs. any other roadmap the user has started. Mode (a) needs no store change at all — it imports `buildSeedItems(templateId)` directly from `src/data/templates/index.js`, the same registry `roadmapStore.js` itself already reads from, and diffs it against `store.getSnapshot().items` (the active roadmap's own live, reactive in-memory state). Mode (b) is the one genuinely new need: reading a *different*, non-active started roadmap's items without switching the user's active roadmap out from under them (unlike every other cross-roadmap read in this file, which either operates on the currently active template or goes through the heavier `setItemDoneInTemplate()` cross-roadmap-write machinery documented above). `getRoadmapSnapshotForComparison(templateId)` is a thin wrapper around the existing `resolveRoadmapItems(templateId, fetchTemplateData(templateId))` pair — the exact same cache → Firebase → local blob → seed resolution order every other roadmap load already applies — but never assigns into `activeTemplateId`/`items`/`templatePhases`/`roadmapCache`/`dirty` and never attaches a listener. It's genuinely read-only: calling it for a roadmap already visited this session is an instant `roadmapCache` hit; calling it for one that's never been touched this session does the same one-shot Firebase/local read `switchRoadmap()` would, just without ever making that roadmap "active." The diff/overlap computation itself lives entirely in `src/core/roadmap/roadmapComparison.js` (`compareRoadmapTopics()`/`groupComparisonByPhase()`) — a **pure** module, no DOM/store/Firebase access, matching the `src/core/analytics/`/`reviewSchedule.js`/`completionCelebration.js` precedent of keeping all real computation independently unit-testable and decoupled from the store. Topics across the two sets are matched by a normalized `(phase, title)` key (`comparisonKey()`), not by item id — a freshly re-seeded template's `seed-...` ids never match a since-edited roadmap's own ids, and a custom roadmap's items were never seeded from a template at all, so id-matching would never produce a usable diff for either comparison mode.
