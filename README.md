# Ascent

*Engineer your next move.* A roadmap tracker for anyone learning, revising, or working
toward a goal — students, professionals, and career switchers alike. New sign-ups pick
one of 8 starter templates — Java Backend Engineer, GenAI/Agentic AI Engineer, Frontend
Developer, Data Scientist, 12th Grade Mathematics, Learning Piano, Marketing, or a blank
slate to build your own — all in one editable, syncable checklist. Any template except
the blank one can be hidden from your own picker if you don't want it cluttering the
list; hiding is per-account and never affects anyone else.

- Sign in with email/password or start instantly as a guest.
- Progress syncs across devices via Firebase, with an offline/local fallback.
- Every topic can carry its own resource links, priority, and custom notes.
- Light and dark themes, following your system preference by default.

## Tech stack

Vanilla JavaScript over native ES modules — **no build step, no bundler, no
framework**. Firebase Authentication + Realtime Database for sync, with
`localStorage` as an offline fallback. See [`docs/architecture.md`](docs/architecture.md)
for the full data model and file layout, and [`CLAUDE.md`](CLAUDE.md) /
[`AGENTS.md`](AGENTS.md) for the conventions this codebase follows.

## Getting started

1. **Clone and install** — there are no dependencies to install; this is a static
   site.
   ```bash
   git clone <this-repo-url>
   cd ascent
   ```
2. **Set up Firebase.** Create a project at [console.firebase.google.com](https://console.firebase.google.com),
   then copy the example config to a real one:
   - macOS/Linux:
     ```bash
     cp src/services/firebase.config.example.js src/services/firebase.config.js
     ```
   - Windows (PowerShell):
     ```powershell
     Copy-Item src/services/firebase.config.example.js src/services/firebase.config.js
     ```
   Fill in `firebase.config.js` with your project's values (Project settings →
   General → Your apps). This file is gitignored — it's meant to hold your own
   credentials, never a committed value.
   - Enable **Email/Password** and **Anonymous** sign-in under Authentication.
   - Publish the Realtime Database rules from `firebase/database.rules.json`.
3. **Run it.**
   ```bash
   npm run dev
   ```
   Serves the app at `http://localhost:4173` on macOS, Linux, and Windows alike —
   `npm run dev` shells out to a small Node-only static server
   (`scripts/dev-server.mjs`), so no separate Python install or OS-specific command is
   needed.

## Deploying

```bash
firebase deploy            # deploys hosting + database rules
firebase deploy --only hosting
```

Every push to `main` auto-deploys to Firebase Hosting via GitHub Actions. Every PR
gets a temporary preview URL posted as a comment. See [`docs/architecture.md`](docs/architecture.md)
for the required GitHub secrets (`FIREBASE_SERVICE_ACCOUNT`, `FIREBASE_CONFIG`,
`FIREBASE_PROJECT_ID`).

> **Note on `firebase.config.js`:** The values in this file (`apiKey`, `authDomain`,
> etc.) are public client identifiers — they are embedded in the page JavaScript and
> visible to any user who opens DevTools. Firebase's security model relies on Security
> Rules, not on keeping these values private. The file is gitignored to avoid committing
> production credentials during local development; CI injects it from a GitHub Secret.

## Project status

Phase 0 (Foundation & Standards) is complete. Phase 1 work (hosting, auth, core
architecture hardening) is in progress. See [`CHANGELOG.md`](CHANGELOG.md) for the
detailed change history and [`docs/roadmap.md`](docs/roadmap.md) for the planned
feature list.

Tests run via `npm test` (Vitest unit + integration) and `npm run test:e2e` (Playwright).
Run `npm run lint` to check for security and quality issues. See the "Verifying changes"
section of [`CLAUDE.md`](CLAUDE.md) for the full checklist.

## Contributing

Found a bug or want to suggest a feature? See [`CONTRIBUTING.md`](CONTRIBUTING.md) for
local setup, code conventions, and how to report issues.

## License

All rights reserved — see [`LICENSE`](LICENSE). This code is shared for viewing
only; no license to use, copy, or modify is granted without permission.
