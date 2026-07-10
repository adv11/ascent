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

## Agent memory map — read this before assuming a convention doesn't exist

This file only holds conventions that are short and apply almost everywhere. Everything
else — long, feature-specific "why we built it this way" reference material — lives in
files that load only when you're actually touching the relevant code, so every session
doesn't pay for content unrelated to the task at hand (issue #86; see
`docs/adr/ADR-007-agent-memory-architecture.md` for the full rationale and measurements).

- **`.claude/rules/roadmap-store.md`** — loads when touching `roadmapStore.js`,
  `dailyTodoStore.js`, `core/roadmap/**`, `core/dailyTodo/**`, `data/templates/**`,
  `dashboard.js`, `onboarding.js`, or the daily-todo/import/newRoadmap components. Store
  contracts, `structuralVersion`, echo/dirty/stale-listener guards, multi-roadmap,
  custom-roadmap CRUD, AI import, Daily Todos + roadmap-topic linking.
- **`.claude/rules/ui-styling.md`** — loads when touching `app.css`, `theme.js`,
  `themeBootstrap.js`, `index.html`, or any page/component. Theming, card/grid layout,
  responsive breakpoints, touch/hover detection, safe-area insets, modal overflow.
- **`.claude/rules/auth-security.md`** — loads when touching `firebase.js`,
  `authCleanup.js`, `accountGuards.js`, `signIn.js`/`signUp.js`, `password.js`,
  `index.html`, or `database.rules.json`. SRI/CSP lockstep updates, password reset,
  account deletion ordering, anonymous-user cleanup.
- **`.claude/skills/`** — multi-step procedures needed only at specific moments, not on
  every read: `raise-issue`, `start-issue`, `open-pr`, `after-merge`, `parallel-work`,
  `verify-changes` (the full responsive/touch verification matrix).
- **`docs/architecture.md`** and **`docs/adr/`** — deep history and one-time design
  decisions, read on demand, never auto-loaded.

If you're about to explain a "why" that isn't in this file, check the relevant rules
file above before assuming it was never documented.

## MANDATORY WORKFLOW

These rules apply to every issue and every PR. They are not optional — every step must be done, every time. Full step-by-step procedures live in `.claude/skills/` (linked below) — this section only has what's needed on essentially every task.

### Label taxonomy (every GitHub issue must have all three)

**Type** (≥ 1): `type:feat` `type:fix` `type:refactor` `type:test` `type:docs` `type:chore` `type:design` `type:security` `type:perf`

**Priority** (exactly 1): `priority:critical` `priority:high` `priority:medium` `priority:low`

**Domain** (≥ 1): `domain:auth` `domain:storage` `domain:roadmap` `domain:ui` `domain:import` `domain:a11y` `domain:brand` `domain:infra` `domain:security`

### Workflow steps → skills

- Raising a new issue → `.claude/skills/raise-issue/`
- Starting work on an issue → `.claude/skills/start-issue/`
- Before/opening a PR → `.claude/skills/open-pr/`
- After a PR merges → `.claude/skills/after-merge/`
- Running multiple issues in parallel → `.claude/skills/parallel-work/`

### Docs that must ship with every code PR

| Doc | When required |
|---|---|
| `CHANGELOG.md` | Always — add an entry under `[Unreleased]` |
| `CLAUDE.md` | If a short, universal convention changed (root file only — keep it under ~220 lines) |
| `.claude/rules/*.md` | If a feature/area-specific convention changed — edit the file scoped to that area, not this one |
| `AGENTS.md` | Pointer file only — do not restore full duplicate content; update only if the pointer itself needs to change |
| `docs/architecture.md` | If structure, CI pipeline, data-flow, or test setup changed — **also add a Build Log entry** |
| `docs/api.md` | If a public store or service contract changed |

## File map

```
index.html                    entry HTML; inline no-FOUC theme bootstrap script; see .claude/rules/ui-styling.md
src/main.js                   boot: migrate localStorage keys, init theme, auth gate, hash router wiring
src/data/roadmap.js           backward-compat shim — re-exports the java-backend template, no logic
src/data/templates/           starter template registry + 7 template modules (java-backend, frontend, data-science, genai-agentic-ai, math-grade12, piano, marketing) + retired blank.js — see .claude/rules/roadmap-store.md
src/services/firebase.js      Firebase Auth (authApi) + auth/database singletons — see .claude/rules/auth-security.md
src/services/authCleanup.js   pure, dependency-injected anonymous-sign-out cleanup logic — see .claude/rules/auth-security.md
src/services/accountGuards.js pure `assertAccountDeletable(user)` guard — see .claude/rules/auth-security.md
src/services/firebase.config.js          gitignored — your real Firebase project config
src/services/firebase.config.example.js  committed template for the file above
src/services/localStorageKeys.js  canonical `ascent-*` localStorage/sessionStorage key strings
src/services/migration.js     one-time migration off the pre-rename `switchprep-*` key prefix
src/services/roadmapStore.js  in-memory roadmap store — see .claude/rules/roadmap-store.md
src/services/dailyTodoStore.js  in-memory Daily Todos store — see .claude/rules/roadmap-store.md
src/services/storage/         storage backend interface + FirebaseAdapter (+ withTimeout.js) + LocalStorageAdapter + adapterFactory — see .claude/rules/roadmap-store.md
src/services/theme.js         dark/light theme state — see .claude/rules/ui-styling.md
src/services/themeBootstrap.js  synchronous classic script, no-FOUC — see .claude/rules/ui-styling.md
src/ui/router.js              tiny hash router (registerRoute/navigate/startRouter)
src/ui/dom.js                 el() DOM-builder helper, debounce, isValidUrl
src/ui/pages/signIn.js        sign-in screen — see .claude/rules/auth-security.md
src/ui/pages/signUp.js        sign-up screen — see .claude/rules/auth-security.md
src/ui/pages/onboarding.js    starter template picker (route: /onboarding) — see .claude/rules/roadmap-store.md
src/ui/pages/dashboard.js     the roadmap dashboard (the whole app, really) — see .claude/rules/roadmap-store.md and ui-styling.md
src/ui/components/authShell.js   shared chrome for signIn/signUp — split layout (issue #6 Phase 5) + authMarketingPanel.js left panel
src/ui/components/brand.js       canonical brand mark/wordmark — createBrandMark()/createBrandIcon()
src/ui/components/themeToggle.js reusable dark/light toggle button
src/ui/components/sidebar.js, topbar.js, avatar.js, dropdown.js  app shell (issue #6 Phase 2) — see .claude/rules/ui-styling.md
src/ui/components/skeleton.js, emptyState.js, tooltip.js, modal.js, tabs.js, notificationBadge.js, commandPalette.js  component library (issue #6 Phase 3), not yet wired into any page; progressRing.js wired into dashboard.js (Phase 4)
src/ui/components/dailyTodoPanel.js, dailyTodoGuide.js, addToDailyTodoModal.js  Daily Todos UI — see .claude/rules/roadmap-store.md
src/ui/components/itemPanel.js   slide-in panel for editing a topic + its resources + notes
src/ui/components/toast.js       transient toast notifications
src/ui/components/confirmDialog.js  styled confirm/cancel modal — see "Never use window.confirm()" below
src/ui/components/buildYourOwnGuide.js, newRoadmapModal.js, importRoadmapModal.js  manual/AI-import roadmap creation — see .claude/rules/roadmap-store.md
src/data/importPrompt.js, src/core/roadmap/importValidator.js, schemaAdapter.js, limits.js  AI-import prompt + pure validator/adapter/caps — see .claude/rules/roadmap-store.md
src/core/dailyTodo/limits.js         MAX_TODO_TITLE_LENGTH/MAX_ACTIVE_TODOS/duration caps — see .claude/rules/roadmap-store.md
src/ui/utils/dailyTodo.js, customRoadmapIcon.js, fieldValidation.js, buttonLoading.js  pure/DOM helpers, no Firebase dependency; src/utils/countUp.js  pure requestAnimationFrame count-up helper
src/styles/app.css            the entire design system (tokens, components, both themes) — see .claude/rules/ui-styling.md
docs/architecture.md          living architecture guide + Build Log (canonical deep-dive doc)
docs/adr/                     one-time architecture decision records
firebase/database.rules.json  Realtime Database security rules — see .claude/rules/auth-security.md
public/                       favicon.svg, generated PWA icons/OG image, manifest.json
scripts/generate-brand-assets.mjs  dev-only Playwright script that rasterizes favicon.svg into public/*.png
```

## Conventions to follow

Universal, short, apply regardless of what you're touching. Everything longer or
feature-specific lives in `.claude/rules/` — see "Agent memory map" above.

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

**`data-action` click-guard convention** (`dashboard.js` `renderItemRow`): a checklist
row toggles `done` on click, but child controls that need their own click behavior
(Edit button, the resource-count badge) are marked `data-action="…"` and call
`e.stopPropagation()` in their own handler. Any new interactive element nested inside a
row must follow this pattern or it will silently toggle the row's checkbox.

**Brand rules.** Never hard-code the product name as a string in any `.js` file —
import `createBrandMark()` / `createBrandWordmark()` / `createBrandIcon()` from
`src/ui/components/brand.js` instead. The only permitted occurrences of the literal
string `'Ascent'` in source are inside `brand.js` itself and inside `index.html`'s meta
tags/title. All `localStorage`/`sessionStorage` keys must come from
`src/services/localStorageKeys.js`'s `KEYS` object (or `verifyDismissedKey()`) — never
write a raw `ascent-*` string in any other file. This is what makes a future rename (or
a white-labeled variant) a one-file change instead of a repo-wide grep; see Issue #7
and `docs/adr/ADR-004-product-rename.md`.

**Never use the native `window.confirm()` — use `confirmDialog()` (`src/ui/components/confirmDialog.js`).** The browser's built-in confirm dialog can't be styled, breaks the app's own dark/light theming, and reads as unpolished in a customer-facing product. `confirmDialog({ title, message, confirmText, cancelText, danger })` returns a `Promise<boolean>`. Pass `danger: true` for anything destructive/irreversible; leave it `false` for reversible actions. Every call site does `if (!await confirmDialog({...})) return;`. Tests reach the dialog via `document.querySelector('.modal-overlay [data-action="confirm"|"cancel"]')` (Vitest/jsdom) or `page.locator('.modal-overlay[aria-label*="..."] [data-action="confirm"]')` (Playwright) — never via `page.on('dialog', ...)`.

**Component subscription cleanup — always unsubscribe on DOM removal, or clear the timer.** Any component that calls `onThemeChange()`, subscribes to any other module-level store or service, or starts a `setInterval`/`setTimeout` that outlives a single render, must capture the returned unsubscribe function (or the timer id) and clean it up when the component is torn down. The pattern: attach the cleanup to the element as `el._cleanup = unsubscribe` (or a function that calls `clearInterval`/`clearTimeout`), have the component factory return `{ node, cleanup }` (or expose `_cleanup` for callers to collect), and wire the cleanup into the route's cleanup return in `main.js`. Failing to do this leaks dead DOM references, fires callbacks on removed nodes, or leaves a timer running forever — see Issue #27. Never add a subscription or a long-lived timer without a paired teardown path.

**ESLint code-cleanliness gates (`eslint.config.js`, issue #53).** `complexity: 10`, `max-depth: 4`, `max-lines-per-function: { max: 80 }`, and `max-params: 4` run as `warn` on every PR via the existing `lint` CI job — intentionally `warn`, not `error`, since zero violations was never reached repo-wide. When you touch a flagged function, prefer extracting a **named, module-scope function** (grep-able, independently unit-testable) over just shortening lines. Don't flip these to `error` without first re-auditing the whole repo's violation count.

**Living architecture doc (`docs/architecture.md`) — keep the Build Log current.** Every PR that adds, removes, or significantly restructures a module must append a dated entry to the `## Build Log` section:

```
### YYYY-MM-DD — PR #N — <short title>
What changed architecturally and why.
```

Distinct from `CHANGELOG.md` (user-facing). The CI `pr-checklist` job (`.github/workflows/ci.yml`) enforces this: a new file under `src/services/`, `src/ui/components/`, or `src/ui/pages/` with no `docs/architecture.md` diff fails the PR. The same job also fails if root `CLAUDE.md` exceeds ~220 lines — new content belongs in `.claude/rules/` or `.claude/skills/`, not appended here (issue #86). Issue templates: `.github/ISSUE_TEMPLATE/` (`feature.yml`, `bug.yml`, `chore-refactor.yml`, `docs.yml`) — blank issues disabled.

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

**If your change touches `app.css`, `index.html`, or any page/component layout**, also run the full cross-device/responsive/touch matrix — see `.claude/skills/verify-changes/`. Don't skip it for "just a small CSS tweak"; that's exactly how the bugs it exists to catch get shipped.
