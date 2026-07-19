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
(`.btn-icon`, `.btn-sm`, `.filter-chip`, `.check-item`) are raised to a 46×46px minimum
(WCAG 2.5.5's ~44px floor plus 2px of rounding headroom, issue #233 — sizing exactly at
44px let sub-pixel/DPI layout rounding measure real elements fractionally under it,
e.g. `43.999996px`, flaking the CI touch-target assertion) under `@media (pointer:
coarse)` for the same reason — a mouse user at a narrow window shouldn't get oversized
targets, and a touch user at a wide one should. Never size a new touch target to exactly
44px for this reason; use 46px (or higher) so real-browser rounding can't push it back
under the WCAG floor. See `docs/adr/ADR-006-responsive-breakpoints-touch-hover.md`.

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

**Two `position: fixed` corner elements that can both be visible at once must not share
the same corner — a real, reported visual bug.** `.save-badge` and `.feedback-widget-trigger`
(the latter mounted once on `document.body` for the whole app session, never unmounted —
see `.claude/rules/roadmap-store.md`'s `feedbackWidget.js` note) were both fixed to
`bottom: ~20-24px; right: ~20-24px`, so whenever a save event fired, the feedback button
(higher z-index, always present) visually sat on top of — and partially hid — the save
badge underneath it. Fixed by stacking the save badge directly above the feedback trigger
(`.save-badge`'s `bottom` raised to clear the trigger's own bottom offset + rendered height
+ a gap) rather than moving it to the opposite corner, which isn't safe either: the
dashboard/progress/settings app-shell sidebar (`.app-sidebar`, `position: sticky` but still
occupying a full-height 240px column) would sit underneath a fixed bottom-left element on
every page that has it. Before adding a new fixed-position corner element (a toast, a
badge, a floating action button), check every other fixed corner element already on the
pages it can appear alongside — verify visually with both potentially visible at once,
not just each in isolation.

**`.modal-overlay` uses `align-items: safe center`, not plain `center` — never change this back.** Plain `align-items: center` on an overflowing flex container (which `.modal-overlay` is, once any `.modal-card` content is taller than the viewport) clips both the top and bottom of the content equally and makes the clipped parts permanently unreachable by scrolling — a well-known flexbox+overflow trap, not a bug in any one modal's content. Found when `dailyTodoGuide.js`'s content grew long enough to push its "Got it" button below the fold on a short window, with no way to scroll to it (issue #56 follow-up). `align-items: safe center` centers when content fits and falls back to start-aligned (scrollable to both real ends) when it doesn't — combined with `overflow-y: auto` on `.modal-overlay` itself. This fixes every modal in the app that could ever grow tall (confirmDialog, item panel, guide modals), not just the one that surfaced it — if you ever add long-form modal content, you don't need a special case for it.

**Brand mark is a home link on every authenticated/onboarding-adjacent page.** Clicking the "Ascent" logo/wordmark (`createBrandMark()`) always navigates somewhere predictable instead of sitting inert — `<a class="brand" href="#/signin">` on the sign-in/sign-up pages (already existed), and `<a class="brand" href="#/onboarding">` on the dashboard and onboarding pages (`src/ui/pages/dashboard.js`, `src/ui/pages/onboarding.js`), since `/onboarding` is the "all roadmaps" picker — the closest thing this app has to a home/index page. `.brand`'s CSS (`text-decoration: none; color: inherit;`) was already anchor-ready; only the wrapping element needed to change from a plain `<div>` to an `<a>`. Never make the brand mark a dead `<div>` on a page that has a sensible "home" to link to.

**The active roadmap must always be visible, and a started template must never be shown as re-seedable.** Two coordinated pieces, both in response to real user confusion about "which roadmap am I on": (1) the dashboard header (`src/ui/pages/dashboard.js`, `.roadmap-header`) always renders a `.current-roadmap-badge` with the active template's icon and name, sourced from `getTemplate(store.getSnapshot().activeTemplateId)` (`src/data/templates/index.js`), plus a `.roadmap-meta-row` (item count · % complete · last synced, issue #6 Phase 4.4) — never let the dashboard render without the badge, even for the seeded/default template; (2) the "Switch your starter roadmap" picker (`src/ui/pages/onboarding.js`) marks the currently-active template's card with a `.template-card-current` highlight and a "Current" badge, and any other *started* (but not active) template with a `.template-card-started` / `.template-card-started-badge` "In progress" badge — both live inside `.template-card-footer` so neither disturbs the equal-height card layout above. `pickTemplate()` treats clicking the active card as a no-op navigation back to `/app`; clicking any other card (started or not) calls `store.switchRoadmap(id)` directly with **no confirmation dialog**, since issue #58 made every switch non-destructive — an already-started template loads its own saved progress, a not-yet-started one seeds fresh, and neither ever touches another template's data. If you add another place that lists templates or lets a user pick one, carry all three badge states and the no-dialog switch with it. The dashboard's old `.hero-panel` marketing tagline ("Learn it. Revise it. Track it.") was dropped in Phase 4 — a returning user's daily-driver view doesn't need the product re-pitched every visit; don't reintroduce hero copy on this page without a specific reason.

**`onboarding.js` has no app-shell sidebar, so it must rebuild its own account affordance rather than silently doing without one.** Real feedback (screenshot): a user landing on `/onboarding` had no way to tell they're signed in, as whom, or reach Settings/backup/delete-account — every other page (`dashboard.js`/`settings.js`/`progress.js`) gets this "for free" from `createSidebar()`'s footer identity + `buildAccountMenu()` dropdown (`sidebar.js`), but this page is deliberately outside that shell (see `.claude/rules/roadmap-store.md`'s Daily Todos "Placement" note for why). The fix is a standalone top-right `createAvatar(user, 'sm')` trigger + `createDropdown(..., { align: 'end' })` in `onboarding.js` itself, next to the existing theme toggle/sign-out icon — rebuilding the exact same item list `buildAccountMenu()` provides (Settings, My reports, Share this roadmap…, Download/Export backup, Import backup…, Print roadmap…, Export to calendar, Delete account) rather than a subset, so account actions don't differ depending on which page a user happens to be on. `align: 'end'` (not the sidebar's `'start'`) since the trigger sits in a top-right corner, not a bottom-left footer. If `onboarding.js` is ever given a real app-shell sidebar, retire this standalone dropdown rather than keeping both.

**Never set an inline `style` attribute anywhere in this app — index.html's CSP silently drops it.** `index.html`'s Content-Security-Policy `style-src` has no `unsafe-inline` (see `.claude/rules/auth-security.md`), which blocks not just `<style>` tags but every inline `style="…"` HTML attribute app-wide, including ones set from JS via `el()`'s `style:` key. This was hit for real in issue #6 Phase 4.2: a per-row `animation-delay` set via `style: \`animation-delay: …\`` was silently dropped by the browser — no error surfaced anywhere except a CSP violation in the console, and the intended stagger animation simply never played. The fix, and the required pattern for any future per-element numeric/computed style value (delays, offsets, anything that would otherwise be "just set an inline style"): a small **capped set of discrete CSS classes**, one per value bucket (e.g. `.entering-delay-0` through `.entering-delay-6`, `src/styles/app.css`, applied via `el()`'s `className`), never a `style:` attribute. Direct DOM property mutation (`el.style.width = '40%'`, e.g. `progressRing.js`'s SVG `stroke-dashoffset` via `setAttribute`, not `style`) is a different code path than the HTML `style` attribute and is unaffected — but don't rely on that distinction being obvious; when in doubt, add a class instead.

**Sticky section headers reuse `--topbar-h`, not a hardcoded pixel offset.** `.section-label`'s `position: sticky; top: var(--topbar-h);` (issue #6 Phase 4.2, phase-body section headers) needs to clear `.app-topbar`'s own sticky height exactly, or a stuck header sits half-hidden underneath it. `--topbar-h` (`:root`, `src/styles/app.css`) is the single source of truth both `.app-topbar`'s `min-height` and `.section-label`'s `top` read from — if you add another sticky element that needs to clear the topbar, reuse this token rather than re-measuring and hardcoding a second magic number that can drift out of sync with the first.

**`overflow: hidden` on an animating ancestor hijacks any `position: sticky` descendant's positioning context — a real, reported bug.** `animatePhaseBody()`'s FLIP height animation (`src/ui/pages/dashboard.js`, issue #6 Phase 7) sets `overflow: hidden` on `.phase-body` for the duration of the open/close animation, to clip content while its height animates. But per spec, `overflow: hidden` makes an element a scroll container — which makes it the sticky positioning context for any `position: sticky` descendant, i.e. `.section-label` above. For as long as the animation ran, every section label inside the animating phase recalculated its "stuck" position against the still-tiny/growing `.phase-body` instead of the page, which is what a live bug report described as one section's header visually overlapping the next section's rows for a fraction of a second before snapping to the correct layout. Fixed with `.phase-body-animating` (`app.css`) — added right before the animation starts, removed in its `onfinish` — that forces `.section-label { position: static }` for exactly that window. If you ever add another `position: sticky` element that can end up inside a container that temporarily gets `overflow: hidden` for an animation (this pattern, or any future one), it needs the same treatment: strip `sticky` for the animation's duration rather than letting it recompute against a transient container.

**A fixed-overlay, self-removing CSS animation burst (issue #181).** `confetti.js`'s `triggerConfetti()` (phase/roadmap completion celebration) is the first "one-shot full-viewport effect" in this app — a distinct pattern from the existing entrance animations (`item-entering`, which animate elements already in the DOM) and from `animatePhaseBody()`'s FLIP height animation (which needs a measured pixel height, so it's JS-driven via `Element.animate()`). It's pure CSS `@keyframes` + the same discrete `*-delay-N` class bucketing `item-entering` established (never an inline `animation-delay`, see above), appended to `document.body` as a `position: fixed; inset: 0; pointer-events: none` overlay so it never blocks the underlying UI, and removes its own container node via `setTimeout` once the animation finishes — the caller does nothing to clean it up. Skips entirely under `prefers-reduced-motion: reduce` (checked once via `matchMedia` before appending anything, not just a CSS override) since there's no ongoing DOM presence worth leaving inert for a screen reader/reduced-motion user to trip over. Reuse this shape (fixed pointer-events-none overlay, self-removing timeout, upfront `matchMedia` reduced-motion check) for any future one-shot full-screen visual effect rather than the entrance-animation or FLIP patterns, which both assume the animated element is a persistent part of the layout.

**A two-column modal with a shared header/footer outside the grid (issue #100).** `importRoadmapModal.js`'s "Create your own roadmap" modal (`.import-modal-card`/`.import-modal-grid`) is the first modal in this app wide enough to need a genuine two-column split rather than one long scroll. Pattern, reusable for any future modal with two independently-scrollable halves: the grid itself (`grid-template-columns: minmax(0, 1fr)` below the tier, a real split at/above it) holds only the two columns, each with its own `overflow-y: auto` and a `max-height` — never `overflow-y: auto` on the whole `.modal-card`, which is what caused the single-column predecessor's disorientation (losing sight of one half while scrolling the other). Primary actions (Import/Cancel here) live in a `.modal-card`-level footer, a sibling of the grid, not inside either column, so they're always reachable without scrolling through either half first. Gated on a `min-width: 1025px` media query (just above the existing `≤1024px` tier's own upper edge, `.claude/rules/ui-styling.md`'s six-tier scale) — below it, the grid collapses to its single implicit column and the modal behaves exactly like every other stacked-column modal in the app.

**A "sticky-by-layout" block inside one column of the modal above, not `position: sticky` (issue #100 follow-up).** Real feedback on the two-column modal: on first open, the "Copy prompt" button sat below the fold of the build column's own scroll area, unreachable without scrolling past the customization filters first — genuinely hidden, not just visually deprioritized. The fix is **not** `position: sticky` on the copy button (which would need a scrolling ancestor with a defined height and adds its own stacking/z-index bookkeeping) — instead, `.import-column-build` is a flex column with a fixed `max-height`, containing a scrollable `.import-column-scroll` child (`flex: 1; min-height: 0; overflow-y: auto`) *and* a sibling `.import-copy-sticky` block that sits outside that scrolling child, in normal flow. Because the scroll area is `flex: 1` and the sticky-by-layout block is a normal sibling below it, the column's fixed height is shared between "however much space the copy block needs" and "whatever's left for scrolling" — the copy block is never inside the part that scrolls, so it's always rendered, with zero `position` tricks. Reusable pattern for any future "this one element must never scroll out of view, but I don't want to fight `position: sticky`'s containing-block rules" case: fixed-height flex column, `flex: 1; min-height: 0; overflow-y: auto` on the scrolling child, the must-stay-visible content as a plain sibling.

**A correctly-positioned portaled floating menu can still read as broken layout if it covers unrelated content with no visual cue marking it as an overlay — a real, reported bug.** `select.js`'s listbox and `dropdown.js`'s menu (both `position: fixed`, portaled to `document.body` — see the transformed-ancestor/scroll-tracking entries above) position themselves correctly relative to their trigger, but a menu tall enough to cover its own sibling controls or spill into unrelated content below a short card (the Daily Todos duration select, opened from a card near the top of the onboarding page, covering its own "Add" button and the roadmap-picker grid beneath) has nothing distinguishing it from a rendering glitch — it blends into the same dark background as the rest of the page. `.floating-scrim` (`app.css`) is a shared, dim, fixed full-viewport backdrop appended to `document.body` alongside the listbox/menu on open and removed on close (`.custom-select-scrim` at `z-index: 1009`, just below the listbox's `1010`; `.dropdown-scrim` at `z-index: 209`, just below the menu's `210`) — the same "this is a layer above the page" cue every modal's own overlay already provides. Never gets its own click handler: both components' existing click-outside-`wrap`-and-listbox/menu check already treats a click on the scrim as "outside," since the scrim is neither. Any future portaled floating element large enough to plausibly cover unrelated content should follow this same pattern rather than relying on `box-shadow`/`border` alone to read as a floating layer.

**Cross-device / responsive verification is required whenever this file (or `index.html`, or any page/component layout) changes** — see the `.claude/skills/verify-changes/` skill for the full viewport/touch/safe-area matrix before calling a layout change done.

**Never put `role="checkbox"`/`role="button"` on an element that also contains other genuinely focusable children — WCAG 4.1.2, issue #6 Phase 9.** Both roles are ARIA leaf widgets; a role="checkbox"/role="button" element with a nested focusable descendant (a real `<button>`, another `[tabindex]`) is a real, axe-flagged violation, not a style nit — screen readers expect these roles to have no focusable content. Found on `.check-item` (`dashboard.js`, contained the Edit/resource-count/add-todo buttons) and `.template-card` (`onboarding.js`, contained the hide/delete/info corner button). Fixed by moving the interactive role onto a **dedicated inner element** instead of the whole card/row: `.check-box` (not `.check-item`) carries `role="checkbox"`/`aria-checked`/its own `aria-label` now; a new `.template-card-pick` button (not `.template-card`) carries the "pick this template" click/keyboard handling, with the corner button as a true DOM sibling. The outer card/row keeps its full original visual styling and can still have a plain (non-ARIA) `onClick` for mouse convenience — that's fine, since a bare `<div onClick>` with no role isn't a widget axe checks for nested-focusable-content. If you add another card/row with both a "primary pick" action and a smaller secondary action (delete/hide/info/etc.), follow this same split rather than nesting a real button inside a `role="checkbox"`/`role="button"` element.

**Every ad hoc modal must use `attachFocusTrap()` (`src/ui/components/modal.js`), not its own Escape-only `keydown` handler.** `openModal()` already had a real Tab-cycling focus trap (Phase 3); every other hand-rolled `.modal-overlay`/`.modal-card` implementation (`confirmDialog.js`, `newRoadmapModal.js`, `importRoadmapModal.js`, `addToDailyTodoModal.js`, `buildYourOwnGuide.js`, `dailyTodoGuide.js`, `dashboard.js`'s account-deletion modal) used to copy-paste just the Escape half, so a keyboard user could Tab straight out of an open dialog into the page behind it (issue #6 Phase 9). `attachFocusTrap(containerEl, { onEscape })` is the one shared implementation now — pass the `.modal-card` (or equivalent inner container, not the overlay) as `containerEl`, and call the returned cleanup function from your own `close()`. Never re-add a local `onKey`/`keydown` listener that only handles Escape — that's exactly the bug this fixes.

**Any footer/row that stays visible in an icon-only sidebar rail must switch to a vertical stack, not shrink a horizontal row (issue #102).** `.app-sidebar-footer` (avatar identity + sign-out button) is a horizontal flex row sized for the full 240px sidebar — both icon-only rail states (the automatic 640–1023px tablet rail, 56px wide, and the manual desktop `.collapsed` rail, ≥1024px, 64px wide) are too narrow for that row once the email label is hidden, and the two controls visually overlapped in both instead of wrapping (found live, screenshot report). The fix is `flex-direction: column` on the footer plus shrinking the sign-out button to match the avatar's size, applied identically under `.app-sidebar.collapsed` and inside the `≤1023px` tablet media query — never try to solve this by shrinking/squeezing a horizontal row into a narrower one, since a `flex: 1` + `flex-shrink: 0` sibling pair just overlaps rather than compressing. The same media query gap also left 640–1023px with no way to reach the full sidebar at all (manual collapse toggle hidden there by design, mobile hamburger previously scoped to `<640px` only) — the hamburger now also appears at tablet width and opens the same `_toggleMobile()` overlay drawer the phone breakpoint uses. Any future icon-only rail state needs both halves of this: a vertical-stack fallback for anything in the footer, and a real way back to the expanded view.

**Icon system (issue #107) — `createIcon()` for functional/navigational chrome, emoji reserved for decorative/data-driven content, every icon wrapper sets an explicit size.** Found live: the sidebar's Settings gear (`⚙`, `.nav-item-icon`) rendered visibly undersized because `.nav-item-icon` was the one icon-wrapper class in `app.css` that never set `font-size` — it silently inherited `.nav-item`'s 13px `--text-sm` body text instead of a deliberate icon size. That specific bug, and the app-wide inconsistency it was a symptom of (real inline SVG in a few components each redefining its own `svgEl` helper, plain Unicode/emoji everywhere else, sized by ~10 independent one-off CSS wrapper classes with no shared scale), are fixed by three pieces:
- **`src/ui/utils/svg.js`** — `svgEl(tag, attrs)` (a thin `createElementNS` wrapper) and `svgIcon(shapes, { size })` (builds a 24x24-viewBox `<svg>` from shape descriptors, defaulting each shape to `currentColor` stroke / no fill / 1.8 stroke-width, per-shape overridable). The single shared helper `brand.js`, `landing.js`, `authMarketingPanel.js`, and `progressRing.js` all now import, replacing four independently copy-pasted versions.
- **`src/ui/components/icons.js`** — a curated named icon set (`dashboard`, `roadmaps`, `settings`, `signOut`, `menu`, `collapse`, `chevron`, `check`, `search`, `timer`, `reset`, `note`, `info`, `trash`, `close`, `plus`, `edit`, `sparkle`, `flame`, `trendingUp`, `progress`, `share`, `bell`, `link`) behind one `createIcon(name, { size = 'sm' })` factory. `size` is `'xs' | 'sm' | 'md' | 'lg'` — anything else throws, as does an unrecognized `name`, rather than silently rendering nothing. Returns a bare, already-`aria-hidden` `<svg class="icon icon-{size}">` node; callers drop it into whatever wrapper element/class they already had (`el('span', { className: 'nav-item-icon' }, [createIcon('settings')])`), the same way `brand.js`'s `createBrandIcon()` wraps its own raw svg. As of issue #136 Phase 2, every shape here is a real Phosphor Icons (Regular weight, MIT licensed) source path in that icon's native `256x256` viewBox (`fill: currentColor, stroke: none` per shape) — not this app's original hand-drawn 24x24 stroke icons. `svgIcon()` (`src/ui/utils/svg.js`) takes an optional `viewBox` override for exactly this reason; its stroke-icon defaults (`currentColor` stroke, no fill, 1.8 width, `24 24` viewBox) are unchanged for any future hand-drawn icon, just no longer used by this module.
- **`app.css` `:root`** — `--icon-size-xs: 16px` / `--icon-size-sm: 20px` / `--icon-size-md: 24px` / `--icon-size-lg: 32px`, plus a base `.icon { flex-shrink: 0; }` and four `.icon-xs`/`.icon-sm`/`.icon-md`/`.icon-lg` modifier classes that set `width`/`height` from those tokens. **Never set an icon's size via an inline `style`/`.style.setProperty` call** — `createIcon()` uses a discrete size-modifier class specifically because `index.html`'s CSP has no `unsafe-inline` for `style-src` (see the "Never set an inline `style` attribute" rule below).

**When to use `createIcon()` vs. `createDecorativeIcon()` — revised in issue #136 Phase 2, emoji is no longer used anywhere in this app.** Functional/navigational chrome (nav items, buttons, toolbars, status indicators, collapse/close/delete affordances) goes through `createIcon()` (`icons.js`, Phosphor **Regular** weight) exactly as before. What changed: decorative, data-driven content — per-template icons (`src/data/templates/index.js`), resource-type badges (`src/ui/utils/linkDetector.js`'s `LINK_TYPE_META`), and custom/imported roadmap card icons (`src/ui/utils/customRoadmapIcon.js`) — used to stay raw Unicode/emoji glyphs (issue #107's original carve-out); they now go through **`createDecorativeIcon(name, { size })`** (`src/ui/components/decorativeIcon.js`), a second factory over Phosphor's **Duotone** weight (a deliberately richer, two-tone style — a faint `opacity: 0.2` base path plus a full-opacity detail path, both `currentColor`) so decorative content stays visually distinguishable from flat-monochrome functional chrome while both now draw from the same underlying icon vocabulary instead of two incompatible ones. **Why the reversal**: cross-platform emoji rendering (a coffee-cup emoji is a different illustration style/color/weight on every OS) was an acceptable tradeoff before the product's own quality bar moved toward "sellable enterprise product" (root `CLAUDE.md`) — a live screenshot audit found the built-in-template/SVG-icon mismatch on the onboarding picker's card grid to be the single most visible "not enterprise" tell in the app, which is what prompted the reversal. `template.icon` (`src/data/templates/index.js`), `LINK_TYPE_META[type].icon` (`linkDetector.js`), and `pickCustomRoadmapIcon()`'s return value (`customRoadmapIcon.js`) are now `createDecorativeIcon()` name strings, not glyphs — every module holding one is still DOM/import-free itself (a plain string), only the *rendering* call site needs `decorativeIcon.js`. If a wrapper class holds a mix — e.g. `dashboard.js`'s `.current-roadmap-badge` icon, a built-in template's `createDecorativeIcon()` name string *or* a custom roadmap's `createIcon('edit')` fallback node depending on state — branch on `typeof icon === 'string'` (name string → `createDecorativeIcon(icon, ...)`) vs. a DOM node (pass as a child directly) rather than forcing one representation on both. One deliberate exception: a plain-text tooltip (`attachTooltip()`, `tooltip.js`) can only ever render a string, never a DOM node — `dashboard.js`'s resource-count breakdown tooltip dropped its old inline emoji glyphs entirely rather than trying to inline an SVG into plain text; don't add an icon glyph back into a tooltip string.

**Never add an icon-wrapper CSS class without an explicit size declaration on it** — that's exactly what caused the Settings gear bug. A wrapper class holding a `createIcon()` result doesn't need its own `font-size`/`width`/`height` (the SVG's own `.icon-{size}` class handles that); a wrapper class still holding emoji text does need an explicit `font-size`, ideally one of the `--icon-size-*` tokens rather than a fresh magic-number pixel value.

**`scripts/lint-icons.mjs` enforces the emoji-elimination policy above in CI (issue #136 Phase 2 follow-up).** Wired into the same `lint` CI job as `lint-theme.mjs` — fails the build on any raw emoji glyph found anywhere in `src/ui/**/*.js` or `src/data/**/*.js`, with a small, justified exemption list for genuinely non-icon content (`shareCard.js`'s canvas-rendered share-card text, `shareModal.js`'s social-media caption copy — user-facing content leaving the app onto an external platform, not this app's own UI icon system). This exists because the original Phase 2 PR only converted the icon-shaped call sites it went looking for (templates, resource types, custom-roadmap icons) and missed a second wave of raw emoji scattered across the feedback modal, theme toggle, field-validation marks, and several plain-text status strings — all real UI, just not the specific modules that phase's own scope list named. Run `node scripts/lint-icons.mjs` locally before adding any new icon-shaped UI; if it flags a file that's genuinely non-icon content, add it to `EXEMPT_FILES` in that script with the same reasoning as the two existing entries, never by weakening the regex.

**Two same-row circular icon-buttons must share the same box size and the same icon size — never eyeball it.** `.daily-todo-info-btn` and `.daily-todo-collapse-btn` (`dailyTodoPanel.js`'s heading row) shipped at different box diameters (20px vs 24px) and different `createIcon()` sizes (`xs` vs `sm`), which read as visibly inconsistent/misaligned side by side (reported live, screenshot). Fixed by matching both dimensions exactly rather than nudging padding — when two icon-only buttons sit adjacent in the same row/toolbar, their CSS box size and their `createIcon()`/`createDecorativeIcon()` `size` argument must be identical, even if one glyph visually "reads" bigger than the other at the same nominal size.

**A bare `1fr` grid track has no width ceiling of its own — it defaults to its content's min-content size, which can force the whole grid (and the page) wider than the viewport (issue #8 follow-up).** `.app-shell-2 { grid-template-columns: auto 1fr; }` (and its `≤1023px`/`≤639px` overrides) had shipped this way since issue #6 Phase 2 with no visible problem, because neither `dashboard.js` nor `settings.js` ever had content wide enough to expose it. The Progress page's activity heatmap and charts (~800px of genuinely wide content, meant to scroll within their own containers) did: even with `.app-shell-main { min-width: 0; }` already set on the grid *item*, the `1fr` *track* itself still sized to content, so the whole page rendered ~850px wide on a 390px phone screen instead of clipping. The same trap hit `.progress-content` a second time: it's `display: grid` with no `grid-template-columns` declared at all, and an *implicit* single-column grid track has the identical content-based default — `.progress-card`'s own `min-width: 0` wasn't enough to fix it; the track needed an explicit `grid-template-columns: minmax(0, 1fr)`. **Fix, and the rule going forward: any `1fr` track (explicit or the single implicit column of a `display: grid` with no `grid-template-columns`) that's meant to contain content wider than itself must be `minmax(0, 1fr)`, not a bare `1fr`** — this is the grid equivalent of a flex item needing `min-width: 0` to shrink below its content size (see the "flex/grid item won't shrink" reasoning throughout this file), and it's very easy to not notice until something genuinely wide is finally rendered inside it. Verified via real `getBoundingClientRect()`/`scrollWidth` checks in a live phone-width Playwright run, not just a visual screenshot — `scrollWidth` on an `overflow: auto` element always reports its *content* size (expected, not a bug), so the actual test is whether an ancestor's own rendered box (`getComputedStyle(...).gridTemplateColumns`, or a plain-text element like an `<h1>` with no wide content of its own) is still constrained to the viewport.

**An `overflow` value that isn't `visible` on one axis silently clips the other axis too — and a lingering non-`none` `transform`/`filter` anywhere in an ancestor chain hijacks every `position: fixed` descendant on the page (both issue #102 follow-up).** Two related, easy-to-miss CSS traps found while fixing the sidebar dropdown above. (1) `.app-sidebar { overflow-y: auto; }` had no `overflow-x` declared — per the CSS overflow spec, a box with one axis set to something other than `visible` computes the *other*, unspecified axis to `auto` too, not `visible`. This silently clipped anything positioned to escape the sidebar's own narrow box (a `position: absolute`/`fixed` dropdown menu wider than the 56–64px icon rail), with no warning anywhere in the CSS that this was happening — if an element ever needs to intentionally overflow its container in one direction (a dropdown, a tooltip, a popover), check every scrollable ancestor for this, not just the nearest one. (2) `.fade-in`'s `animation: fade-in 420ms var(--ease-spring) both` kept the `to` keyframe's `transform: translateY(0)` applied forever via the `forwards` half of `both` — and *any* declared `transform` (even a visual no-op like `translateY(0)`), or `filter`/`perspective`/`contain: layout|paint|strict|content`/a transform-related `will-change`, establishes a new containing block for every `position: fixed` (and `absolute`) descendant, wherever it sits in the DOM. A fixed-position dropdown menu nested inside `.app-shell-2.dashboard.fade-in` was positioning itself relative to that div's full scrollable content height instead of the viewport, landing thousands of pixels off-screen. Only use `forwards`/`both` fill-mode when something genuinely needs to persist after the animation ends, and audit every element between a `position: fixed` node and the document root for a lingering transform/filter before trusting that "fixed" actually means "relative to the viewport." `position: fixed` elements whose exact screen offset depends on a trigger's live geometry (not a fixed corner of the viewport) must compute that offset from `getBoundingClientRect()` in JS (`dropdown.js`'s `positionMenu()`), the same way `tooltip.js` already does — CSS alone can't parametrize an arbitrary trigger position, and `.dropdown`'s own `position: relative` has no effect once its child is `fixed`.

**The same transformed-ancestor trap hit a second, more general component (issue #136 Phase 3) — the fix this time is a body-level portal, not a CSS tweak.** `select.js`'s custom listbox (replacing every bare `<select>`, see below) is meant to be dropped into *any* form, and `itemPanel.js`'s Priority field sits inside `.item-panel`, whose slide-in animation is `.item-panel.show { transform: translateX(0) }` — a permanently-applied, non-`none` transform, the exact ancestor shape the rule above warns about. A `position: fixed` listbox nested inside `.item-panel` positioned itself relative to the panel's own box, not the viewport — found live via a `getBoundingClientRect()` mismatch between the trigger (correct) and the listbox (offset by roughly the panel's own position). Auditing every current and future call site for a transformed ancestor doesn't scale, so `select.js` sidesteps the whole bug class structurally: `.custom-select-listbox` is never a DOM descendant of the select's own wrapper — it's appended straight to `document.body` when opened and removed when closed (a portal), guaranteeing there is never an ancestor between it and the root to hijack its `position: fixed` coordinates, regardless of which animated/transformed container a caller nests the select inside. Any future floating/positioned element meant to be droppable into an arbitrary form should follow this same portal pattern rather than assuming its container is untransformed — **including a "known-safe" chrome location**, which turned out not to be safe either: `dropdown.js`'s `.dropdown-menu` (issue #121 follow-up, reported live with a screenshot) intermittently rendered *behind* other page content specifically when triggered from the sidebar's avatar identity menu, nested inside the animated dashboard shell. Unlike the `.item-panel` case above, this wasn't purely a mispositioning bug — `position: fixed` also *stacks* (z-index paint order) within whatever stacking context its containing block belongs to, not the root, so even a correctly-positioned fixed menu can paint behind/in front of unrelated content inconsistently depending on which sibling stacking contexts exist at open time. `dropdown.js` now portals `.dropdown-menu` to `document.body` on open exactly like `select.js`'s listbox — its open/closed visibility is driven by `.dropdown-menu.open` directly (not a `.dropdown.open .dropdown-menu` descendant selector, which stopped matching once the menu left the DOM subtree), and its keydown handling is split across the trigger and the portaled menu rather than a single wrapper-level listener (same split `select.js` uses for its trigger/listbox). There is no longer a "this component only lives somewhere safe" exemption anywhere in this app — every floating/positioned element is a portal.

**A fourth variant — a portaled `position: fixed` element positioned once at open time doesn't track page scroll, and neither `select.js` nor `dropdown.js` originally closed or repositioned on scroll (real bug, reported with screenshots).** `positionListbox()`/`positionMenu()` compute `left`/`top`/`width` from the trigger's `getBoundingClientRect()` exactly once, when the listbox/menu opens — correct at that instant, but `position: fixed` coordinates don't move as the page scrolls (that's the whole point of `fixed`), while the trigger they were computed from does move, since it's a normal-flow element. Leaving either open and scrolling the page showed the fixed listbox/menu visually stuck at its original screen position, rendering as a giant overlay on top of whatever content happened to scroll underneath it — reported live from the onboarding page's Daily Todos duration `<select>`, staying stuck over the entire template card grid across multiple scroll positions, with no way to dismiss it short of clicking it or pressing Escape.

The first fix attempt — close on *any* `scroll`/`resize` event, full stop — turned out to be too blunt and caused a real regression, caught only by CI's real-browser E2E suite (local unit tests run in jsdom, which doesn't dispatch real scroll events at all, so this never showed up there). Root cause: this app's global `html { scroll-behavior: smooth }` (`app.css`) means any unrelated `.focus()` elsewhere on the page — e.g. a modal opening and focusing its first field, per this app's own `openModal()` convention — can turn into a real, multi-hundred-millisecond smooth-scroll settle, dispatching a continuous stream of genuine `scroll` events that have nothing to do with the listbox/menu at all. An any-scroll-closes listener misread that unrelated settle as "the user scrolled, close the dropdown," closing it before a real user (or a test) ever got to interact with it — reproduced live via an AI-import modal test where the `.custom-select-listbox` closed itself mid-open, and a sidebar account-menu test where `.dropdown-menu` never became visible at all. `{ preventScroll: true }` on every `.focus()` call inside both components (the option/item being focused on open, and every keyboard-navigation focus move while open) closes the gap for scrolls *this component itself* would otherwise cause, but can't do anything about a smooth-scroll already in flight elsewhere on the page — so it isn't sufficient by itself.

**The real fix**: stop treating "a `scroll` event fired" as the signal, and check what actually matters — whether the trigger has moved a meaningful amount since the listbox/menu opened. Both `onWindowScrollOrResize()` handlers now capture the trigger's `getBoundingClientRect()` at open time and compare it against the current rect on every `scroll`/`resize` event, closing only past a small `TRIGGER_MOVE_THRESHOLD_PX` (4px). This absorbs unrelated smooth-scroll jitter (which doesn't move *this* trigger at all, since the trigger isn't what's being scrolled into view) while still closing promptly on a real, deliberate page scroll, which moves the trigger by far more than a few pixels within a single frame. `scroll` doesn't bubble, so this is still a capture-phase listener on `document`, not a bubble-phase one on the trigger/wrapper, attached only while open and torn down in the existing `_cleanup()`. `select.js`'s version keeps one extra guard `dropdown.js`'s doesn't need: `.custom-select-listbox` is `overflow-y: auto` for a long option list, and scrolling *inside* the open listbox itself also dispatches a `scroll` event a capture-phase `document` listener sees — the handler explicitly ignores any scroll event whose `target` is the listbox itself, independent of the trigger-movement check. Any future portaled `position: fixed` element (a new dropdown, a new custom field) needs this same trigger-movement-threshold pairing, not a bare any-scroll-closes listener — being correctly positioned *at open time* isn't the same guarantee as staying correctly positioned *while open*, and "a scroll event exists somewhere on the page" is not the same signal as "this element's own anchor point moved."

**A fifth variant — a non-portaled `position: fixed` element sized itself against the viewport, not its intended parent, silently painting over unrelated content two DOM levels up (real bug, reported with a screenshot).** `.auth-page-bg` (a decorative background-fill layer meant to sit behind just `.auth-page-right`, the sign-in card's own column) is `position: fixed; inset: 0`. Every other `position: fixed` bug documented in this file so far has been about *where a portaled element ends up* (a transformed ancestor hijacking its containing block, or its coordinates going stale on scroll) — this one is simpler and easier to miss precisely because it never moves anywhere: `inset: 0` on a `position: fixed` element always resolves against the full viewport, full stop, regardless of which element it's nested inside or what that parent's own size/position is. `.auth-page-bg` is a DOM child of `.auth-page-right` (intentionally, so it visually reads as "this column's background"), but being `position: fixed` meant it silently ignored that nesting and covered the *entire* two-column `.auth-page` — painting its light `--color-bg` fill directly over the always-dark `.auth-marketing` panel on the left, whose own fixed-white text then rendered as near-invisible pale ghosting on top of it. `pointer-events: none` (required so the layer never intercepts clicks meant for real content) also meant `elementFromPoint()`/`elementsFromPoint()` never reported it as present at that location, which made this bug unusually hard to isolate — every hit-testing-based check said the correctly-styled `.auth-marketing-headline` was the topmost element there, while the actual paint told a different story. Fixed by switching to `position: absolute` — its intended containing block, `.auth-page-right`, is already `position: relative`, so `inset: 0` now correctly resolves against that column alone. **The general rule this adds**: `position: fixed` is a promise to size/position against the viewport specifically — the moment you want an element scoped to *any* ancestor smaller than the full page (even one immediately one level up), that ancestor needs `position: relative` (already true almost everywhere in this app) and the child needs `position: absolute`, not `fixed`. Reach for `fixed` only when viewport-relative sizing/position is *actually* the intent (a repeating print header, a toast stack, a modal overlay) — never as a default "make this sit behind its sibling" pattern.

**A third variant of the same bug class — plain CSS `overflow` clipping, not a transformed-ancestor mispositioning (issue #180 follow-up).** `tooltip.js`'s `attachTooltip()` had never actually followed the portal convention above — its `.tooltip-bubble` was a plain absolutely-positioned DOM child of the trigger, invisible almost everywhere the trigger has no scrolling/overflow ancestor. `heatmap.js`'s per-cell tooltip (trigger inside `.heatmap-scroll`, `overflow-x: auto`, which per this file's own "one non-`visible` overflow axis forces the other to `auto` too" rule above) got its bubble visibly clipped at the container's edge — found live via a screenshot report, compounded by the same cell also setting a redundant native `title` attribute (two overlapping tooltips at once, one of them cut off). Fixed the same way as `select.js`/`dropdown.js`: `attachTooltip()` now portals `.tooltip-bubble` to `document.body` on `mouseenter`/`focus` (removed on `mouseleave`/`blur`, not left resident in the tree), positioned via `getBoundingClientRect()` (viewport-relative, matching `position: fixed`) and direct `bubble.style.left`/`top` writes. Any future tooltip-like hover affordance should portal from the start rather than assuming its trigger will never end up inside a scrolling container.

**Every custom interactive element must explicitly set `color` (and `font`) — never rely on inheritance (issue #116).** A `<button>` does not inherit `color`/`font` from the page by default — the UA stylesheet gives it its own `color: buttontext`/`font: unset`, overriding whatever ancestor color the rest of the page has. `.feedback-type-card` and `.my-report-summary` (issue #9/#115) shipped this way and rendered near-black text on a dark navy background in dark theme; `.notes-indicator` (issue #116, a bare `<button>` whose only content is a `currentColor`-based `createIcon()` SVG) had the identical gap and was fixed alongside this rule. Every other custom button-like class in this app (`.btn`, `.forgot-link`, `.filter-chip`, `.tab`, `.template-card-*`, etc.) already does this correctly — set `color` (a token, or `inherit` if the button's own text genuinely lives in a child element that sets its own color, like `.app-sidebar-identity`/`.command-palette-item`) and `font: inherit` on any new `button`/`[role="button"]`/custom `input`-adjacent wrapper the moment you add it, not after a live screenshot report catches the gap. `scripts/lint-theme.mjs` (run in CI alongside `npm run lint`) enforces this automatically for any `el('button', { className: '...' })` outside the `.btn` family — see the script's own header comment for how it decides.

**Every literal hex/`rgb()`/`rgba()` color in `app.css` outside the two `:root` token blocks needs an adjacent `/* intentional: ... */` comment, or `scripts/lint-theme.mjs` fails (issue #116).** The legitimate pattern — a fixed white/saturated color on a background that's *also* fixed regardless of theme (a brand-gradient mark, a solid-danger/priority badge, `.auth-marketing`'s always-dark panel, a theme-agnostic modal/sidebar scrim) — is common and correct; the lint isn't banning it, it's making every instance self-documenting so the next person (or the next audit) doesn't have to re-derive *why* a color bypassed the token system. When you add a new one, write the comment in the same PR, not as a follow-up. A color that should have been a token but wasn't, or a light-mode value with no `:root[data-theme='dark']` counterpart on an element whose background does change with theme, is a bug — token it or theme it, don't comment around it.

**Every bare `<select>` in the app goes through `createSelect()` (`src/ui/components/select.js`, issue #136 Phase 3) — never add a fresh `el('select', ...)`.** A native `<select>`'s browser-default dropdown arrow/font read as a visible seam next to every other fully custom-styled field in the same form (found live, screenshotted). `createSelect(options, { value, ariaLabel, className })` (`options: [{ value, label }]`) returns a single wrapper node that deliberately mirrors a native `<select>`'s API so an existing call site only needs its element-construction line swapped: `.value` is a live getter/setter (setting it does **not** dispatch `change`, matching `select.value = x` on a real `<select>`), and `.addEventListener('change', fn)` fires on every user-driven selection (click, Enter/Space on a focused option, or type-ahead landing on a new value). `.disabled` proxies to the inner trigger button. The listbox is keyboard-operable per the ARIA combobox/listbox pattern (Arrow keys, Home/End, Enter/Space, Escape, type-ahead) and the trigger is a real `<button>` (a labelable element), so wrapping it in `<label class="field">` associates it exactly like a native `<select>` did — never skip the wrapping `<label>` (or an explicit `ariaLabel`) just because the control no longer looks like a form field to a sighted user. Every caller must call `select._cleanup()` when its container unmounts (wired into the same route/modal cleanup path as everything else in `.claude/rules/roadmap-store.md`'s and this file's "Component subscription cleanup" precedent) — it removes the shared `document` click listener and detaches the portal listbox described in the transformed-ancestor rule above.

**Shared "metadata chip" box-model scale — `--chip-height`/`--chip-padding-x`/`--chip-radius` (`app.css` `:root`, issue #136 Phase 3).** A single checklist row could show a priority tag, a resource-count pill, and other small inline badges with no shared height/padding/radius tying them together as one visual family, even though they already shared color tokens correctly. `.badge`, `.resource-count`, `.template-card-current-badge`/`-started-badge`/`-ai-badge` all read these three tokens now (explicit `height` + `inline-flex` centering, not padding+line-height arithmetic, so every chip is pixel-identical regardless of its own font-size) — **colors stay semantically distinct per component**, only the box model unifies. `.priority-tag` is a deliberate partial exception: it reads `--chip-height` too (so it vertically aligns with `.resource-count` in the same row) but stays bare colored text with no background/padding/radius — giving it a tinted background would need its own WCAG contrast pass against every `--p0`–`--p3` pair in both themes (see the `color-contrast` rule below), which is out of scope for a pure box-model unification; don't add one without doing that verification first. When you add a new small inline badge/pill, reach for these three tokens before inventing fresh padding/radius values.

**Re-scoped `color-contrast` axe exception list (`tests/e2e/accessibility.test.js`, issue #116, expanded in #124).** `color-contrast` runs enabled on every page now — it used to be disabled app-wide via a blanket `disableRules(['color-contrast'])`, which is exactly the rule that would have caught the `.feedback-type-card` dark-theme bug above, on every page, permanently. `CONTRAST_FALSE_POSITIVE_SELECTORS` in that file lists every selector excluded from an axe scan that opts into it — originally just `.phase-name`, `.badge`, and `.phase-index` from the dashboard test; issue #124 extended coverage to `/settings`, `/progress`, and three modals (the item edit panel, the AI-import modal, a `confirmDialog` instance) for the first time and found several more of the identical sampler bug on those pages: `.nav-item`, `.app-sidebar-user-email`, `.btn-primary`, `.btn-secondary`, `.stat-tile`, `.priority-table-wrap td`, `.brand-name`, `.import-step-heading`, `.panel-kicker`, `.link-badge`, `.btn-danger`. All are confirmed, not assumed, sampler false positives — axe's rendering-based pixel sampler misattributes color on each (most likely from a progress-ring SVG/box-shadow/animation element nearby), reporting ratios that don't match their real computed styles at all (verified with a real WCAG contrast-ratio calculation against the exact `app.css` token values, in both themes, for every new entry). `.phase-index` was added in issue #136 Phase 3/4 — the new shared `--chip-height`/`--chip-padding-x` box model on `.badge`/`.resource-count` shifted layout enough to newly trigger the same sampler bug on an element that hadn't hit it before (axe reported 3.75:1; live-verified actual contrast is 5.19:1 light / 6.65:1 dark, both comfortably passing AA). `.badge` was broadened from the original `.badge.P0`-only exclusion in the same follow-up, after the identical layout shift newly triggered the sampler bug on `.badge.P1` too (axe: 4.07:1) — rather than add priorities one at a time as axe happens to sample them, all four priority/theme pairs were live-verified first (light P0 4.83:1 / P1 5.02:1 / P2 5.17:1; dark P0 6.93:1 / P1 11.48:1 / P2 7.54:1; P3 shares the identical `.badge` base rule plus a single background-color override, so it's covered by construction) before broadening to the whole class — a reminder that a pure box-model change with no color changes can still perturb this sampler bug via layout shift alone, and that the false-positive's root cause (proximity to the progress-ring) is structural, not tied to one specific priority color. If axe ever flags a new element, don't add it to this list without the same live verification — an unexplained addition here is exactly how the original blanket disable happened. When scanning a modal specifically, prefer scoping the whole scan to the modal's own DOM subtree via `runAxe`'s `include` option over adding exclusions for what turns out to be axe still sampling the (visually covered, but still-present) page behind an open overlay — that's a different bug shape than the sampler false positive this list otherwise documents, and `include` fixes the whole class of it rather than exclude()-ing one covered element at a time (see the item edit panel test, issue #124). The suite also runs a second, `dark-theme` pass (`localStorage.ascent-theme = 'dark'` before navigation) with the same zero-critical-violations assertion — any future page/component added to the light-mode suite should get the same dark-theme test alongside it.

**`--accent-2` is reserved for AI-assisted affordances specifically, not general "second brand color" use (issue #136 Phase 1).** A live screenshot audit found brand teal (`--brand`/`--brand-light`) doing too many jobs at once — the "AI-powered" create card/badge, "this is selected" (`.template-card-current`), and a resource-count pill all drew from the identical hue, so none of them read as visually distinct meanings. `--accent-2`/`--accent-2-dark`/`--accent-2-light`/`--accent-2-light-border` (a violet/indigo family, both themes WCAG-verified ≥5.9:1 for every text pairing) is the fix — used today by `.template-card-create`/`.template-card-ai-badge`. Don't reach for it as a generic "second color" for anything that isn't AI-related; `--accent` (orange) remains the token for priority/daily-todo/"not brand teal" uses that predate this. The ambient `--glow-accent` corner-gradient token also now resolves to this violet family (was orange, screenshotted as a stray, unexplained clash) — recolor both theme blocks together if you ever retune it. A resource count or other pure-metadata pill should default to a neutral gray (`--muted`/`--panel-2`/`--line`, see `.resource-count`), not a token from either accent family — metadata isn't a status and doesn't need its own hue.

**Re-enabling `color-contrast` immediately caught a real, previously-undetected bug, not just the two already known ones (issue #116).** `.badge.P0`–`.badge.P3` and `.filter-chip[data-p="…"].active` set fixed white text on `--p0`–`--p3` — correct in light theme, where those tokens are dark/saturated, but dark theme's `--p0`–`--p3` are light pastel values (tuned for *visibility as borders/dots* against the dark panel, not for hosting white text), so white-on-them fails WCAG contrast (`.badge.P1` measured 1.66:1 against `#fbbf24` in CI; the other three priorities have the identical gap by the same luminance math, just untested by axe because the visible dashboard state only happened to render P1). Fixed with a `:root[data-theme='dark']` override on both selectors switching to `var(--soft)` (near-black) text, which reads >6:1 against all four dark-theme priority tokens. **The lesson for any future token whose light- and dark-theme values differ in more than just lightness direction:** don't assume a text/background pairing that's contrast-safe in one theme is automatically safe in the other just because the same CSS rule "looks" theme-aware (it reads a token, not a literal) — a token can still fail contrast in exactly one theme if that theme's value was tuned for a different purpose (border/accent visibility) than the pairing assumes (text legibility). Verify both themes' *token values*, not just whether the rule uses a token.

## Visual design language (issue #155, ZeBeyond direction)

Issue #155 originally shipped (unmerged) a "Neura-style" dark-teal + Material Design 3
elevation/shape/state-layer system — that direction was fully reverted, not retuned,
after new reference material came in (a Dribbble "ZeBeyond" marketing site) and the
call was made to replace rather than extend it. If you find a stray reference to
`--elevation-*`/`--surface-tint-*`/`--state-hover` etc. anywhere, it's leftover from
that abandoned direction and should be removed, not extended.

**Dark theme moved from navy-tinted to neutral near-black.** `--soft`/`--panel`/
`--panel-2`/`--surface-3`/`--line`/`--line-strong` (`:root[data-theme='dark']`,
`app.css`) were retuned from a scale with a visible blue undertone
(`#0a0f1a`/`#121a2b`/`#182238`/`#1f2b42`/`#253147`/`#33415c`) to a neutral scale with
none (`#0a0a0a`/`#141414`/`#191919`/`#1f1f1f`/`#262626`/`#333333`), matching the
reference's page/card backgrounds. `--brand`/`--brand-dark` (mint/teal) were kept
unchanged — they already matched the reference closely, so no retune was needed there.
Every real text/background pairing against the new values was re-verified with a
relative-luminance calculation before landing on them (the existing issue #116/#136
discipline): `--ink` clears ~14-17:1, `--muted` ~6.7-7.6:1, `--faint` ~5.1-5.5:1,
`--brand` ~9.9-10.6:1, `--brand-dark` ~12.4-13.4:1 against `--soft`/`--panel`/`--panel-2`
— see the retuned tokens' own code comments in `app.css` for the exact per-pairing
figures. `--track-bg`/`--emphasis-text`/`--surface-glass`/`--border-glass` were updated
alongside these to stay in sync (each previously derived from or paired with one of the
retuned navy values).

**New shared classes, all in `app.css`:**
- **`.eyebrow`** — an uppercase, letter-spaced kicker label (the reference's "PLANS",
  "CASE STUDIES", "WHY CHOOSE US" pattern), reading `--brand` for color and
  `--tracking-caps` for letter-spacing. Pair with a leading `.eyebrow-dot` (a small
  filled circle) when the label needs a visual anchor. Used above the landing hero
  title and each landing section title (`landing.js`'s `buildSectionEyebrow()`), and
  above the auth marketing panel's headline. Generalizes what used to be several ad hoc
  uppercase-label rules (`.current-roadmap-badge`, `.toolbar-label`, `.panel-kicker`)
  into one reusable class — those existing call sites are unchanged, this is additive.
- **`.text-gradient-brand`** — a `background-clip: text` gradient (`--brand` →
  `--brand-cyan`, a new token formalizing the literal `.brand-mark`'s gradient already
  used) for **one accent phrase inside a heading**, never the whole heading — a fully
  gradient-filled heading can't be evaluated by contrast tooling against a background,
  since there's no single foreground color to check. `landing.js`'s hero title
  ("Engineer your **next move**.") is the only current call site.
- **`.tag-chip` / `.tag-chip-accent`** — a two-tone tag-chip pair (the reference's
  "EPOP CONCEPT" + "AUTOMOTIVE" chip pattern), built on the same
  `--chip-height`/`--chip-padding-x`/`--chip-radius` scale `.badge`/`.resource-count`
  already use so a tag chip is pixel-identical in height to every other small pill in
  the app — only the neutral (`.tag-chip`, `--panel-2`/`--line`/`--muted`) vs. accent
  (`.tag-chip-accent`, `--brand-light`/`--brand-light-border`/`--brand-dark`) color
  pairing is new. Not currently used on the landing feature/step cards — they don't
  have a real second category to show, and inventing one would be a fabricated
  taxonomy; reach for this class only where a genuine category/type label exists.
- **`.icon-tile`** — a 44×44px rounded-square icon container (`--panel-2` background,
  `--line` border, `--brand` icon color) for card headers. Not yet adopted by
  `.feature-card-icon`/`.step-card-icon` (their existing `--brand-light` circular/
  rounded treatment already reads fine against the new near-black cards) — reach for
  `.icon-tile` on a genuinely new icon-topped card rather than retrofitting working
  cards for its own sake.
- **`.btn-cta`** — a solid bright pill button (`border-radius: var(--chip-radius)`,
  `background: var(--brand)`) for marketing CTAs specifically (landing nav/hero/CTA
  section, both "Start for free" actions). Deliberately a **new class, not a change to
  `.btn-primary`** — `.btn-primary` is used app-wide (dashboard, settings, forms) and
  reshaping it was out of this pass's scope (landing/auth/dashboard shell only).
  `color: var(--soft)` is a deliberate cross-theme trick, not an oversight: light
  theme's `--soft` is a light near-white (reads correctly on light theme's dark-teal
  `--brand`), dark theme's `--soft` is near-black (reads correctly on dark theme's
  bright-mint `--brand`) — the same token resolves to a readable text color against
  `--brand` in both themes without a separate per-theme override. Add `.btn-lg` for the
  same 48px height as an adjacent `.btn-secondary.btn-lg`.
- **`.icon-btn-group`** — a bordered pill container that visually groups adjacent
  icon-only buttons (the reference's search/mail/sign-in cluster). `topbar.js` wraps
  its search/notification/theme-toggle buttons in one; this is a **grouping wrapper
  only**, not a reimplementation — every wrapped button keeps its own existing
  markup/behavior/cleanup.
- **`.bg-grid-glow`** — a decorative diagonal-grid + radial brand-glow background
  layer (the reference's faint grid-line texture behind hero/CTA sections), meant as
  an absolutely-positioned child of a `position: relative; overflow: hidden` section
  (`landing.js`'s hero and CTA sections; the auth marketing panel's existing
  `.auth-marketing-bg-pattern` is a closely related, pre-existing sibling pattern, not
  replaced by this). Its diagonal lines read from `--ink` via `color-mix(in srgb,
  var(--ink) 6%, transparent)` rather than a fixed white/black literal, so they stay
  faint-but-visible in both themes without a separate dark-theme override — this
  matters because, unlike `.auth-marketing-bg-pattern` (whose panel is *always* dark
  regardless of site theme, issue #116), `.landing-hero`/`.landing-cta` genuinely flip
  with the site's own light/dark toggle. The radial glow reuses `--glow-brand`, which
  already flips per theme on its own.

**The auth marketing panel's background changed from a solid brand-gradient fill to a
near-black base with two radial teal/cyan glows**, matching the reference's dark
marketing-panel treatment instead of a flat color fill. Still a fixed-dark panel
regardless of site theme (unchanged reasoning from issue #116 — see the comment above
`.auth-marketing` in `app.css`), so the new radial-glow colors are literals with
`/* intentional: ... */` comments, same as every other fixed color already on this
panel. `.auth-marketing-eyebrow` is a scoped override of `.eyebrow`'s color (a fixed
`#5eead4`, not the theme-flipping `--brand` token) for the same always-dark reason.

**The sidebar's active nav item is pill-shaped, not the standard rect radius.**
`.nav-item.active` (`app.css`) gained `border-radius: var(--chip-radius)` on top of its
existing `--brand-light` background/`--brand-dark` text — no color change, matching the
reference's rounded active-nav-item treatment.

**No new font was introduced.** `--font-display: 'Space Grotesk'` (already in place) is
a close-enough match to the reference's display type and swapping fonts would have
meant self-hosting a new webfont or updating the CSP's `font-src` for no clear visual
gain — out of scope for this pass. No custom illustration assets were added either;
every icon still goes through `createIcon()`/`createDecorativeIcon()` per the existing
icon-system rules above — `.icon-tile`/`.tag-chip` are wrappers around those, not a new
icon vocabulary.

**Scope: landing page, auth screens, and the dashboard's core shell (sidebar/topbar)
only.** Settings, Progress, and every modal are unchanged this pass and are a planned
fast-follow — don't assume a class documented here has been applied everywhere in the
app just because it exists in `app.css`.

### Visual design language v2 (issue #155 redefinition — lime/near-black direction)

Issue #155 was reopened with a second redefinition: the ZeBeyond mint/near-black
direction above is superseded (not extended) by a new reference — a dark
analytics-dashboard screenshot set with a bright lime accent — and this pass is scoped
far wider than ZeBeyond's landing/auth/shell: every page and every modal in the app.
See issue #155's redefinition comment for the full spec (reference breakdown, phased
implementation plan, open decisions). Landing in 5 phases, each its own PR: A (token
layer, below) → B (shared component classes) → C (landing/auth/shell recolor) → D
(Settings/Progress/every modal — first real pass) → E (full verification).

**Palette:** near-black `#080808` (a further neutral retune of the
`--soft`/`--panel` scale — Phase A tightened the ZeBeyond scale one more step to this
exact reference hex, it was not a new hue direction), mid-gray `#4E4E4E`, light-gray
`#D4D4D4`, pure white `#FFFFFF`, and a new accent — **`#F0F941`, a bright
lime/chartreuse**. The mid-gray/light-gray/white swatches from the reference's
branding board map conceptually to this app's existing `--muted`/`--faint`/`--ink`
text tiers (already contrast-verified, issue #116/#136 precedent) rather than being
adopted as literal hex replacements — `#4E4E4E` on `#080808` measures only 2.41:1,
which fails WCAG AA for text entirely, so it cannot be used as a literal token value
here even though it's what the reference specimen shows.

**Accent-token decision (Phase A, shipped):** a **parallel `--accent-lime` token
family** was added (`--accent-lime: #f0f941`, `--accent-lime-dark: #cdd707`,
`--accent-lime-light: #22230b`, `--accent-lime-light-border: #404215`, all
`:root[data-theme='dark']` only), **not** a `--brand`/`--brand-dark`/`--brand-light`/
`--brand-light-border` retune in place. Reasoning: `--brand-dark` alone is read by
~20 call sites across dashboard/settings/progress (toasts, links, tab underlines, stat
numbers, success messages) that Phase A/B/C don't touch and haven't had a real v2
design pass yet (Phase D's job) — retuning it globally now would silently change
surfaces outside this pass's scope, and at least one (`.toast-success`'s white text on
a solid `--brand-dark` fill) would break contrast outright, since lime cannot host
white text (see the next paragraph). Phases B/C/D consume `--accent-lime*` explicitly
wherever the new spec calls for it, verifying each surface as they're built, rather
than one blanket global swap. Light theme keeps `--brand` teal unchanged — no
light-theme reference material exists for this direction.

**Live-verified WCAG contrast (relative-luminance calculation, same discipline as
every other token in this file):** `--accent-lime` (`#f0f941`) measures 17.48:1
against `--soft` (`#080808`), 16.08:1 against `--panel` (`#121212`), and 15.35:1
against `--panel-2` (`#171717`) — comfortably passing in both directions (lime
foreground on near-black, or near-black foreground on a solid lime fill). Near-black
text on a solid `--accent-lime` fill reuses the existing `--brand`-on-`--soft`
cross-theme trick (`color: var(--soft)`, already near-black in dark theme) rather than
introducing a redundant "ink" token — no new token needed for that role.
`--accent-lime-dark` (`#cdd707`, a ~18%-deepened lime for headroom, not a contrast
requirement) measures 11.88:1 against `--panel` and 11.37:1 against `--panel-2`, for
use as accent text directly on a card background. `--accent-lime-light`/
`--accent-lime-light-border` (`#22230b`/`#404215`) are a dark-desaturated lime tint for
subtle chip/pill fills, mirroring how `--brand-light`/`--brand-light-border` are
already *dark* muted tints in dark theme (not light pastels) — `--accent-lime` on
`--accent-lime-light` measures 13.96:1. As flagged in the issue: a raw `#F0F941` is a
known-hard color for white text — it is never paired with white; every text-on-lime
pairing above uses near-black instead.

**Typography.** Kept the zero-new-font recommendation: `--font-display: 'Space
Grotesk'` is unchanged. It's already a geometric grotesk in the same family as the
reference's "Zona Pro" specimen, and self-hosting a new webfont (or updating the CSP's
`font-src`) for this pass wasn't judged worth it — consistent with how ZeBeyond scoped
the identical decision. Any bolder-weight retuning on headings/stat numbers is Phase
C/D's job (component work), not Phase A's (tokens only).

**Retuned near-black scale (Phase A, dark theme only):** `--soft` `#0a0a0a` → `#080808`
(the reference's exact base hex), `--panel` `#141414` → `#121212`, `--panel-2`
`#191919` → `#171717`, `--surface-3` `#1f1f1f` → `#1c1c1c`, `--line` `#262626` →
`#242424`, `--line-strong` `#333333` → `#303030` — each stepped down proportionally to
preserve the same relative card/hairline separation the ZeBeyond scale had, not
rebuilt from scratch. `--emphasis-text`/`--surface-glass`/`--border-glass` (derived
from `--soft`/`--panel`/`--line-strong`) were updated alongside to stay in sync, same
as they were during the ZeBeyond retune. Every existing text/background pairing
(`--ink`/`--muted`/`--faint`/`--brand`/`--brand-dark`) was re-verified against these
tighter values and still clears WCAG AA by a wide margin (`--ink` ~15-17:1, `--muted`
~6.9-7.7:1, `--faint` ~5.0-5.6:1, `--brand` ~9.6-10.8:1, `--brand-dark` ~12.1-13.5:1)
— see the retuned tokens' own code comments in `app.css` for the exact per-pairing
figures.

**New structural patterns (Phase B, shipped — built and visually verified in isolation,
not wired into any real page yet; that's Phase C/D):**

- **`.kpi-tile` / `.kpi-tile-hero`** — the reference's 4-equal-width KPI card (`app.css`).
  Deliberately **not** named `.stat-tile` despite the issue's own bullet using that
  name: `.stat-tile` already exists (issue #6 Phase 4.1, the dashboard's horizontal
  icon-left/number-right stat strip row) — reusing the name for this structurally
  different vertical card (label + corner badge row, then a large number, then a delta
  caption) would collide with an in-production component instead of extending it.
  Structure: `.kpi-tile-head` (label + `.card-arrow-badge`) → `.kpi-tile-number` →
  `.kpi-tile-delta`. `.kpi-tile-hero` is the "exactly one solid-filled tile per screen"
  variant — `background: var(--accent-lime, var(--brand))`, falling back to `--brand`
  teal in light theme (no v2 reference material exists there). Text inside a hero tile
  reuses the existing `--brand`-on-`--soft` cross-theme trick (`color: var(--soft)`),
  same as `.btn-cta` in the ZeBeyond section above.
- **`.card-arrow-badge`** — the shared circular corner-badge affordance (`app.css`),
  used by `.kpi-tile-head` today and intended for Phase D's planned person/customer
  cards too, per the issue's spec. Parent needs `position: relative` (`.kpi-tile`
  already has it).
- **`.filter-chip-counted`** — an embedded count sub-badge (`.filter-chip-count-badge`)
  on top of the existing `.filter-chip` base (`app.css`) — apply both classes together
  (`filter-chip filter-chip-counted`), never as a replacement. The badge inverts
  `--emphasis-bg`/`--emphasis-text` (the same pair `.filter-chip.active` itself already
  uses) so it always reads as "a dark circle on top of whichever bright fill the active
  chip ends up using," without hardcoding a color — verified visually in both themes.
- **`chartWrapper.js`'s `createBucketedBarChart(canvas, { labels, values, bucketOf })`**
  — a value-bucketed multi-color bar series (defaults to a tercile split over `values`
  when `bucketOf` is omitted; high/medium/low map to `--accent-lime`/`--faint`/
  `--line-strong`) plus a custom floating tooltip (`.chart-tooltip`, `app.css` — a fixed
  white-card/dark-text tooltip in both themes, matching the reference exactly rather
  than following site theme, same reasoning as `.auth-marketing`'s always-dark panel).
  The tooltip is **portaled to `document.body`**, not appended near the canvas — this
  app's established "every floating/positioned element is a portal" convention
  (`select.js`/`dropdown.js`, this file's transformed-ancestor section above). This
  wasn't a hypothetical precaution: an earlier version of this component appended the
  tooltip as a sibling of the canvas and positioned it with viewport-relative
  coordinates, which only works when the tooltip's positioning ancestor is the
  document itself — the mismatch was caught during this phase's own isolated visual
  verification (the tooltip rendered nowhere near the hovered bar) and fixed before
  Phase C/D ever wires this into a real page. `chart.destroy()` is wrapped to also
  remove the portaled tooltip node, so the existing `chart?.destroy()` call-site
  pattern (`progress.js`) needs no change to stay leak-free.
- **`createChartLegend(items?)`** (`chartWrapper.js`) — the reference's "dot + label"
  row (`.chart-legend`, `app.css`), defaulting to the high/medium/low bucket set above.
  Per-bucket dot colors are discrete `.chart-legend-dot-{bucket}` classes, not an
  inline `style` (CSP has no `unsafe-inline` for `style-src`).

**Phase C, shipped — landing/auth/shell recolor.** The ZeBeyond structural classes
documented in the "ZeBeyond direction" section above (`.eyebrow`, `.text-gradient-brand`,
`.tag-chip-accent`, `.icon-tile`, `.btn-cta`, plus the landing-only `.feature-card-icon`/
`.step-card-icon`/`.landing-proof-text` and the sidebar's `.nav-item.active`) now read
the `--accent-lime`/`--accent-lime-dark`/`--accent-lime-light`/
`--accent-lime-light-border` family under `:root[data-theme='dark']`, in place of
`--brand`/`--brand-dark`/`--brand-light`/`--brand-light-border` — colors only, every
class's structure/markup is unchanged from ZeBeyond. Light theme keeps the mint values
(no override), consistent with Phase A/B's "no v2 reference material exists in light
theme" reasoning. `.auth-marketing-eyebrow` (a fixed literal, not a token, since that
panel is always-dark regardless of site theme) moved from `#5eead4` to `#f0f941`
directly and unconditionally.

**Phase D1, shipped — Progress page's stat strip.** `progress.js`'s `renderStatTile()`
now builds Phase B's `.kpi-tile`/`.kpi-tile-hero` markup instead of `.stat-tile` —
`.kpi-tile-head` (label + `.card-arrow-badge` icon), `.kpi-tile-number` (the value plus
a small `.kpi-tile-total` caption, e.g. "128 `/ 484`"), and an optional `.kpi-tile-bar`
(the existing mini progress-bar SVG, only on the "Items complete" tile). "Items
complete" is the one `hero: true` tile — the single stat that matters most on this
page, per the reference's "exactly one hero-highlighted tile" rule. New CSS:
`.kpi-tile-total` (a muted inline caption, with a `.kpi-tile-hero` override reading
`--soft` at reduced opacity) and a `.kpi-tile-hero .mini-bar-fill`/`.mini-bar-track`
override so the progress bar reads correctly against the solid accent fill instead of
its default teal-on-dark styling. `dashboard.js`'s own `.stat-tile` strip is a
different page and is untouched. **Deliberately scoped to just this one stat strip**,
not `settings.js` or any of the ~12 modals the issue's Phase D also names — those are
tracked as separate follow-up phases given the real size of a genuine first design pass
across that many surfaces (see tracker issue #11's row for #155).

**Phase D2, shipped — Settings page.** `.settings-verified` (`app.css`) — the only
accent-colored class unique to `settings.js`, every other class on that page is neutral
gray/ink — now reads `--accent-lime-dark` in dark theme, falling back to mint in light
theme, the same scoped-override pattern Phase C used for landing/auth/shell. No other
change was needed on this page: its cards/rows already read the Phase A near-black
scale automatically via tokens (no page-specific token overrides exist), and its
remaining classes are neutral, not accent-colored. **Deliberately scoped to just this
one class** — the ~12 modals the issue's Phase D also names are tracked as a further
Phase D3, not this PR (see tracker issue #11's row for #155).

**Phase D3 (part 1), shipped — importRoadmapModal.js + feedbackModal.js.** Two of the
~12 modals in scope, picked for having a genuine `--brand`-colored element to recolor
(most modals in this app are neutral gray/ink with no accent color at all — grepped
before touching any file, not assumed). `.import-step-badge` (the numbered "1"–"6"
circle badges on the "Create your own roadmap" modal) is a fixed white-text-on-solid-
`--brand` badge — its dark-theme override swaps **both** the fill (`--accent-lime`)
*and* the text color (`var(--soft)`, near-black, not the base rule's fixed white),
since white text on lime fails badly (the issue's own explicit callout). This is
different from every border/outline-only recolor elsewhere in this pass
(`.feedback-type-card:hover`/`:focus-visible`, also shipped here) — those carry no
text-contrast requirement of their own, so a straight `border-color`/`outline-color`
token swap was safe without touching any text color. `.feedback-reference` (the
monospace bug-report reference code) follows the same simple pattern as
`.settings-verified` in Phase D2 — `--accent-lime-dark` text, mint fallback in light
theme. All three reuse Phase A's already-live-verified contrast figures; no new
calculation was needed. **The other ~10 modals remain** — tracked as further Phase D3
follow-up PRs, split by modal (see tracker issue #11's row for #155).

**Phase D3 (full completion), shipped — issue #155 v2 fully complete.** Every remaining
`--brand`/`--brand-dark`/`--brand-light`/`--brand-light-border` selector in `app.css`
(~45 in total, across every page/modal/shared component the app has) now has a
`:root[data-theme='dark']` lime override, closing out the issue's "genuinely every
page and every modal" mandate in full. Found by grepping the whole file for every
remaining `var(--brand...)` occurrence (not assumed from the issue's own file list,
which named stale filenames in places — e.g. `newRoadmapModal.js` no longer exists,
merged into `importRoadmapModal.js` by issue #100). Two swap patterns, applied
consistently:

1. **Straight swap** — border/outline/plain-text/icon colors, which carry no
   text-contrast implication of their own: `.field-input:focus`, `.password-toggle:
   focus-visible`, `.field-validation-icon.valid`, `.strength-segment.strong`,
   `.forgot-link:hover`/`:focus-visible`, `.remember-checkbox` (accent-color),
   `.template-card:hover`/`.template-card-current`/`.template-card-count`/
   `.template-card-info-corner:hover`, `.custom-select-trigger:focus-visible`,
   `.shared-item-status`/`.shared-resource-link` (`sharedRoadmapView.js`),
   `.search-input:focus`, `.progress-ring-fill`, `.save-badge .spin`,
   `.changelog-type-dot.changelog-type-feat`, `.notes-status`, `.mini-bar-fill` (base
   rule — `.kpi-tile-hero .mini-bar-fill`'s own Phase D1 override still wins by
   specificity), `.daily-todo-remaining.ok`, `.projection-headline`,
   `.landing-mock-bar-fill`, `.feedback-widget-trigger:focus-visible`.
2. **Fill + text swap** — anything with fixed white text on a solid `--brand`/
   `--brand-dark` fill needs its text color changed too, not just the background, since
   white-on-lime fails badly (the issue's own explicit callout): `.reset-success-icon`,
   `.avatar` (the reference explicitly names "avatar-ring accents" as a lime use case),
   `.check-item.done .check-box`/`.check-mark` (the app's single most-used interactive
   element — every checklist row), `.feature-new-badge`, and **`.toast-success`** — the
   exact call site Phase A's own code comment named as *the reason* not to retune
   `--brand-dark` globally in the first place. Handled safely here as a scoped
   override instead of a token retune, exactly as that comment anticipated.

Several `--brand-light`/`--brand-light-border`/`--brand-dark` text-on-light-fill
badges/banners followed the same shape as Phase C's `.tag-chip-accent`:
`.template-card-current-badge`, `.current-roadmap-badge`, `.stat-tile-icon`/
`.stat-tile-number`/`.stat-tile-ring-value` (dashboard's own stat strip — distinct
component from `progress.js`'s `.kpi-tile`, Phase D1), `.daily-todo-linked-badge`,
`.custom-select-option.active`, `.verification-banner`, `.backup-reminder-banner`,
`.btn-secondary` (the app's single most-used secondary button).

**`--focus` retuned directly, not per-selector** — the translucent focus-ring glow
(`box-shadow: 0 0 0 4px var(--focus)`) read by every focusable element app-wide was
still teal after every individual border/outline swap above, and visually dominates a
focus ring far more than a 1-2px border does. Since it's purely decorative (never hosts
text), none of the contrast concerns blocking a direct `--brand-dark` retune apply —
retuned from `rgba(45, 212, 191, 0.28)` to `rgba(240, 249, 65, 0.28)` (lime's RGB, same
alpha), dark theme only.

**Deliberately still untouched — product identity, not an accent.** `.brand`/
`.brand-mark`/`a.brand:focus-visible` (the "Ascent" logo mark/wordmark) keep their
fixed teal→cyan gradient in both themes, exactly as Phase A left them. The v2
reference is a third-party dashboard screenshot with no app branding in it — the
product's own logo color is a separate design decision outside the reference's
purview, same reasoning `.brand-mark`'s own code comment ("fixed brand gradient, same
in both themes") already documents. `.tab[aria-selected='true']` was also left
untouched — confirmed via grep that `tabs.js` has no live call site anywhere in the
app (audited dead code, issue #125); recoloring CSS nothing renders isn't worth
verifying or screenshotting.

**Live contrast verification (relative-luminance calculation, same discipline as every
other token in this file):** every new pairing in this pass falls into one of three
already-verified buckets from Phase A — `--accent-lime`/`--soft` (17.48:1),
`--accent-lime-dark` on `--panel`/`--panel-2` (11.4–11.9:1), or `--accent-lime-dark` on
`--accent-lime-light` (10.14:1, newly computed for this pass, still comfortably
passing) — so no pairing needed fresh calculation beyond confirming which bucket it
belonged to.

**Phase E (full verification), shipped.** `tests/e2e/accessibility.test.js`'s full
suite re-run against a real Firebase emulator (not the guest-session-only local
verification earlier phases were limited to) — 16/16 accessibility checks passing,
both themes, every page and modal the suite covers. This surfaced 6 pre-existing axe
sampler false positives (the same "pixel sampler misattributes color near an
animation/progress-ring/sticky-position ancestor" bug class this file's
`CONTRAST_FALSE_POSITIVE_SELECTORS` comment block already documents at length),
**none caused by this design pass** — `.resource-count`, `.btn-ghost`, `.field-label`,
`.priority-tag`, `.section-label`, and `.kpi-tile`/`.kpi-tile-hero`/`.kpi-tile-label`
were added to that list, each with its own live-verified real contrast figure in the
adjacent code comment, following the exact discipline that list's own header comment
requires ("don't add it without the same live verification"). The full E2E suite
(103 tests) was also re-run: 100 passed outright, 2 passed on retry (matching issue
#141's already-documented pre-existing intermittent-flake list), and one
(`roadmapSharingRules.test.js`, a Firebase security-rules test with zero relation to
`app.css`/design work — confirmed via `git diff` showing no change to
`firebase/database.rules.json`) failed consistently but pre-dates this pass entirely.
A responsive spot-check (375/768/1024/1440px, dark theme, dashboard) confirmed no
layout regression — expected, since every change across this whole pass (Phases A–E)
is a color-value swap; no `display`/`flex`/`grid`/`width`/`height`/`padding`/`margin`
property was touched anywhere.

## Visual design language v3 — "Alpenglow" (issue #206, supersedes v2 above)

Issue #206 replaces (not extends) the lime/near-black direction documented in full
above — same supersession relationship v2 had to its own ZeBeyond predecessor. Warm
neutrals in both themes (not pure white/black, not cream) with a two-color gold→rose
brand gradient (`--gradient-alpenglow`) as the signature element, used sparingly:
the active-roadmap card's top border, the Progress page's "Complete" ring, the brand
mark, and one gradient accent dot per empty state — never a flat fill on a
button/chip/badge or any high-frequency element.

**Full token replace, not an alias layer.** Every token in `:root`/
`:root[data-theme='dark']` was renamed and re-valued to the issue's exact spec'd names
(`--color-bg`, `--color-surface`, `--color-surface-raised`, `--color-border`,
`--color-border-strong`, `--color-text`, `--color-text-muted`, `--color-text-faint`,
`--color-brand-gold`, `--color-brand-rose`, `--color-success`/`-bg`, `--color-warning`/
`-bg`, `--color-danger`/`-bg`, `--color-p0`–`--color-p3`, plus the type/spacing/radius/
shadow/motion scale — `--text-*`, `--space-*`, `--radius-*`, `--shadow-*`,
`--duration-*`, `--ease-*`), and every call site across `app.css` was mechanically
updated in the same PR — a deliberate decision made with the user after an initial
parallel-namespace (`-ag`-suffixed) approach was rejected as leaving permanent dual
naming in production CSS. If you find a stray `--ink`/`--soft`/`--panel`/`--brand`/
`--accent-lime*`/`--muted`/`--line`/`--accent-2*` reference anywhere (including inside
`cssVar()` calls in `.js` files, which a pure `app.css` grep won't catch — this bit
`chartWrapper.js`'s chart-color helpers during this migration, see below), it's a
migration miss and should be repointed to the mapping below, not left as dead code.

**Old token → new token mapping** (for anything not yet migrated, or any future
archaeology): `--ink`→`--color-text`, `--muted`→`--color-text-muted`,
`--faint`→`--color-text-faint`, `--panel`/`--panel-2`→`--color-surface`/
`--color-surface-raised`, `--line`/`--line-strong`→`--color-border`/
`--color-border-strong`, `--soft`→`--color-bg` (background role) or `--color-text`
(text-on-accent-fill role — gold hosts dark text in **both** themes now, collapsing the
old cross-theme near-black/near-white flip), `--danger`/`--danger-border`→
`--color-danger` (border variant collapsed, no dedicated tint-border token in spec),
`--p0`–`--p3`→`--color-p0`–`--color-p3`, `--accent`→`--color-warning`, `--brand`/
`--brand-dark`/`--accent-lime`/`--accent-lime-dark`→`--color-brand-gold` (all four old
"primary accent" variants converge — Alpenglow has no separate darker-gold tier),
`--brand-light`/`--accent-lime-light`→`--color-warning-bg` (closest available light-gold
tint, not a precise match), `--brand-light-border`/`--accent-lime-light-border`→
`--color-border-strong`, **`--accent-2`/`--accent-2-dark`→`--color-brand-rose`** (the old
violet "AI-assisted" hue — deliberately kept distinct from brand color by the v2 rule
above — now shares a token with the gradient's second stop; a real user decision, not a
guess: Alpenglow's two-hue palette has no room for a third, and the alternative of
inventing a new token outside the spec's exact list was explicitly rejected in favor of
staying spec-exact), `--accent-2-light`→`--color-danger-bg` (arbitrary nearest-unused
tint, not a strong semantic match), `--status-ok/warn/error-bg/text/border`→
`--color-success/-warning/-danger` `-bg`/plain pairs (border variants collapsed into the
text token), `--track-bg`→`--color-border-strong`, `--emphasis-bg`/`-text`→
`--color-text`/`--color-bg` (preserves the existing "inverted chip" trick),
`--surface-glass`/`--border-glass`/`--glow-brand`/`--glow-accent`/`--focus` kept their
own names but were retuned from cool/lime rgba to warm-neutral/gold rgba (no Alpenglow
spec name exists for the glass/glow roles), `--surface-0/1/2/3`→`--color-bg`/
`--color-surface`/`--color-surface-raised`/`--color-surface-raised` (the old 4th
"deepest inset" tier has no Alpenglow equivalent, collapsed into `-raised`), `--font`→
`--font-body`, `--mono`→`--font-mono`, `--font-display` kept its name (value now
Fraunces — the spec's 4-location-only restriction on where this token may be used is a
per-component job, not the token pass's; some headings may still render serif until
their own component is touched), `--text-md`→`--text-base` (rounded up, no exact spec
tier existed), `--leading-relaxed`→`--leading-loose` (exact 1.7 value match),
`--space-5/10/20`→`--space-6/12/24` (rounded up, arbitrarily tie-broken — each was
equidistant between two new tiers), `--radius`→`--radius-md` (exact pixel match, zero
visual risk). `--brand-cyan` (the old `.text-gradient-brand`/`.brand-mark` gradient
endpoint) was removed outright once its last call site was repointed to
`var(--gradient-alpenglow)` directly — no Alpenglow equivalent needed, since the whole
point of the new token is to replace ad hoc two-color gradients like that one.
**Left untouched, no Alpenglow spec coverage** (still live, still valid): motion tokens
not in the spec's list (`--duration-instant`/`-enter`, `--stagger-base`, all
`--ease-spring`/`-out`/`-in-out`/`-bounce` — motion consolidation is PR 2/§5 scope),
`--leading-snug`, `--tracking-*`, `--topbar-h`, `--icon-size-*`, `--chip-*`,
`--shadow-xs`/`-xl`/`-brand`, `--heat-0..4`, `--neutral-*`, `--accent-50/400/500`.
**`--brand-50/100/500/600/700`** (the old teal scale `shareCard.js`'s canvas-rendered
share card kept using on its own after the rest of the app moved to gold/rose) was a
similar deliberate exception at the time — since removed in a follow-up, once real
feedback (a screenshot of the share card still showing the retired teal look) prompted
recoloring it too. `shareCard.js`'s `drawBackground()` now reads
`--color-brand-gold-ink`/`--color-brand-rose-ink` (see that file's own comment for why
the darkened "-ink" variants, not the base gold/rose tokens, are the right choice for a
card that hosts white text throughout) — the old five-token teal scale had no other call
site anywhere in the app, so it was deleted outright rather than left as dead tokens.

**Component-level changes, all CSS-only except where noted:**
- **Buttons** — `.btn-primary`/`.btn-secondary`/`.btn-ghost`/`.btn-danger` rebuilt
  against the mapping above: filled-gold + shadow-lift hover, surface+border-strong,
  transparent→surface-raised hover, filled-danger, respectively. Every variant's focus
  ring moved to `outline` on `:focus-visible` only (never plain `:focus`), and disabled
  state suppresses hover entirely rather than just fading opacity. `.btn-cta` (the
  landing-page pill CTA) was kept as its own class aliased to the primary treatment
  rather than merged into `.btn-primary`, to avoid a `.js` touch on a CSS-only pass —
  flagged as a possible future unification.
- **Cards** — hover-lift (`translateY(-2px)` + shadow-md + border-strong) is now scoped
  to genuinely clickable cards only (`.template-card`, which has a real
  `.template-card-pick` click target) — removed from `.phase-card` and `.stat-tile`,
  which have no card-level click handler of their own. The active-roadmap indicator
  (`.template-card-current`) uses `border-image: var(--gradient-alpenglow) 1` sliced to
  the top edge only (`border-image-slice`/`-width` zeroed on the other three sides, which
  fall back to the card's plain `border-{side}: 1px solid var(--color-border)`) — not a
  full gradient border or a background tint. The `.template-card` equal-height flex
  column + `margin-top: auto` footer pattern (the real historical bug this file's own
  card-grid section above documents) was verified intact, not regressed.
- **Checklist rows** — `.check-box`'s checked-state fill moved from the old brand/gold
  color to `--color-success` (a semantic completion color, distinct from the brand
  accent) + a light contrast checkmark.
- **Forms** — focus glow uses `color-mix(in srgb, var(--color-brand-gold) 20%,
  transparent)`, matching this file's existing opacity-token idiom (`--surface-glass`,
  `--focus`) rather than a fresh rgba literal.
- **Modals** — the overlay scrim is `rgba(0,0,0,0.5)` fixed regardless of theme, per an
  explicit `/* intentional: ... */` comment satisfying `scripts/lint-theme.mjs`'s rule
  (see that rule's own entry above) — the one deliberate non-token color in this pass.
- **Badges/chips** — priority pills (`.badge.P0`–`P3`, `.filter-chip[data-p].active`)
  moved from a flat saturated fill + white text to a `color-mix()` 15%-opacity tint
  background + full-opacity `--color-p*` text — removes the need for the old dark-theme
  white-text-contrast override this file's issue #116 section documents, since the new
  pairing is contrast-safe by construction in both themes.
- **Nav sidebar** — `.nav-item.active`'s indicator changed from a flat background fill
  to `box-shadow: inset 3px 0 0 var(--color-brand-gold)` (a left-edge accent bar) +
  `--color-surface-raised` bg — inset box-shadow was chosen specifically to avoid the
  layout shift a real `border-left` would have caused on an element with existing
  padding. Also moved off the old full-pill radius to `--radius-md`, since a straight
  edge bar reads as visually clipped against a rounded pill corner.
- **Toasts** — rebuilt from a solid-fill 999px pill with white text to
  `--color-surface` bg + `--color-text` + a `border-left: 3px solid` accent bar colored
  by type (a real border was used here instead of the sidebar's inset-shadow approach,
  since toasts have no existing border to conflict with and a border naturally respects
  `border-radius` clipping) — also moved off the pill radius to `--radius-md` for the
  same reason as the sidebar item above.
- **Empty states** — Progress page zero-states, dashboard's no-matching-filter state,
  and `itemPanel.js`'s "no resources yet" state got action-oriented copy (per
  `.claude/rules/content-style.md`) — de-emphasizing the literal zero rather than leading
  with it. The accent dot originally spec'd as `var(--gradient-alpenglow)` is a flat
  `var(--color-brand-gold)` fill instead, per the no-gradients decision immediately below.
- **Progress ring + brand mark, superseded by a later no-gradients decision.** §7
  originally called for the Progress page's circular "Complete" indicator and
  `brand.js`'s `createBrandIcon()` to both render `var(--gradient-alpenglow)` via an
  inline SVG `<linearGradient>` stroke — shipped that way initially, then reverted in
  the same PR after an explicit user decision: **no gradients anywhere in the app,
  solid colors only.** `progressRing.js` no longer builds a `<linearGradient>` at all
  (flat `var(--color-brand-gold)` stroke via `.progress-ring-fill` in `app.css`, not an
  inline attribute); `.brand-mark`/`.text-gradient-brand`/`.template-card-current`'s
  border-image top accent all moved to the same flat gold. `--gradient-alpenglow`
  (`app.css` `:root`) is kept as a token definition — still referenced by its own doc
  comments, in case a future design pass wants it back — but has **zero remaining call
  sites** anywhere in `app.css` or any `.js` file as of this decision. A follow-up
  pass (issue #206 §5) later found four page-wide ambient background gradients this
  sweep had missed (`body`, `.auth-page-bg`, `.auth-marketing`, `.bg-grid-glow`'s glow)
  — see the Motion section below for that fix. If you find a stray
  `var(--gradient-alpenglow)` reference anywhere, it's a regression, not an
  intentional use — flatten it to `var(--color-brand-gold)` (or `--color-brand-rose`
  if the specific spot was meant to skew toward the rose end) rather than restoring
  the gradient.

**PR 2, issue #206 §4.1 — card-action overflow menu, shipped.** `onboarding.js`'s
template cards used to stack a standalone `.template-card-favorite` star button next to
a `.template-card-hide` (built-in) or `.template-card-delete` (custom/imported) button in
the card's top-right corner — both now collapse behind one new
`.template-card-overflow-btn` (⋯, `createIcon('overflow', ...)`) opening a
`createDropdown()` menu (`.template-card-overflow`, the dropdown's own portaled-to-
`document.body` wrapper positioned in the same corner slot the old buttons occupied) with
Favorite/Unfavorite plus Hide or Delete, per the spec's "2+ secondary actions collapse
into one ⋯ menu" rule. `onboarding.js` tracks every open dropdown in its own
`dropdownEls` array (parallel to the existing `cardEls` array) specifically because
`renderVisibleGrid()` tears down and rebuilds every card on any favorite/hide/delete/live-
store-update — each dropdown's `_cleanup()` (removes its `document` click listener and any
still-portaled menu node) must run before the old card DOM is discarded, or a re-render
leaks one listener per rebuild; the same cleanup array is also flushed in the route's own
final cleanup return. "Create your own roadmap" keeps its own single, always-visible
`.template-card-info-corner` button unchanged — it only ever had one secondary action, so
the spec's 2-or-more-actions trigger for collapsing into a menu never applied to it.
Icon replacement (§4) needed no new work here — it was already complete app-wide from
issue #136's earlier emoji-elimination pass (`scripts/lint-icons.mjs` was already clean
before this PR); the one new icon this PR added is `overflow` itself
(`src/ui/components/icons.js`), the ⋯ trigger glyph, since no existing icon in the set
covered that shape.

**PR 2 (continued), issue #206 §5 — motion/animation system, shipped.** Most of §5 turned
out to already exist from earlier work (route-mount fade-in per page, modal entrance,
skeleton/confetti/entering-row animations, and a global
`@media (prefers-reduced-motion: reduce) { *, *::before, *::after { animation-duration:
0.01ms !important; transition-duration: 0.01ms !important; scroll-behavior: auto
!important; } }` catch-all covering every animation in the app, not just the ones with
their own explicit override) — this pass closed the specific remaining gaps, found by
auditing every §5 bullet against the actual codebase rather than assuming the whole
section was unbuilt:
- **Checkbox check micro-animation** — `.check-pop` (`app.css`, next to `.check-box`),
  a `scale(1)->scale(1.15)->scale(1)` pop on `--duration-fast`, layered on top of (not
  replacing) `.check-mark`'s pre-existing spring-bounce fade-in. `toggleDone()`
  (`dashboard.js`) adds/removes the class directly — a forced reflow (`void
  checkBoxEl.offsetWidth`) between remove and re-add is required so the animation
  restarts on rapid repeated clicks, since a second toggle before the first
  `animationend` fires would otherwise be a no-op class-add. Fires only when marking an
  item *done*, never on uncheck, matching the spec's exact wording.
- **Toast entrance/exit timing** — `.toast`'s transition moved off a hardcoded `220ms
  ease` onto `--duration-base`/`--ease-decelerate` (entrance, the base rule) and
  `--duration-fast`/`--ease-accelerate` (exit, a `.toast:not(.show)` override) — CSS
  transitions use the *target* state's own `transition` property, so this asymmetric
  in/out pairing works correctly with a single declarative rule pair, no JS timing
  logic needed. `toast.js`'s own post-fade DOM-removal `setTimeout` was retuned from a
  hardcoded `260` to a named `EXIT_TRANSITION_MS = 120` constant matching
  `--duration-fast`'s value — kept as a literal (not read via `getComputedStyle`) since
  it's one constant; if `--duration-fast` is ever retuned, update this alongside it or
  the toast will be yanked from the DOM before its own fade-out visually finishes.
- **Route transition coverage** — every page already had a `.fade-in` class on its
  outermost container (`authShell.js`'s `.auth-page`, `dashboard.js`/`onboarding.js`/
  `progress.js`/`settings.js`'s own `.app-shell-2` wrapper) *except* `landing.js` and
  `sharedRoadmapView.js`, both missed by the earlier pass. A genuine router-level
  approach (applying the class once in `router.js` to the shared `#app` mount) was
  prototyped and deliberately **not** kept — it would have double-animated every page
  that already carries its own inner `.fade-in`, and the spec's own wording explicitly
  frames the router-level approach as an *alternative* to per-page ("if possible... else
  per-page"), not something to layer on top of an existing per-page implementation.
  Closing the two gaps was the correct, minimal fix.
- **Progress ring fill** — already animates `stroke-dashoffset` on change
  (`.progress-ring-fill`, `var(--duration-enter) var(--ease-spring)`) — a valid
  `--duration-*`/`--ease-*` token pairing, just not literally `--duration-slow`/
  `--ease-standard` as the spec's own example names; left as-is rather than retuned for
  its own sake, since the actual requirement (animate on mount/update, tokens only) was
  already met.
- **Modal entrance** — already used `--duration-enter`/`--ease-spring` (a valid token
  pair outside the core §2 list, same status as the progress ring above); no exit
  animation existed and none was added — modals in this app currently close by DOM
  removal, not a class-driven exit transition, and adding one was judged out of scope
  for a gap-closing pass this focused.

No PR 3 remains for §5 — the section is complete. If a future audit finds another gap,
treat it as a normal follow-up fix, not evidence the whole system needs rebuilding.

## First-time feature tour — spotlight/portal/focus-trap convention (`featureTour.js`, issue #17)

**Reuses two existing conventions instead of inventing new ones — `attachFocusTrap()`
and the "every floating/positioned element is a portal" rule above.** Each step's
popover and the welcome card both call `attachFocusTrap(cardEl, { onEscape })` (`modal.js`)
directly, same as every ad hoc modal in this app — no bespoke Escape-only `keydown`
handler. The ring, scrim, and popover are all appended straight to `document.body` (the
portal convention), never a descendant of whatever they're highlighting, and the
target itself is resolved live via `step.target()` (a plain `querySelector` call) on
every reposition, not a cached element reference — this is what lets a step survive a
structural re-render (a `.phase-card` toggling open, a `structuralVersion` bump) between
`showStep()` calls.

**The dimming "spotlight" is the ring's own `box-shadow`, not a `clip-path`'d overlay.**
`.tour-ring` is positioned with `getBoundingClientRect()` over the target and given a
huge-spread `box-shadow: 0 0 0 9999px rgba(0,0,0,0.6)` — that spread fills the rest of
the viewport, leaving the ring's own box as a transparent "cutout" over the highlighted
element. Repositioning on scroll/resize is then just two style writes
(`ring.style.left`/`top`/`width`/`height`) rather than recomputing a path — cheaper to
keep in sync, and the reason the issue's own spec called for box-shadow over
`clip-path` in the first place. A separate `.tour-scrim` (transparent, `pointer-events:
auto`) sits behind the ring/popover purely to swallow clicks on the dimmed page during
the tour — the ring itself is `pointer-events: none`, and box-shadow never participates
in hit-testing.

**z-index 1100+, deliberately above every other floating element in this file,
including an already-open modal.** `.custom-select-listbox`'s `1010` was the highest
z-index anywhere in `app.css` before this — the tour can be re-triggered mid-session via
"Take a tour" while the user is anywhere on the dashboard, so it must render on top of
literally everything, not just the base page content every other portaled element
above assumes it's competing with.

**Collision-aware popover placement is hand-rolled, matching `tooltip.js`'s existing
approach rather than pulling in a positioning library.** `computePlacement()`
(`featureTour.js`) tries below → above → right → left, in that order, falling back to a
viewport-clamped "below" if nothing fits cleanly — same shape as `tooltip.js`'s
above/below flip, just with two more fallback directions since a tour popover is larger
and more likely to need them.

## Branded print/PDF export (issue #160, restructured onto `<thead>`/`<tfoot>` in a follow-up)

**A repeating print header/footer uses a real `<table>` with `<thead>`/`<tfoot>`, not
`position: fixed` and not an `@page` margin box.** Two `position: fixed`-based
approaches were tried and rejected before this, both confirmed broken via a real
multi-page `page.pdf()` render (not just visual inspection or assumption) — see the
comment above `@media print` in `app.css` for the exact reasoning, kept in detail
there since this is easy to reinvent incorrectly a third time:

1. **`position: fixed` header/footer + `.print-roadmap`'s own padding for
   clearance.** That padding only applies once, at the very top/bottom of the whole
   flowed document — it does nothing on page 2+, where Chrome's pagination starts the
   next chunk of flowing content flush against the physical page edge. A real
   47-page multi-phase roadmap export showed every page after the first with its
   heading text overlapping the fixed brand header directly on top of it.
2. **`position: fixed` header/footer + an `@page { margin-top/-bottom }` rule.**
   This looked like the correct fix for (1) — `@page` margins genuinely do
   re-apply on every physical page, unlike document padding — but a follow-up
   `page.pdf()` render with real text-position inspection (not a screenshot) showed
   the overlap was still present: Chromium positions `position: fixed` elements
   during print pagination relative to the page's *content box* (i.e., already
   inside the `@page` margin), not the physical page edge. A fixed header at
   `top: 0` therefore lands at the exact same coordinate the flowing content starts
   at — the margin reserves the space, but the fixed header renders *inside* that
   reserved space instead of *above* it, reproducing the identical overlap
   regardless of how large the margin is.

`<thead>`/`<tfoot>` inside a real `<table>` (`.print-roadmap` — `printRoadmap.js`
builds an actual `<table>`/`<thead>`/`<tfoot>`/`<tbody>` tree now, not `<div>`s with a
`position: fixed` class) is the browser-native, spec-backed mechanism for exactly
this — "repeat this row and reserve real space for it on every printed page" — and
was the only one of the three approaches a real multi-page `page.pdf()` render
confirmed clean (no overlap, correct repeat) on every page, verified specifically in
Chromium via direct PDF text-position extraction, not a visual screenshot alone.
`.print-page-header`/`.print-page-footer` (the branded content itself, unchanged
visually) now live inside a `<td>` in the `<thead>`/`<tfoot>` row rather than being
`position: fixed` themselves — if you ever need a third repeating band (e.g. a
running page-number footer), add another `<thead>`/`<tfoot>` row rather than
reaching for `position: fixed` again.

**`@page { margin: 0 }` suppresses the browser's own injected print
header/footer (URL, date, page number) — real feedback, screenshot.** Chrome
and Firefox both render their own print chrome (page URL in one top corner,
date/time in the other, URL + page number in the bottom corners) into the
blank margin band they reserve around the page by default — this showed up
live as `localhost:4173/#/app` printed at the top of every exported page
during local dev. With `@page { margin: 0 }` (`app.css`'s `@media print`
block), there's no margin band left for that browser chrome to paint into,
regardless of the user's own "Headers and footers" print-dialog toggle. This
is unrelated to (and doesn't reintroduce) the `<thead>`/`<tfoot>` fix above —
`position: fixed` is no longer used anywhere in this stylesheet, so there's
no risk of the earlier margin-vs-content-box mispositioning bug recurring.
Since the browser's own default margin is gone, `.print-roadmap`'s
`<thead>`/`<tfoot>`/`<tbody>` `<td>`s now carry their own explicit
`padding: 0 40px` so content doesn't run edge-to-edge on the physical page —
if you resize the page's overall side margin, change that padding value, not
`@page`'s (which must stay `0`).

**`.print-watermark` is a `position: fixed` full-page repeating background
mark, and deliberately does *not* use the `<thead>`/`<tfoot>` technique
above.** Real feedback: printed roadmaps should show a faint, blurred Ascent
logo+wordmark behind the checklist content on every page. Unlike the
header/footer, a watermark is *meant* to overlap the flowing content (that's
the whole point of a watermark) rather than needing space reserved clear of
it — so the exact problem `<thead>`/`<tfoot>` solves (repeat *and reserve
space for* a row) doesn't apply, and `position: fixed`'s per-page repeat
behavior (which was never broken — the earlier bug was the *unrelated*
margin/content-box mispositioning issue, not the fact that fixed content
doesn't repeat) works fine here on its own. `.print-watermark` (`z-index: 0`,
`filter: blur(2px)`, `pointer-events: none`, appended to `document.body`
before `.print-roadmap` in `printSnapshot()`) sits behind
`.print-roadmap` (`z-index: 1`) — `.print-roadmap` itself carries no
`background` for this exact reason: an opaque table background would paint
over the watermark instead of letting it show through the whitespace/behind
the text, since the physical page canvas is already white regardless.
`.print-watermark-mark`'s `opacity: 0.07` (not a `background-color` on a
`background` layer) is deliberate — `opacity`/`color` always print, unlike
`background-color`/`box-shadow`, which need the browser's own "background
graphics" print option enabled; a watermark that silently disappeared for
any user with that option off would be a worse bug than a heavier one that's
always guaranteed to render. Any future "always-visible regardless of
optional print-dialog settings" print decoration should follow this
`color`/`opacity`-only rule.

**Every color in the print stylesheet is a fixed literal, not a `--p0`-`--p3` token
read — even though the hues are meant to visually match the on-screen priority
system.** A printed page is always white paper regardless of the app's active
on-screen theme (the existing issue #133 rule, unchanged), so `.print-phase-P0`-`P3`
and `.print-priority-badge.print-priority-P0`-`P3` hardcode the *light-theme*
`--p0`-`--p3` hex values (`#dc2626`/`#b45309`/`#2563eb`/`#15803d`) as literals — never
the dark-theme values those same custom properties resolve to when the site theme is
dark. Each pairing (white text on a solid accent fill for the badges, accent-colored
left border against white for the phase card) was verified against actual white
paper specifically, not the dark-theme panel background the hue is visually copied
from — see the block comment above the print media query in `app.css` for the exact
contrast figures.
