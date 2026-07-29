# Ascent design system — binding rules (v3, synced to developer portfolio)

> Loads whenever `app.css`, `theme.js`, `themeBootstrap.js`, `index.html`, or any page/component is touched — same trigger as `.claude/rules/ui-styling.md`, which this file takes precedence over for exact color/type/radius/shadow values (issue #416).
> Every UI change — human or AI-authored, any issue, any PR — MUST follow these rules.
> If a requested feature conflicts with a rule here, raise it in the issue before coding; do not silently deviate.
> **This fully supersedes v2 "Modernist"** (`#289`/`#297`–`#301`/`#309`) — v2's flat/zero-radius/no-gradient/no-glow/single-red-accent system is retired wholesale, not kept as a fallback or a second selectable theme. See `docs/adr/ADR-013-v3-terminal-redesign.md` for the pivot rationale.
> The v3 rollout is tracked in issue #416 and lands in phases (0–5), mirroring how #289 was phased — until a given phase's PR merges, some screens will still show v2 red/flat styling. That's expected mid-rollout, not a violation of this file. **Phase 0 (this spec) ships no visual change** — Phase 1 is the first phase that touches `app.css`.

## 0. Source of truth

Every token below is carried forward, value-for-value, from the developer's personal
portfolio (`https://adv-woad.vercel.app/`, source at
`personal_portfolio_website/app/globals.css`, `tailwind.config.ts`, `app/layout.tsx`,
`components/header.tsx`, `components/hero.tsx`, `components/section.tsx`) — not
eyeballed or approximated. Where Ascent has no build step and the portfolio relies on a
React-only dependency (Framer Motion) or a Tailwind utility class, this spec gives the
vanilla-CSS/vanilla-JS equivalent Phase 1–5 must implement instead. **Do not add
Tailwind, Framer Motion, or any bundler to this repo** — root `CLAUDE.md`'s "no build
step, no framework, no bundler" stack rule is unaffected by this redesign.

## 1. Identity

- Glassmorphic, translucent, ambient. Depth and motion carry the identity — the exact
  inverse of v2's flat/architectural approach.
- Three type families: **Sora** (display/headings), **Outfit** (body), **JetBrains
  Mono** (code/mono contexts). No Archivo, Inter, Space Grotesk, or Fraunces.
- One accent (a "hacker green") per theme, used generously: gradient headlines,
  gradient buttons, glow shadows, gradient progress fills — the opposite of v2's "accent
  is scarce" rule.
- Brand mark: the existing triangle glyph (`brand.js`) is kept as-is (no shape change
  requested), but every surface it sits on adopts v3 depth/color — see Phase 2 for the
  sidebar/topbar brand-mark treatment.

## 2. Color tokens (the only colors allowed)

Both themes' literal HSL triples, unchanged from the portfolio source. Store them as
HSL components (not pre-composed hex) so `hsl(var(--x) / <alpha>)` composition works the
same way it does in the portfolio's own CSS:

| Token | Light | Dark |
|---|---|---|
| `--color-bg` | `0 0% 100%` | `220 30% 4%` |
| `--color-text` | `220 20% 8%` | `0 0% 98%` |
| `--color-accent` | `146 88% 38%` | `145 92% 55%` |
| `--color-accent-muted` | `146 92% 30%` | `145 92% 45%` |
| `--color-accent-glow-alpha` | `0.28` | `0.38` |
| `--color-surface` | `0 0% 100%` | `220 20% 10%` |
| `--color-surface-elevated` | `210 20% 98%` | `220 18% 14%` |
| `--color-divider` | `220 12% 90%` | `220 12% 22%` |
| `--color-text-muted` | `220 10% 44%` | `220 12% 70%` |
| `--gradient-start` | `146 88% 38%` | `145 92% 55%` |
| `--gradient-end` | `160 80% 35%` | `165 80% 46%` |

Usage: `background: hsl(var(--color-accent))`, `border-color: hsl(var(--color-accent) /
0.4)`, etc. — always the HSL-components-plus-alpha pattern, never a hex literal.

**Text-safe accent variant (`--color-accent-ink`) — new in v3, not present in the
portfolio source.** The portfolio only ever renders accent as large-scale
headline/button/UI-chrome color, never as small paragraph text, so it never had to solve
for WCAG body-text contrast. Ascent does (settings copy, inline links, etc.), and
`--color-accent` measures **~2.8:1 on `--color-bg` in light mode** — well under the
4.5:1 body-text floor. Computed starting point for Phase 1 to verify with a real
contrast tool (do not trust this number blind): `--color-accent-ink: 146 92% 22%` in
light mode (~6.5:1 on white), `--color-accent` unchanged in dark mode (already ~13:1 on
`--color-bg`, no separate ink token needed there). **Any paragraph-size accent text must
use `--color-accent-ink`, not `--color-accent` directly, in light mode.** This is the
single highest-risk contrast pairing in this spec — see Phase 1's testing requirements.

Rules:
- **Never hard-code a hex or raw HSL triple** in component CSS — always
  `hsl(var(--color-*))`.
- Gradients are back and encouraged for headline text, primary buttons, progress fills,
  and section-heading underline bars (`.gradient-text`, `.btn-primary`,
  `.progress-fill`) — `linear-gradient(135deg, hsl(var(--gradient-start)), hsl(var(--gradient-end)))`.
  Nowhere else; don't add gradients to arbitrary surfaces just because they're allowed
  again.
- Semantic colors stay collapsed into the accent/neutral scheme — no new hues for
  danger/success/warning. Danger reuses the accent ramp (this is a "hacker green"
  identity end to end; there is no separate red-for-danger token). Priority mapping:
  P0 = accent tint background + `--color-accent-ink` text, P1 = lighter accent tint or
  outline, P2 = neutral tint (`--color-surface-elevated`).

## 3. Type scale

- Headings: **Sora** 600/700 (Sora ships 400–800; use 600 for section titles, 700 for
  hero/page titles), tight tracking (`-0.02em` to `-0.015em`), `line-height 1.1–1.15`.
  Hero up to 72px, page titles 32–48px, section titles 28–36px.
- Body: **Outfit** 400 (500/600 for emphasis), 15px / 1.6 (13–14px in dense lists).
- Kickers/eyebrows: 11–12px, uppercase, `letter-spacing 0.2em`, weight 600, accent color,
  paired with a small glowing accent dot (`.eyebrow-dot` is **un-retired** — the
  portfolio's hero kicker (`"Full Stack Developer"`) uses exactly this pattern: a
  `h-1.5 w-1.5` accent dot with a glow box-shadow next to the label).
- Mono: **JetBrains Mono** for any code/technical-value context (topic resource URLs
  shown as text, JSON in the AI-import modal, etc.) — a new usage v2 never had, since v2
  had no mono family at all.
- Google Fonts `<link>` in `index.html`: extend the existing Archivo `<link>` tag with
  Sora, Outfit, and JetBrains Mono weights actually used (400/500/600/700 for Sora and
  Outfit, 400/500 for JetBrains Mono) rather than a blanket all-weights request — same
  mechanism already in place, CSP already allowlists
  `fonts.googleapis.com`/`fonts.gstatic.com`, no CSP change needed. Archivo is removed
  once every surface using it is migrated (end of Phase 5, not before — mid-rollout
  screens still need it).

## 4. Structure — radius, depth, and grid

- **Three-step radius scale — the exact opposite of v2's "radius 0 everywhere."**
  - `--radius-sm: 0.5rem` (8px) — small controls, checkboxes.
  - `--radius-md: 0.75rem` (12px) — chips, inputs, mobile menu button.
  - `--radius-lg: 1rem` (16px) — cards, buttons, the nav pill, modals.
- **Glass surfaces.** `.card` and any elevated panel: `background: hsl(var(--color-surface) / 0.85)`,
  `backdrop-filter: blur(12px)` (`blur-md`), 1px border at `hsl(var(--color-divider) / 0.6)`,
  plus a **hairline gradient border** using the mask-composite technique (`::before` with
  `padding: 1px`, gradient background, `mask-composite: exclude`) — carried forward
  verbatim from the portfolio's `.card::before`. Nav pill and header-on-scroll use a
  stronger `backdrop-filter: blur(20px)` (`blur-xl`).
  - **`backdrop-filter` fallback is mandatory, not optional** (see issue #416's Risks):
    `@supports not (backdrop-filter: blur(1px))` must set an opaque
    `background: hsl(var(--color-surface))` (no translucency) so older browsers get a
    solid card instead of unreadable text over whatever's behind it. Every phase that
    ships a new glass surface checks this against a browser without `backdrop-filter`
    support (or the DevTools feature-flag override) before merging.
- **Glow shadows**, accent-colored, replace v2's flat/no-glow rule:
  - `--shadow-glow: 0 20px 50px -30px hsl(var(--color-accent) / 0.6)`
  - `--shadow-glow-lg: 0 30px 80px -40px hsl(var(--color-accent) / 0.55)`
  - `.card`'s resting shadow: `0 16px 36px -26px hsl(var(--color-accent) / 0.25), inset 0 1px 0 hsl(var(--color-text) / 0.04)`.
  - Hover lift: `-translate-y-0.5` (buttons) / `-translate-y-1` (cards), paired with the
    `-lg` glow variant, `transition: all 300ms` easing (see §7).
- **Ambient background wash**, new in v3: the page background (`body`) carries three
  soft `radial-gradient` accent washes (10%/-10%, 90%/-10%, 50%/120% positions, 0.08–0.12
  alpha) over the base `--color-bg`, per the portfolio's own `body` rule. This replaces
  v2's flat single-color background on the landing/marketing surfaces first (Phase 3);
  app-shell surfaces (dashboard, settings) can stay closer to flat if the wash reads as
  too busy behind dense data — decide per-surface in Phase 2/4, default to "wash on
  marketing pages, flat-with-glass-cards on app pages."
- Grid: the "modular equal-width bordered cells" pattern from v2 (template picker,
  landing features) is replaced by a looser card grid with gaps and individual glass
  cards, not shared borders — cards are visually separate objects now, not cells in one
  ruled grid.
- Flush-left is **no longer a blanket rule.** The portfolio centers hero content on
  narrow viewports and uses a two-column asymmetric grid on wide ones
  (`lg:grid-cols-[1.05fr_0.95fr]`); section headings stay left-aligned within their
  container. Button labels remain centered (unchanged from v2 §4's exception, issue
  #338). Per-surface layout calls happen in each phase's own issue, not blanket-decided
  here.
- Elevation is no longer overlay-only — glass/glow depth applies to any card-like
  surface, not just dialogs/dropdowns/toasts.

## 5. Components

- **Buttons**: `.btn-primary` — gradient fill (`--gradient-start` → `--gradient-end`),
  black text in light mode / `--color-bg` text in dark mode (portfolio uses literal
  black `text-black` on the gradient in both themes since the gradient is always light
  green — verify this still passes contrast against the *lightest* stop of the gradient,
  not just the average, in Phase 1), `--radius-lg`, `--shadow-glow` resting →
  `--shadow-glow-lg` + lift on hover. `.btn-secondary` — glass surface
  (`hsl(var(--color-surface) / 0.7)`, `backdrop-filter: blur(8px)`), 1px divider border,
  hover border tints accent + text tints accent. `.btn-cta` stays merged into
  `.btn-primary` (unchanged from v2).
- **Checkboxes**: squares are replaced by **rounded squares** (`--radius-sm`). Unchecked
  = 1.5px ink border; done = accent fill + white check, same interaction as v2 otherwise;
  done row text = line-through at 50% opacity (unchanged).
- **Tags/chips**: `--radius-md`, glass fill (`hsl(var(--color-surface) / 0.7)`), 1px
  divider border, uppercase small-caps label — this is the portfolio's `.chip` verbatim.
  Priority ramp per §2.
- **Inputs**: glass fill, 1px divider border, `--radius-md`, accent caret, accent-glow
  ring on focus (`box-shadow: 0 0 0 3px hsl(var(--color-accent) / 0.15)` in addition to
  the focus outline in §6, not instead of it).
- **Segmented controls**: unchanged structurally from v2 (still used for priority
  filter, theme picker); selected segment becomes solid accent with `--radius-sm` inner
  corners instead of the old square-corner treatment.
- **Nav (sidebar/topbar)**: recreate the portfolio's floating glass nav pill —
  `--radius-lg`, `hsl(var(--color-surface) / 0.6)`, `backdrop-filter: blur-md`, 1px
  border. Active nav item: accent text + `hsl(var(--color-accent) / 0.1)` hover fill on
  each pill segment (portfolio has no left-bar active-state convention since it's a
  single-page site with anchor nav; Ascent's multi-page active-item indicator is a new
  per-phase call — Phase 2 decides square-corner vs. pill-active treatment, document the
  choice there).
- **Progress**: replaces v2's flat bar entirely. `.progress-track` — 3px height, flat
  neutral background. `.progress-fill` — gradient fill (`--gradient-start` →
  `--gradient-end`), `box-shadow: 0 0 18px hsl(var(--color-accent) / 0.7)` (the glow).
  The oversized-numeral treatment from v2 is kept alongside the gradient bar (numeral +
  bar together, not replaced).
- **Heatmap**: 5-step green ramp replacing v2's red ramp — needs new stops, not a
  hue-rotate (per issue #416). Starting point for Phase 4 to refine:
  `--color-surface-elevated` (light mode neutral) → progressively saturated greens →
  `--color-accent` at the hottest step. Exact stops are a Phase 4 decision; this spec
  only fixes the direction (green ramp, accent-anchored top step) and that hue-rotating
  the old red ramp is explicitly not acceptable (green and red don't share a rotation
  that preserves perceptual step spacing).
- **Charts**: single accent gradient line (not flat accent), dashed accent projection,
  0.5px gridlines — unchanged from v2 otherwise except the line itself may use the
  gradient stroke where the charting approach supports it; fall back to flat
  `--color-accent` stroke if Chart.js can't gradient a line stroke cleanly, don't fight
  the library for it.
- **Toasts**: kept as ink-filled bars (`--color-text` bg / `--color-bg` text) — the
  portfolio has no toast pattern to source from, and v2's toast treatment already reads
  fine against the new palette. No change here.
- **Icons**: **Lucide stays the vocabulary** (already zero-dependency inline SVG, the
  same mechanism the portfolio itself uses for its hand-written SVGs) — this is the
  "decide and document one consistent treatment" call issue #416 asked for. Per-icon
  fill/stroke split, matching the portfolio's own `social-section.tsx` convention
  exactly:
  - **Brand marks** (GitHub, LinkedIn, X, and any other third-party logo mark) —
    `fill="currentColor"`, no stroke. New icons needed for #414's profile page.
  - **Every other icon** (all 34 existing icons in `src/ui/components/icons.js`:
    dashboard, roadmaps, settings, signOut, menu, collapse, chevron, check, search,
    timer, reset, note, info, trash, close, plus, edit, sparkle, flame, trendingUp,
    progress, share, bell, link, sun, moon, warning, camera, upload, save, star, play,
    pause, overflow, lock) — `stroke="currentColor"`, `stroke-width="2"`,
    `fill="none"`, unchanged from v2's rule. Plus the new `mail`/envelope icon for #414,
    same line-icon treatment.
  - This is a **narrower rule than v2's blanket "stroke-2 always"** — v2 never had brand
    marks to render at all. Don't apply fill treatment to any icon outside the
    brand-mark set.

## 6. Interaction states

- Hover: filled controls lift (`-translate-y-0.5`) and step to the `-lg` glow variant;
  outlined/ghost controls tint 10% accent background + accent border, matching the
  portfolio's `hover:bg-accent/10` / `hover:border-accent/40` pattern (a step up from
  v2's flatter 7% ink tint).
- Focus: `:focus-visible { outline: 2px solid hsl(var(--color-accent)); outline-offset: 2px; }`
  — unchanged from v2, still never the browser default. Inputs additionally get the
  accent-glow ring from §5 on focus, in addition to (not instead of) this outline.
- `::selection`: 30% accent tint (unchanged). Disabled: 45% opacity (unchanged).
- Respect `prefers-reduced-motion` — unchanged, still mandatory; see §7 for exactly what
  gets disabled.

## 7. Motion

**Everything below must be rebuilt in vanilla CSS keyframes + a small
`IntersectionObserver`-based reveal helper (`src/ui/utils/scrollReveal.js`, new module) —
Framer Motion is a React-only dependency and cannot be added to this framework-less
codebase.** Every animation in this section must fully disable under
`prefers-reduced-motion: reduce` (opacity/transform set to final state immediately, no
transition) — same convention as v2, just with more surfaces now animating.

- **Transitions**: opacity/transform only, 120–300ms (v2 capped at 200ms; glass hover
  lifts read better at up to 300ms — `.card` transitions use `duration-300`, smaller
  controls stay in the 120–200ms range), `ease-out`. No bounce/spring easing anywhere —
  the portfolio's Framer Motion spring on the hero photo does not get recreated; use a
  standard `ease-out` fade+lift instead.
- **Scroll-reveal** (`whileInView` equivalent): `scrollReveal.js` exports an
  `observeReveal(el, { delay })` helper — `IntersectionObserver` with `threshold`
  tuned so the reveal fires once the element is ~80px into the viewport (matching the
  portfolio's `margin: "-80px"`), adds a `.is-revealed` class once, then unobserves
  (portfolio's `viewport={{ once: true }}` — never re-triggers on scroll-back). CSS:
  `opacity: 0; transform: translateY(28px);` at rest, `.is-revealed { opacity: 1;
  transform: translateY(0); transition: opacity 450ms, transform 450ms;
  transition-timing-function: cubic-bezier(0.25, 0.46, 0.45, 0.94); }` — the exact easing
  curve and duration from the portfolio's `Section` component. Under
  `prefers-reduced-motion`, `observeReveal` must add `.is-revealed` synchronously on call
  with no observer/transition at all (test this directly — see #416's testing
  requirements for the IntersectionObserver-mock unit test).
- **Staggered children** (hero content): plain CSS `animation-delay` steps (0.05s,
  0.15s, 0.25s, …, matching the portfolio's `staggerChildren: 0.1, delayChildren: 0.05`)
  on a fixed set of hero child elements — not a generic stagger utility, since vanilla
  CSS has no `staggerChildren` primitive. Fine as one-off inline delays on the handful of
  hero elements that need it.
- **Floating orbs**: `@keyframes float { 0%, 100% { transform: translateY(0); } 50% {
  transform: translateY(-8px); } }` (6s loop) and `floatSlow` (same shape, `-14px`, 10s
  loop) — decorative, `aria-hidden="true"`, blurred accent-tinted circles positioned
  absolutely behind hero content. Disabled entirely (not just paused) under
  `prefers-reduced-motion`.
- **Scroll-progress shimmer**: the topbar's scroll-progress fill gets an animated sheen
  overlay — `@keyframes shimmer { 0% { background-position: -200% 0; } 100% {
  background-position: 200% 0; } }`, 1.6s linear infinite, `mix-blend-mode: overlay`,
  `background: linear-gradient(90deg, transparent, hsl(var(--color-text) / 0.32), transparent)`
  at `200% 100%` size. Disabled under `prefers-reduced-motion` (the bar itself still
  shows scroll progress via `scaleX`, just without the sheen).
- **Fade-in/slide-up** (`fadeIn`/`slideUp` keyframes): kept as the base building blocks
  for any element that isn't part of the scroll-reveal or stagger systems above — same
  shape as v2's existing `fade-in` route-change convention, just now also available as a
  named slide-up variant (`opacity 0→1` + `translateY(20px)→0`).
- Completion celebration (confetti): **squares are replaced by soft-edged shapes** — v2
  specifically banned circles/gold in favor of squares; v3 allows small rounded-square or
  circle particles in the accent gradient ramp, matching the softer overall shape
  language. Respect `prefers-reduced-motion` (skip entirely) — unchanged requirement.
- Feature tour spotlight: cutout radius follows `--radius-lg` instead of v2's hard
  square cutout; 2px accent outline + ink scrim at 50% (unchanged); tooltip card becomes
  a glass surface with `--shadow-glow` instead of `--shadow-lg`.
- Skeletons/loading: flat pulse is kept (portfolio has no skeleton pattern to source
  from) — no shimmer gradient here specifically, to avoid visually colliding with the
  scroll-progress shimmer's similar effect elsewhere on-screen.

## 8. Long-tail surfaces

- Empty states (`emptyState.js`): kicker + Sora 700 heading + one Outfit body line + one
  primary action, inside a glass-card cell (`--radius-lg`, 1px divider border) rather
  than v2's flush-left 2px-ruled cell. No illustrations (unchanged).
- Avatars (`avatar.js`): `--radius-lg` rounded square (not v2's hard square), accent-fill
  or accent-gradient fill, `--color-bg`-colored Sora 700 initial.
- Notification badge: small glowing accent dot (matches the hero kicker's dot treatment
  in §3) — replaces v2's flat square dot.
- Share card / PDF print (`shareCard.js`, `printRoadmap.js`): same tokens on white; print
  stays black-ink friendly (glow/gradient don't print — fall back to flat accent for the
  triangle and priority tags in the print stylesheet specifically, same exception v2 had
  for print).
- PWA/meta: favicon + app icons keep the existing red triangle mark **only if** a brand
  mark color change isn't separately requested — this spec covers UI chrome, not the
  brand mark itself; if the accent shifts to green everywhere else, flag the
  favicon/OG-image/`theme-color` mismatch as a follow-up decision for the project owner
  before Phase 5 closes, don't silently recolor brand assets as a side effect of a UI
  phase. Icon URL cache-busting (`?v=N`) convention from v2 §8 is unchanged and still
  applies to any brand-asset file that does change.
- Emoji: never in UI copy or icons (unchanged from v2).

## 9. Review checklist (gate every UI PR on this)

- [ ] No new hex values outside the token sheet (HSL-components-plus-alpha only)
- [ ] Radius uses one of `--radius-sm/md/lg` — never `0` and never an arbitrary value
- [ ] Gradients/glows/blur limited to the surfaces listed in §2/§4 — not applied
      speculatively to unrelated elements
- [ ] `backdrop-filter` surfaces have a `@supports not (...)` solid-surface fallback
- [ ] Paragraph-size accent text in light mode uses `--color-accent-ink`, verified
      ≥4.5:1 with a real contrast tool (not eyeballed)
- [ ] Fonts limited to Sora/Outfit/JetBrains Mono per §3's weight list
- [ ] Icons: brand marks use `fill`, everything else uses `stroke-2` per §5
- [ ] `:focus-visible` accent outline present on new interactive elements
- [ ] Every new animation fully no-ops under `prefers-reduced-motion`
- [ ] Both themes checked (light `hsl(0 0% 100%)` / dark `hsl(220 30% 4%)` grounds)
- [ ] Lighthouse perf budget re-run manually (glow/blur/gradient are more
      paint/GPU-expensive than v2's flat surfaces — see issue #416's Risks)
