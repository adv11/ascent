# Ascent documentation index

Start with the top-level [`README.md`](../README.md) for a product overview,
[`CONTRIBUTING.md`](../CONTRIBUTING.md) for local setup, and [`CLAUDE.md`](../CLAUDE.md)
for the codebase conventions every change follows. This directory holds the deeper
reference material.

## Core references

| Doc | What it covers |
|---|---|
| [`architecture.md`](architecture.md) | The living architecture guide — module-by-module walkthrough, data model, CI/testing pipeline, non-obvious conventions and the incidents that produced them, deploy checklist, and a dated Build Log of every structural change since the project started. Start here for "how does this actually work." |
| [`api.md`](api.md) | Public store/service contracts (`roadmapStore.js`, `dailyTodoStore.js`, `activityLogStore.js`, etc.) — the shape of the data and functions other modules are allowed to depend on. |
| [`roadmap.md`](roadmap.md) | Pointer to [issue #11](https://github.com/adv11/ascent/issues/11), the single source of truth for what's shipped vs. still open. |
| [`monetization-decision.md`](monetization-decision.md) | The product's monetization approach and the reasoning behind it. |

## Architecture Decision Records (ADRs)

One-time, dated decisions — read on demand, not auto-loaded into every session.
Each records the context, options considered, and the actual decision, so a
future change doesn't have to re-litigate a question that was already settled.

| ADR | Decision |
|---|---|
| [ADR-001](adr/ADR-001-current-architecture.md) | Current flat module architecture (pre-restructure baseline) |
| [ADR-002](adr/ADR-002-csp-sri-security.md) | Content Security Policy + Subresource Integrity hardening |
| [ADR-003](adr/ADR-003-firebase-hosting-platform.md) | Firebase Hosting as the production platform |
| [ADR-004](adr/ADR-004-product-rename.md) | Product rename to Ascent |
| [ADR-005](adr/ADR-005-anonymous-user-lifecycle.md) | Anonymous (guest) Firebase Auth user lifecycle |
| [ADR-006](adr/ADR-006-responsive-breakpoints-touch-hover.md) | Responsive breakpoint scale and touch/hover detection strategy |
| [ADR-007](adr/ADR-007-agent-memory-architecture.md) | Splitting the monolithic `CLAUDE.md` into scoped rules + skills |
| [ADR-008](adr/ADR-008-backup-export-schema-versioning.md) | Backup export/import schema versioning strategy |
| [ADR-009](adr/ADR-009-analytics-data-model.md) | Progress analytics data model |
| [ADR-010](adr/ADR-010-feedback-storage.md) | In-app feedback storage design |
| [ADR-011](adr/ADR-011-pwa-offline-strategy.md) | PWA offline caching strategy |
| [ADR-012](adr/ADR-012-ai-generation-backend.md) | In-app AI roadmap generation via a server-side LLM proxy — **Proposed**, not yet implemented (today's AI-import flow is copy/paste with an external assistant) |
| [ADR-013](adr/ADR-013-v3-terminal-redesign.md) | v3 visual redesign — syncing the UI to the developer's portfolio, retiring v2 "Modernist" — **Active**, fully shipped |

## Agent-facing conventions

Not meant for a human reader working top-to-bottom — these load automatically
into an AI coding agent's context only when it touches the relevant files, so
every session doesn't pay for content unrelated to its task. See root
[`CLAUDE.md`](../CLAUDE.md)'s "Agent memory map" for the full trigger list:
`.claude/rules/roadmap-store.md`, `.claude/rules/ui-styling.md`,
`.claude/rules/design-system.md`, `.claude/rules/auth-security.md`,
`.claude/rules/content-style.md`, and the step-by-step procedures under
`.claude/skills/`.

## Screenshots

[`screenshots/`](screenshots/) holds the source images embedded in the root
README, organized by the issue that captured them — always the most recent
folder for a given page, per [`CLAUDE.md`](../CLAUDE.md)'s "delete the
superseded folder rather than leaving it orphaned" convention.
