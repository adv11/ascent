import { el } from '../dom.js';
import { attachFocusTrap } from './modal.js';
import { setButtonLoading } from '../utils/buttonLoading.js';

// Shared replacement for the native window.confirm() — matches the app's own
// modal-overlay/modal-card styling instead of the browser's unstyleable
// built-in dialog. Resolves true/false instead of throwing/blocking, so every
// call site just does `if (!(await confirmDialog({...}))) return;`.
//
// `onConfirm` is optional (every pre-existing call site omits it and keeps
// its old fire-and-forget-then-close behavior unchanged). Pass it when
// confirming kicks off an async action the user needs to see is actually
// happening — e.g. sign-out's pending-write flush — and the dialog stays
// open with the confirm button showing a spinner (`setButtonLoading`) until
// `onConfirm()` resolves, instead of closing instantly and leaving the user
// staring at a blank transition with no feedback. If `onConfirm()` throws,
// the dialog re-enables and stays open so the caller's own catch block (in
// the code that continues after `await confirmDialog(...)`) never runs —
// callers that pass `onConfirm` are expected to handle/report errors inside
// it themselves (see `signOut.js` for the pattern).
export function confirmDialog({
  title,
  message,
  confirmText = 'Confirm',
  cancelText = 'Cancel',
  confirmingText,
  danger = false,
  onConfirm
} = {}) {
  return new Promise(resolve => {
    let busy = false;

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
      onClick: async () => {
        if (!onConfirm) { close(true); return; }
        busy = true;
        cancelBtn.disabled = true;
        setButtonLoading(confirmBtn, true, confirmingText || `${confirmText}…`);
        try {
          await onConfirm();
          close(true);
        } catch (error) {
          console.error('confirmDialog onConfirm failed', error);
          busy = false;
          cancelBtn.disabled = false;
          setButtonLoading(confirmBtn, false);
        }
      }
    });

    const cancelBtn = el('button', {
      type: 'button',
      className: 'btn btn-secondary',
      'data-action': 'cancel',
      text: cancelText,
      onClick: () => { if (!busy) close(false); }
    });

    const card = el('div', { className: 'modal-card confirm-dialog-card' }, [
      el('h2', { className: 'modal-title', text: title }),
      el('p', { className: 'confirm-dialog-body', text: message }),
      el('div', { className: 'confirm-dialog-actions' }, [cancelBtn, confirmBtn])
    ]);

    const overlay = el('div', {
      className: 'modal-overlay',
      role: 'alertdialog',
      'aria-modal': 'true',
      'aria-label': title,
      onClick: e => { if (e.target === overlay && !busy) close(false); }
    }, [card]);

    // Issue #6 Phase 9 — Tab now cycles between Cancel/Confirm instead of
    // escaping to the page behind the overlay; Escape still closes as cancel.
    const detachTrap = attachFocusTrap(card, { onEscape: () => { if (!busy) close(false); } });
    document.body.appendChild(overlay);
    confirmBtn.focus();
  });
}
