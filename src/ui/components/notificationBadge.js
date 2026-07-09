import { el } from '../dom.js';

// Issue #6 Phase 3.8 — small dot/number badge for nav items (e.g. a future
// count of incomplete P0 items). A plain dot when `count` is omitted/0 but
// `show` is true; a capped "N+" number otherwise, since a two/three-digit
// exact count in a small circular badge stops being legible past a point.
export function createNotificationBadge(count, { max = 99 } = {}) {
  if (!count) {
    return el('span', { className: 'notification-badge notification-badge-dot', 'aria-hidden': 'true' });
  }
  const text = count > max ? `${max}+` : String(count);
  return el('span', { className: 'notification-badge', text });
}
