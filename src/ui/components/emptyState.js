import { el } from '../dom.js';
import { createIcon } from './icons.js';

// Issue #6 Phase 3.2 — a full-bleed empty state, reusable across "no roadmap
// items match your filter", "no search results", "no resources yet", etc.
// `icon` names one of the shared createIcon() icons (issue #107) rather than
// a plain emoji glyph. Wired into dashboard.js's no-matching-filter state
// (issue #125), replacing a hand-rolled div with the identical markup.
export function createEmptyState({ icon = 'search', title, message, actionText, onAction }) {
  return el('div', { className: 'empty-state' }, [
    el('div', { className: 'empty-icon' }, [createIcon(icon, { size: 'lg' })]),
    el('p', { className: 'empty-title', text: title }),
    message ? el('p', { className: 'empty-message', text: message }) : null,
    actionText && onAction ? el('button', {
      type: 'button',
      className: 'btn btn-secondary btn-sm',
      text: actionText,
      onClick: onAction
    }) : null
  ].filter(Boolean));
}
