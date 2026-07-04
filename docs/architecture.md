# SwitchPrep Architecture

SwitchPrep is now structured as a small production-style frontend application rather than a single HTML file.

## Current stack

- Native ES modules for a zero-build local MVP.
- Firebase Authentication for email/password and anonymous sessions.
- Firebase Realtime Database for per-user roadmap documents.
- LocalStorage fallback for signed-out/offline progress.

## Data model

Realtime Database:

```text
users/{uid}/roadmap
  version: number
  updatedAt: number
  items: Record<itemId, RoadmapItem>
```

Each roadmap item contains:

```text
id, title, phase, section, priority, done, custom, deleted, resources[]
```

This keeps every user's edits isolated by Firebase UID. Security rules should require `auth != null && auth.uid == $uid` for both reads and writes.

## Frontend layout

```text
index.html                       # no-FOUC theme bootstrap lives inline here
src/main.js                      # boot: init theme, auth gate, hash router
src/data/roadmap.js              # seed phases, topic resources
src/services/firebase.js         # auth + realtime DB
src/services/firebase.config.js  # gitignored — your Firebase project credentials
src/services/firebase.config.example.js  # committed template, copy to the path above
src/services/roadmapStore.js
src/services/theme.js            # dark/light theme state
src/ui/pages/signIn.js
src/ui/pages/signUp.js
src/ui/pages/dashboard.js
src/ui/components/authShell.js   # shared auth-page chrome (signIn/signUp)
src/ui/components/themeToggle.js
src/ui/components/itemPanel.js
src/styles/app.css               # tokens + components, both themes
firebase/database.rules.json
```

See `CLAUDE.md` / `AGENTS.md` at the repo root for conventions AI agents working on
this project should follow (the `el()` helper contract, the store's `structuralVersion`
rendering rule, the `data-action` click-guard pattern, and the theme token system).

## CI pipeline

GitHub Actions runs on every PR and push to `main` (`.github/workflows/ci.yml`):

| Job | Tool | What it checks |
|---|---|---|
| `lint` | ESLint (flat config) | Security rules (no `innerHTML`, no `eval`), unused vars, undefined refs |
| `security` | gitleaks + git ls-files | No committed secrets; `firebase.config.js` not tracked |
| `test-unit` | Vitest + jsdom | Unit and integration tests in `tests/unit/` and `tests/integration/` |
| `test-e2e` | Playwright (Chromium) | End-to-end flows via Firebase Emulator |
| `pr-checklist` | github-script | PR body is filled (≥ 50 chars, references an issue) |

**Branch protection on `main` (active):** four jobs required — `ESLint`, `Secret & security scan`, `Unit & integration tests (Vitest)`, `PR description check`. `enforce_admins: true`. Branches must be up to date before merging. `E2E tests (Playwright)` will be added as a fifth required check once Firebase Emulator is set up (tracked in issue #37).

**Required GitHub secrets:**
- `FIREBASE_CONFIG_TEST` — Firebase config JSON for the CI test project (written to `src/services/firebase.config.js` during E2E job)
- `FIREBASE_TOKEN` — Firebase CLI token for emulator start

## Test structure

```
tests/
  unit/             ← Vitest unit tests (jsdom environment)
    dom.test.js
    themeToggle.test.js
  integration/      ← Vitest integration tests (store round-trips, pub-sub)
  e2e/              ← Playwright E2E tests (real Chromium, Firebase Emulator)
    auth.test.js
  __mocks__/
    firebase.js     ← vi.fn() stubs for authApi / dbApi (use with vi.mock())
  setup.js          ← jsdom shims: matchMedia, localStorage
```

Scripts:

| Command | What it runs |
|---|---|
| `npm test` | Vitest unit + integration (CI mode, no watch) |
| `npm run test:watch` | Vitest in watch mode |
| `npm run test:coverage` | Vitest with v8 coverage report |
| `npm run test:e2e` | Playwright E2E (requires Firebase Emulator or real config) |
| `npm run lint` | ESLint on `src/` |
| `npm run lint:fix` | ESLint with auto-fix |

## Deploy checklist

1. Create a Firebase project and copy `src/services/firebase.config.example.js` to
   `src/services/firebase.config.js`, filling in that project's values (this file is
   gitignored — never commit real credentials).
2. Enable Email/Password and Anonymous auth in Firebase Console.
3. Publish Realtime Database rules from `firebase/database.rules.json`.
4. Serve static files (`python3 -m http.server 4173` locally; Firebase Hosting or any CDN in production).
5. Enable Firebase App Check before a public launch.

- Keep writes per user scoped to `users/{uid}`.
- Add Firebase App Check before public launch.
- Move public seed roadmap content to versioned static JSON or a `roadmapTemplates/{version}` node.
- Add server-side validation with Cloud Functions if sharing/community resources are introduced.
- Track analytics events without storing sensitive preparation notes.
