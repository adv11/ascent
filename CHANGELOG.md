# Changelog

All notable changes to this project will be documented in this file.

## [Unreleased]

### Security
- **CSP + SRI + security headers** (issue #25): Content Security Policy meta tag added to `index.html` blocking inline scripts and restricting fetch/connect origins. Three Firebase SDK CDN modules pinned with `<link rel="modulepreload" integrity="sha384-...">` SRI hashes. `firebase.json` extended with Firebase Hosting security headers (HSTS, X-Frame-Options: DENY, X-Content-Type-Options, Referrer-Policy, Permissions-Policy). Theme bootstrap extracted from inline IIFE to `src/services/themeBootstrap.js` (classic script, no-FOUC guarantee preserved). ADR-002 documents the CSP/SRI design and SDK upgrade process. `connect-src` also allows the local `127.0.0.1:9099`/`127.0.0.1:9000` Auth/Database emulator origins so `FIREBASE_CONFIGURED=true` E2E runs (issue #37) aren't blocked by the new policy.

### Infra
- **Firebase Hosting + CI/CD** (issue #28): `firebase.json` extended with comprehensive hosting config (ignore list, SPA rewrite, per-route cache headers: `no-cache` for `index.html`, `immutable` for `/src/**` and `*.css`, security headers on all routes). `database` section added so `firebase deploy` also deploys Realtime Database Security Rules. `.firebaserc` added with placeholder project ID. `.github/workflows/deploy.yml` added: every PR gets a 7-day Firebase Hosting preview channel URL; every merge to `main` auto-deploys to production. `FIREBASE_SERVICE_ACCOUNT`, `FIREBASE_CONFIG`, and `FIREBASE_PROJECT_ID` are the required repo secrets/variables. ADR-003 documents the platform decision and Cloudflare Pages migration path.
- CI: verify Firebase Emulator E2E runs with secrets configured (issue #37)
- **`pr-checklist` extended** (issue #43): CI now fails when `src/` changes without a `CHANGELOG.md` diff, or when a new module is added under `src/services|ui/components|ui/pages` without a `docs/architecture.md` diff.
- **`issues-label-check` workflow** (issue #43): new GitHub Actions workflow fires on `issues.opened`/`issues.edited` and comments on any issue missing `type:*`, `priority:*`, or `domain:*` labels.
- **GitHub issue templates** (issue #43): `.github/ISSUE_TEMPLATE/` with four structured forms (`feature.yml`, `bug.yml`, `chore-refactor.yml`, `docs.yml`) and `config.yml` disabling blank issues.
- **`.claude/rules/docs-sync.json`** (issue #43): machine-readable rule for AI agents — CHANGELOG.md update required on every `src/` change; Build Log entry required on every module add/remove/restructure.

### Added

- **Living architecture doc** (issue #43): rewrote `docs/architecture.md` into a comprehensive guide covering project goals, stack rationale, module-by-module walkthrough, non-obvious conventions with incident history, CI pipeline evolution, deploy checklist, and a Build Log section.
- **PR template upgrade** (issue #43): added "Build Log entry added?" checkbox and "Breaking changes / rollback notes" section to `.github/PULL_REQUEST_TEMPLATE.md`.

- **CI quality gate** (issue #30): full GitHub Actions pipeline with ESLint, Vitest unit tests, Playwright E2E, secret scanning, and PR checklist enforcement. Branch protection on `main` requires all four non-E2E jobs to pass before merge.
- **ESLint** (issue #30): flat config with security rules blocking `innerHTML` and `eval`, plus `no-unused-vars`/`no-undef`/`no-console` quality rules. `npm run lint` / `npm run lint:fix` scripts.
- **Playwright E2E** (issue #30): `playwright.config.js` targeting Chromium; starter auth tests in `tests/e2e/`; `npm run test:e2e` script.
- **PR template** (issue #30): `.github/PULL_REQUEST_TEMPLATE.md` pre-fills every new GitHub PR.
- **Vitest test runner** (issue #30): installed Vitest with jsdom environment; 17 unit tests covering `isValidUrl`, `escapeHtml`, `debounce`, and `themeToggle` subscriber cleanup. Tests live in `tests/unit/`. `npm run test:coverage` script added.
- **Firebase mock** (issue #30): `tests/__mocks__/firebase.js` for unit/integration tests that import `roadmapStore.js`.
- **Firebase Emulator wiring** (issue #37): `firebase.json` emulator config (auth port 9099, database port 9000); `firebase-tools` added as a devDependency so CI uses the pinned local version. Browser SDK now connects to the emulator when `window.__USE_FIREBASE_EMULATOR__` is set, which the new Playwright fixture (`tests/e2e/fixtures.js`) injects via `addInitScript` when `FIREBASE_CONFIGURED=true`. CI E2E job now waits for the auth emulator to be ready before launching Playwright.
- **Integration tests** (issue #3): `tests/integration/roadmapStore.test.js` — 12 tests covering subscribe/notify cycle, structuralVersion contract (done-only vs structural changes), sign-out localStorage guard, and Firebase echo detection via stableStringify comparison.
- **`npm run test:integration` script** (issue #3): runs only `tests/integration/` via `vitest run tests/integration`.
- **Coverage thresholds** (issue #3): baseline 20% thresholds in `vitest.config.js`; will tighten to ≥80% on `core/` and `utils/` after the folder-restructure PR.
- **`.claude/rules/`** (issue #3): five machine-readable rule files for AI agents — `no-innerHTML`, `url-validation`, `structural-version`, `subscription-cleanup`, `store-pattern`.
- **`docs/adr/ADR-001-current-architecture.md`** (issue #3): baseline architecture ADR recording current flat `src/` layout and the target folder structure for the restructure PR.
- **`docs/roadmap.md`** (issue #3): planned-features list linked to GitHub issues, organised by phase.
