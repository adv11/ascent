# ADR-010: In-app feedback storage — Firebase write-only `reports/` vs. an external form service

**Date**: 2026-07-11
**Status**: Active
**Deciders**: solo project — adv01
**Issue**: #9

## Context

Issue #9 adds an in-app feedback widget — bug reports, feature requests, and general
feedback, each optionally carrying a screenshot and browser/OS/viewport metadata. It
needs somewhere to land that (a) the developer can review, (b) a user can never read
back (someone else's bug report, or the raw list of everyone's reports), and (c) doesn't
require standing up new infrastructure for a project that is currently a single static
site plus Firebase Auth/Realtime Database.

## Options considered

| Option | Why not chosen (or chosen) |
|---|---|
| 1. External form service (Formspree, Netlify Forms, a Google Form) | New third-party dependency and a new account/API key to manage; reports would live outside the one place (Firebase console) this project already reviews data; "My reports" history would need a second round trip to a second backend |
| 2. A new Cloud Function + Firestore/separate project | Real overkill for a write-then-occasionally-read report queue, and this app has no Cloud Functions today — would be the first server-side compute this otherwise fully static-hosted app needs |
| 3. Firebase Realtime Database, a new top-level `reports/` path, write-only for clients | **Chosen** — see below |

## Decision

**Option 3.** Every report writes to two paths in one multi-path `update()`:
`reports/{reportId}` (the full payload, including any screenshot — `.read: false`, so no
client can ever list or read another user's report; reviewed by the developer directly
in the Firebase console, which bypasses security rules entirely) and
`users/{uid}/reports/{reportId}` (the same payload minus the screenshot, to save quota —
readable/writable only by that uid, same access pattern every other per-user path in
this app already has) powering the "My reports" history view.

`reports/{reportId}` is a flat, unscoped path (not `reports/{uid}/{reportId}`) so a
future admin dashboard can list every report in submission order without fetching one
subtree per user — the security boundary is enforced by the write-time `.validate` rule
requiring `newData.child('userId').val() == auth.uid` instead, which stops a client from
forging a report under someone else's identity even though the path itself carries no
uid. `firebaseStore.js` (`src/services/feedbackStore.js`) is a thin, stateless wrapper
around exactly two Firebase calls — not a fifth `create*Store()` alongside
`roadmapStore.js`/`dailyTodoStore.js`/`activityLogStore.js` — because a report is a
fire-and-forget write with nothing to keep in sync afterward, unlike every other store in
this app. See `.claude/rules/roadmap-store.md`'s "In-app feedback & bug reporting"
section for the full data-flow writeup.

Rate limiting (max 3 reports per 24h, max 1 per 60s) is enforced client-side only
(`src/services/feedbackRateLimit.js`, a plain `localStorage` timestamp log) — Realtime
Database rules have no way to express "reject if this uid wrote N times in the last M
seconds." This is a deliberate, good-faith UX guard against accidental double-submits
and casual spam, not a security boundary; genuine server-side throttling would require a
Cloud Function, which is out of scope for this decision.

## Consequences

- No new third-party account, API key, or billing surface — reports live in the same
  Firebase project as everything else this app already stores.
- The developer's only review surface is the Firebase console (or a future admin
  dashboard reading `reports/` directly, bypassing rules the same way the console does).
  There is currently no in-app moderation UI, no email/Slack notification on a new
  report, and no way for a client to change a report's `status` — the client always
  writes `status: 'new'`; every status transition (`under_review`/`in_progress`/
  `resolved`/`wont_fix`) is a manual edit in the Firebase console. If report volume ever
  grows enough that console-only review becomes the bottleneck, an admin dashboard is
  the natural next step — the flat `reports/` path was chosen specifically so that
  addition doesn't require restructuring the data first.
- A screenshot only ever lives at `reports/{reportId}` (full payload), never
  `users/{uid}/reports/{reportId}` (summary) — enforced by both the client
  (`buildReportSummary()` strips it) and a second, independent server-side rule
  (`".validate": "false"` on that specific child under the user path) so a buggy client
  can't accidentally leak a screenshot into the quota-sensitive per-user copy.
- Rate limiting can be cleared by clearing `localStorage` — acceptable for a good-faith
  spam/double-submit guard, not acceptable if this is ever load-bearing for abuse
  prevention. Revisit with a Cloud Function if real abuse is observed.
