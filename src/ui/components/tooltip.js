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
// below when there isn't enough room above (overflow detection against the
// viewport, not the trigger's offset parent, since `.tooltip-bubble` is
// absolutely positioned relative to `.tooltip-trigger` wherever that sits on
// the page) — or when "above" would land on top of a sticky section header
// (see `overlapsVisibleSectionLabel` above).
export function attachTooltip(triggerEl, text) {
  triggerEl.classList.add('tooltip-trigger');
  const bubble = el('span', { className: 'tooltip-bubble', role: 'tooltip', text });
  triggerEl.append(bubble);

  function positionBubble() {
    const rect = triggerEl.getBoundingClientRect();
    const bubbleWidth = bubble.offsetWidth || 120;
    const bubbleHeight = bubble.offsetHeight || 28;
    const candidateAbove = {
      top: rect.top - bubbleHeight - 6,
      bottom: rect.top - 6,
      left: rect.left + rect.width / 2 - bubbleWidth / 2,
      right: rect.left + rect.width / 2 + bubbleWidth / 2
    };
    const fitsAbove = candidateAbove.top >= 0 && !overlapsVisibleSectionLabel(candidateAbove);
    bubble.classList.toggle('tooltip-below', !fitsAbove);
  }

  triggerEl.addEventListener('mouseenter', positionBubble);
  triggerEl.addEventListener('focus', positionBubble);

  return bubble;
}
