import { el } from '../dom.js';

const FOCUSABLE_SELECTOR = 'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])';

// Issue #6 Phase 9 — extracted out of openModal() below so every other ad hoc
// `.modal-overlay`/`.modal-card` implementation in the app (confirmDialog.js,
// newRoadmapModal.js, importRoadmapModal.js, addToDailyTodoModal.js,
// buildYourOwnGuide.js, dailyTodoGuide.js, deleteAccountModal.js) can
// get real Tab-cycling focus containment without duplicating this logic —
// they already had Escape-to-close, but none of them kept Tab focus inside
// the dialog, so a sighted keyboard user (or screen-reader user in browse
// mode) could Tab straight out into the page behind the overlay. Returns a
// cleanup function; callers must call it when the dialog closes, the same
// "always pair a subscription with its teardown" rule as everything else in
// this app (root CLAUDE.md's "Component subscription cleanup").
export function attachFocusTrap(containerEl, { onEscape } = {}) {
  function onKey(e) {
    if (e.key === 'Escape') {
      onEscape?.();
      return;
    }
    if (e.key !== 'Tab') return;
    const focusable = Array.from(containerEl.querySelectorAll(FOCUSABLE_SELECTOR)).filter(elmt => !elmt.disabled);
    if (!focusable.length) return;
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (e.shiftKey && document.activeElement === first) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && document.activeElement === last) {
      e.preventDefault();
      first.focus();
    }
  }
  window.addEventListener('keydown', onKey);
  return () => window.removeEventListener('keydown', onKey);
}

// Issue #6 Phase 3.5 — a generic modal builder with a focus trap, Escape/
// outside-click close, body scroll lock, and a spring entry animation using
// the Phase 1 motion tokens. Reuses the existing `.modal-overlay`/`.modal-card`
// classes (confirmDialog.js's own ad hoc pattern already established them) so
// every modal in the app — old and new — shares one visual language; this is
// additive capability (focus trap, scroll lock) for future call sites (Phase
// 4+ dashboard modals, issue #9's feedback widget), not a forced migration of
// confirmDialog.js/buildYourOwnGuide.js/etc., which already work correctly.
//
// `content` is any node (or array of nodes) rendered inside `.modal-card`.
// Returns `{ close }` — callers close it explicitly (e.g. from a button's
// onClick) in addition to it closing itself on Escape/outside click.
export function openModal({ content, ariaLabel, className = '', closeOnOverlayClick = true } = {}) {
  let closed = false;

  function close() {
    if (closed) return;
    closed = true;
    detachTrap();
    document.body.classList.remove('scroll-locked');
    overlay.remove();
    previouslyFocused?.focus?.();
  }

  const card = el('div', { className: `modal-card modal-card-enter ${className}`.trim() },
    Array.isArray(content) ? content : [content]);

  const overlay = el('div', {
    className: 'modal-overlay',
    role: 'dialog',
    'aria-modal': 'true',
    'aria-label': ariaLabel,
    onClick: e => { if (closeOnOverlayClick && e.target === overlay) close(); }
  }, [card]);

  const previouslyFocused = document.activeElement;
  const detachTrap = attachFocusTrap(card, { onEscape: close });
  document.body.classList.add('scroll-locked');
  document.body.appendChild(overlay);
  card.querySelector(FOCUSABLE_SELECTOR)?.focus();

  return { close };
}
