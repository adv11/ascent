# Ascent — Public Store & Service Contracts

This document is the reference for the public contracts of `roadmapStore.js`,
`firebase.js`, `src/services/storage/`, `src/data/templates/index.js`, and the
AI-import modules under `src/core/roadmap/` — the surfaces other modules (and future
contributors) are expected to code against. For the *why* behind these decisions, see
`docs/architecture.md`. Update this file whenever one of these contracts changes shape.

## `createRoadmapStore()` — `src/services/roadmapStore.js`

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
| `updateItem` | `(id: string, patch: object) => void` | Bumps `structuralVersion` unless `patch` only touches `done` (see architecture.md §5.1). A `{ notes }` patch (issue #15) is therefore non-cosmetic — never add `'notes'` to the cosmetic-check. |
| `addItem` | `({ title, phase, section, priority }) => boolean` | Returns `false` (no-op, no `structuralVersion` bump) once the roadmap already holds 1,000 non-deleted items — issue #24's client-enforced cap, since Realtime Database rules can't count a map's children. Otherwise adds the item, bumps `structuralVersion`, seeds `notes: ''`, and returns `true`. Callers must check the return value. |
| `removeItem` | `(id: string) => void` | Soft-delete (`deleted: true`); always bumps `structuralVersion`. |
| `addResource` / `updateResource` / `removeResource` | `(id, ...) => void` | Mutate an item's `resources` array via `updateItem`. |
| `flush` | `async () => void` | Immediately persists `items` and `phases` to `localStorage` and (if signed in) Firebase, bypassing the debounce. |
| `getUiState` / `setUiState` | `() => object` / `(state) => void` | Per-device UI prefs (open phases, filter, search) — never synced to Firebase. |

### Item shape

```ts
{
  id: string, title: string, phase: string, section: string, priority: 'P0' | 'P1' | 'P2' | 'P3',
  done: boolean,
  custom: boolean, deleted: boolean,
  resources: { label: string, url: string }[],
  notes?: string,     // issue #15 — plain text, ≤ 5000 chars. Missing/'' both mean "no notes".
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

## `src/services/firebase.js`

| Export | Signature | Notes |
|---|---|---|
| `authApi` | `signIn, signUp, guest, signOut, linkGuest, sendResetEmail, sendVerificationEmail, setPersistence, deleteAccount, onChange` | Thin wrappers around Firebase Auth. `signOut()` (issue #24) delegates to `signOutWithCleanup()` (`src/services/authCleanup.js`), which deletes `users/{uid}` and the Auth record instead of a plain sign-out when the user is anonymous and unlinked — see `docs/adr/ADR-005-anonymous-user-lifecycle.md`. |
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
