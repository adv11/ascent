# Ascent

Ascent ("Engineer your next move.") is a personal roadmap tracker for anyone learning, revising, or tracking progress toward a goal — students, professionals, or career switchers. New sign-ups pick a starter template (Issue #51): Java Backend Engineer (the original roadmap — Java, Spring Boot, microservices, GenAI/agentic AI, system design), Frontend Developer, Data Scientist, or a blank slate. It's moving from a personal tool toward a sellable product, so treat correctness and polish here as customer-facing, not a side project.

## Stack

- Vanilla JavaScript, native ES modules, **no build step, no framework, no bundler**. `npm run dev` / `npm start` just serve the static files with a small Node-only server (`scripts/dev-server.mjs`), OS-agnostic since it only needs the Node already required to run `npm test`/`npm run lint`.
- Firebase Authentication (email/password + anonymous "guest" sessions) and Firebase Realtime Database for per-user roadmap sync; security rules in `firebase/database.rules.json`. Project credentials live in `src/services/firebase.config.js`, which is **gitignored** — copy `src/services/firebase.config.example.js` to that path and fill in your own Firebase project's values before running locally. Never put real credentials back into a tracked file.
- **Vitest** for unit/integration tests (`tests/unit/`, `tests/integration/`); **Playwright** for E2E (`tests/e2e/`). Run `npm test` before pushing — all checks must be green. Run `npm run lint` to enforce security and quality rules. Never merge a PR with failing checks.

## Agent memory map — read this before assuming a convention doesn't exist

This file only holds conventions that are short and apply almost everywhere. Everything else — long, feature-specific "why we built it this way" reference material — lives in files that load only when you're actually touching the relevant code, so every session doesn't pay for content unrelated to the task at hand (issue #86; see `docs/adr/ADR-007-agent-memory-architecture.md` for the full rationale and measurements).

- **`.claude/rules/roadmap-store.md`** — loads when touching `roadmapStore.js`, `dailyTodoStore.js`, `activityLogStore.js`, `core/roadmap/**`, `core/dailyTodo/**`, `core/analytics/**`, `data/templates/**`, `dashboard.js`, `onboarding.js`, or the daily-todo/import/newRoadmap components. Store contracts, `structuralVersion`, echo/dirty/stale-listener guards, multi-roadmap, custom-roadmap CRUD, AI import, Daily Todos + roadmap-topic linking, activity-log/analytics data layer (issue #8).
- **`.claude/rules/ui-styling.md`** — loads when touching `app.css`, `theme.js`, `themeBootstrap.js`, `index.html`, or any page/component. Theming, card/grid layout, responsive breakpoints, touch/hover detection, safe-area insets, modal overflow.
- **`.claude/rules/design-system.md`** — same trigger as `ui-styling.md` above; the **binding v2 "Modernist" visual identity** (Archivo type, single red accent, zero radius, ruled grid, flush-left everything) — this file's exact tokens/type/structure/component rules take precedence over anything conflicting in `ui-styling.md` or already-shipped v1 styling. Every UI PR is gated on its review checklist. Rollout tracked in issue #289, landing in phases — mid-rollout, not every screen matches this file yet.
- **`.claude/rules/auth-security.md`** — loads when touching `firebase.js`, `authCleanup.js`, `accountGuards.js`, `signIn.js`/`signUp.js`, `password.js`, `index.html`, or `database.rules.json`. SRI/CSP lockstep updates, password reset, account deletion ordering, anonymous-user cleanup.
- **`.claude/rules/content-style.md`** — loads when touching any page/component with user-facing text. Plain-language/grammar convention, button labels, error messages.
- **`.claude/skills/`** — multi-step procedures needed only at specific moments, not on every read: `raise-issue`, `start-issue`, `open-pr`, `after-merge`, `parallel-work`, `verify-changes` (the full responsive/touch verification matrix).
- **`docs/architecture.md`** and **`docs/adr/`** — deep history and one-time design decisions, read on demand, never auto-loaded.

If you're about to explain a "why" that isn't in this file, check the relevant rules file above before assuming it was never documented.

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
src/data/changelog.json, changelog.js  What's New changelog data + APP_VERSION (issue #20) — every entry is `{ version: number, date: "YYYY-MM-DD", items: [{ type: 'feat'|'fix'|'improvement', title, description, featureKey? }] }`; APP_VERSION is `Math.max()` over every entry's version, parallel to ROADMAP_VERSION. Bump by appending a new, higher-version entry — never edit an already-shipped one. An item's optional `featureKey` opts a real UI element into a "New" pill via `src/ui/components/featureBadge.js`'s `createFeatureBadge(key)` (Phase C) — see docs/api.md for the full schema and src/ui/components/notificationBell.js/changelogDrawer.js for the bell + drawer UI. This file went stale for two months before issue #240 caught it (no CI check covers its data content, unlike CHANGELOG.md) — do a changelog.json pass at the end of each tracker Step, or before any public release, not only when a feature first ships.
src/services/firebase.js      Firebase Auth (authApi) + auth/database singletons — see .claude/rules/auth-security.md
src/services/authCleanup.js   pure, dependency-injected anonymous-sign-out cleanup logic — see .claude/rules/auth-security.md
src/services/accountGuards.js pure `assertAccountDeletable(user)` guard — see .claude/rules/auth-security.md
src/services/firebase.config.js          gitignored — your real Firebase project config
src/services/firebase.config.example.js  committed template for the file above
src/services/localStorageKeys.js  canonical `ascent-*` localStorage/sessionStorage key strings
src/services/migration.js     one-time migration off the pre-rename `switchprep-*` key prefix
src/services/roadmapStore.js  in-memory roadmap store — see .claude/rules/roadmap-store.md
src/services/dailyTodoStore.js  in-memory Daily Todos store — see .claude/rules/roadmap-store.md
src/services/activityLogStore.js  daily completed-item counts, feeds analytics (issue #8) — see .claude/rules/roadmap-store.md
src/services/storage/         storage backend interface + FirebaseAdapter (+ withTimeout.js) + LocalStorageAdapter + adapterFactory — see .claude/rules/roadmap-store.md
src/core/analytics/           pure analytics engine (streaks/velocity/heatmap/projection/progressDigest), no DOM/store access — see .claude/rules/roadmap-store.md
src/core/roadmap/roadmapComparison.js  pure roadmap-comparison diff engine (issue #285) — no DOM/store access, matches topics by (phase, title); src/ui/components/roadmapComparisonModal.js  "Compare roadmaps" modal (vs. starter template or vs. another started roadmap), opened from progress.js — see .claude/rules/roadmap-store.md
src/services/theme.js         dark/light theme state — see .claude/rules/ui-styling.md
src/services/themeBootstrap.js  synchronous classic script, no-FOUC — see .claude/rules/ui-styling.md
src/ui/router.js              tiny hash router (registerRoute/navigate/startRouter)
src/ui/dom.js                 el() DOM-builder helper, debounce, isValidUrl
src/ui/pages/signIn.js        sign-in screen — see .claude/rules/auth-security.md
src/ui/pages/signUp.js        sign-up screen — see .claude/rules/auth-security.md
src/ui/pages/onboarding.js    starter template picker (route: /onboarding) — see .claude/rules/roadmap-store.md
src/ui/pages/dashboard.js     the roadmap dashboard (the whole app, really) — see .claude/rules/roadmap-store.md and ui-styling.md
src/ui/pages/landing.js       marketing page at route: / for signed-out visitors (issue #6 Phase 6); an already-signed-in visitor is routed straight to /app instead
src/ui/pages/settings.js      account settings (route: /settings, issue #16) — change email/password, preferences, delete account; guest sees a CTA-only view
src/ui/pages/progress.js      analytics dashboard (route: /progress, issue #8) — stat cards, heatmap, charts, phase/priority breakdowns, projection — see .claude/rules/roadmap-store.md and ui-styling.md
src/ui/pages/sharedRoadmapView.js  unauthenticated-reachable read-only view (route: /shared?id=..., issue #131) — see .claude/rules/roadmap-store.md; src/ui/components/shareRoadmapModal.js  "Share this roadmap…" publish/list/revoke modal (sidebar.js account menu); src/services/shareStore.js, src/core/roadmap/shareSchema.js  Firebase write + pure snapshot schema
src/ui/components/heatmap.js, chartWrapper.js  activity heatmap + lazy Chart.js loader (issue #8) — see .claude/rules/ui-styling.md; shareCard.js, shareModal.js  canvas social share card + preview modal (issue #8); progressDigestBanner.js  dismissible once-per-week progress-digest banner on the dashboard (issue #284), paired with src/ui/utils/progressDigest.js's shown/dismissed guard logic
src/ui/components/authShell.js   shared chrome for signIn/signUp — split layout (issue #6 Phase 5) + authMarketingPanel.js left panel
src/ui/components/brand.js       canonical brand mark/wordmark — createBrandMark()/createBrandIcon()
src/ui/components/themeToggle.js reusable dark/light toggle button
src/ui/components/sidebar.js, topbar.js, avatar.js, dropdown.js  app shell (issue #6 Phase 2) — see .claude/rules/ui-styling.md; featureTour.js  first-time dashboard spotlight walkthrough (issue #17), started from dashboard.js and replayable via sidebar.js's "Take a tour" — see .claude/rules/roadmap-store.md for the `tourDone` store contract and .claude/rules/ui-styling.md for the spotlight/portal/focus-trap convention
src/ui/components/skeleton.js (wired into progress.js's first chart load), emptyState.js (wired into dashboard.js's no-matching-filter state), commandPalette.js (Cmd/Ctrl+K search wired into topbar.js — nav items always, plus a global cross-roadmap topic search once the query reaches 2 characters, issue #283, superseding #125's nav-only scope; see src/core/roadmap/globalTopicSearch.js and roadmapStore.js's getAllRoadmapsForSearch()), tooltip.js, modal.js, notificationBadge.js  component library (issue #6 Phase 3); tabs.js  built but deliberately still unwired, no current page has a real tab UI to adopt it into (audited issue #125); progressRing.js wired into dashboard.js (Phase 4); icons.js  curated named SVG icon set + createIcon(name, { size }) factory for functional/navigational chrome (issue #107) — see .claude/rules/ui-styling.md
src/ui/components/dailyTodoPanel.js, dailyTodoGuide.js, addToDailyTodoModal.js  Daily Todos UI — see .claude/rules/roadmap-store.md
src/ui/components/itemPanel.js   slide-in panel for editing a topic + its resources + notes
src/ui/components/toast.js       transient toast notifications
src/ui/components/confirmDialog.js  styled confirm/cancel modal — see "Never use window.confirm()" below; deleteAccountModal.js  shared "type password to confirm" delete-account modal used by sidebar.js/settings.js
src/ui/components/buildYourOwnGuide.js, newRoadmapModal.js, importRoadmapModal.js  manual/AI-import roadmap creation — see .claude/rules/roadmap-store.md
src/ui/components/feedbackWidget.js, feedbackModal.js, feedbackForm.js, myReports.js  in-app feedback & bug reporting (issue #9, screenshot capture removed in #348) — see .claude/rules/roadmap-store.md; src/services/feedbackStore.js, feedbackRateLimit.js, src/core/feedback/  Firebase write + rate limit + pure schema/metadata
src/data/importPrompt.js, src/core/roadmap/importValidator.js, schemaAdapter.js, limits.js  AI-import prompt + pure validator/adapter/caps — see .claude/rules/roadmap-store.md
src/core/dailyTodo/limits.js         MAX_TODO_TITLE_LENGTH/MAX_ACTIVE_TODOS/duration caps — see .claude/rules/roadmap-store.md
src/core/time/timeTracking.js        pure start/pause elapsed-time math (issue #180), no DOM/store access — see .claude/rules/roadmap-store.md
src/ui/utils/dailyTodo.js, customRoadmapIcon.js, fieldValidation.js, buttonLoading.js  pure/DOM helpers, no Firebase dependency; signOut.js  confirmAndSignOut(), the one shared sign-out entry point — see .claude/rules/auth-security.md; svg.js  shared svgEl()/svgIcon() SVG-builder helpers (issue #107); src/utils/countUp.js  pure requestAnimationFrame count-up helper
src/styles/app.css            the entire design system (tokens, components, both themes) — see .claude/rules/ui-styling.md
docs/architecture.md          living architecture guide + Build Log (canonical deep-dive doc)
docs/adr/                     one-time architecture decision records
firebase/database.rules.json  Realtime Database security rules — see .claude/rules/auth-security.md
public/                       favicon.svg, generated PWA icons/OG image, manifest.json
scripts/generate-brand-assets.mjs  dev-only Playwright script that rasterizes favicon.svg into public/*.png
```

## Conventions to follow

Universal, short, apply regardless of what you're touching. Everything longer or feature-specific lives in `.claude/rules/` — see "Agent memory map" above.

**`el(tag, attrs, children)`** (`src/ui/dom.js`) is the only DOM-construction helper — there's no JSX/templating. `attrs.className`/`dataset`/`text` are special-cased; any `onX` key becomes an `addEventListener`. Build UI by composing `el()` calls, not by writing HTML strings.

**Never use `innerHTML` — not directly, not via any helper.** All text must flow through `textContent` (via `el()`'s `text:` key or `node.textContent = …`). The `html` key was removed from `el()` (Issue #22) — it was an undocumented escape hatch that routed directly to `node.innerHTML`. If a future genuine need for trusted HTML arises (e.g. rendering sanitised Markdown), introduce a separate named helper with an explicit doc comment so the danger is visible at every call site. Never silently re-add `html:` to `el()`.

**Resource URLs must be validated before use as `href`.** Any URL coming from the store (Firebase, localStorage) must pass `isValidUrl()` before being set as an anchor `href`. `isValidUrl()` accepts only `http:` and `https:` protocols — this blocks `javascript:` and `data:` URI injection. Apply this at both render time and save time.

**`data-action` click-guard convention** (`dashboard.js` `renderItemRow`): a checklist row toggles `done` on click, but child controls that need their own click behavior (Edit button, the resource-count badge) are marked `data-action="…"` and call `e.stopPropagation()` in their own handler. Any new interactive element nested inside a row must follow this pattern or it will silently toggle the row's checkbox.

**Brand rules.** Never hard-code the product name as a string in any `.js` file — import `createBrandMark()` / `createBrandWordmark()` / `createBrandIcon()` from `src/ui/components/brand.js` instead. The only permitted occurrences of the literal string `'Ascent'` in source are inside `brand.js` itself and inside `index.html`'s meta tags/title. All `localStorage`/`sessionStorage` keys must come from `src/services/localStorageKeys.js`'s `KEYS` object (or `verifyDismissedKey()`) — never write a raw `ascent-*` string in any other file. This is what makes a future rename (or a white-labeled variant) a one-file change instead of a repo-wide grep; see Issue #7 and `docs/adr/ADR-004-product-rename.md`.

**Never use the native `window.confirm()` — use `confirmDialog()` (`src/ui/components/confirmDialog.js`).** The browser's built-in confirm dialog can't be styled, breaks the app's own dark/light theming, and reads as unpolished in a customer-facing product. `confirmDialog({ title, message, confirmText, cancelText, danger })` returns a `Promise<boolean>`. Pass `danger: true` for anything destructive/irreversible; leave it `false` for reversible actions. Every call site does `if (!await confirmDialog({...})) return;`. Tests reach the dialog via `document.querySelector('.modal-overlay [data-action="confirm"|"cancel"]')` (Vitest/jsdom) or `page.locator('.modal-overlay[aria-label*="..."] [data-action="confirm"]')` (Playwright) — never via `page.on('dialog', ...)`.

**Component subscription cleanup — always unsubscribe on DOM removal, or clear the timer.** Any component that calls `onThemeChange()`, subscribes to any other module-level store or service, or starts a `setInterval`/`setTimeout` that outlives a single render, must capture the returned unsubscribe function (or the timer id) and clean it up when the component is torn down. The pattern: attach the cleanup to the element as `el._cleanup = unsubscribe` (or a function that calls `clearInterval`/`clearTimeout`), have the component factory return `{ node, cleanup }` (or expose `_cleanup` for callers to collect), and wire the cleanup into the route's cleanup return in `main.js`. Failing to do this leaks dead DOM references, fires callbacks on removed nodes, or leaves a timer running forever — see Issue #27. Never add a subscription or a long-lived timer without a paired teardown path. `feedbackWidget.js` (issue #9) is the one deliberate exception to "wire cleanup into the route's cleanup return": it's mounted once in `main.js`, directly on `document.body`, outside the router entirely — and must never be unmounted or re-mounted on route change. The widget's DOM node is always present in the tree; only its `_setUser()` is called again, on every auth-state change.

**ESLint code-cleanliness gates (`eslint.config.js`, issue #53).** `complexity: 10`, `max-depth: 4`, `max-lines-per-function: { max: 80 }`, and `max-params: 4` run as `warn` on every PR via the existing `lint` CI job — intentionally `warn`, not `error`, since zero violations was never reached repo-wide. When you touch a flagged function, prefer extracting a **named, module-scope function** (grep-able, independently unit-testable) over just shortening lines. Don't flip these to `error` without first re-auditing the whole repo's violation count.

**Living architecture doc (`docs/architecture.md`) — keep the Build Log current.** Every PR that adds, removes, or significantly restructures a module must append a dated entry to the `## Build Log` section:
```
### YYYY-MM-DD — PR #N — <short title>
What changed architecturally and why.
```
Distinct from `CHANGELOG.md` (user-facing). The CI `pr-checklist` job (`.github/workflows/ci.yml`) enforces this: a new file under `src/services/`, `src/ui/components/`, or `src/ui/pages/` with no `docs/architecture.md` diff fails the PR. The same job also fails if root `CLAUDE.md` exceeds ~220 lines — new content belongs in `.claude/rules/` or `.claude/skills/`, not appended here (issue #86). When adding a new "Conventions to follow" or "Agent memory map" entry, prefer folding it into an existing paragraph as one continuous line (Markdown treats a soft-wrapped paragraph and a single long line identically when rendered) over adding new hard line breaks — the CI check counts newlines, not characters, so this is the cheapest way to buy headroom before something has to move out to `.claude/rules/`. Issue templates: `.github/ISSUE_TEMPLATE/` (`feature.yml`, `bug.yml`, `chore-refactor.yml`, `docs.yml`) — blank issues disabled.

## Deploying

Every push to `main` auto-deploys to Firebase Hosting **and** `firebase/database.rules.json` via `.github/workflows/deploy.yml` (issue #153 — database rules deploy used to be manual-only, which meant the rules actually enforced against the live project could silently drift from the repo with no CI signal; a stale ruleset rejecting a write reads identically to any other "Save failed" error). The production-deploy job is gated on CI: it triggers on `workflow_run` keyed off `ci.yml` completing on `main` and only deploys if that run's `conclusion` was `success`, checking out `ci.yml`'s exact commit SHA rather than whatever `main` resolves to when the event fires (issue #266 — previously `deploy.yml` fired its own independent `push` trigger in parallel with `ci.yml`, with no dependency between them, so CI passing only gated the PR merge button, not whether the resulting commit was actually safe to deploy). `main`'s branch protection also requires a pull request before merging, so a direct push can no longer bypass CI entirely. Every PR gets a temporary 7-day preview URL posted as a PR comment (hosting only — a PR preview never touches production rules, and still deploys regardless of check status so reviewers can see in-progress work). A daily scheduled workflow (`.github/workflows/db-backup.yml`, issue #130) exports the full Realtime Database, encrypts it (this repo is public), and uploads it as a build artifact — see `docs/architecture.md` §6a for the retention policy, the `BACKUP_ENCRYPTION_KEY` secret, and the restore procedure.

**For a manual deploy** (only needed to push a rules/hosting change ahead of the next push to `main`, e.g. while testing locally):
```bash
firebase deploy            # deploys hosting + database rules
firebase deploy --only hosting
firebase deploy --only database
```

**`firebase.config.js` is gitignored on purpose.** It holds client-side Firebase identifiers (`apiKey`, `authDomain`, etc.) that are visible to any user who opens DevTools — they are not secrets in the traditional sense, but keeping the file out of git prevents accidental commitment of production credentials during local development. CI injects the production config from the `FIREBASE_CONFIG` GitHub Secret at deploy time.

**Required GitHub secrets/variables** (set in repo → Settings → Secrets and variables → Actions):
- `FIREBASE_SERVICE_ACCOUNT_<PROJECT_ID>` (secret) — Firebase service account JSON for deploy auth; named this way (not the bare `FIREBASE_SERVICE_ACCOUNT`) because `firebase init hosting:github` mints the secret name from the linked project ID automatically — `deploy.yml` references whatever name was actually created
- `FIREBASE_CONFIG` (secret) — contents of `src/services/firebase.config.js` for production
- `FIREBASE_PROJECT_ID` (variable) — project ID (non-sensitive; use GitHub Variables, not Secrets)
- `BACKUP_ENCRYPTION_KEY` (secret) — passphrase for the daily database-backup workflow; this repo is public, so the exported snapshot is encrypted before being uploaded as a build artifact

Also update `.firebaserc` with the real project ID before running `firebase deploy` locally.

## Verifying changes

```
npm run lint           # must exit 0
npm test               # must exit 0
npm run dev            # serves at http://localhost:4173
```

Manual browser check: sign in as guest, toggle several checklist items across phases (confirm no unrelated phase-cards flash), click a "N resources" badge (confirm it opens the edit panel and does not toggle the item), toggle the theme button on both auth screens and the dashboard (confirm it persists across reload).

**If your change touches `app.css`, `index.html`, or any page/component layout**, also run the full cross-device/responsive/touch matrix — see `.claude/skills/verify-changes/`. Don't skip it for "just a small CSS tweak"; that's exactly how the bugs it exists to catch get shipped.

**Lighthouse perf budget is a manual, local-only check, not a CI gate** (removed from CI in #231 — headless Chrome under GitHub Actions' shared runners hit an unfixable `NO_FCP` flake; see the CHANGELOG and `docs/architecture.md`'s Build Log for the investigation). Run it yourself before opening a perf-sensitive PR: `npx serve . -p 4173 -s &` then `npx @lhci/cli autorun --config=./lighthouserc.json` (assertions live in root `lighthouserc.json`).

## graphify

This project has a knowledge graph at graphify-out/ with god nodes, community structure, and cross-file relationships.

Rules:
- For codebase questions, first run `graphify query "<question>"` when graphify-out/graph.json exists. Use `graphify path "<A>" "<B>"` for relationships and `graphify explain "<concept>"` for focused concepts. These return a scoped subgraph, usually much smaller than GRAPH_REPORT.md or raw grep output.
- If graphify-out/wiki/index.md exists, use it for broad navigation instead of raw source browsing.
- Read graphify-out/GRAPH_REPORT.md only for broad architecture review or when query/path/explain do not surface enough context.
- After modifying code, run `graphify update .` to keep the graph current (AST-only, no API cost). `.github/workflows/graph-update.yml` also does this automatically after every push to main and opens a PR with the diff — see `docs/architecture.md`'s Build Log for why it PRs rather than pushing directly.
