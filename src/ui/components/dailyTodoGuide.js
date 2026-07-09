import { el } from '../dom.js';
import { MAX_ACTIVE_TODOS } from '../../core/dailyTodo/limits.js';

// Informational modal reachable from the Daily Todos card's corner ℹ button
// (issue #56 follow-up) — same pattern as buildYourOwnGuide.js. Explains a
// feature that has no other onboarding: it's a separate, always-visible
// list (independent of whichever roadmap is active) for short-lived,
// self-imposed deadlines, not another way to track roadmap topics.
export function openDailyTodoGuide() {
  function close() {
    window.removeEventListener('keydown', onKey);
    overlay.remove();
  }

  const onKey = e => { if (e.key === 'Escape') close(); };

  // Condensed from an earlier 3-heading/8-paragraph version (issue #78) —
  // same facts, tightened into one short paragraph per heading so the modal
  // can be skimmed in a few seconds instead of read top to bottom.
  const card = el('div', { className: 'modal-card build-guide-card' }, [
    el('h2', { className: 'modal-title', text: "About Today's Todos" }),
    el('p', {
      className: 'build-guide-intro',
      text: 'A separate, quick-add task list for short-term deadlines — not tied to any roadmap, and unaffected by switching or hiding one.'
    }),
    el('h3', { className: 'build-guide-heading', text: 'Deadlines' }),
    el('p', { className: 'build-guide-body' }, [
      'Pick a preset or a custom number of hours when you add a todo. The countdown turns ',
      el('strong', { text: 'amber' }),
      ' under 6 hours left and ',
      el('strong', { text: 'red' }),
      ' under 1.'
    ]),
    el('h3', { className: 'build-guide-heading', text: 'Done, missed & delete' }),
    el('p', { className: 'build-guide-body' }, [
      'Check it off when done — it stays, struck through. If time runs out first, it moves to the collapsed ',
      el('strong', { text: 'Missed' }),
      ' section on its own; nothing else changes. The ',
      el('strong', { text: '×' }),
      ' button deletes a todo at any point — active, done, or missed — which is also how you undo one added by mistake. Up to ',
      el('strong', { text: String(MAX_ACTIVE_TODOS) }),
      ' active todos at a time.'
    ]),
    el('h3', { className: 'build-guide-heading', text: 'Linking to a roadmap topic' }),
    el('p', { className: 'build-guide-body' }, [
      'Click ⏱ on any roadmap row to turn that topic into a todo (tagged ',
      el('strong', { text: 'via <Roadmap>' }),
      '). ',
      el('strong', { text: 'Checking' }),
      ' it off asks you to confirm, since it also completes the topic; ',
      el('strong', { text: 'unchecking' }),
      ' always syncs back silently. Deleting a linked todo before it\'s checked never touches the roadmap — only completing one does. A completed link shows a small ⏱✓ mark, cleared if either side is unchecked again.'
    ]),
    el('div', { className: 'panel-footer-right' }, [
      el('button', { type: 'button', className: 'btn btn-primary', text: 'Got it', onClick: close })
    ])
  ]);

  const overlay = el('div', {
    className: 'modal-overlay',
    role: 'dialog',
    'aria-modal': 'true',
    'aria-label': "About Today's Todos",
    onClick: e => { if (e.target === overlay) close(); }
  }, [card]);

  window.addEventListener('keydown', onKey);
  document.body.appendChild(overlay);

  return close;
}
