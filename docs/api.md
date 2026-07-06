# Ascent — Public Store & Service Contracts

This document is the reference for the public contracts of `roadmapStore.js`,
`firebase.js`, and `src/data/templates/index.js` — the surfaces other modules (and
future contributors) are expected to code against. For the *why* behind these
decisions, see `docs/architecture.md`. Update this file whenever one of these
contracts changes shape.

## `createRoadmapStore()` — `src/services/roadmapStore.js`

Returns a store instance with the following methods.

| Method | Signature | Notes |
|---|---|---|
| `subscribe` | `(callback: (snapshot) => void) => unsubscribe` | Calls `callback` immediately with the current snapshot, then on every `notify()`. |
| `setUser` | `async (user: { uid } \| null) => void` | **Must be awaited.** Resolves `onboardingDone`/`activeTemplateId`/`startedTemplateIds` for the signed-in user (or clears state on sign-out) before returning. See "Onboarding detection" below. Safe to call concurrently with itself or `switchRoadmap` — a call superseded by a newer one before it finishes aborts without mutating state (the `stateCallId` guard, see `docs/architecture.md` §5.8, §5.11). |
| `switchRoadmap` | `async (templateId: string) => void` | Issue #58 — replaces `initFromTemplate`. Handles both a first-time pick and a later switch with the same logic: a not-yet-started template seeds fresh and is appended to `startedTemplateIds`; an already-started one is loaded cache-first (never re-seeded) and never touches any other template's stored items. Sets `onboardingDone = true`. Flushes any pending debounced edit on the *outgoing* template before switching (see `docs/architecture.md` §5.11 "flush-before-switch"). No-op if `templateId` is already active. Same `stateCallId` staleness guard as `setUser`. Called by `onboarding.js` with **no confirmation dialog** — switching is always non-destructive. |
| `hideTemplate` | `async (templateId: string) => void` | Per-user preference only — adds `templateId` to `hiddenTemplateIds` and persists to `users/{uid}/meta/hiddenTemplateIds` (plus a local fallback). No-op for `'blank'` or an already-hidden id. Never touches the template's own content, any other account, or `startedTemplateIds`/the ability to switch to an already-started template. See `docs/architecture.md` §5.9. |
| `unhideTemplate` | `async (templateId: string) => void` | Removes `templateId` from `hiddenTemplateIds` and re-persists. No-op if not currently hidden. |
| `getSnapshot` | `(meta?: object) => Snapshot` | Synchronous; returns the current state merged with any extra `meta` fields. |
| `updateItem` | `(id: string, patch: object) => void` | Bumps `structuralVersion` unless `patch` only touches `done` (see architecture.md §5.1). |
| `addItem` | `({ title, phase, section, priority }) => void` | Always bumps `structuralVersion`. |
| `removeItem` | `(id: string) => void` | Soft-delete (`deleted: true`); always bumps `structuralVersion`. |
| `addResource` / `updateResource` / `removeResource` | `(id, ...) => void` | Mutate an item's `resources` array via `updateItem`. |
| `flush` | `async () => void` | Immediately persists `items` to `localStorage` and (if signed in) Firebase, bypassing the debounce. |
| `getUiState` / `setUiState` | `() => object` / `(state) => void` | Per-device UI prefs (open phases, filter, search) — never synced to Firebase. |

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
  phases: TemplatePhase[],     // the active template's phase/section skeleton
  hiddenTemplateIds: string[], // per-user; templates hidden from this user's onboarding picker
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
| `TEMPLATES` | `{ id, name, description, icon, buildItems: () => Promise<Record<string, Item>> }[]` | The 8 starter templates, in display order. `buildItems()` dynamically imports the template module. Has no concept of "hidden" — that's a per-user preference in `roadmapStore`, not a registry property. |
| `getTemplate` | `(id: string) => TemplateEntry` | Falls back to `TEMPLATES[0]` (`java-backend`) for an unknown or missing id. |
| `buildSeedItems` | `(templateId: string) => Promise<Record<string, Item>>` | Equivalent to `getTemplate(templateId).buildItems()`. |
| `getTemplatePhases` | `(templateId: string) => Promise<TemplatePhase[]>` | The template's `PHASES` export — used for `dashboard.js`'s phase-card skeleton. |

Every template module (`java-backend.js`, `frontend.js`, `data-science.js`,
`genai-agentic-ai.js`, `math-grade12.js`, `piano.js`, `marketing.js`, `blank.js`)
exports `PHASES` and a synchronous `buildSeedItems()` in the same shape
`src/data/roadmap.js` always used — see `docs/architecture.md` for the full shape.

## `src/services/firebase.js`

| Export | Signature | Notes |
|---|---|---|
| `authApi` | `signIn, signUp, guest, signOut, linkGuest, sendResetEmail, sendVerificationEmail, setPersistence, deleteAccount, onChange` | Thin wrappers around Firebase Auth. |
| `dbApi.listenRoadmap` | `(uid, templateId, callback, onError) => unsubscribe` | Realtime listener on `users/{uid}/roadmaps/{templateId}` (issue #58 — was `users/{uid}/roadmap`, no `templateId`). Only one listener is attached at a time; switching templates detaches the previous one first. |
| `dbApi.saveRoadmap` | `(uid, templateId, payload) => Promise<void>` | Full overwrite of `users/{uid}/roadmaps/{templateId}`. |
| `dbApi.getRoadmap` | `(uid, templateId) => Promise<{ version, items } \| null>` | One-time read of a specific template's node — used by `resolveRoadmapItems` when a started template isn't already in the in-memory `roadmapCache`. |
| `dbApi.getLegacyRoadmap` | `(uid) => Promise<{ version, items } \| null>` | Issue #58 — one-time read of the old singular `users/{uid}/roadmap` path. Only ever called during legacy-account migration in `setUser`; never written to. |
| `dbApi.getMeta` | `(uid) => Promise<{ onboardingDone?, templateId?, activeTemplateId?, startedTemplateIds?, hiddenTemplateIds? } \| null>` | One-time read of `users/{uid}/meta`. `templateId` is the pre-#58 field, still read as a migration fallback; `activeTemplateId`/`startedTemplateIds` are the current fields. |
| `dbApi.saveMeta` | `(uid, meta: { onboardingDone?, activeTemplateId?, startedTemplateIds?, hiddenTemplateIds? }) => Promise<void>` | Partial `update()` — does not overwrite the whole `meta` node. |
| `authErrorMessage` | `(error) => string` | Maps Firebase Auth error codes to user-facing copy. |
