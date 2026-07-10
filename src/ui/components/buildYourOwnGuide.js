import { el } from '../dom.js';
import { attachFocusTrap } from './modal.js';

// Informational modal reachable from "Create your own roadmap"'s corner ℹ
// button (issue #4 follow-up — used to live on the now-retired "blank"
// template, the only way to get an empty roadmap before manual CRUD and
// AI-assisted import both existed). Explains both real paths side by side:
// adding topics by hand, and generating a roadmap with an AI assistant via
// "Import roadmap". `onOpenImport`, if given, powers the "Open Import
// roadmap" button — closes this guide and hands off to the caller's own
// import flow (`onboarding.js`'s `handleImport()`) instead of duplicating
// that logic here.
export function openBuildYourOwnGuide({ onOpenImport } = {}) {
  function close() {
    detachTrap();
    overlay.remove();
  }

  const footerButtons = [
    onOpenImport
      ? el('button', {
        type: 'button',
        className: 'btn btn-secondary',
        text: 'Open Import roadmap',
        onClick: () => { close(); onOpenImport(); }
      })
      : null,
    el('button', { type: 'button', className: 'btn btn-primary', text: 'Got it', onClick: close })
  ].filter(Boolean);

  const card = el('div', { className: 'modal-card build-guide-card' }, [
    el('h2', { className: 'modal-title', text: 'Build your own roadmap' }),
    el('p', {
      className: 'build-guide-intro',
      text: '"Create your own roadmap" starts empty — you add exactly the phases, sections, and topics your goal needs. There are two ways to fill it in.'
    }),
    el('h3', { className: 'build-guide-heading', text: '1. Add topics manually' }),
    el('p', { className: 'build-guide-body' }, [
      'Use ',
      el('strong', { text: '"+ Add phase"' }),
      ' and ',
      el('strong', { text: '"+ Add section"' }),
      ' to build the structure, then ',
      el('strong', { text: '"Add a custom topic…"' }),
      ' under any section to add as many topics as you want. Click ',
      el('strong', { text: 'Edit' }),
      ' on any topic to set its priority and attach resource links.'
    ]),
    el('h3', { className: 'build-guide-heading', text: '2. Generate one with an AI assistant' }),
    el('p', { className: 'build-guide-body' }, [
      el('strong', { text: '"Import roadmap"' }),
      ' (next to "Create your own roadmap") gives you a ready-to-copy prompt for describing your goal to an AI assistant like Claude or ChatGPT. Paste its reply back in and it\'s validated and imported automatically — no copying topics in one at a time.'
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

  return close;
}
