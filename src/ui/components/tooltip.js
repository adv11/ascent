import { el } from '../dom.js';

// Issue #12B follow-up — a tooltip on the first checklist row of a section
// rendered with its top sliced off, no matter how high its z-index was set
// (confirmed live: even z-index: 99999 didn't fix it). Root cause isn't
// z-index/paint-order at all: `.section-label` is `position: sticky`, and
// its containing block is `.phase-card` (`overflow: hidden`, for its
// rounded corners/priority-accent border, and also transformed on :hover) —
// a sticky element gets its own promoted layer scoped to that containing
// block, which Chromium paints ahead of ordinary z-indexed content inside
// the same block regardless of the z-index those elements declare. A
// tooltip popping "above" a row that sits directly under a section header
// has nowhere to go that doesn't overlap that header's box. Confirmed by
// temporarily forcing `.section-label` to `position: static` — the tooltip
// then rendered correctly on top, proving it wasn't a z-index bug at all.
// Fix: never place the bubble somewhere that would overlap a currently
// visible `.section-label` — flip below instead. `.section-label` is the
// only sticky element that can end up inside the same positioning context
// as a tooltip trigger in this app (`.app-topbar` is page-level and never
// near a checklist row); if a future tooltip trigger needs to coexist with
// a different sticky element, extend this selector, not the whole approach.
function overlapsVisibleSectionLabel(candidateRect) {
  const labels = document.querySelectorAll('.section-label');
  for (const label of labels) {
    const r = label.getBoundingClientRect();
    if (r.width === 0 && r.height === 0) continue;
    const overlaps = candidateRect.top < r.bottom && candidateRect.bottom > r.top &&
      candidateRect.left < r.right && candidateRect.right > r.left;
    if (overlaps) return true;
  }
  return false;
}

// Issue #6 Phase 3.4 — lightweight tooltip for icon buttons/truncated text,
// no third-party library. Positions above the trigger by default, flipping
// below when there isn't enough room above, or when "above" would land on
// top of a sticky section header (see `overlapsVisibleSectionLabel` above).
//
// Portaled to `document.body` on show/removed on hide (issue #180
// follow-up) — this app's established "every floating/positioned element is
// a portal" convention (`select.js`/`dropdown.js`, `.claude/rules/
// ui-styling.md`'s transformed-ancestor section), which this component had
// never actually followed: it used to append `.tooltip-bubble` as a plain
// DOM child of the trigger, absolutely positioned relative to it. That's
// invisible almost everywhere the trigger has no scrolling/overflow
// ancestor, but a real bug the moment it does — `heatmap.js`'s per-cell
// tooltip (trigger inside `.heatmap-scroll`, `overflow-x: auto`, which per
// the CSS overflow spec makes the unset y-axis compute to `auto` too) got
// its bubble visibly clipped/cut off at the container's edge, found live via
// a screenshot report. Positioning now reads `getBoundingClientRect()`
// (viewport-relative, matching `position: fixed`) and writes directly to
// `bubble.style.left/top` — direct DOM property mutation, not an inline
// `style` HTML attribute, so it's unaffected by the CSP's `style-src` with
// no `unsafe-inline` (same distinction `dropdown.js`/`select.js` already
// rely on).
export function attachTooltip(triggerEl, text) {
  triggerEl.classList.add('tooltip-trigger');
  const bubble = el('span', { className: 'tooltip-bubble', role: 'tooltip', text });

  function positionBubble() {
    const rect = triggerEl.getBoundingClientRect();
    const bubbleHeight = bubble.offsetHeight || 28;
    const centerX = rect.left + rect.width / 2;
    const candidateAbove = {
      top: rect.top - bubbleHeight - 6,
      bottom: rect.top - 6
    };
    const fitsAbove = candidateAbove.top >= 0 && !overlapsVisibleSectionLabel({
      ...candidateAbove,
      left: centerX - (bubble.offsetWidth || 120) / 2,
      right: centerX + (bubble.offsetWidth || 120) / 2
    });
    bubble.classList.toggle('tooltip-below', !fitsAbove);
    bubble.style.left = `${centerX}px`;
    bubble.style.top = fitsAbove ? `${rect.top - 6}px` : `${rect.bottom + 6}px`;
  }

  function show() {
    document.body.append(bubble);
    positionBubble();
  }

  function hide() {
    bubble.remove();
  }

  triggerEl.addEventListener('mouseenter', show);
  triggerEl.addEventListener('focus', show);
  triggerEl.addEventListener('mouseleave', hide);
  triggerEl.addEventListener('blur', hide);

  return bubble;
}
