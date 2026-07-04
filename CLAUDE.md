# SwitchPrep

SwitchPrep is a prep tracker for backend engineers (Java, Spring Boot, microservices,
GenAI/agentic AI, system design) working toward a company switch. It's moving from a
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
- No test framework or linter is wired up yet. Verify changes by running the dev
  server and exercising the flow in a browser — see "Verifying changes" below.

## File map

```
index.html                    entry HTML; has an inline no-FOUC theme bootstrap script
src/main.js                   boot: init theme, auth gate, hash router wiring
src/data/roadmap.js           seed phases/sections/items + resource library
src/services/firebase.js      auth + Realtime Database access
src/services/firebase.config.js          gitignored — your real Firebase project config
src/services/firebase.config.example.js  committed template for the file above
src/services/roadmapStore.js  in-memory roadmap store: subscribe/notify, local + remote save
src/services/theme.js         dark/light theme state (localStorage + system preference)
src/ui/router.js              tiny hash router (registerRoute/navigate/startRouter)
src/ui/dom.js                 el() DOM-builder helper, debounce, isValidUrl
src/ui/pages/signIn.js        sign-in screen
src/ui/pages/signUp.js        sign-up screen
src/ui/pages/dashboard.js     the roadmap dashboard (the whole app, really)
src/ui/components/authShell.js   shared chrome for signIn/signUp (brand row + theme toggle + card)
src/ui/components/themeToggle.js reusable dark/light toggle button
src/ui/components/itemPanel.js   slide-in panel for editing a topic + its resources
src/ui/components/toast.js       transient toast notifications
src/styles/app.css            the entire design system (tokens, components, both themes)
docs/architecture.md          deploy checklist + data model notes
firebase/database.rules.json  Realtime Database security rules
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

**Store pattern** (`src/services/roadmapStore.js`): a single mutable `items` map,
`subscribe(callback)`/`notify()` for pub-sub, and a 500ms debounced `queueSave()` that
persists to `localStorage` immediately and to Firebase after the debounce. Snapshots
carry `saveState` (`saving`/`saved`/`local`/`synced`/`error`) and a `structuralVersion`
counter.

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

**Watch the Firebase echo.** `dbApi.listenRoadmap`'s `onValue` callback fires on every
write to the path, *including the echo of writes this client just made* (every debounced
save round-trips back through the listener ~500ms-1s after a click). It must not bump
`structuralVersion` on that echo — `roadmapStore.js` compares the incoming remote data
against the current in-memory `items` with a key-order-independent `stableStringify`
(Realtime Database returns keys sorted; our in-memory map is insertion-order, so a plain
`JSON.stringify` compare produces false positives) and only bumps when they actually
differ. If this comparison is ever removed or replaced with an unconditional bump, the
checklist flicker comes back — it'll just be delayed by a save round-trip instead of
happening immediately on click, which makes it easy to miss in casual testing.

**`data-action` click-guard convention** (`dashboard.js` `renderItemRow`): a checklist
row toggles `done` on click, but child controls that need their own click behavior
(Edit button, the resource-count badge) are marked `data-action="…"` and call
`e.stopPropagation()` in their own handler. Any new interactive element nested inside a
row must follow this pattern or it will silently toggle the row's checkbox — this is
exactly the bug that was fixed for the resource badge.

**Sign-out contract — never load one user's localStorage into another user's session.**
`roadmapStore.js`'s `setUser(nextUser)` detects when the active uid changes (sign-out,
sign-in as a different user). Whenever `uid` transitions from a non-null value to any
other value, it calls `clearLocal()` (removes both `LOCAL_KEY` and `UI_KEY`) and resets
in-memory `items` to `buildSeedItems()` before the incoming user's session starts.
`loadLocal()` is only called for the *incoming* user (after `uid` is updated to the
new value). The initial boot call has `uid = null`, so the guard is skipped on first
load. Do not restructure `setUser` in a way that removes this guard or that calls
`loadLocal()` before clearing — that would silently re-introduce the privacy leak.

**Theming**: `index.html` sets `data-theme` on `<html>` synchronously (before CSS loads)
to avoid a flash of the wrong theme. `src/services/theme.js` owns `getTheme()` /
`setTheme()` / `toggleTheme()` / `onThemeChange()`, persisted under the
`switchprep-theme` localStorage key; until the user makes an explicit choice, it follows
`prefers-color-scheme` live. All colors in `app.css` are CSS custom properties defined
once under `:root` (light) and re-defined under `:root[data-theme='dark']` — never hardcode
a color in a component rule; add or reuse a token instead so both themes stay correct.

## Verifying changes

There's no test suite. To check a change:

```
npm run dev            # serves at http://localhost:4173
```

Then in a browser: sign in as guest, exercise the checklist (toggle items with several
phases expanded — confirm no flash of unrelated phase-cards), click a "N resources"
badge (confirm it opens the edit panel and does not toggle the item), and toggle the
theme button on both auth screens and the dashboard (confirm it persists across reload).
