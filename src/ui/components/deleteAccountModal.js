import { authApi, authErrorMessage } from '../../services/firebase.js';
import { el } from '../dom.js';
import { navigate } from '../router.js';
import { showToast } from './toast.js';
import { attachFocusTrap } from './modal.js';

// Extracted out of dashboard.js (issue #16) — the sidebar's account dropdown
// and the settings page's danger zone both need to open the exact same
// "type your password to confirm" delete flow, so it lives here instead of
// being duplicated or imported page-to-page.
export function openDeleteAccountModal() {
  const message = el('p', { className: 'form-message', text: '' });
  const passwordInput = el('input', {
    className: 'field-input',
    type: 'password',
    placeholder: 'Your current password',
    autocomplete: 'current-password'
  });
  const confirmBtn = el('button', {
    type: 'submit',
    className: 'btn btn-danger btn-block',
    text: 'Delete my account'
  });
  const cancelBtn = el('button', {
    type: 'button',
    className: 'btn btn-secondary btn-block',
    text: 'Cancel'
  });

  function setBusy(busy) {
    confirmBtn.disabled = busy;
    cancelBtn.disabled = busy;
  }

  async function handleDelete(e) {
    e.preventDefault();
    message.textContent = '';
    message.className = 'form-message';
    const pass = passwordInput.value;
    if (!pass) {
      message.textContent = 'Enter your password to confirm.';
      message.className = 'form-message error';
      return;
    }
    setBusy(true);
    try {
      await authApi.deleteAccount(pass);
      closeModal();
      showToast('Account deleted.', 'success');
      navigate('/signin', true);
    } catch (err) {
      message.textContent = authErrorMessage(err);
      message.className = 'form-message error';
      setBusy(false);
    }
  }

  const form = el('form', { className: 'auth-form', onSubmit: handleDelete }, [
    el('p', { className: 'delete-modal-body', text: 'This permanently deletes your account and all roadmap data. Enter your password to confirm.' }),
    el('label', { className: 'field' }, [
      el('span', { className: 'field-label', text: 'Password' }),
      passwordInput
    ]),
    message,
    confirmBtn,
    cancelBtn
  ]);

  const card = el('div', { className: 'modal-card' }, [
    el('h2', { className: 'modal-title', text: 'Delete account' }),
    form
  ]);

  const overlay = el('div', { className: 'modal-overlay', role: 'dialog', 'aria-modal': 'true', 'aria-label': 'Delete account' }, [card]);

  // Issue #6 Phase 9 — this modal had neither Escape-to-close nor a focus
  // trap before (every other ad hoc modal in the app already had at least
  // Escape); attachFocusTrap() gives it both in one call, same as everywhere
  // else.
  function closeModal() {
    detachTrap();
    overlay.remove();
  }
  const detachTrap = attachFocusTrap(card, { onEscape: closeModal });
  cancelBtn.addEventListener('click', closeModal);
  overlay.addEventListener('click', e => { if (e.target === overlay) closeModal(); });

  document.body.appendChild(overlay);
  passwordInput.focus();
}
