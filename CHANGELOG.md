# Changelog

All notable changes to this project will be documented in this file.

## [Unreleased]

### Fixed

- **themeToggle subscriber leak** (Issue #27): `createThemeToggle()` now captures and stores the unsubscribe function returned by `onThemeChange()` as `btn._cleanup`. `authShell` returns `{ node, cleanup }` so both `renderSignIn` and `renderSignUp` propagate the unsubscribe through the route cleanup chain. `renderDashboard` extracts the toggle into a variable and calls `themeToggleBtn._cleanup?.()` in its cleanup return. Subscribers no longer accumulate on each navigation.

### Improved

- **Theme toggle aria-label** (Issue #27, secondary): The toggle button's `aria-label` now reflects the current state ("Switch to light mode" / "Switch to dark mode") and updates live on each theme change, fixing a static ARIA label that never matched the visible state.
