import { el } from '../dom.js';
import { attachFocusTrap } from './modal.js';

// "Create your own roadmap" (issue #4) — collects a title (required) and an
// optional description, matching the same `.modal-overlay`/`.modal-card`
// chrome as confirmDialog()/buildYourOwnGuide() rather than a native prompt.
// Resolves `{ title, description } | null` (null on cancel/Escape/outside-click)
// so the caller can `await` it just like confirmDialog().
export function openNewRoadmapModal() {
  return new Promise(resolve => {
    function close(result) {
      detachTrap();
      overlay.remove();
      resolve(result);
    }

    const message = el('p', { className: 'form-message', text: '' });
    const titleInput = el('input', {
      className: 'field-input',
      placeholder: 'e.g. Backend interview prep',
      maxlength: '80'
    });
    const descriptionInput = el('textarea', {
      className: 'field-input',
      placeholder: 'What is this roadmap for? (optional)',
      rows: '3',
      maxlength: '280'
    });

    function handleSubmit(e) {
      e.preventDefault();
      const title = titleInput.value.trim();
      if (!title) {
        message.textContent = 'Give your roadmap a title.';
        message.className = 'form-message error';
        titleInput.focus();
        return;
      }
      close({ title, description: descriptionInput.value.trim() });
    }

    const form = el('form', { className: 'auth-form', onSubmit: handleSubmit }, [
      el('label', { className: 'field' }, [
        el('span', { className: 'field-label', text: 'Title' }),
        titleInput
      ]),
      el('label', { className: 'field' }, [
        el('span', { className: 'field-label', text: 'Description' }),
        descriptionInput
      ]),
      message,
      el('button', { type: 'submit', className: 'btn btn-primary btn-block', text: 'Create roadmap' }),
      el('button', {
        type: 'button',
        className: 'btn btn-secondary btn-block',
        text: 'Cancel',
        onClick: () => close(null)
      })
    ]);

    const card = el('div', { className: 'modal-card' }, [
      el('h2', { className: 'modal-title', text: 'Create your own roadmap' }),
      form
    ]);

    const overlay = el('div', {
      className: 'modal-overlay',
      role: 'dialog',
      'aria-modal': 'true',
      'aria-label': 'Create your own roadmap',
      onClick: e => { if (e.target === overlay) close(null); }
    }, [card]);

    const detachTrap = attachFocusTrap(card, { onEscape: () => close(null) });
    document.body.appendChild(overlay);
    titleInput.focus();
  });
}
