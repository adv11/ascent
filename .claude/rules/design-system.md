# Ascent design system — binding rules (v2 "Modernist")

> Loads whenever `app.css`, `theme.js`, `themeBootstrap.js`, `index.html`, or any page/component is touched — same trigger as `.claude/rules/ui-styling.md`, which this file takes precedence over for exact color/type/radius values (issue #289).
> Every UI change — human or AI-authored, any issue, any PR — MUST follow these rules.
> If a requested feature conflicts with a rule here, raise it in the issue before coding; do not silently deviate.
> The v2 rollout itself is tracked in issue #289 and lands in phases (0–5); until a given phase's PR merges, some screens will still show v1 gold/rose styling — that's expected mid-rollout, not a violation of this file.

## 1. Identity

- Flat, architectural, gridded. Alignment and rules do the organising — never decoration.
- One type family: **Archivo** (400 / 600 / 800). No Inter, Space Grotesk, or Fraunces.
- One accent per theme (see tokens). The UI is mostly ink-on-ground; accent is scarce.
- Brand mark: the triangle glyph, flat accent fill, wordmark `ASCENT` in Archivo 800 uppercase `+0.05em`.

## 2. Color tokens (the only colors allowed)

Light theme ("Signal Red") / dark theme ("Ink") — these replace the gold/rose palette in `src/styles/app.css`:

| Token | Light | Dark |
|---|---|---|
| `--color-bg` | `#F3F2F2` | `#141312` |
| `--color-surface` | `#EAE9E9` | `#1E1C1B` |
| `--color-surface-raised` | `#F8F4F4` | `#252221` |
| `--color-text` | `#201E1D` | `#F1EFED` |
| `--color-text-muted` | `color-mix(in srgb, var(--color-text) 60%, transparent)` | same |
| `--color-divider` | `color-mix(in srgb, #201E1D 40%, transparent)` | `color-mix(in srgb, #F1EFED 32%, transparent)` |
| `--color-accent` | `#EC3013` | `#FF563C` |
| `--color-accent-100` | `#FFF2EF` | `#38201A` |
| `--color-accent-200` | `#FFE0D9` | `#4D170E` |
| `--color-accent-600` (hover) | `#DD2B0F` | `#FF6D55` |
| `--color-accent-700` (accent as text) | `#AE1800` | `#FFC4B8` |
| `--color-accent-800` (text on accent tint) | `#7C1405` | `#FFC4B8` |
| `--color-neutral-200` | `#EAE7E7` | `#2B2827` |
| `--color-neutral-300` | `#D7D3D3` | `#3A3634` |

Rules:
- **Never hard-code a hex** in component CSS — always `var(--color-*)`.
- No gradients anywhere (`--gradient-alpenglow` is deleted). No glows, no `bg-grid-glow`.
- Semantic colors collapse into the mono scheme: danger reuses the accent ramp; success/warning use neutral ink + tags, not new hues.
- Priority mapping: P0 = accent tint (`accent-100` bg / `accent-800` text), P1 = lighter accent tint or outline, P2 = neutral tint.
- Accent-on-ground is ~3.9:1 — fine for icons, large numerals, UI chrome. **Paragraph-size accent text must use `--color-accent-700`.**
- The accent runs as a *field* (full red surface) in exactly one pattern: poster statements (landing closing banner). Nowhere else.

## 3. Type scale

- Headings: Archivo 800, `line-height 1.12`, `letter-spacing -0.015em`. Hero up to 72px, page titles 36–48px, section titles 17–20px.
- Body: Archivo 400, 15px / 1.55 (13–14px in dense lists).
- Kickers/eyebrows: 11px, uppercase, `letter-spacing 0.14em`, weight 600, accent color. The dot-eyebrow (`.eyebrow-dot`) is retired.
- Oversized ghost numerals (44px+, `neutral-300`) for step/stat ornamentation instead of icon circles.

## 4. Structure

- **Radius 0 everywhere.** `--radius-sm/md/lg: 0px`. No rounded buttons, cards, inputs, checkboxes, chips, avatars, or modals.
- **2px rules** (`--color-divider`) between major sections; **1px** between list rows / inside tables. Never soften a rule to a hairline or replace it with whitespace.
- Modular grids: equal-width bordered cells (template picker, landing features, stat rows). Let the grid show.
- **Flush-left everything**: headings, copy. Never center hero copy. **Button labels are the one deliberate exception** (issue #338, reversing this rule's original scope at the product owner's explicit request): every `.btn` variant centers its label (and any icon) via `justify-content: center` on the shared base rule — a wide button's text sits centered in the available width, not pinned to the left padding edge.
- Elevation only for overlays (dialog, dropdown, command palette, toasts) via `--shadow-sm/md/lg`. Flat surfaces otherwise.

## 5. Components

- Buttons: `.btn-primary` solid accent (ground-colored text; hover `accent-600`), `.btn-secondary` 1px divider border, `.btn-ghost` accent text. `.btn-cta` is merged into `.btn-primary`.
- Checkboxes: squares. Unchecked = 1.5px ink border; done = accent fill + white check; done row text = line-through at 50% opacity.
- Tags: squared, ramp tints (see priority mapping).
- Inputs: flat `--color-surface` fill, 1px divider border, accent caret, accent border on focus.
- Segmented controls for exclusive choices (priority filter, theme picker); selected segment = solid accent.
- Active nav item: 3px accent left bar + `accent-100` fill + accent text. Same pattern for the command palette's selected row.
- Progress: flat bars (6–8px) on `neutral-200`, accent fill. The progress ring is replaced by an oversized numeral + flat bar.
- Heatmap: hard-edged squares, 5 steps: `neutral-200` → `#FFC4B8` → `#FF9783` → `#FF563C` → `#DD2B0F` (dark theme starts from `neutral-200` dark).
- Charts: single accent line, dashed accent projection, 0.5px gridlines. No area fills, no gradients.
- Toasts: ink-filled bars (`--color-text` bg, `--color-bg` text). Feedback widget: solid accent square.
- Icons: **Lucide** only — inline SVG, `currentColor`, stroke-width 2. No emoji, no Phosphor Duotone (`decorativeIcon.js` migrates to Lucide equivalents).

## 6. Interaction states

- Hover: one ramp step past base (`accent-600` light / lighter step dark) for filled controls; 7% ink tint for outlined/ghost.
- Pressed: one further step (`accent-700`).
- Focus: `:focus-visible { outline: 2px solid var(--color-accent); outline-offset: 2px; }` — never the browser default.
- `::selection`: 30% accent tint. Disabled: 45% opacity.
- Respect `prefers-reduced-motion`; transitions ≤ 200ms, opacity/transform only.

## 7. Motion

- Transitions: opacity/transform only, 120–200ms, `ease-out`. No bounce, spring, or parallax.
- Route changes keep the existing `fade-in` convention (opacity only).
- Count-up numerals (`countUp.js`) stay — duration ≤ 600ms.
- Completion celebration: confetti particles become **squares** in the accent ramp colors (no circles, no gold); respect `prefers-reduced-motion` (skip entirely).
- Feature tour spotlight: squared cutout, 2px accent outline, ink scrim at 50%; tooltip card is a flat surface with `--shadow-lg`.
- Skeletons/loading: flat `neutral-200` blocks, no shimmer gradients — a simple opacity pulse.

## 8. Long-tail surfaces

- Empty states (`emptyState.js`): kicker + Archivo 800 heading + one body line + one primary action, flush-left inside a 2px-ruled cell. No illustrations.
- Avatars (`avatar.js`): square, ink fill, ground-colored Archivo 800 initial.
- Notification badge: square accent dot, no pill.
- Share card / PDF print (`shareCard.js`, `printRoadmap.js`): same tokens on white; brand triangle + wordmark header, 2px rules; print stays black-ink friendly (accent only for the triangle and priority tags).
- PWA/meta: favicon + app icons = red triangle on `#F3F2F2` (dark: on `#141312`); `<meta name="theme-color">` = `#EC3013`; og-image rebuilt in Archivo 800 with the red poster style.
- Emoji: never in UI copy or icons.

## 9. Review checklist (gate every UI PR on this)

- [ ] No new hex values outside the token sheet
- [ ] No border-radius > 0
- [ ] No gradients / glows / drop-shadows on flat surfaces
- [ ] No centered hero copy (button labels are centered by design — see §4)
- [ ] Section boundaries drawn with 2px rules, list rows with 1px
- [ ] Paragraph-size accent text uses `accent-700`
- [ ] Fonts limited to Archivo 400/600/800
- [ ] Icons are Lucide, `currentColor`, stroke-2
- [ ] `:focus-visible` accent outline present on new interactive elements
- [ ] Both themes checked (light `#F3F2F2` / dark `#141312` grounds)
