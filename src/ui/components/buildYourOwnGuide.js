import { el } from '../dom.js';
import { attachFocusTrap } from './modal.js';

// Informational modal reachable from "Create your own roadmap"'s corner ℹ
// button (issue #4 follow-up — used to live on the now-retired "blank"
// template, the only way to get an empty roadmap before manual CRUD and
// AI-assisted import both existed). Since issue #100 retired manual "start
// truly blank" creation, generating with an AI assistant is the only way to
// start a custom roadmap — this guide now presents that as a single flow
// (generate, then fine-tune) rather than two alternative starting methods.
// `onOpenImport`, if given, powers the "Open the roadmap builder" button —
// closes this guide and hands off to the caller's own creation flow
// (`onboarding.js`'s `handleCreate()`) instead of duplicating that logic here.
export function openBuildYourOwnGuide({ onOpenImport } = {}) {
  function close() {
    detachTrap();
    overlay.remove();
  }

  const gotItBtn = el('button', { type: 'button', className: 'btn btn-primary', text: 'Got it', onClick: close });

  const footerButtons = [
    onOpenImport
      ? el('button', {
        type: 'button',
        className: 'btn btn-secondary',
        text: 'Open the roadmap builder',
        onClick: () => { close(); onOpenImport(); }
      })
      : null,
    gotItBtn
  ].filter(Boolean);

  const card = el('div', { className: 'modal-card build-guide-card' }, [
    el('h2', { className: 'modal-title', text: 'Build your own roadmap' }),
    el('p', {
      className: 'build-guide-intro',
      text: '"Create your own roadmap" builds your starting structure with an AI assistant, then lets you fine-tune it by hand afterward.'
    }),
    el('h3', { className: 'build-guide-heading', text: '1. Generate your roadmap with an AI assistant' }),
    el('p', { className: 'build-guide-body' }, [
      el('strong', { text: '"Create your own roadmap"' }),
      ' gives you a ready-to-copy prompt for describing your goal to an AI assistant like Claude or ChatGPT. Paste its reply back in and it\'s validated and imported automatically — no need to add topics one at a time.'
    ]),
    el('h3', { className: 'build-guide-heading', text: '2. Fine-tune it afterward' }),
    el('p', { className: 'build-guide-body' }, [
      'Once your roadmap exists, use ',
      el('strong', { text: '"+ Add phase"' }),
      ' and ',
      el('strong', { text: '"+ Add section"' }),
      ' to adjust its structure, and ',
      el('strong', { text: '"Add a custom topic…"' }),
      ' under any section to add more topics. Click ',
      el('strong', { text: 'Edit' }),
      ' on any topic to set its priority and attach resource links. These tools work on any custom roadmap, whenever you want to adjust it.'
    ]),
    el('div', { className: 'panel-footer-right' }, footerButtons)
  ]);

  const overlay = el('div', {
    className: 'modal-overlay',
    role: 'dialog',
    'aria-modal': 'true',
    'aria-label': 'Build your own roadmap',
    onClick: e => { if (e.target === overlay) close(); }
  }, [card]);

  const detachTrap = attachFocusTrap(card, { onEscape: close });
  document.body.appendChild(overlay);
  gotItBtn.focus();

  return close;
}
