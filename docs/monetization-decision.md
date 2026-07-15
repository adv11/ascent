# Monetization model decision (Issue #135)

> **Status:** decision document, not an implementation spec. Promoted from issue
> #126 item 4. Tracks a known open product question so it isn't silently deferred
> forever — see #126's own framing: "a business decision as much as an engineering
> one." No code changes accompany this document; implementation is deferred to a
> future issue once a model is chosen.

## Context

Root `CLAUDE.md` states Ascent is "moving from a personal tool toward a sellable
product," but no pricing decision has ever been made — a grep across `src/` for
`stripe`/`payment`/`subscription`/`billing`/`paywall` returns zero real hits. Ascent
today has **no backend compute** — it's a static-hosted, no-build-step app backed
only by Firebase Auth + Realtime Database. That constraint shapes every option below.

## Options considered

### 1. Free forever, no monetization

No engineering follow-up. A legitimate outcome, not a failure to monetize — valid if
the goal is a portfolio/personal-tool showcase rather than recurring revenue.

### 2. Freemium

Core roadmap tracking stays free for everyone; a paid tier unlocks specific
higher-cost/higher-value features. Candidates already in this backlog: the Chrome
extension (#52), advanced analytics beyond what #8 shipped, roadmap
sharing/collaboration (#131) if it grows past read-only links, priority support.

Requires:
- A payment provider decision — Stripe is the standard choice and integrates with a
  static-hosted app via Stripe Checkout, but **webhooks need some server-side
  receiver**. This app has no backend compute today (the same constraint noted in
  #132's push-notification research), so a payment webhook cannot be received by a
  static site alone — at minimum a Cloud Function or equivalent becomes necessary.
- A plan/entitlement field in the user's data model — `users/{uid}/meta` is the
  natural place, following the existing shape.
- UI for upgrade/downgrade/billing management.

### 3. One-time purchase (e.g. a lifetime unlock)

Simpler to implement than recurring billing; less predictable revenue. Still needs
the payment provider decision, but not the recurring-billing/webhook complexity in
the same way — a successful one-time Stripe Checkout redirect can plausibly flip an
entitlement flag client-side plus a minimal Cloud Function verification step, still
requiring *some* backend, but far less than recurring billing.

### 4. Subscription

The standard SaaS model. Requires the most engineering (recurring billing,
dunning/failed-payment handling, plan upgrade/downgrade, proration) and the most
product commitment (ongoing feature delivery to justify recurring charges). Same
webhook/backend requirement as freemium, plus the added surface of recurring-billing
edge cases.

## Recommendation

Don't default to subscription just because it's the common SaaS pattern. Ascent has
zero backend today and has already chosen *not* to take one on for a lower-stakes
feature (Google Drive sign-in, #5/#71 — "not worth the ongoing cost right now"). Any
paid tier that requires webhook handling (freemium or subscription) is a materially
bigger infrastructure commitment than anything else currently in this backlog, and
should be weighed against that history before being chosen.

If and when real user demand or a concrete business goal makes monetization worth
pursuing, **one-time purchase** is the model that best fits Ascent's current
architecture: it needs a payment provider decision but avoids recurring-billing
complexity, and its backend footprint (a single verification step) is the smallest
addition consistent with "no ongoing backend cost" that isn't free-forever itself.
Free-forever remains a fully legitimate outcome if the goal stays a portfolio/personal
tool rather than revenue.

## Out of scope

- Implementing any payment integration, entitlement checks, or billing UI — deferred
  entirely to whichever future issue gets filed once a model is chosen.
- Specific pricing amounts/tiers — a business decision requiring market context this
  document can't provide.

## Milestone

Step 8 — Launch (Phase 4), same "parked here as a known gap, revisit post-launch
based on real user demand" framing #126 used for this item.
