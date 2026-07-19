# Contributing to Ascent

Thanks for your interest in Ascent. This file covers how to get set up locally,
the conventions this codebase follows, and how to report a bug or suggest a feature.

**Not a developer, or don't want to set anything up?** You can still contribute —
open a [GitHub issue](../../issues/new/choose) for a bug or idea, or use the in-app
feedback widget (floating button, bottom corner of the deployed app) which captures
a screenshot automatically. Docs/wording fixes are welcome as PRs too, and don't
require running the app locally to write.

## Local setup

Prerequisites: [Git](https://git-scm.com/downloads), [Node.js](https://nodejs.org)
v20+ (this project has no build step — Node only runs the dev server and tests),
and a free [Firebase](https://console.firebase.google.com) project.

1. Clone the repo and `cd` into it — there's nothing to install; this is a static
   site with no build step.
   ```bash
   git clone <this-repo-url>
   cd ascent
   ```
2. Set up Firebase. Create a project at
   [console.firebase.google.com](https://console.firebase.google.com), then:
   ```bash
   cp src/services/firebase.config.example.js src/services/firebase.config.js
   ```
   Fill in `firebase.config.js` with your project's values (Project settings →
   General → Your apps). This file is gitignored — never commit real credentials
   to it.
   - Enable **Email/Password** and **Anonymous** sign-in under Authentication.
   - Publish the Realtime Database rules from `firebase/database.rules.json`.
3. Run it.
   ```bash
   npm run dev
   ```
   Serves the app at `http://localhost:4173`.

## Code conventions

This project's conventions — DOM construction, brand rules, store contracts,
styling, security — are documented in [`CLAUDE.md`](CLAUDE.md) and the
area-specific files under `.claude/rules/`. Read `CLAUDE.md` before opening a PR.

Before pushing:
```bash
npm run lint     # must exit 0
npm test         # must exit 0
```

If your change is perf-sensitive, also run the Lighthouse perf budget locally
(it's not a CI check — see `CLAUDE.md`'s "Verifying changes" section for why):
```bash
npx serve . -p 4173 -s &
npx @lhci/cli autorun --config=./lighthouserc.json
```

## Branch naming

`feat/`, `fix/`, `refactor/`, `docs/`, `chore/` followed by a short slug, e.g.
`fix/dropdown-select-overlay-scrim`.

## Commit message style

Short, present-tense summary line (`fix: ...`, `feat: ...`, `chore: ...`), body
only when the "why" isn't obvious from the diff.

## Pull requests

Every PR should reference the issue it addresses and include a summary of the
change and a test plan. See `.github/PULL_REQUEST_TEMPLATE.md` for the format
this repo uses.

## Reporting bugs and requesting features

If you're using the deployed app, use the in-app feedback widget (the floating
button in the bottom corner) — it captures a screenshot and routes straight to
this repo's issue tracker. Otherwise, open a
[GitHub issue](../../issues/new/choose) directly.
