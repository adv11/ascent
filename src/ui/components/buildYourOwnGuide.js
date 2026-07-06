import { el } from '../dom.js';

// Informational modal for the "blank" starter template (Issue #51) — explains
// how to fill in the four empty phases, since there's no automated AI-import
// feature yet (that's tracked separately). Purely explanatory, no state.
export function openBuildYourOwnGuide() {
  function close() {
    window.removeEventListener('keydown', onKey);
    overlay.remove();
  }

  const onKey = e => { if (e.key === 'Escape') close(); };

  const card = el('div', { className: 'modal-card build-guide-card' }, [
    el('h2', { className: 'modal-title', text: 'Build your own roadmap' }),
    el('p', {
      className: 'build-guide-intro',
      text: '"Start blank" gives you four empty phases — Learn, Practice, Build, Review — for any goal you\'re working toward. Here\'s how to fill them in.'
    }),
    el('h3', { className: 'build-guide-heading', text: '1. Add topics manually' }),
    el('p', { className: 'build-guide-body' }, [
      'On your dashboard, use the ',
      el('strong', { text: '"Add a custom topic…"' }),
      ' box under any phase to add as many topics as you want. Click ',
      el('strong', { text: 'Edit' }),
      ' on any topic to set its priority and attach resource links.'
    ]),
    el('h3', { className: 'build-guide-heading', text: '2. Get help from an AI assistant' }),
    el('p', { className: 'build-guide-body' }, [
      'Ask an AI chat assistant (like Claude or ChatGPT) to break your goal into concrete topics ',
      'organized under Learn, Practice, Build, and Review — then copy each one into Ascent using ',
      el('strong', { text: '"Add a custom topic…"' }),
      '.'
    ]),
    el('p', {
      className: 'build-guide-note',
      text: 'A fully automated AI import is planned for a future update — for now, this manual copy-paste approach works great.'
    }),
    el('div', { className: 'panel-footer-right' }, [
      el('button', { type: 'button', className: 'btn btn-primary', text: 'Got it', onClick: close })
    ])
  ]);

  const overlay = el('div', {
    className: 'modal-overlay',
    role: 'dialog',
    'aria-modal': 'true',
    'aria-label': 'Build your own roadmap',
    onClick: e => { if (e.target === overlay) close(); }
  }, [card]);

  window.addEventListener('keydown', onKey);
  document.body.appendChild(overlay);

  return close;
}
