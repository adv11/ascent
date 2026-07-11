# Ascent — Public Store & Service Contracts

This document is the reference for the public contracts of `roadmapStore.js`,
`firebase.js`, `src/services/storage/`, `src/data/templates/index.js`, and the
AI-import modules under `src/core/roadmap/` — the surfaces other modules (and future
contributors) are expected to code against. For the *why* behind these decisions, see
`docs/architecture.md`. Update this file whenever one of these contracts changes shape.

## `createRoadmapStore()` — `src/services/roadmapStore.js`

`createRoadmapStore({ onCompletionToggle }?)` — `onCompletionToggle` (issue #8) is an
optional `(delta: 1 | -1) => void` callback, defaulting to a no-op, fired exactly once
per genuine `done` transition (from `updateItem` directly, and from all three branches
of `setItemDoneInTemplate`). `main.js` wires it to `activityLogStore`'s
`recordCompletion`/`recordUncompletion` — see `.claude/rules/roadmap-store.md`.

Returns a store instance with the following methods.

| Method | Signature | Notes |
|---|---|---|
| `subscribe` | `(callback: (snapshot) => void) => unsubscribe` | Calls `callback` immediately with the current snapshot, then on every `notify()`. |
| `setUser` | `async (user: { uid, providerData? } \| null) => void` | **Must be awaited.** Resolves `onboardingDone`/`activeTemplateId`/`startedTemplateIds` for the signed-in user (or clears state on sign-out) before returning. Also re-selects the active storage adapter via `getStorageAdapter(user)` before any of its own adapter calls. See "Onboarding detection" below. Safe to call concurrently with itself or `switchRoadmap` — a call superseded by a newer one before it finishes aborts without mutating state (the `stateCallId` guard, see `docs/architecture.md` §5.8, §5.11). |
| `switchRoadmap` | `async (templateId: string) => void` | Issue #58 — replaces `initFromTemplate`. Handles both a first-time pick and a later switch with the same logic: a not-yet-started template seeds fresh and is appended to `startedTemplateIds`; an already-started one is loaded cache-first (never re-seeded) and never touches any other template's stored items. Sets `onboardingDone = true`. Flushes any pending debounced edit on the *outgoing* template before switching (see `docs/architecture.md` §5.11 "flush-before-switch"). No-op if `templateId` is already active. Same `stateCallId` staleness guard as `setUser`. Called by `onboarding.js` with **no confirmation dialog** — switching is always non-destructive. |
| `hideTemplate` | `async (templateId: string) => void` | Per-user preference only — adds `templateId` to `hiddenTemplateIds` and persists to `users/{uid}/meta/hiddenTemplateIds` (plus a local fallback). No-op for an already-hidden id (no template-specific exceptions since issue #4 follow-up retired "blank", the one id this used to special-case). Never touches the template's own content, any other account, or `startedTemplateIds`/the ability to switch to an already-started template. See `docs/architecture.md` §5.9. |
| `unhideTemplate` | `async (templateId: string) => void` | Removes `templateId` from `hiddenTemplateIds` and re-persists. No-op if not currently hidden. |
| `isCustomRoadmapId` | `(id: string) => boolean` | Issue #4 — `true` iff `id` is a user-created roadmap's generated id (`croadmap-<timestamp>-<random>`), never a built-in template id. The only place this distinction is made; every other function below keys off it. |
| `createCustomRoadmap` | `async ({ title, description?, phases?, items? }) => Promise<string>` | Issue #4 (extended for AI-import) — generates a `croadmap-...` id, appends `{ id, title, description, createdAt }` to `customRoadmaps` (persisted to `users/{uid}/meta.customRoadmaps`), then activates it via `switchRoadmap(id)`. `phases`/`items` are optional: omitted, the roadmap seeds empty (manual "Create your own roadmap" flow); passed (from `adaptImportToRoadmap()`, AI-import flow), it activates already populated with that content instead — stashed in an internal one-shot `pendingCustomSeeds` map consumed by `fetchTemplateData`. Throws if `title` is empty/whitespace-only. Returns the new id. |
| `deleteCustomRoadmap` | `async (id: string) => void` | Issue #4 — no-op unless `isCustomRoadmapId(id)`. Removes the entry from `customRoadmaps`/`startedTemplateIds`, deletes `users/{uid}/roadmaps/{id}` and its local blob. If `id` is the active roadmap, switches to `java-backend` first so the app is never left without an active roadmap. |
| `addPhase` | `(title: string) => void` | Issue #4 — no-op unless the active roadmap `isCustomRoadmapId`. Appends `{ id, title, priority: 'P2', resourceKey: null, sections: [] }` to `phases`; bumps `structuralVersion`. |
| `renamePhase` | `(phaseId: string, newTitle: string) => void` | Issue #4 — same custom-roadmap-only guard. Re-files every item whose `phase` matched the old title to `newTitle`. |
| `removePhase` | `(phaseId: string) => void` | Issue #4 — same guard. Soft-deletes (`deleted: true`) every item filed under the removed phase. |
| `addSection` | `(phaseId: string, title: string) => void` | Issue #4 — same guard. Appends `{ id, title }` to the given phase's `sections`. |
| `renameSection` | `(phaseId: string, sectionId: string, newTitle: string) => void` | Issue #4 — same guard. Re-files matching items to the new section title. |
| `removeSection` | `(phaseId: string, sectionId: string) => void` | Issue #4 — same guard. Soft-deletes every item filed under the removed section. |
| `getSnapshot` | `(meta?: object) => Snapshot` | Synchronous; returns the current state merged with any extra `meta` fields. |
| `updateItem` | `(id: string, patch: object) => boolean` | Returns `false` (no-op) if `id` doesn't exist or the patch fails a length cap. Bumps `structuralVersion` unless `patch` only touches `done` (see architecture.md §5.1). A `{ notes }` patch (issue #15) is therefore non-cosmetic — never add `'notes'` to the cosmetic-check. Issue #18: a `patch.done` transition also derives `completedAt` internally (`Date.now()` on `false -> true`, `null` on `true -> false`) — this derived field is applied *after* the cosmetic-check runs against the caller's own patch keys, so a plain `{ done }` toggle still stays cosmetic. |
| `addItem` | `({ title, phase, section, priority }) => boolean` | Returns `false` (no-op, no `structuralVersion` bump) once the roadmap already holds 800 non-deleted items (issue #53, lowered from 1,000) — Realtime Database rules can't count a map's children. Otherwise adds the item, bumps `structuralVersion`, seeds `notes: ''`/`completedAt: null`, and returns `true`. Callers must check the return value. |
| `removeItem` | `(id: string) => void` | Soft-delete (`deleted: true`); always bumps `structuralVersion`. |
| `addResource` / `updateResource` / `removeResource` | `(id, ...) => void` | Mutate an item's `resources` array via `updateItem`. |
| `importBackupItems` | `(backupItems: Record<string, object>) => { added: number, updated: number, skipped: number }` | Issue #18 — restores a validated JSON backup's `items` map (see "Backup export/import" below) into the active roadmap. Preserves each item's own id (merges onto a matching existing id instead of duplicating — including un-deleting a soft-deleted match); a genuinely new id is subject to the same 800-item cap `addItem` enforces. Re-validates title/resource caps itself (a backup file is untrusted input). Bumps `structuralVersion` once and calls `queueSave()` once if anything was added/updated; a call where everything was skipped is a total no-op. Never mutates `items` directly from outside the store — the one entry point UI import call sites use. |
| `flush` | `async () => void` | Immediately persists `items` and `phases` to `localStorage` and (if signed in) Firebase, bypassing the debounce. |
| `getUiState` / `setUiState` | `() => object` / `(state) => void` | Per-device UI prefs (open phases, filter, search) — never synced to Firebase. |

### Item shape

```ts
{
  id: string, title: string, phase: string, section: string, priority: 'P0' | 'P1' | 'P2' | 'P3',
  done: boolean,
  completedAt?: number | null,  // issue #18 — Date.now() set on done false->true, null on true->false.
                                 // Missing/null both mean "never completed" (backward compat, same as notes).
  custom: boolean, deleted: boolean,
  resources: { label: string, url: string }[],
  notes?: string,     // issue #15 — plain text, ≤ 5000 chars. Missing/'' both mean "no notes".
  completedViaTodoAt?: number | null,  // issue #56 follow-up — set only via setItemDoneInTemplate()
                                        // (a linked Daily Todo), distinct from completedAt above.
  createdAt: number, updatedAt?: number,
}
```

### Snapshot shape

```ts
{
  uid: string | null,
  items: Item[],            // non-deleted items only
  allItems: Record<string, Item>,
  dirty: boolean,
  saveState: 'idle' | 'saving' | 'saved' | 'local' | 'synced' | 'error',
  structuralVersion: number,
  activeTemplateId: string | null,   // null only while onboardingDone === false
  startedTemplateIds: string[],      // issue #58 — every templateId this account has started
  onboardingDone: boolean | null, // null only before the first setUser() resolves
  phases: TemplatePhase[],     // the active roadmap's phase/section skeleton — code-derived
                                // for a built-in template, user-authored (mutable) for a custom one
  hiddenTemplateIds: string[], // per-user; templates hidden from this user's onboarding picker
  customRoadmaps: { id: string, title: string, description: string, createdAt: number }[], // issue #4
}
```

### Onboarding detection (Issue #51, extended by Issue #58)

`setUser` decides `onboardingDone`/`activeTemplateId`/`startedTemplateIds` in this
order — see `docs/architecture.md` §5.7 and §5.11 for the full rationale:

1. `users/{uid}/meta.startedTemplateIds` in Firebase, if non-empty — already on the
   issue #58 shape; `activeTemplateId` comes from `meta.activeTemplateId` (or the first
   started id).
2. Otherwise, a one-time read of the legacy singular `users/{uid}/roadmap` path decides
   whether this is a pre-#58 account that needs migrating forward, checked in order:
   `meta.onboardingDone` (post-#51 shape) → the local `ascent-onboarding-done` flag →
   real progress (`custom: true` or `done: true` on any item) in the legacy roadmap or
   local blob (a pre-#51 account). Any of these → treated as onboarded, the legacy
   roadmap (if any) is copied into `users/{uid}/roadmaps/{templateId}`, and the new meta
   shape is backfilled.
3. Otherwise: `onboardingDone = false`, `activeTemplateId = null`, `items = {}`, no
   realtime listener attached yet.

Callers (`main.js`) must `await setUser(...)` before reading `onboardingDone` off the
snapshot to make a routing decision — it is not safe to read it synchronously right
after calling `setUser`.

## `src/data/templates/index.js` — template registry

| Export | Signature | Notes |
|---|---|---|
| `TEMPLATES` | `{ id, name, description, icon, buildItems: () => Promise<Record<string, Item>> }[]` | The 7 starter templates, in display order (`'blank'` retired — issue #4 follow-up). `buildItems()` dynamically imports the template module. Has no concept of "hidden" — that's a per-user preference in `roadmapStore`, not a registry property. |
| `getTemplate` | `(id: string) => TemplateEntry` | Falls back to `TEMPLATES[0]` (`java-backend`) for an unknown or missing id — including `'blank'` now. |
| `buildSeedItems` | `(templateId: string) => Promise<Record<string, Item>>` | Equivalent to `getTemplate(templateId).buildItems()`. |
| `getTemplatePhases` | `(templateId: string) => Promise<TemplatePhase[]>` | The template's `PHASES` export — used for `dashboard.js`'s phase-card skeleton. |
| `getLegacyBlankTemplateData` | `() => Promise<{ baseItems: Record<string, Item>, phases: TemplatePhase[] }>` | Migration-only (issue #4 follow-up) — bypasses the `TEMPLATES`/`getTemplate` fallback to load `blank.js`'s own fixed phases/empty seed directly. Only ever called by `roadmapStore.js`'s one-time "blank" migration, as a fallback for pre-PR-#60 accounts whose stored roadmap is missing `phases`. |

Every registered template module (`java-backend.js`, `frontend.js`, `data-science.js`,
`genai-agentic-ai.js`, `math-grade12.js`, `piano.js`, `marketing.js`) exports `PHASES`
and a synchronous `buildSeedItems()` in the same shape `src/data/roadmap.js` always
used — see `docs/architecture.md` for the full shape. `blank.js` exports the same shape
but is no longer registered in `TEMPLATES`; kept only for `getLegacyBlankTemplateData()`.

## `src/core/roadmap/importValidator.js` — AI-import validation (issue #4)

Pure — no DOM, no store, no Firebase.

| Export | Signature | Notes |
|---|---|---|
| `SUPPORTED_SCHEMA_VERSION` | `number` (currently `1`) | The only `schemaVersion` value `validateImportPayload` accepts. |
| `parseImportJson` | `(rawText: string) => { data: object \| null, error: string \| null }` | `error` is set to a friendly message on a JSON parse failure; otherwise `data` is the parsed value and `error` is `null`. |
| `validateImportPayload` | `(data: unknown) => string[]` | Empty array means valid. Checks (in order): top-level shape, `schemaVersion`, `title`, non-empty `phases`, then per-phase `title`/`priority`/`sections`, per-section `title`/`items`, per-item shape (string or `[title, priority]` tuple), and a 500-item total cap. Error strings include the `phases[i].sections[j].items[k]` path. |
| `validateImportText` | `(rawText: string) => { valid: boolean, errors: string[], data: object \| null }` | Combines `parseImportJson` + `validateImportPayload` for UI call sites — `data` is only set when `valid` is `true`. |

## `src/core/roadmap/schemaAdapter.js` — AI-import conversion (issue #4)

Pure — no DOM, no store, no Firebase. Only ever called on data that has already passed
`validateImportPayload`; does not re-validate.

| Export | Signature | Notes |
|---|---|---|
| `adaptImportToRoadmap` | `(data: object) => { phases: TemplatePhase[], items: Record<string, Item> }` | Converts a validated import payload into the exact shape `roadmapStore.createCustomRoadmap({ phases, items })` expects — generating `phase-...`/`section-...`/`custom-...` ids the same way `addPhase`/`addSection`/`addItem` do. A plain-string item inherits its phase's `priority`; a `[title, priority]` tuple uses its own. |

## `src/data/importPrompt.js` — versioned AI-import prompt (issue #4)

| Export | Signature | Notes |
|---|---|---|
| `IMPORT_PROMPT_VERSION` | `number` (currently `1`) | Must match `SUPPORTED_SCHEMA_VERSION` in `importValidator.js` — bumping one without the other means the prompt asks for a schema the validator won't accept. |
| `buildImportPrompt` | `(topic: string, options?: { experienceLevel?: string, timeframe?: string, goal?: string, alreadyKnow?: string }) => string` | Renders the full copyable prompt with `topic` as the start of its last line (or a placeholder bracket if empty) — always a complete, ready-to-paste block, never a template with a blank left in it. `options` (issue #64 Part 2) appends one instruction line per set field after the topic line — `Experience level: …`, `Target timeframe: …`, `Goal / context: …`, `Already know: …` (trimmed) — each omitted entirely when unset/blank, never rendered as an empty line. These only ever change the free-text instructions block, never the JSON schema contract above it, so this needed no `IMPORT_PROMPT_VERSION` bump and a prompt copied before this existed still parses identically. |

## `src/core/roadmap/backupSchema.js` — backup export format (issue #18)

Pure — no DOM, no store, no Firebase. A distinct schema/versioning track from
`importValidator.js`/`schemaAdapter.js` above (AI-import) — this snapshots/restores a
roadmap the user already has, not a generated payload that seeds a new one.

| Export | Signature | Notes |
|---|---|---|
| `EXPORT_SCHEMA_VERSION` | `number` (currently `1`) | Bumped only when the exported/imported item shape changes in a way an older app version couldn't read. Unrelated to `importValidator.js`'s `SUPPORTED_SCHEMA_VERSION` — do not conflate the two. |
| `buildRoadmapExport` | `(snapshot: Snapshot) => BackupPayload` | `snapshot` is a `roadmapStore.getSnapshot()` result. Excludes soft-deleted (`deleted: true`) items. `BackupPayload`: `{ schemaVersion, exportedAt: string (ISO), exportedByUid: string \| null, templateId: string, itemCount: number, items: Record<string, BackupItem> }`, `BackupItem`: `{ title, phase, section, priority, done, completedAt, resources, notes }` (a subset of the full Item shape — no `id`/`custom`/`deleted`/`createdAt`/`updatedAt`/`completedViaTodoAt`, none of which a restore needs). `exportedByUid` is informational only, never read back on import — there is nothing to "strip" for a cross-account restore. |
| `buildRoadmapCsv` | `(snapshot: Snapshot) => string` | Flattened, RFC 4180-quoted (CRLF rows, doubled internal quotes) view for spreadsheet review — one row per non-deleted item, columns `phase,section,title,priority,done,completedAt,resourceCount,notes`. One-way — there is no CSV import, since a flat row has no resource-object slots to round-trip. |
| `exportFileBaseName` | `(templateId: string) => string` | `ascent-roadmap-<sanitized-templateId>-YYYY-MM-DD`; callers append `.json`/`.csv`. |

## `src/core/roadmap/backupValidator.js` — backup JSON validation (issue #18)

Pure — no DOM, no store, no Firebase. Same parse/validate split `importValidator.js`
established, applied to the schema above.

| Export | Signature | Notes |
|---|---|---|
| `SUPPORTED_BACKUP_SCHEMA_VERSION` | `number` (currently `1`, re-exported from `backupSchema.js`'s `EXPORT_SCHEMA_VERSION`) | The only `schemaVersion` `validateBackupPayload` accepts. |
| `parseBackupJson` | `(rawText: string) => { data: object \| null, error: string \| null }` | Same contract as `parseImportJson`. |
| `validateBackupPayload` | `(data: unknown) => string[]` | Empty array means valid. Checks top-level shape, `schemaVersion`, the `items` map's presence, then per-item `title`/`phase`/`section`/`priority ∈ P0-P3`. Error strings are `items.<id>.<field> is invalid`. Stops collecting past 30 errors (`...additional errors omitted.`) so a badly-mangled file doesn't produce an unusable wall of text. |
| `validateBackupText` | `(rawText: string) => { valid: boolean, errors: string[], data: object \| null }` | Combines `parseBackupJson` + `validateBackupPayload`; `data` only set when `valid`. |
| `diffBackupItems` | `(currentAllItems: Record<string, Item>, backupItems: Record<string, object>) => { totalCount, existingCount, newCount }` | Pure count-only diff for the import confirmation UI — matches by id against `currentAllItems` (includes soft-deleted items, so restoring over a deleted one correctly counts as "already exists"). Never mutates. |

## `src/ui/components/importBackupModal.js` — restore confirmation UI (issue #18)

| Export | Signature | Notes |
|---|---|---|
| `openImportBackupModal` | `(currentAllItems, backupData) => Promise<'merge' \| 'overwrite' \| null>` | Shows the `diffBackupItems()` summary and resolves the user's choice — `null` on cancel/Escape/outside-click. Never shown for an invalid file (callers run `validateBackupText` first). Built as an ad hoc `attachFocusTrap()` modal (`confirmDialog.js`'s pattern), not `openModal()` — the latter's `close()` has no callback hook for Escape/outside-click, which a promise-resolving modal needs. |

## `src/ui/utils/backupTransfer.js` — download/file-read DOM helpers (issue #18)

| Export | Signature | Notes |
|---|---|---|
| `downloadTextFile` | `(filename: string, content: string, mimeType: string) => void` | Client-side only — a throwaway `Blob`/`URL.createObjectURL()`/`<a download>` click, no server round trip. |
| `readFileAsText` | `(file: File) => Promise<string>` | Wraps `FileReader.readAsText`. |

## `src/ui/utils/backupActions.js` — shared export/import handlers (issue #18 follow-up)

Extracted out of `sidebar.js` so its account-dropdown menu items and
`backupReminderBanner.js`'s "Download backup" CTA drive identical logic instead of two
copies drifting apart.

| Export | Signature | Notes |
|---|---|---|
| `exportBackupJson` | `(store) => void` | Downloads the JSON backup and calls `markBackupTaken(uid)` (below) — the only export path that resets the backup-reminder clock. |
| `exportBackupCsv` | `(store) => void` | Downloads the CSV — never calls `markBackupTaken`, since a CSV isn't a restorable backup. |
| `importBackupFromFile` | `async (store, file: File) => void` | Validates, shows the diff-summary modal, sanitizes resource URLs (`isValidUrl()`), applies Merge/Overwrite via `store.importBackupItems()`/`store.removeItem()`, and shows a result toast. |

## `src/ui/utils/backupReminder.js` — periodic backup-reminder timing (issue #18 follow-up)

Pure aside from `localStorage`/`Date.now()` — no DOM. Backs `backupReminderBanner.js`.
Every function is keyed per-uid (`localStorageKeys.js`'s `backupFirstSeenAtKey`/
`lastBackupAtKey`/`backupReminderDismissedAtKey`), same pattern as
`verifyDismissedKey` — device-level, never synced to Firebase, never cleared on
sign-out (harmless since it's just a timestamp, already namespaced by uid).

| Export | Signature | Notes |
|---|---|---|
| `REMINDER_AFTER_MS` | `number` (14 days) | How long since the last backup (or first-seen, if none) before the reminder becomes due. |
| `SNOOZE_AFTER_DISMISS_MS` | `number` (7 days) | How long a "Not now" dismissal suppresses the reminder before it can resurface. |
| `ensureBackupFirstSeenAt` | `(uid: string, now?: number) => void` | Idempotent — call on every dashboard render; only writes once per uid, establishing a brand-new account's 14-day countdown baseline so it's never nagged on day one. |
| `markBackupTaken` | `(uid: string, now?: number) => void` | Called by `exportBackupJson` only — resets the "since last backup" clock. |
| `dismissBackupReminder` | `(uid: string, now?: number) => void` | Called by the banner's "Not now" (and by "Download backup", which also dismisses). |
| `shouldShowBackupReminder` | `(uid: string, hasRealProgress: boolean, now?: number) => boolean` | `false` for a signed-out user or a roadmap with no real progress; otherwise `true` once `REMINDER_AFTER_MS` has elapsed since the later of last-backup/first-seen, unless still inside a post-dismissal snooze window. |

## `src/ui/components/backupReminderBanner.js` — periodic backup nudge (issue #18 follow-up)

| Export | Signature | Notes |
|---|---|---|
| `createBackupReminderBanner` | `({ user, store }) => HTMLElement \| null` | Same shape as `verificationBanner.js` — a plain function returning a node or `null` (never rendered), decided once at mount, no subscription/timer of its own. Shown for an anonymous guest session too. |

## `src/ui/utils/linkDetector.js` — resource link-type detection (issue #12B Phase 1)

Pure — no DOM, no side effects.

| Export | Signature | Notes |
|---|---|---|
| `detectLinkType` | `(url: string) => string` | Detects a resource's link type from its hostname/path: `'youtube'`, `'github'`, `'notion'`, `'google-doc'`, `'google-drive'`, `'medium'`, `'stackoverflow'`, or the fallback `'article'` for any other http/https URL. Never throws — an unparseable string, a non-http(s) protocol (e.g. `javascript:`), or `undefined` all resolve to `'article'`. |
| `LINK_TYPE_META` | `Record<string, { label: string, icon: string, badgeClass: string }>` | Display metadata for every `detectLinkType` return value — the resource card badge (`itemPanel.js`) and the checklist row's resource-count tooltip breakdown (`dashboard.js`) both read from this instead of hardcoding their own icon/label per type. |

## `createActivityLogStore()` — `src/services/activityLogStore.js` (issue #8)

Same store pattern as `createDailyTodoStore()` — mutable map, `subscribe`/`notify`,
debounced local+Firebase sync, echo/dirty guards, sign-out privacy guard. See
`.claude/rules/roadmap-store.md` for why this exists separately from
`item.completedAt`.

| Method | Signature | Notes |
|---|---|---|
| `subscribe` | `(callback: (snapshot) => void) => unsubscribe` | Calls `callback` immediately, then on every `notify()`. Snapshot: `{ uid, entries: Record<string, number>, dirty, ...meta }`. |
| `setUser` | `async (user: { uid } \| null) => void` | **Must be awaited.** Loads local data, prunes entries older than 365 days (forcing `dirty` if anything was actually dropped), attaches the Firebase listener. Same `stateCallId` staleness guard as `roadmapStore`/`dailyTodoStore`. |
| `getSnapshot` | `(meta?: object) => Snapshot` | Synchronous. |
| `recordCompletion` | `(now?: number) => void` | Increments the current calendar day's count by 1. Never touches any other day. |
| `recordUncompletion` | `(now?: number) => void` | Decrements the current calendar day's count by 1, floored at 0. Never touches any other day. |
| `flush` | `async () => void` | Immediately persists `entries` to `localStorage` and (if signed in) Firebase, bypassing the debounce. |

`pruneOldEntries(entries, now?, maxAgeDays = 365)` is also exported standalone (pure) for
direct unit testing.

## `computeAnalytics()` and friends — `src/core/analytics/` (issue #8)

Pure functions — no DOM, no store access, no side effects. Safe to unit test with any
plain data. `items` throughout is a roadmap snapshot's non-deleted item list
(`store.getSnapshot().items`); `activityLog` is `activityLogStore.getSnapshot().entries`.

| Export | Module | Signature | Notes |
|---|---|---|---|
| `computeAnalytics` | `analyticsEngine.js` | `(items, activityLog, now?) => { overview, streaks, velocity, phaseBreakdown, priorityBreakdown, heatmapData, projection }` | Composes every sub-metric below. Internally merges `activityLog` with a backfill derived from items' `completedAt` (see `buildEffectiveActivityLog`) before computing anything date-based. |
| `computeOverview` | `analyticsEngine.js` | `(items) => { total, done, pct }` | |
| `computePhaseBreakdown` | `analyticsEngine.js` | `(items) => { phase, done, total, pct }[]` | Sorted ascending by `pct` (least complete first). |
| `computePriorityBreakdown` | `analyticsEngine.js` | `(items) => { phase, priorities: Record<'P0'\|'P1'\|'P2'\|'P3', { done, total }> }[]` | An invalid/missing `priority` is bucketed as `P2`. |
| `buildEffectiveActivityLog` | `analyticsEngine.js` | `(items, activityLog) => Record<string, number>` | Merges a log derived from items' `effectiveCompletedAt` underneath the real `activityLog` — the real log always wins for any day it has an entry for (even an explicit `0`), so a since-unchecked completion is never resurrected. |
| `effectiveCompletedAt` | `analyticsEngine.js` | `(item) => number \| null` | Backfill for pre-issue-#18 data: `item.completedAt` if set, else `item.updatedAt` if `done`, else `null`. Never written back to the item. |
| `computeStreaks` | `streaks.js` | `(activityLog, now?) => { current, longest }` | A day "counts" if its entry is `>= 1`. Today with 0 activity doesn't break the current streak, just doesn't extend it. |
| `computeVelocity` | `velocity.js` | `(activityLog, now?) => number` | Average items/day over the trailing 7 calendar days (today inclusive); the denominator is always 7. |
| `computeHeatmap` | `heatmapData.js` | `(activityLog, now?) => { date, count, level, isToday }[]` | Always exactly 364 cells (52×7), oldest first. `level` is bucketed 0/1/2/3/4 from count thresholds 0 / 1-2 / 3-4 / 5-6 / 7+ (`heatLevel`, also exported). |
| `computeProjection` | `projection.js` | `(items, activityLog, now?) => { remainingItems, velocity, daysToComplete?, projectedDate?, boostedDaysToComplete?, boostedProjectedDate?, complete?, noRecentActivity? }` | `complete: true` if nothing remains; `noRecentActivity: true` if 7-day velocity is 0 and work remains; otherwise both a current-pace and a "+2 items/day" boosted projection. |
| `dateKey` / `previousDateKey` | `dateKey.js` | `(timestamp?) => 'YYYY-MM-DD'` / `(key) => 'YYYY-MM-DD'` | Local calendar-day key — the single source of truth every module above and `activityLogStore.js` share for "which day did this happen on." |

## `src/ui/components/heatmap.js` — activity heatmap (issue #8)

| Export | Signature | Notes |
|---|---|---|
| `createHeatmap` | `(heatmapData: HeatmapCell[]) => HTMLElement` | `heatmapData` is `computeHeatmap()`'s output (see above). Returns a `role="img"` container with a computed `aria-label` summarizing total completions. Plain HTML/CSS Grid, not SVG — see the file's own doc comment for why. |

## `src/ui/components/chartWrapper.js` — lazy Chart.js loader (issue #8)

| Export | Signature | Notes |
|---|---|---|
| `createLineChart` | `async (canvas: HTMLCanvasElement, { labels, totals }) => Chart` | B4's cumulative progress line. Dynamically imports Chart.js from a pinned-version CDN URL on first call — see `docs/adr/ADR-002-csp-sri-security.md`'s "CDN loading exceptions". |
| `createBarChart` | `async (canvas: HTMLCanvasElement, { labels, counts, rollingAverage }) => Chart` | B5's daily velocity bars + 7-day rolling average overlay line. |

Both return a real Chart.js instance — callers must call `.destroy()` on it before creating
a new chart on the same canvas (Chart.js throws otherwise) and on component teardown.

## `src/ui/pages/progress.js` — Progress page pure helpers (issue #8)

Exported alongside `renderProgress(app, { user, store, activityLogStore })` (the page's
route entry point, same `(app, ctx) => cleanupFn` contract every other page follows) for
direct unit testing:

| Export | Signature | Notes |
|---|---|---|
| `buildCumulativeSeries` | `(effectiveLog, days, now?) => { labels, totals }` | One point per day in the window; `totals[i]` includes everything before the window too, so the line doesn't restart at 0 when the range toggle changes. |
| `buildVelocitySeries` | `(effectiveLog, days, now?) => { labels, counts, rollingAverage }` | `rollingAverage[i]` is the trailing-7-day average ending on day `i`. |
| `priorityBand` | `(done, total) => 'empty' \| 'low' \| 'mid' \| 'high'` | B7's cell-shading thresholds: empty (no items), <34% low, <67% mid, else high. |

## `src/ui/components/shareCard.js` and `shareModal.js` — social share card (issue #8, Part C)

| Export | Module | Signature | Notes |
|---|---|---|---|
| `generateShareCard` | `shareCard.js` | `async (analytics, activityLog, now?) => HTMLCanvasElement` | `analytics` is `computeAnalytics()`'s output; `activityLog` is the same effective (backfilled) log the Progress page's own heatmap renders from — pass `buildEffectiveActivityLog()`'s result, not the raw store snapshot. Pure with respect to app state (reads live CSS custom properties for its gradient, but never touches the DOM outside the canvas it returns). 1200×630px. |
| `openShareModal` | `shareModal.js` | `async (analytics, activityLog) => { close: () => void }` | Generates the card once, then opens a real `openModal()` dialog with an editable pre-filled caption and Download PNG / Copy image / Share… actions (the latter two feature-detected and hidden, not shown-and-failing, when unsupported). |

## `src/services/firebase.js`

| Export | Signature | Notes |
|---|---|---|
| `authApi` | `signIn, signUp, guest, signOut, linkGuest, sendResetEmail, sendVerificationEmail, setPersistence, deleteAccount, updateEmail, updatePassword, onChange` | Thin wrappers around Firebase Auth. `signOut()` (issue #24) delegates to `signOutWithCleanup()` (`src/services/authCleanup.js`), which deletes `users/{uid}` and the Auth record instead of a plain sign-out when the user is anonymous and unlinked — see `docs/adr/ADR-005-anonymous-user-lifecycle.md`. `updateEmail(newEmail, currentPassword)`/`updatePassword(newPassword, currentPassword)` (issue #16) reauthenticate first, same pattern as `deleteAccount(password)`; `updateEmail` calls Firebase's `verifyBeforeUpdateEmail`, so the address only changes once the new email's verification link is clicked. All three reject via `assertHasPasswordCredential`/`assertAccountDeletable` (`src/services/accountGuards.js`) for an anonymous guest, who has no password credential to reauthenticate with. |
| `authErrorMessage` | `(error) => string` | Maps Firebase Auth error codes to user-facing copy. |
| `database` | Firebase `Database` instance | Consumed only by `FirebaseAdapter` (below) — no other module should read/write the Realtime Database directly. |
| `firebaseClock` | `() => ServerValue` | Firebase's `serverTimestamp()` sentinel. Consumed only by `FirebaseAdapter.now()`. |

## Storage adapters — `src/services/storage/` (issue #5)

`roadmapStore.js` no longer imports Firebase directly — it calls whichever adapter
`getStorageAdapter()` returns. The interface is shaped around what `roadmapStore.js`
actually needs (per-user, per-template roadmap documents plus a separate per-user
`meta` document), which is broader than issue #5's original MVP sketch of a single
`load(roadmapId)`/`save(roadmapId, data)` pair — that sketch predates the multi-user/
multi-template data model issues #58 and #4 built. See `docs/architecture.md` §5.11 for
the full history.

### `StorageAdapter` — `src/services/storage/StorageAdapter.js`

Base class every backend extends. Required methods throw `not implemented` if not
overridden; optional ones have safe defaults.

| Method | Signature | Notes |
|---|---|---|
| `listenRoadmap` | `(uid, templateId, onData, onError) => unsubscribe` | **Required.** Realtime (or polled) listener for one template's roadmap. `onData` receives the plain roadmap payload (or `null`) — never a backend-specific wrapper. Originally leaked Firebase's `DataSnapshot` (`.exists()`/`.val()`) straight through; `FirebaseAdapter` now unwraps its snapshot internally before calling `onData`. |
| `saveRoadmap` | `(uid, templateId, payload) => Promise<void>` | **Required.** Full overwrite of one template's roadmap. |
| `getRoadmap` | `(uid, templateId) => Promise<object \| null>` | **Required.** One-time read. |
| `deleteRoadmap` | `(uid, templateId) => Promise<void>` | **Required.** Only ever called for a custom roadmap the user has explicitly deleted. |
| `getMeta` | `(uid) => Promise<object \| null>` | **Required.** One-time read of the user's roadmap-selection/onboarding meta. |
| `saveMeta` | `(uid, meta: object) => Promise<void>` | **Required.** Partial update, never a full overwrite. |
| `getLegacyRoadmap` | `(uid) => Promise<object \| null>` | Optional — default resolves `null`. Only `FirebaseAdapter` has pre-issue-#58 legacy data to migrate from. |
| `now` | `() => unknown` | Optional — default `Date.now()`. Adapter-specific write timestamp (Firebase's `serverTimestamp()` sentinel — a future second backend controls its own representation). |
| `destroy` | `() => void` | Optional — default no-op. Cleanup hook for a backend with open listeners/timers. |

### `FirebaseAdapter` — `src/services/storage/FirebaseAdapter.js`

| Export | Signature | Notes |
|---|---|---|
| `FirebaseAdapter` | `class extends StorageAdapter` | Same Realtime Database logic previously in `firebase.js`'s `dbApi` (unchanged behavior): `listenRoadmap`/`saveRoadmap`/`getRoadmap` on `users/{uid}/roadmaps/{templateId}`, `getLegacyRoadmap` on the pre-#58 `users/{uid}/roadmap`, `getMeta`/`saveMeta` on `users/{uid}/meta`. `now()` returns `firebaseClock()`. |
| `firebaseAdapter` | `FirebaseAdapter` instance | Singleton used by `adapterFactory.js`. |

### `LocalStorageAdapter` — `src/services/storage/LocalStorageAdapter.js`

| Export | Signature | Notes |
|---|---|---|
| `LocalStorageAdapter` | `class extends StorageAdapter` | Standalone `localStorage`-backed implementation, under its own dedicated keys (`KEYS.LOCAL_ADAPTER_ROADMAPS`, `KEYS.LOCAL_ADAPTER_META`) — independent of `roadmapStore.js`'s own local-cache bookkeeping (`KEYS.ROADMAPS` etc.), which is unchanged. `uid` is accepted but ignored (one local store per browser profile). `listenRoadmap` returns a no-op unsubscribe (no push mechanism over plain `localStorage`). **Not yet wired into `roadmapStore.js`** — reserved for a future guest-only/offline-cache adapter selection. |
| `localStorageAdapter` | `LocalStorageAdapter` instance | Singleton, unused by any call site yet. |

### `adapterFactory.js` — `src/services/storage/adapterFactory.js`

| Export | Signature | Notes |
|---|---|---|
| `getStorageAdapter` | `(user?: { providerData?: { providerId: string }[] } \| null) => StorageAdapter` | Always returns `firebaseAdapter` today — the `user` argument is accepted but unused, kept as the seam a future second backend would branch on. `roadmapStore.js`'s `setUser(nextUser)` calls this on every sign-in (not just once at store creation), so a future branch would apply across sign-out/sign-in-as-a-different-user within the same store instance without any call-site change. |
