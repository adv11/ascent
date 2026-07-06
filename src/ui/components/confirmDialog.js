import { el } from '../dom.js';

// Shared replacement for the native window.confirm() — matches the app's own
// modal-overlay/modal-card styling instead of the browser's unstyleable
// built-in dialog. Resolves true/false instead of throwing/blocking, so every
// call site just does `if (!(await confirmDialog({...}))) return;`.
export function confirmDialog({ title, message, confirmText = 'Confirm', cancelText = 'Cancel', danger = false } = {}) {
  return new Promise(resolve => {
    function close(result) {
      window.removeEventListener('keydown', onKey);
      overlay.remove();
      resolve(result);
    }

    const onKey = e => { if (e.key === 'Escape') close(false); };

    const confirmBtn = el('button', {
      type: 'button',
      className: `btn ${danger ? 'btn-danger' : 'btn-primary'}`,
      'data-action': 'confirm',
      text: confirmText,
      onClick: () => close(true)
    });

    const overlay = el('div', {
      className: 'modal-overlay',
      role: 'alertdialog',
      'aria-modal': 'true',
      'aria-label': title,
      onClick: e => { if (e.target === overlay) close(false); }
    }, [
      el('div', { className: 'modal-card confirm-dialog-card' }, [
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
      ])
    ]);

    window.addEventListener('keydown', onKey);
    document.body.appendChild(overlay);
    confirmBtn.focus();
  });
}
