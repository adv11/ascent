# ADR-012: In-app AI roadmap generation — a server-side proxy to a real LLM API

**Date**: 2026-07-23
**Status**: Proposed
**Deciders**: solo project — adv01 (this ADR does not itself decide the provider/platform — see "Decision" below)
**Issue**: #330

## Context

Today, "accurate roadmap generation" is entirely delegated to whatever external AI chat
tool (ChatGPT, Claude, Gemini, Copilot, etc.) the user happens to use: they copy a
prompt out of `importRoadmapModal.js` (built by `src/data/importPrompt.js`), paste it
into that external tool by hand, then paste the tool's raw JSON response back into
Ascent, where `validateImportPayload()`/`adaptImportToRoadmap()`
(`src/core/roadmap/importValidator.js`/`schemaAdapter.js`) validate and adapt it into a
real roadmap.

This has real, structural costs that no amount of client-side validator hardening can
close, because Ascent has zero influence over what actually generates the content:

- **Accuracy**: Ascent can only validate what comes back, after the fact — it cannot
  enforce the schema at generation time. Every documented AI-import failure mode
  (`.claude/rules/roadmap-store.md`'s AI-import section: corrupted paste text, oversized
  titles, casing quirks, a missing `https://` scheme, ChatGPT-web-UI-specific copy
  corruption, placeholder/refusal content, duplicate topics) exists *because* the
  roundtrip goes through an external, unmanaged UI a human has to operate correctly by
  hand. A server-side call to a model API returns structured output directly, with no
  copy/paste/rendering step in between to corrupt it.
- **Security**: nothing about the current flow lets Ascent apply content moderation,
  cost control, or abuse prevention — generation happens entirely outside the app, with
  no server-side enforcement point at all.
- **Usability**: the current flow requires leaving the app, using a separate AI product
  (possibly requiring its own account/subscription), and manually copying text back and
  forth across up to six steps. Real friction for non-technical users without an
  existing ChatGPT/Claude account.

This app is static-hosted (Firebase Hosting) with **no server compute today** beyond
Firebase Auth + Realtime Database security rules (root `CLAUDE.md`'s Stack section).
Adding this feature would be this app's **first-ever server-compute dependency** and its
**first feature that spends real money per user action** — a genuine architecture
addition, not a small UI change.

Per issue #330's own body: *"This issue should likely be split into implementation
sub-issues (backend function + client wiring + rate-limit/cost-control + docs) once
someone scopes the actual chosen provider/platform — the analysis above is meant to
ground that scoping, not replace it,"* and *"should be scoped/estimated (provider
choice, cost budget, Cloud Functions setup) before implementation starts — recommend
treating this as a design discussion first, not a straight-to-code pickup."* This ADR is
that grounding document, not an implementation green light.

## Options considered

| Option | Notes |
|---|---|
| 1. Firebase Cloud Functions (2nd gen, callable or HTTPS function) | Natural first choice — same Firebase project, same Auth context (`context.auth.uid` available for free, no separate token verification step), same console for logs/monitoring as everything else this app already uses. Requires the **Blaze (pay-as-you-go) plan** — Cloud Functions are unavailable on the free Spark plan this project currently targets (already noted as the reason ADR-005 rejected a Cloud Function TTL sweep). Cold starts and per-invocation billing are both real, non-zero costs on top of the LLM API cost itself. |
| 2. Cloudflare Workers (+ a KV or Durable Object for rate-limit counters) | Genuinely cheaper at low volume (generous free tier, no cold-start billing model the way GCP has), simpler to reason about as a single small HTTP handler. Downside: a **second cloud provider/account/billing relationship** alongside Firebase, no shared Auth context — the worker would need to verify a Firebase ID token itself (`firebase-admin`'s token verification, or a lighter JWT check) rather than getting `context.auth` for free, and rate-limit state would live outside the Realtime Database the rest of the app already uses for per-uid data. |
| 3. Any other serverless platform (Vercel/Netlify Functions, AWS Lambda, a self-hosted endpoint) | Not seriously explored — no existing project relationship with any of these, and none offers an obviously better cost/complexity tradeoff than options 1–2 for a single-endpoint proxy. Listed for completeness only. |
| 4. Do nothing; keep the manual copy/paste flow as the only path | Zero cost, zero new architecture, but leaves every accuracy/usability gap in "Context" above unaddressed indefinitely. |

## Decision

**Not yet made — this ADR is Proposed, not Accepted.** Recording it here (rather than
waiting for a fully scoped implementation issue) is itself the decision issue #330 asked
for: give the repo owner and whoever eventually implements this a running start on the
tradeoffs, without committing the project to a specific provider, a Blaze-plan billing
relationship, or a second cloud account before a human has actually signed off on one.

If forced to a recommendation today: **Option 1 (Firebase Cloud Functions)** is the
better starting point *if and when* the project is willing to move off the free Spark
plan, purely because it reuses the existing Auth context and keeps rate-limit counters
in the same Realtime Database every other per-uid feature already writes to, rather than
standing up a second stateful backend. **Option 2 (Cloudflare Workers)** remains worth a
second look specifically if Blaze-plan billing (even at near-zero Cloud Functions
invocation volume) is judged not worth taking on just for this one endpoint — it is
cheaper and architecturally simpler, at the cost of a second provider relationship and
losing the free `context.auth` integration.

Regardless of which platform is eventually chosen, any real implementation must satisfy
every requirement below — these come directly from issue #330's body, not new scope
introduced by this ADR:

- **The LLM API key never reaches the client.** A key shipped in client JS is trivially
  extractable and would let anyone run up this project's LLM bill. This is the single
  hard security requirement of the whole feature.
- **Reuse, don't reinvent, validation.** The function's response must be run through the
  *exact same* `validateImportPayload()`/`adaptImportToRoadmap()` pair already used for
  the manual-paste path — either by porting those pure, dependency-free modules to run
  server-side too, or by validating client-side after the response comes back, before
  ever calling `createCustomRoadmap()`. The model's output is never treated as
  pre-validated just because it came from Ascent's own backend.
- **Server-side rate limiting and cost control**, not just client-side good faith.
  Unlike `feedbackRateLimit.js`'s deliberately client-only limiting (documented in that
  file as insufficient against a determined abuser), an endpoint that spends real money
  per call needs an actual enforcement point — e.g. a per-uid request cap checked inside
  the function itself, before ever calling the LLM API — because this is the first
  Ascent surface where a client request directly costs the project money per call.
- **Prompt-injection awareness.** The `topic`/customization fields remain user-controlled
  free text fed into a prompt server-side. The output must never be treated as
  trusted/safe regardless of where the call originated — it goes through the same
  validator as any pasted text, and its resources still go through `sanitizeResources()`'s
  `isHttpUrl()` gate.
- **The existing manual copy/paste flow must remain available**, not be replaced. A user
  who prefers their own AI subscription/model of choice, or one who's hit the new
  endpoint's rate limit, still needs a working path. In-app generation is an additional,
  faster option in the same modal, not a hard replacement.
- **Choosing the specific LLM provider/model, a moderation layer beyond schema
  validation, and a "regenerate a single phase" capability are explicitly out of scope**
  for the first implementation — real follow-on decisions that depend on this
  foundational piece existing first.

## Consequences

- No architecture or billing relationship is committed to by this ADR alone — the repo
  owner still needs to pick a provider/platform, a cost budget, and (if Option 1) accept
  moving the Firebase project onto the Blaze plan before any implementation issue can be
  picked up in good faith.
- Whoever scopes the implementation sub-issues (backend function + client wiring +
  rate-limit/cost-control + docs, per issue #330's own suggested split) can start from
  this ADR's requirement list instead of re-deriving it from the issue body each time.
- Until a decision is made and an implementation lands, the manual copy-prompt/paste-JSON
  flow (`importRoadmapModal.js`, `src/data/importPrompt.js`) remains the only roadmap
  generation path, unchanged by this ADR.
- If Option 1 is eventually chosen, `CLAUDE.md`'s Stack section ("no server compute
  beyond Firebase Auth + Realtime Database") will need updating alongside the
  implementation PR — deliberately not done here, since no server compute has actually
  been added yet.
- This ADR should be revisited (its Status field updated to Accepted, or superseded by a
  new ADR) once the repo owner actually picks a provider/platform and cost budget —
  it should not sit as "Proposed" indefinitely once real implementation work starts.
