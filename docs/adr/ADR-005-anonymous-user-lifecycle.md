# ADR-005: Anonymous Firebase Auth user lifecycle — delete on unlinked exit

**Date**: 2026-07-08
**Status**: Active
**Deciders**: solo project — adv01
**Issue**: #24

## Context

Guest sessions ("Continue as guest") create a real anonymous Firebase Auth UID and,
since Firebase is the only storage backend, their roadmap progress syncs to
`users/{uid}/roadmaps/*` like any signed-up account's. If the guest never links that
session to a real account (`authApi.linkGuest`) before leaving, the anonymous UID is
never re-authenticatable — the session token is gone and there is no password/email to
sign back in with. Left alone, that UID's data sits in the database forever: storage
cost with no way to ever read, export, or delete it again through the app.

## Options considered

| Option | Why not chosen (or chosen) |
|---|---|
| 1. Rely on link-on-signup only | Already true (linking upgrades the same UID, no orphan) but doesn't help the guest who never links |
| 2. Delete the anonymous Auth user + their data on unlinked sign-out | **Chosen** — see below |
| 3. Scheduled Cloud Function TTL sweep (30+ days inactive) | Requires the Firebase Blaze (pay-as-you-go) plan; this project targets the free Spark plan, so Cloud Functions aren't available |

## Decision

**Option 2.** `authApi.signOut()` (`src/services/firebase.js`) checks
`auth.currentUser.isAnonymous` first. For an unlinked guest, it removes
`users/{uid}` from the Realtime Database and then calls `deleteUser()` on the
anonymous Auth record — the same order (data before Auth record) as the existing
account-deletion flow, and for the same reason: once the Auth record is gone the
security rules can no longer authenticate that write, so cleanup would be blocked if
done in the other order. A linked guest is no longer `isAnonymous` by the time they
ever sign out, so that path is unaffected and was already orphan-free (Option 1).

If the cleanup itself fails (e.g. a stale/expired token), `signOut()` catches the error
and falls back to a plain `signOut(auth)` — a user must never be blocked from leaving
the app because a best-effort cleanup call failed.

## Consequences

- No orphaned anonymous accounts accumulate from the normal "try it, don't sign up"
  path — the dominant guest exit.
- A guest who closes the tab/browser without triggering a sign-out (crash, force-quit,
  killing the process) still leaves an orphan — there's no `beforeunload`-reliable way
  to guarantee cleanup in that case. This is accepted as a residual, lower-frequency
  gap; Option 3 (Cloud Function TTL sweep) remains the documented path to close it
  fully if the project ever moves to the Blaze plan.
- No CI-run Rules Simulator test exists yet for the database-rules half of issue #24
  (payload validation, `$other` catch-all, `reports/` stub) — that's blocked on issue
  #3's testing-infra work standing up Firebase emulator test tooling. The pass/fail
  matrix for those rules was verified by hand against the local emulator instead; see
  the issue #24 Build Log entry in `docs/architecture.md`.
