import { el } from '../dom.js';

// Issue #6 Phase 3.2 — a full-bleed empty state, reusable across "no roadmap
// items match your filter", "no search results", "no resources yet", etc.
// A single flexible factory rather than three hardcoded illustrations: this
// app has no illustration assets anywhere (every icon in the codebase today
// is a plain emoji glyph, not custom SVG art), so an `icon` glyph plays the
// same "friendly icon" role the spec's SVG illustrations would, without
// introducing a new asset pipeline for three one-off pictures.
export function createEmptyState({ icon = '🔍', title, message, actionText, onAction }) {
  return el('div', { className: 'empty-state' }, [
    el('div', { className: 'empty-icon', 'aria-hidden': 'true', text: icon }),
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
