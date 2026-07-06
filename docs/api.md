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
| `setUser` | `async (user: { uid } \| null) => void` | **Must be awaited.** Resolves `onboardingDone`/`templateId` for the signed-in user (or clears state on sign-out) before returning. See "Onboarding detection" below. |
| `initFromTemplate` | `async (templateId: string) => void` | Seeds `items` from the given template, sets `onboardingDone = true`, and starts syncing. Called once, by `onboarding.js`. |
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
  templateId: string | null,   // null only while onboardingDone === false
  onboardingDone: boolean | null, // null only before the first setUser() resolves
  phases: TemplatePhase[],     // the active template's phase/section skeleton
}
```

### Onboarding detection (Issue #51)

`setUser` decides `onboardingDone` in this order — see `docs/architecture.md` §5.7 for
the full rationale:

1. `users/{uid}/meta.onboardingDone` in Firebase, if present.
2. The local `ascent-onboarding-done` flag, if present.
3. Real progress (`custom: true` or `done: true` on any item) in either the remote or
   local roadmap — treated as a pre-existing account, and the flag is backfilled.
4. Otherwise: `onboardingDone = false`, `items = {}`, no realtime listener attached yet.

Callers (`main.js`) must `await setUser(...)` before reading `onboardingDone` off the
snapshot to make a routing decision — it is not safe to read it synchronously right
after calling `setUser`.

## `src/data/templates/index.js` — template registry

| Export | Signature | Notes |
|---|---|---|
| `TEMPLATES` | `{ id, name, description, icon, buildItems: () => Promise<Record<string, Item>> }[]` | The four starter templates, in display order. `buildItems()` dynamically imports the template module. |
| `getTemplate` | `(id: string) => TemplateEntry` | Falls back to `TEMPLATES[0]` (`java-backend`) for an unknown or missing id. |
| `buildSeedItems` | `(templateId: string) => Promise<Record<string, Item>>` | Equivalent to `getTemplate(templateId).buildItems()`. |
| `getTemplatePhases` | `(templateId: string) => Promise<TemplatePhase[]>` | The template's `PHASES` export — used for `dashboard.js`'s phase-card skeleton. |

Every template module (`java-backend.js`, `frontend.js`, `data-science.js`,
`blank.js`) exports `PHASES` and a synchronous `buildSeedItems()` in the same shape
`src/data/roadmap.js` always used — see `docs/architecture.md` for the full shape.

## `src/services/firebase.js`

| Export | Signature | Notes |
|---|---|---|
| `authApi` | `signIn, signUp, guest, signOut, linkGuest, sendResetEmail, sendVerificationEmail, setPersistence, deleteAccount, onChange` | Thin wrappers around Firebase Auth. |
| `dbApi.listenRoadmap` | `(uid, callback, onError) => unsubscribe` | Realtime listener on `users/{uid}/roadmap`. Only attach once a user is confirmed onboarded. |
| `dbApi.saveRoadmap` | `(uid, payload) => Promise<void>` | Full overwrite of `users/{uid}/roadmap`. |
| `dbApi.getRoadmap` | `(uid) => Promise<{ version, items } \| null>` | One-time read, used only during onboarding detection. |
| `dbApi.getMeta` | `(uid) => Promise<{ onboardingDone?, templateId? } \| null>` | One-time read of `users/{uid}/meta`. |
| `dbApi.saveMeta` | `(uid, meta: { onboardingDone?, templateId? }) => Promise<void>` | Partial `update()` — does not overwrite the whole `meta` node. |
| `authErrorMessage` | `(error) => string` | Maps Firebase Auth error codes to user-facing copy. |
