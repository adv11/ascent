---
paths:
  - "src/styles/app.css"
  - "src/services/theme.js"
  - "src/services/themeBootstrap.js"
  - "index.html"
  - "src/ui/pages/**"
  - "src/ui/components/**"
---

# Theming, layout, and responsive/touch conventions

Relocated from `CLAUDE.md` (issue #86) with no content changes — see
`docs/adr/ADR-007-agent-memory-architecture.md`. These are the layout/CSS invariants that
exist because a specific real bug (flicker, clipped modal, oversized/undersized touch
target, iOS auto-zoom, stretched card) already happened once and got fixed with a rule,
not just a one-off patch.

**Theming**: The no-FOUC theme bootstrap lives in `src/services/themeBootstrap.js` —
a classic `<script src="...">` (no `defer`/`async`/`type="module"`) that reads
`localStorage` and sets `data-theme` on `<html>` synchronously before CSS loads. It was
extracted from an inline IIFE so the Content Security Policy (Issue #25) can omit
`'unsafe-inline'`. Do not convert it to a module or add `defer`/`async` — that breaks
the synchronous timing guarantee and causes a flash of the wrong theme. Because it runs
before `migrateLocalStorageKeys()` ever gets a chance to, it reads `ascent-theme` first
and falls back to the pre-rename `switchprep-theme` key so existing users don't get a
flash of the wrong theme on their first post-rename load. `src/services/theme.js`
owns `getTheme()` / `setTheme()` / `toggleTheme()` / `onThemeChange()`, persisted under
`KEYS.THEME` (`localStorageKeys.js`, currently `ascent-theme`); until the user makes an
explicit choice, it follows `prefers-color-scheme` live. All colors in `app.css` are CSS custom properties defined
once under `:root` (light) and re-defined under `:root[data-theme='dark']` — never hardcode
a color in a component rule; add or reuse a token instead so both themes stay correct.

**Card/grid layout — every card in a row must be equal height, with variable-length content, not the grid's stretch behavior, being the thing you design around.** A CSS grid's cells stretch equally by default (`align-items: stretch`), but a card only visually fills that cell if the card element itself is sized to `height: 100%` and stacks its content as a flex column — otherwise each card sizes to its own content and rows visibly mismatch the moment one card's text runs longer than its neighbors (this exact bug hit `.template-card` in the onboarding template picker, `src/ui/pages/onboarding.js` / `src/styles/app.css` — same-row cards rendered at different heights because the card had no `height: 100%` and used `display: grid` with content-sized rows instead of a flex column). The required pattern for any new card-grid component:
- Grid container: `display: grid; grid-template-columns: repeat(auto-fit, minmax(<min>, 1fr)); align-items: stretch;` so it reflows responsively across breakpoints without a bespoke media query per card count.
- Card element: `height: 100%; display: flex; flex-direction: column;` so it actually fills the stretched cell.
- Any footer/action element (badge, button, count) that should stay flush to the card's bottom regardless of how long the body text is: `margin-top: auto` on that element — never rely on equal source text length to keep footers visually aligned.
- Every element that should stay left-aligned inside the flex column needs an explicit `align-self: flex-start` (or `text-align: left` for text content) — a bare `<button>` left in a stretched flex column centers its text by default (the browser's UA stylesheet), which is an easy regression to introduce when converting a card from `display: grid` (where `justify-self: start` did this job) to `display: flex`.
Verify visually at at least three viewport widths (mobile ~390px, tablet ~820px, desktop ~1440px) before calling a card-grid change done — unit tests run in jsdom and cannot catch layout/height mismatches.

**The inverse failure mode: a single-column list grid over-stretching a lone row (issue #65).** The multi-column case above is about *rows not stretching enough* to match their siblings; a single-column list grid has the opposite default-`align`-value trap — *one row stretching too much* to fill unrelated leftover space. `.dashboard-content` (`src/ui/pages/dashboard.js` / `src/styles/app.css`) is a `display: grid` inside a `flex: 1` container with no explicit `align-content`; the default `normal` resolves to `stretch` for a grid, so with few rows on screen (a priority filter matching one phase, a small custom/imported roadmap, a narrow search match) the container's leftover height — viewport height minus one or two rows' natural content height — got distributed into those few row tracks, ballooning whichever `.phase-card`/`.phase-manage-row` sat in them to hundreds of pixels tall. With many rows this never showed up, since their combined natural height already exceeds the container and there's no leftover space to distribute — easy to miss in normal testing for exactly that reason. Any single-column (or otherwise row-stacked) list grid must set `align-content: start;` on the grid container so implicit row tracks size to their content instead of stretching to fill the container, regardless of how few rows are present.

**Responsive breakpoint scale — six tiers, not two (`src/styles/app.css`, issue #36).**
`≤375px` (small phone) / `≤480px` (phone) / `≤768px` (tablet portrait) / `≤1024px`
(tablet landscape / small laptop) / the untuned base styles for laptop–desktop /
`≥1600px` (large/ultra-wide desktop, a `min-width` tier) replaces the old ad-hoc
`920px`/`640px` pair — see the comment block above the `@media` rules at the bottom of
`app.css` for the full rationale. Add new breakpoint-specific rules to the existing tier
whose intent matches (don't invent a seventh number); if none fits, ask whether the new
rule is really about screen width at all, since touch/hover capability (below) is a
separate axis and should never be inferred from width.

**Touch vs. hover capability must be detected with `(hover: …)`/`(pointer: …)` media
features, never with a viewport-width media query as a stand-in (issue #36).** A
touchscreen laptop, Surface, or iPad in landscape has a desktop-sized viewport but no
reliable `:hover` — width-based detection gets this wrong in both directions (it also
wrongly assumes every *narrow* viewport is touch-only, which breaks a narrow desktop
browser window resized by a mouse user). `.check-actions` (the per-row Edit/resource
controls, hidden via `opacity: 0` and revealed on `:hover`/`:focus-within`) is forced
visible under `@media (hover: none), (pointer: coarse)` — not under a `max-width` query.
Any future hover-reveal control must follow the same pattern. Touch targets
(`.btn-icon`, `.btn-sm`, `.filter-chip`, `.check-item`) are raised to a ~44×44px minimum
(WCAG 2.5.5) under `@media (pointer: coarse)` for the same reason — a mouse user at a
narrow window shouldn't get oversized targets, and a touch user at a wide one should.
See `docs/adr/ADR-006-responsive-breakpoints-touch-hover.md`.

**No focusable field may render under 16px font-size on a phone/tablet viewport
(`≤1024px`, issue #36).** iOS Safari auto-zooms the whole page when a focused input's
computed font size is under 16px — jarring on every tap into `.field-input.compact` (the
dense rename/add-topic rows) or `.search-input`. Fixed with a `≤1024px` override
bumping `.field-input`/`.field-input.compact`/`.search-input`/`.import-paste-area` to
`font-size: 16px` — scoped to that width tier (not unconditional) specifically so the
denser desktop field styling is untouched, since desktop Safari/Chrome don't have this
zoom behavior. Any new focusable field class must be added to that override.

**`100vh` does not track a mobile browser's real visible height — use `100dvh` with a
`100vh` fallback.** Mobile Safari/Chrome collapse and expand their address bar, so a
fixed-height container sized with `100vh` alone can be cut off or jump when the browser
chrome resizes. Every full-height container (`.app-shell`, `.auth-page`,
`.onboarding-page`, `.dashboard`) declares `min-height: 100vh;` immediately followed by
`min-height: 100dvh;` — the second declaration wins in browsers that support `dvh` and
is silently ignored (falling back to the first) in ones that don't. Never remove the
`100vh` line when adding a `100dvh` one; they're a pair, not a replacement.

**Safe-area insets on fixed chrome (`viewport-fit=cover`, issue #36).** `index.html`'s
viewport meta includes `viewport-fit=cover` (required for `env(safe-area-inset-*)` to
resolve to anything nonzero) — this matters most because `public/manifest.json` sets
`"display": "standalone"`, so an installed PWA has no browser chrome to keep content
clear of a notch/Dynamic Island/gesture bar on its own. `.dashboard-header`, `.auth-page`,
`.onboarding-page` pad their top/left/right with `max(<base>, env(safe-area-inset-*))`;
`.item-panel` (fixed, full-height, right-edge) pads top/right/bottom directly; `.save-badge`
and `.toast-stack` (fixed near the bottom) add `env(safe-area-inset-bottom)` to their
`bottom` offset. Any new `position: fixed` element that touches an edge of the viewport
needs the same treatment.

**`.modal-overlay` uses `align-items: safe center`, not plain `center` — never change this back.** Plain `align-items: center` on an overflowing flex container (which `.modal-overlay` is, once any `.modal-card` content is taller than the viewport) clips both the top and bottom of the content equally and makes the clipped parts permanently unreachable by scrolling — a well-known flexbox+overflow trap, not a bug in any one modal's content. Found when `dailyTodoGuide.js`'s content grew long enough to push its "Got it" button below the fold on a short window, with no way to scroll to it (issue #56 follow-up). `align-items: safe center` centers when content fits and falls back to start-aligned (scrollable to both real ends) when it doesn't — combined with `overflow-y: auto` on `.modal-overlay` itself. This fixes every modal in the app that could ever grow tall (confirmDialog, item panel, guide modals), not just the one that surfaced it — if you ever add long-form modal content, you don't need a special case for it.

**Brand mark is a home link on every authenticated/onboarding-adjacent page.** Clicking the "Ascent" logo/wordmark (`createBrandMark()`) always navigates somewhere predictable instead of sitting inert — `<a class="brand" href="#/signin">` on the sign-in/sign-up pages (already existed), and `<a class="brand" href="#/onboarding">` on the dashboard and onboarding pages (`src/ui/pages/dashboard.js`, `src/ui/pages/onboarding.js`), since `/onboarding` is the "all roadmaps" picker — the closest thing this app has to a home/index page. `.brand`'s CSS (`text-decoration: none; color: inherit;`) was already anchor-ready; only the wrapping element needed to change from a plain `<div>` to an `<a>`. Never make the brand mark a dead `<div>` on a page that has a sensible "home" to link to.

**The active roadmap must always be visible, and a started template must never be shown as re-seedable.** Two coordinated pieces, both in response to real user confusion about "which roadmap am I on": (1) the dashboard header (`src/ui/pages/dashboard.js`, `.roadmap-header`) always renders a `.current-roadmap-badge` with the active template's icon and name, sourced from `getTemplate(store.getSnapshot().activeTemplateId)` (`src/data/templates/index.js`), plus a `.roadmap-meta-row` (item count · % complete · last synced, issue #6 Phase 4.4) — never let the dashboard render without the badge, even for the seeded/default template; (2) the "Switch your starter roadmap" picker (`src/ui/pages/onboarding.js`) marks the currently-active template's card with a `.template-card-current` highlight and a "Current" badge, and any other *started* (but not active) template with a `.template-card-started` / `.template-card-started-badge` "In progress" badge — both live inside `.template-card-footer` so neither disturbs the equal-height card layout above. `pickTemplate()` treats clicking the active card as a no-op navigation back to `/app`; clicking any other card (started or not) calls `store.switchRoadmap(id)` directly with **no confirmation dialog**, since issue #58 made every switch non-destructive — an already-started template loads its own saved progress, a not-yet-started one seeds fresh, and neither ever touches another template's data. If you add another place that lists templates or lets a user pick one, carry all three badge states and the no-dialog switch with it. The dashboard's old `.hero-panel` marketing tagline ("Learn it. Revise it. Track it.") was dropped in Phase 4 — a returning user's daily-driver view doesn't need the product re-pitched every visit; don't reintroduce hero copy on this page without a specific reason.

**Never set an inline `style` attribute anywhere in this app — index.html's CSP silently drops it.** `index.html`'s Content-Security-Policy `style-src` has no `unsafe-inline` (see `.claude/rules/auth-security.md`), which blocks not just `<style>` tags but every inline `style="…"` HTML attribute app-wide, including ones set from JS via `el()`'s `style:` key. This was hit for real in issue #6 Phase 4.2: a per-row `animation-delay` set via `style: \`animation-delay: …\`` was silently dropped by the browser — no error surfaced anywhere except a CSP violation in the console, and the intended stagger animation simply never played. The fix, and the required pattern for any future per-element numeric/computed style value (delays, offsets, anything that would otherwise be "just set an inline style"): a small **capped set of discrete CSS classes**, one per value bucket (e.g. `.entering-delay-0` through `.entering-delay-6`, `src/styles/app.css`, applied via `el()`'s `className`), never a `style:` attribute. Direct DOM property mutation (`el.style.width = '40%'`, e.g. `progressRing.js`'s SVG `stroke-dashoffset` via `setAttribute`, not `style`) is a different code path than the HTML `style` attribute and is unaffected — but don't rely on that distinction being obvious; when in doubt, add a class instead.

**Sticky section headers reuse `--topbar-h`, not a hardcoded pixel offset.** `.section-label`'s `position: sticky; top: var(--topbar-h);` (issue #6 Phase 4.2, phase-body section headers) needs to clear `.app-topbar`'s own sticky height exactly, or a stuck header sits half-hidden underneath it. `--topbar-h` (`:root`, `src/styles/app.css`) is the single source of truth both `.app-topbar`'s `min-height` and `.section-label`'s `top` read from — if you add another sticky element that needs to clear the topbar, reuse this token rather than re-measuring and hardcoding a second magic number that can drift out of sync with the first.

**`overflow: hidden` on an animating ancestor hijacks any `position: sticky` descendant's positioning context — a real, reported bug.** `animatePhaseBody()`'s FLIP height animation (`src/ui/pages/dashboard.js`, issue #6 Phase 7) sets `overflow: hidden` on `.phase-body` for the duration of the open/close animation, to clip content while its height animates. But per spec, `overflow: hidden` makes an element a scroll container — which makes it the sticky positioning context for any `position: sticky` descendant, i.e. `.section-label` above. For as long as the animation ran, every section label inside the animating phase recalculated its "stuck" position against the still-tiny/growing `.phase-body` instead of the page, which is what a live bug report described as one section's header visually overlapping the next section's rows for a fraction of a second before snapping to the correct layout. Fixed with `.phase-body-animating` (`app.css`) — added right before the animation starts, removed in its `onfinish` — that forces `.section-label { position: static }` for exactly that window. If you ever add another `position: sticky` element that can end up inside a container that temporarily gets `overflow: hidden` for an animation (this pattern, or any future one), it needs the same treatment: strip `sticky` for the animation's duration rather than letting it recompute against a transient container.

**Cross-device / responsive verification is required whenever this file (or `index.html`, or any page/component layout) changes** — see the `.claude/skills/verify-changes/` skill for the full viewport/touch/safe-area matrix before calling a layout change done.

**Never put `role="checkbox"`/`role="button"` on an element that also contains other genuinely focusable children — WCAG 4.1.2, issue #6 Phase 9.** Both roles are ARIA leaf widgets; a role="checkbox"/role="button" element with a nested focusable descendant (a real `<button>`, another `[tabindex]`) is a real, axe-flagged violation, not a style nit — screen readers expect these roles to have no focusable content. Found on `.check-item` (`dashboard.js`, contained the Edit/resource-count/add-todo buttons) and `.template-card` (`onboarding.js`, contained the hide/delete/info corner button). Fixed by moving the interactive role onto a **dedicated inner element** instead of the whole card/row: `.check-box` (not `.check-item`) carries `role="checkbox"`/`aria-checked`/its own `aria-label` now; a new `.template-card-pick` button (not `.template-card`) carries the "pick this template" click/keyboard handling, with the corner button as a true DOM sibling. The outer card/row keeps its full original visual styling and can still have a plain (non-ARIA) `onClick` for mouse convenience — that's fine, since a bare `<div onClick>` with no role isn't a widget axe checks for nested-focusable-content. If you add another card/row with both a "primary pick" action and a smaller secondary action (delete/hide/info/etc.), follow this same split rather than nesting a real button inside a `role="checkbox"`/`role="button"` element.

**Every ad hoc modal must use `attachFocusTrap()` (`src/ui/components/modal.js`), not its own Escape-only `keydown` handler.** `openModal()` already had a real Tab-cycling focus trap (Phase 3); every other hand-rolled `.modal-overlay`/`.modal-card` implementation (`confirmDialog.js`, `newRoadmapModal.js`, `importRoadmapModal.js`, `addToDailyTodoModal.js`, `buildYourOwnGuide.js`, `dailyTodoGuide.js`, `dashboard.js`'s account-deletion modal) used to copy-paste just the Escape half, so a keyboard user could Tab straight out of an open dialog into the page behind it (issue #6 Phase 9). `attachFocusTrap(containerEl, { onEscape })` is the one shared implementation now — pass the `.modal-card` (or equivalent inner container, not the overlay) as `containerEl`, and call the returned cleanup function from your own `close()`. Never re-add a local `onKey`/`keydown` listener that only handles Escape — that's exactly the bug this fixes.

**Any footer/row that stays visible in an icon-only sidebar rail must switch to a vertical stack, not shrink a horizontal row (issue #102).** `.app-sidebar-footer` (avatar identity + sign-out button) is a horizontal flex row sized for the full 240px sidebar — both icon-only rail states (the automatic 640–1023px tablet rail, 56px wide, and the manual desktop `.collapsed` rail, ≥1024px, 64px wide) are too narrow for that row once the email label is hidden, and the two controls visually overlapped in both instead of wrapping (found live, screenshot report). The fix is `flex-direction: column` on the footer plus shrinking the sign-out button to match the avatar's size, applied identically under `.app-sidebar.collapsed` and inside the `≤1023px` tablet media query — never try to solve this by shrinking/squeezing a horizontal row into a narrower one, since a `flex: 1` + `flex-shrink: 0` sibling pair just overlaps rather than compressing. The same media query gap also left 640–1023px with no way to reach the full sidebar at all (manual collapse toggle hidden there by design, mobile hamburger previously scoped to `<640px` only) — the hamburger now also appears at tablet width and opens the same `_toggleMobile()` overlay drawer the phone breakpoint uses. Any future icon-only rail state needs both halves of this: a vertical-stack fallback for anything in the footer, and a real way back to the expanded view.

**An `overflow` value that isn't `visible` on one axis silently clips the other axis too — and a lingering non-`none` `transform`/`filter` anywhere in an ancestor chain hijacks every `position: fixed` descendant on the page (both issue #102 follow-up).** Two related, easy-to-miss CSS traps found while fixing the sidebar dropdown above. (1) `.app-sidebar { overflow-y: auto; }` had no `overflow-x` declared — per the CSS overflow spec, a box with one axis set to something other than `visible` computes the *other*, unspecified axis to `auto` too, not `visible`. This silently clipped anything positioned to escape the sidebar's own narrow box (a `position: absolute`/`fixed` dropdown menu wider than the 56–64px icon rail), with no warning anywhere in the CSS that this was happening — if an element ever needs to intentionally overflow its container in one direction (a dropdown, a tooltip, a popover), check every scrollable ancestor for this, not just the nearest one. (2) `.fade-in`'s `animation: fade-in 420ms var(--ease-spring) both` kept the `to` keyframe's `transform: translateY(0)` applied forever via the `forwards` half of `both` — and *any* declared `transform` (even a visual no-op like `translateY(0)`), or `filter`/`perspective`/`contain: layout|paint|strict|content`/a transform-related `will-change`, establishes a new containing block for every `position: fixed` (and `absolute`) descendant, wherever it sits in the DOM. A fixed-position dropdown menu nested inside `.app-shell-2.dashboard.fade-in` was positioning itself relative to that div's full scrollable content height instead of the viewport, landing thousands of pixels off-screen. Only use `forwards`/`both` fill-mode when something genuinely needs to persist after the animation ends, and audit every element between a `position: fixed` node and the document root for a lingering transform/filter before trusting that "fixed" actually means "relative to the viewport." `position: fixed` elements whose exact screen offset depends on a trigger's live geometry (not a fixed corner of the viewport) must compute that offset from `getBoundingClientRect()` in JS (`dropdown.js`'s `positionMenu()`), the same way `tooltip.js` already does — CSS alone can't parametrize an arbitrary trigger position, and `.dropdown`'s own `position: relative` has no effect once its child is `fixed`.
