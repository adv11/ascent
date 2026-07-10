# ADR-008: Backup export/import schema versioning strategy

**Date**: 2026-07-11
**Status**: Active
**Deciders**: solo project — adv01
**Issue**: #18

## Context

Issue #18 adds a client-side JSON export of a user's roadmap (a personal backup/escape
hatch) and a matching JSON import to restore it — plus a one-way CSV export for
spreadsheet review. Once a user's browser holds an old export file, the item shape it
was written against can drift arbitrarily far from the app's current item shape before
they ever import it back (a phone found in a drawer two years later, a backup made right
before a schema change that never got imported until now). The import path needs a
policy for what happens when an old file meets a newer app, decided once, up front,
rather than improvised per future schema change.

This is a distinct decision from AI-import's (`importValidator.js`/`schemaAdapter.js`,
issue #4) `SUPPORTED_SCHEMA_VERSION` — that schema versions a *generated* payload format
(an LLM's JSON output, validated against a prompt contract) and is expected to change
roughly in lockstep with `IMPORT_PROMPT_VERSION`. A backup schema versions the
*roadmap's own persisted shape* and needs its own, independent policy.

## Options considered

| Option | Why not chosen (or chosen) |
|---|---|
| 1. No version field at all — always attempt a best-effort import | Silently misinterprets an old or malformed file as valid, corrupting the live roadmap with no way to detect it happened |
| 2. A single `schemaVersion` integer, reject anything that doesn't exactly match `SUPPORTED_BACKUP_SCHEMA_VERSION` | **Chosen** — see below |
| 3. Semver-style major.minor, auto-migrate minor mismatches | Real migration-chain complexity (a v1→v2→v3 upgrade path to build and test) for a feature with exactly one version so far; premature for the first shipped schema |

## Decision

**Option 2.** `backupSchema.js` exports a single integer `EXPORT_SCHEMA_VERSION`
(currently `1`), written into every export's `schemaVersion` field.
`backupValidator.js`'s `validateBackupPayload()` rejects any payload whose
`schemaVersion` doesn't **exactly** match `SUPPORTED_BACKUP_SCHEMA_VERSION` (re-exported
from the same constant) with a clear, user-facing error — `"Unsupported backup schema
version (N) — this app reads version M."` — rather than attempting a partial or
best-effort read. An unsupported file is a hard stop at the validation step, before
`roadmapStore.importBackupItems()` is ever called; the live roadmap is never touched.

This intentionally defers writing any actual migration logic until a second schema
version is ever needed. When that happens, the shape to add is: keep
`EXPORT_SCHEMA_VERSION` as the *current* version constant, add a version-specific
migrator function (e.g. `migrateBackupV1toV2(data)`, pure, same file), and have
`validateBackupPayload`/`validateBackupText` run the old payload through the migrator
chain before the normal shape checks — never loosen the "exact match or reject" check
itself to silently accept multiple versions at once. This mirrors the precedent already
established by `importValidator.js`'s `SUPPORTED_SCHEMA_VERSION` (also a hard
exact-match reject, also with no migration chain yet) and by `roadmapStore.js`'s own
`ROADMAP_VERSION` field on every persisted Firebase/local roadmap document.

The exported payload additionally carries `exportedAt` (an ISO timestamp, informational
only — never validated or acted on) and `itemCount` (a redundant, human-readable
cross-check a user can eyeball in a text editor without counting the `items` map by
hand) — neither participates in versioning, both are purely for a human inspecting the
file.

## Consequences

- A backup exported by an older app version that predates issue #18 doesn't exist (this
  is the first schema version) — nothing to migrate on day one.
- The first time `EXPORT_SCHEMA_VERSION` bumps, every export written under version 1 and
  sitting in a user's Downloads folder becomes unreadable until a v1→v2 migrator ships
  alongside the bump — this is the intended failure mode (loud rejection, never silent
  misinterpretation), not a gap to route around later.
- `roadmapStore.importBackupItems()` re-validates every individual item's fields (title
  length, resource caps) independently of `validateBackupPayload()`'s shape check, since
  a backup file is untrusted input the same way an AI-import payload or a Firebase read
  is — schema-version acceptance is not a substitute for per-field validation at the
  point of mutation.
- No server-side component exists for export/import (issue #18 is entirely client-side,
  per its own implementation notes) — this ADR only governs the JSON shape itself, not
  any transport or storage concern.
