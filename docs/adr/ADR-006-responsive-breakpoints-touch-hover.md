# ADR-006: Responsive breakpoint scale and touch/hover detection strategy

**Date**: 2026-07-08
**Status**: Active
**Deciders**: solo project — adv01
**Issue**: #36

## Context

Ascent is moving toward v1.0 as a sellable product, expected to look and behave
correctly on any device a customer might use — phone, tablet, laptop, ultra-wide
desktop, mouse or touch. `app.css` had only two breakpoints (`max-width: 920px` and
`max-width: 640px`), both tuned by trial and error rather than against a real device
scale, and several real bugs traced back to the same root cause: using viewport width
as a proxy for something else entirely.

The most significant of these: `.check-actions` (the per-row Edit/resource-count
controls on the checklist) was hidden via `opacity: 0` and only revealed on `:hover`,
with the `max-width: 640px` query forcing it visible again. That query conflates two
unrelated properties of a device — how wide its viewport is, and whether it has a
reliable `:hover` at all. A touchscreen laptop, Surface, or iPad in landscape mode has
no reliable hover but a viewport comfortably above 640px, so its Edit controls stayed
invisible until an accidental `:focus-within` — the exact opposite of an accessibility
fix. The future enterprise UI/UX revamp (issue #6) and the accessibility audit (issue
#21) both depend on this being solved correctly now rather than retrofitted later (#6
is explicitly blocked on this issue; #21 defers its touch-target checks to this issue's
outcome).

Also in scope, all with the same "the current implementation used the wrong signal"
shape: `100vh` doesn't track a mobile browser's collapsing/expanding address bar;
sub-16px inputs trigger iOS Safari's auto-zoom; there was no `viewport-fit=cover` /
`env(safe-area-inset-*)` handling despite the app shipping an installable
(`"display": "standalone"`) PWA that has no browser chrome of its own to clear a
notch/Dynamic Island/gesture bar.

## Decisions

### 1. A six-tier breakpoint scale, replacing the ad-hoc 920/640 pair

| Tier | Query | Device class |
|---|---|---|
| Small phone | `max-width: 375px` | iPhone SE, older/small Android |
| Phone | `max-width: 480px` | most modern phones, portrait |
| Tablet portrait | `max-width: 768px` | iPad portrait |
| Tablet landscape / small laptop | `max-width: 1024px` | iPad landscape |
| _(base, untuned)_ | — | laptop – desktop |
| Large / ultra-wide | `min-width: 1600px` | ultra-wide monitors |

**Why these numbers and not others:** they map to real, common device viewport widths
rather than being picked to "look right" on one developer's monitor — the same failure
mode as the 920/640 pair they replace. Six tiers (five `max-width` + one `min-width`)
is enough to give phone, tablet, and ultra-wide each their own dedicated adjustment
point without fragmenting into a breakpoint-per-pixel scheme that would be expensive to
maintain. Implemented as `max-width` overrides layered on top of the existing
desktop-first base styles (consistent with every other rule already in `app.css`), not
rewritten mobile-first — a full mobile-first rewrite of the stylesheet was considered
and rejected as unnecessary churn unrelated to this issue's actual bugs.

**Why not CSS custom properties for the breakpoint values:** `env()`/media query
conditions cannot reference custom properties in any browser Ascent supports (no
build step means no preprocessor to inline them either) — the scale is documented once,
in the CSS comment block directly above the `@media` rules in `app.css`, and mirrored in
`CLAUDE.md`/`AGENTS.md`.

### 2. Touch/hover capability is detected with `(hover: …)` / `(pointer: …)`, never viewport width

`.check-actions` now reveals via:

```css
@media (hover: none), (pointer: coarse) {
  .check-actions { opacity: 1; }
}
```

instead of a `max-width` query. Touch target sizing (`.btn-icon`, `.btn-sm`,
`.filter-chip`, `.check-item` raised to a ~44×44px minimum, per WCAG 2.5.5 and Apple
HIG / Material Design guidance) is gated the same way, under `@media (pointer: coarse)`.

**Why this is a hard rule, not just this issue's fix:** viewport width and input
capability are orthogonal properties of a device. A width-based proxy is wrong in both
directions — it misses a touch-capable device at a desktop-sized viewport (the bug
above), and it also wrongly assumes every *narrow* window is touch-only, which
penalizes a mouse user who's simply resized their browser to a narrow width. The
`(hover)`/`(pointer)` media features exist specifically to answer "can this input
device hover" and "how precise is it" — there is no correctness reason left to keep
inferring either from `max-width`, so any future hover-reveal or touch-sizing decision
must use these features, not a width query.

### 3. `100vh` is always paired with a `100dvh` override, never replaced outright

```css
.app-shell { min-height: 100vh; min-height: 100dvh; }
```

**Why keep the `100vh` line at all:** browsers without `dvh` support ignore the second
declaration and fall back to the first — this is a progressive enhancement, not a
replacement, and removing the fallback would break older browsers for no benefit.

### 4. iOS input auto-zoom fix is scoped to a width tier, not a pointer/hover feature

Unlike items 2 and 3, the 16px-minimum-font-size fix for focusable fields *is* scoped by
width (`max-width: 1024px`), not by a `(hover)`/`(pointer)` feature:

```css
@media (max-width: 1024px) {
  .field-input, .field-input.compact, .search-input, .import-paste-area { font-size: 16px; }
}
```

**Why width here and not a media feature:** there is no CSS media feature for "is this
WebKit's iOS Safari text-zoom behavior" — the auto-zoom is a specific quirk of one
rendering engine on one OS, not a general property of touch or coarse-pointer
input (desktop Chrome/Safari never do this regardless of pointer type). `max-width:
1024px` comfortably covers phones and tablets in either orientation — the two device
classes that actually run iOS/Android mobile Safari/Chrome — without touching the
denser `.field-input.compact` styling relied on elsewhere in the desktop UI.

### 5. Safe-area insets via `viewport-fit=cover`, applied only to edge-touching fixed/full-viewport chrome

`index.html`'s viewport meta gained `viewport-fit=cover` (required for
`env(safe-area-inset-*)` to resolve to anything nonzero); `.dashboard-header`,
`.auth-page`, `.onboarding-page` pad their top/left/right with
`max(<existing padding>, env(safe-area-inset-*))`, and the genuinely `position: fixed`
elements that touch a viewport edge (`.item-panel`, `.save-badge`, `.toast-stack`) add
`env(safe-area-inset-*)` directly to their offsets.

**Why this matters for this specific app:** `public/manifest.json` already declares
`"display": "standalone"` — an installed PWA runs with no browser chrome, so there is no
one else to keep content clear of a notch, Dynamic Island, or gesture bar. This was
already a real (if latent) gap before this issue, not a new requirement introduced by
it.

## Options considered and rejected

| Option | Why not chosen |
|---|---|
| Full mobile-first rewrite of `app.css` | Would fix nothing this issue's bugs don't already cover, at the cost of touching every rule in the stylesheet — pure churn |
| A JS-based device/touch detection helper (e.g. `ontouchstart` sniffing) feeding a class onto `<html>` | CSS media features (`hover`, `pointer`) already answer this correctly and update live if input capability changes (e.g. a 2-in-1 laptop switching between keyboard and tablet mode) — a JS sniff would need to do the same and is strictly more code for the same answer |
| Applying the iOS 16px fix unconditionally (all viewports) | Would visually bloat the intentionally dense `.compact` fields on desktop, where the zoom bug can't occur — rejected in favor of scoping to the phone/tablet width tier |

## Consequences

- Any future hover-reveal control or touch-target rule must use `(hover)`/`(pointer)`
  media features, never `max-width`, per the convention now documented in
  `CLAUDE.md`/`AGENTS.md`.
- The breakpoint scale is a foundational, hard-to-reverse decision the future
  enterprise UI/UX revamp (issue #6) builds on top of, rather than re-solving.
- No automated check enforces "no new width-based hover/touch detection" — this relies
  on the documented convention and code review catching a regression, the same as any
  other CLAUDE.md convention in this project.
