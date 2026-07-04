# Changelog

All notable changes to this project will be documented in this file.

## [Unreleased]

### Infra
- CI: verify Firebase Emulator E2E runs with secrets configured (issue #37)

### Added

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
