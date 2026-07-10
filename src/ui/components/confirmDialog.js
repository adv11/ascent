import { el } from '../dom.js';
import { attachFocusTrap } from './modal.js';

// Shared replacement for the native window.confirm() — matches the app's own
// modal-overlay/modal-card styling instead of the browser's unstyleable
// built-in dialog. Resolves true/false instead of throwing/blocking, so every
// call site just does `if (!(await confirmDialog({...}))) return;`.
export function confirmDialog({ title, message, confirmText = 'Confirm', cancelText = 'Cancel', danger = false } = {}) {
  return new Promise(resolve => {
    function close(result) {
      detachTrap();
      overlay.remove();
      resolve(result);
    }

    const confirmBtn = el('button', {
      type: 'button',
      className: `btn ${danger ? 'btn-danger' : 'btn-primary'}`,
      'data-action': 'confirm',
      text: confirmText,
      onClick: () => close(true)
    });

    const card = el('div', { className: 'modal-card confirm-dialog-card' }, [
      el('h2', { className: 'modal-title', text: title }),
      el('p', { className: 'confirm-dialog-body', text: message }),
      el('div', { className: 'confirm-dialog-actions' }, [
        el('button', {
          type: 'button',
          className: 'btn btn-secondary',
          'data-action': 'cancel',
          text: cancelText,
          onClick: () => close(false)
        }),
        confirmBtn
      ])
    ]);

    const overlay = el('div', {
      className: 'modal-overlay',
      role: 'alertdialog',
      'aria-modal': 'true',
      'aria-label': title,
      onClick: e => { if (e.target === overlay) close(false); }
    }, [card]);

    // Issue #6 Phase 9 — Tab now cycles between Cancel/Confirm instead of
    // escaping to the page behind the overlay; Escape still closes as cancel.
    const detachTrap = attachFocusTrap(card, { onEscape: () => close(false) });
    document.body.appendChild(overlay);
    confirmBtn.focus();
  });
}
