# ADR-013: v3 visual redesign — sync to developer portfolio, retiring v2 "Modernist"

**Date**: 2026-07-29
**Status**: Active
**Deciders**: solo project — adv01
**Issue**: #416 (master tracking issue), #417 (Phase 0)

## Context

Ascent is moving from a personal tool toward a sellable product (root `CLAUDE.md`), and
the product owner also maintains a personal developer portfolio
(`https://adv-woad.vercel.app/`) that will present alongside it — job applications, a
resume link, a "built by" credit, and eventually #414's in-app profile page all put the
two side by side. Right now they look like two unrelated products: the portfolio is a
glassmorphic, green-accented, rounded, motion-heavy site (Next.js + Tailwind + Framer
Motion); Ascent is `#289`'s "Modernist" system — flat, zero-radius, red-accented, motion
minimal. The mismatch reads as unpolished for a product the owner is personally
vouching for.

This is the **second full redesign** in the repo's history. `#6` was the original
UI/UX rebuild; `#289` ("v2 Modernist") replaced that with the current flat/red/
zero-radius system across a 6-phase rollout (`#297`–`#301`) plus a dedicated compliance
sweep (`#309`). Both were deliberate, reviewed pieces of work — this ADR is not
correcting a mistake in either, it's a scope pivot driven by a new external constraint
(the portfolio now exists and needs to visually agree with the product).

## Options considered

Confirmed directly with the product owner via 3 clarifying questions before filing
`#416` (see that issue's "Decisions confirmed" section):

| Option | Reason not chosen |
|---|---|
| Colors-only swap (keep v2's flat/zero-radius structure, just repaint red→green) | Would leave Ascent visually flat while the portfolio is glassmorphic — the mismatch that motivated this ADR would only partially close. Explicitly rejected in favor of full depth adoption. |
| Coexisting theme (v2 "Modernist" and v3 both selectable) | Doubles the design-system surface area to maintain indefinitely for a solo-maintained product; the portfolio-sync goal is about having *one* consistent identity, not optionality. |
| Full glassmorphic adoption, framework-parity via adding Tailwind/Framer Motion to Ascent | Ascent's stack rule (root `CLAUDE.md`) is deliberately build-step-free; adding a bundler and a React-only animation library to match the portfolio's implementation, rather than just its visual output, would be a stack change with much larger blast radius than a redesign needs. |

## Decision

**Adopt the portfolio's full visual identity in Ascent — color, radius, depth, gradient,
type, icons, and motion — recreated in vanilla CSS/JS, retiring v2 "Modernist"
wholesale.** Concretely:

- **Color**: the portfolio's literal HSL token values (light: white ground, `hsl(146 88%
  38%)` "hacker green" accent; dark: near-black ground, `hsl(145 92% 55%)` accent) replace
  v2's `#F3F2F2`/`#EC3013` red palette. See `.claude/rules/design-system.md` §2 for the
  full token table, including a new `--color-accent-ink` text-safe variant the portfolio
  itself never needed (it never renders accent as body text) but Ascent does.
- **Shape**: a 3-step radius scale (`0.5rem`/`0.75rem`/`1rem`) replaces v2's "radius 0
  everywhere" rule — a direct reversal, not a middle ground.
- **Depth**: glass surfaces (`backdrop-filter` blur, translucent fills, hairline
  gradient borders) and accent-glow shadows replace v2's flat-surfaces-only rule, with a
  mandatory `@supports not (backdrop-filter: ...)` solid fallback for older browsers.
- **Type**: Sora (display) / Outfit (body) / JetBrains Mono (code) replace the single
  Archivo family, loaded the same way Archivo already is — an extended Google Fonts
  `<link>` in `index.html`, no bundler needed.
- **Icons**: Lucide stays the icon vocabulary (already the mechanism the portfolio
  itself uses — inline SVG), but adopts a fill-vs-stroke split matching the portfolio's
  own convention: brand marks (GitHub/LinkedIn/X) use `fill`, every other icon keeps
  v2's `stroke-2` rule.
- **Motion**: floating background orbs, an animated scroll-progress shimmer, staggered
  hero fade-ins, and `IntersectionObserver`-driven scroll-reveal replace v2's minimal
  opacity/transform-only transitions — all rebuilt in vanilla CSS keyframes + a new
  `src/ui/utils/scrollReveal.js` helper, since Framer Motion (the portfolio's actual
  implementation) is a React-only dependency this repo cannot add. `prefers-reduced-motion`
  fully disables every new animation, same non-negotiable convention v2 already had.

Full token/component/motion spec: `.claude/rules/design-system.md` (rewritten in place
by this same PR, not appended — v3 fully replaces v2's content there).

### Phased rollout

Same phased-rigor shape `#289` used, tracked at `#416`:

- **Phase 0** (this ADR + the design-system.md rewrite + icon inventory) — `#417`.
- **Phase 1** — tokens & primitives (`app.css` token layer, base `.btn`/`.tag`/`.input`/
  `.card`, WCAG re-verification for every new color pairing). Blocks Phases 2–5.
- **Phase 2** — app shell (sidebar, topbar, dashboard cards, Daily Todos rail).
- **Phase 3** — landing/auth/onboarding (highest motion-recreation surface;
  `scrollReveal.js` is built and tested here first).
- **Phase 4** — analytics/settings (heatmap green ramp, charts, settings ledger).
- **Phase 5** — overlays, icon fill/stroke pass, `prefers-reduced-motion` audit, full
  cross-device verification, and a `#309`-style compliance sweep before `#416` closes.

Each phase becomes its own issue + PR when that phase's work starts.

## Consequences

- **Positive**: the product and the personal brand presenting it read as one coherent
  thing — the goal that motivated this ADR.
- **Positive**: the icon fill/stroke ambiguity the portfolio itself never had to resolve
  (Ascent has 34 existing Lucide icons, the portfolio has 4 hand-written ones) is decided
  and documented once, in `design-system.md` §5, instead of being improvised per icon as
  #414's profile page and future work touch new brand marks.
- **Negative**: this retires substantial recent, deliberate work — `#289`'s 6 phases and
  `#309`'s compliance sweep are superseded, not kept as a fallback. Called out explicitly
  in every phase's PR description so it reads as an intentional supersession, not an
  oversight.
- **Negative**: glass/blur/glow/gradient surfaces are more paint/GPU-expensive than v2's
  flat design. The manual Lighthouse perf-budget check (`lighthouserc.json`, removed
  from CI in `#231` for flakiness) must be re-run at the end of every phase, not just
  once at the end of the rollout — flagged as the single most likely thing yet to
  regress that budget.
- **Negative**: contrast risk is real and specific, not generic. `--color-accent` fails
  WCAG AA for body text on the light-mode background (~2.8:1, computed in
  `design-system.md` §2) — the portfolio never had to solve this because it never puts
  accent-colored text at paragraph size. Phase 1 must verify the new
  `--color-accent-ink` token (and every other new color pairing) with a real
  contrast-ratio tool before merging, not assume the portfolio's own choices already
  pass — a personal static site has a materially looser accessibility bar than a
  customer-facing product.
- **Neutral**: the brand mark (triangle glyph, `brand.js`) and its derived assets
  (favicon, OG image, `theme-color`) are explicitly out of this ADR's scope — this is a
  UI-chrome redesign, not a logo change. If the accent shift to green makes the existing
  red brand mark look inconsistent, that's a separate decision for the project owner to
  make explicitly before Phase 5 closes, not an automatic side effect of this pivot.
