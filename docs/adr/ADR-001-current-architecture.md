# ADR-001: Current flat module architecture (pre-restructure baseline)

**Date**: 2026-07-05
**Status**: Active (target state defined in issue #3 — folder-restructure PR)
**Deciders**: solo project — adv01

## Context

SwitchPrep started as a personal tool with a flat `src/` layout. As it moves toward a
sellable product, a formal module structure is needed. This ADR records the current
state as a baseline before the restructure.

## Current state

```
src/
  data/roadmap.js        — seed phases/sections/items + resource library
  services/firebase.js   — Firebase Auth + Realtime Database wrappers
  services/firebase.config.js          — gitignored; real project credentials
  services/firebase.config.example.js  — committed template
  services/roadmapStore.js  — in-memory store: subscribe/notify, queueSave
  services/theme.js         — dark/light theme state (localStorage + OS pref)
  ui/router.js              — tiny hash router
  ui/dom.js                 — el() builder, debounce, isValidUrl
  ui/pages/signIn.js
  ui/pages/signUp.js
  ui/pages/dashboard.js
  ui/components/authShell.js
  ui/components/themeToggle.js
  ui/components/itemPanel.js
  ui/components/toast.js
  styles/app.css
  main.js                   — boot entry
```

## Decision

Keep the current flat layout until the dedicated folder-restructure PR is ready.
All new code follows the conventions in `CLAUDE.md`. No deep cross-module imports
are added that would make the future restructure harder.

## Target state

See issue #3 for the full target:

```
src/
  core/           — pure business logic, no DOM, no Firebase
    roadmap/
    auth/
  services/       — side-effectful integrations (Firebase, localStorage)
  ui/
    pages/
    components/
    hooks/
  data/           — seed data only
  utils/          — pure helpers (debounce, el, stableStringify, …)
  styles/
```

That restructure moves `el()`, `debounce`, `stableStringify`, and pure roadmap
mutations into `core/` and `utils/`, then adds barrel `index.js` per module.

## Consequences

- **Now**: easy to navigate for a solo dev; no barrel imports needed
- **After restructure**: clear public API boundaries per module; coverage thresholds
  can tighten to ≥80 % on `core/` and `utils/`; cross-module coupling is explicit
