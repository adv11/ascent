# Changelog

All notable changes to this project will be documented in this file.

## [Unreleased]

### Added

- **CI quality gate** (issue #30): full GitHub Actions pipeline with ESLint, Vitest unit tests, Playwright E2E, secret scanning, and PR checklist enforcement. Branch protection on `main` requires all four non-E2E jobs to pass before merge.
- **ESLint** (issue #30): flat config with security rules blocking `innerHTML` and `eval`, plus `no-unused-vars`/`no-undef`/`no-console` quality rules. `npm run lint` / `npm run lint:fix` scripts.
- **Playwright E2E** (issue #30): `playwright.config.js` targeting Chromium; starter auth tests in `tests/e2e/`; `npm run test:e2e` script.
- **PR template** (issue #30): `.github/PULL_REQUEST_TEMPLATE.md` pre-fills every new GitHub PR.
- **Vitest test runner** (issue #30): installed Vitest with jsdom environment; 17 unit tests covering `isValidUrl`, `escapeHtml`, `debounce`, and `themeToggle` subscriber cleanup. Tests live in `tests/unit/`. `npm run test:coverage` script added.
- **Firebase mock** (issue #30): `tests/__mocks__/firebase.js` for unit/integration tests that import `roadmapStore.js`.
