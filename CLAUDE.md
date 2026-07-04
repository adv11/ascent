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
3. **Immediately after** `gh pr create`: fetch the live tracker body and set status → `🔀 PR #N open`

### After a PR merges

1. Fetch the live tracker body and set status → `✅ Done — merged PR #N`
2. Note in the tracker if any blocked issue in the next Step is now unblocked

### Docs that must ship with every code PR

| Doc | When required |
|---|---|
| `CHANGELOG.md` | Always — add an entry under `[Unreleased]` |
| `CLAUDE.md` | If any convention, pattern, or rule changed |
| `AGENTS.md` | Keep in sync with `CLAUDE.md` whenever `CLAUDE.md` changes |
| `docs/architecture.md` | If structure, CI pipeline, data-flow, or test setup changed |
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

**Component subscription cleanup — always unsubscribe on DOM removal.** Any component that calls `onThemeChange()`, or subscribes to any other module-level store or service, must capture the returned unsubscribe function and call it when the component is torn down. The pattern: attach the unsubscribe to the element as `el._cleanup = unsubscribe`, have the component factory return `{ node, cleanup }` (or expose `_cleanup` for callers to collect), and wire the cleanup into the route's cleanup return in `main.js`. Failing to do this leaks dead DOM references and fires callbacks on removed nodes — see Issue #27. Never add a subscription without a paired teardown path.

## Verifying changes

```
npm run lint           # must exit 0
npm test               # must exit 0
npm run dev            # serves at http://localhost:4173
```

Manual browser check: sign in as guest, toggle several checklist items across phases (confirm no unrelated phase-cards flash), click a "N resources" badge (confirm it opens the edit panel and does not toggle the item), toggle the theme button on both auth screens and the dashboard (confirm it persists across reload).
