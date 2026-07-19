---
name: raise-issue
description: Use when raising a new GitHub issue in this repo (adv11/ascent) — covers the required label taxonomy, body sections, and the tracker-update step that must happen immediately after gh issue create.
---

# Raising a new GitHub issue

Relocated from `CLAUDE.md`'s MANDATORY WORKFLOW section (issue #86) with no content
changes — see `docs/adr/ADR-007-agent-memory-architecture.md`. This procedure is
mandatory, not optional, every time.

1. **First line of the issue body: the label category line** — `` `type:X` `priority:Y` `domain:Z` ``. See root `CLAUDE.md` for the full label taxonomy (Type ≥ 1, Priority exactly 1, Domain ≥ 1).
2. **Body must include these sections**, in this order: What/Why, Scope, Testing requirements, Doc changes checklist, Blocked by / Blocks / Safe to run in parallel, GitHub milestone. Mirror the format used by `.github/ISSUE_TEMPLATE/*.yml` (four forms: `feature.yml`, `bug.yml`, `chore-refactor.yml`, `docs.yml`) even when creating the issue via `gh issue create` rather than the web form.
3. **Immediately after `gh issue create` returns**: fetch the live tracker body (`gh issue view 11 --json body`), add the new issue at the correct Step in the table with status `⬜ Not started`, and note what it's blocked by (if anything) in the Note column. Push the updated body with `gh issue edit 11 --body-file <file>`. Do not skip or defer this — an issue that isn't on the tracker is easy to lose track of.

Look at a recently-created issue (e.g. via `gh issue view <N> --json body`) for a concrete example of the expected level of detail before writing a new one from scratch.
