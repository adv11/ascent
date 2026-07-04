# Changelog

All notable changes to this project will be documented in this file.

## [Unreleased]

### Added

- **Vitest test runner** (issue #30, partial): installed Vitest with jsdom environment; `npm test` and `npm run test:watch` scripts wired up. Initial suite covers `isValidUrl`, `escapeHtml`, and `debounce` (11 tests). Full CI pipeline (Playwright E2E, GitHub Actions, ESLint) remains in issue #30.
