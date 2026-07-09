import { el } from '../dom.js';

// Issue #6 Phase 3.4 — lightweight tooltip for icon buttons/truncated text,
// no third-party library. Positions above the trigger by default, flipping
// below when there isn't enough room above (overflow detection against the
// viewport, not the trigger's offset parent, since `.tooltip-bubble` is
// absolutely positioned relative to `.tooltip-trigger` wherever that sits on
// the page).
export function attachTooltip(triggerEl, text) {
  triggerEl.classList.add('tooltip-trigger');
  const bubble = el('span', { className: 'tooltip-bubble', role: 'tooltip', text });
  triggerEl.append(bubble);

  function positionBubble() {
    const rect = triggerEl.getBoundingClientRect();
    const bubbleHeight = bubble.offsetHeight || 28;
    const fitsAbove = rect.top >= bubbleHeight + 8;
    bubble.classList.toggle('tooltip-below', !fitsAbove);
  }

  triggerEl.addEventListener('mouseenter', positionBubble);
  triggerEl.addEventListener('focus', positionBubble);

  return bubble;
}
