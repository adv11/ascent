---
name: open-pr
description: Use right before and when opening a pull request in this repo — the required pre-PR checks (test/lint/cache-version/rebase/push) and the PR template/linking convention. tracker-sync.yml handles the tracker row automatically; this skill only covers the manual steps.
---

# Before opening a PR — all five required, no exceptions

Relocated from `CLAUDE.md`'s MANDATORY WORKFLOW section (issue #86) with no content
changes — see `docs/adr/ADR-007-agent-memory-architecture.md`.

1. `npm test` — zero failures
2. `npm run lint` — zero errors
3. `npm run check:cache-version` — bump `sw.js`'s `CACHE_VERSION` if it fails (issue #17
   follow-up: CI's "PR description check" job silently fails this same check on every
   PR touching `src/**` — this local script mirrors that exact CI logic so it's caught
   before push instead of after opening the PR)
4. `git fetch origin && git rebase origin/main` — branch must be on top of latest main
5. `git push --force-with-lease origin <branch>`

# Opening the PR

1. Follow `.github/PULL_REQUEST_TEMPLATE.md` in full: What / How / Testing / Docs updated / Screenshots / Linked issue
2. Use `Refs #N` (not `Closes #N`) when the issue spans multiple PRs; use `Closes #N` only when this PR fully resolves the issue
3. The `tracker-sync.yml` workflow **automatically** updates the tracker table row and reference table when the PR is opened or merged — no manual update needed for those two events (see the `after-merge` skill for what's still manual after merge)

## Screenshots are required for any visible UI change — actually attach them, don't just say "available on request"

Earlier PRs got away with "verified live via Playwright — screenshots available on
request, driver script not committed." Stop doing that whenever the template's
"Screenshots / recordings" section applies (any visible UI change). Instead:

1. Capture real PNGs (a throwaway Playwright script against `npm run dev` calling `page.screenshot()` is fine — the script itself still doesn't need to be committed, only the images do).
2. Commit them under `docs/screenshots/issue-<N>/*.png` (or `pr-<N>` if there's no single driving issue) on the PR branch itself.
3. Push, then reference each one in the PR body as `![caption](https://raw.githubusercontent.com/adv11/ascent/<branch>/docs/screenshots/issue-<N>/<file>.png)` — a repo-relative markdown path does not render inline in a PR *description*, so it must be the `raw.githubusercontent.com` form, and the branch must already be pushed before the images resolve.
4. If the PR is edited after opening (`gh pr edit --body-file`), the images stay live as long as the branch/commit they point at isn't force-pushed away — prefer plain (non-force) pushes for screenshot-only follow-up commits once the PR is open.

Also confirm the "Docs that must ship with every code PR" table in root `CLAUDE.md` is
satisfied before opening: `CHANGELOG.md` always; `CLAUDE.md`/the relevant
`.claude/rules/*.md` file if a convention changed; `docs/architecture.md` (+ Build Log
entry) if structure/CI/data-flow/test setup changed; `docs/api.md` if a public
store/service contract changed.
