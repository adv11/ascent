import { el } from '../dom.js';
import { openFeedbackModal } from './feedbackModal.js';
import { createDecorativeIcon } from './decorativeIcon.js';

// Persistent floating trigger button (issue #9 §2.1) — mounted exactly once
// in main.js, outside the router, directly on document.body, so it survives
// every route change untouched. See CLAUDE.md's "feedbackWidget.js" mount
// rule: this node must never be unmounted or re-mounted on route change.
export function createFeedbackWidget({ user }) {
  const trigger = el('button', {
    type: 'button',
    className: 'feedback-widget-trigger',
    'aria-label': 'Send feedback',
    onClick: () => openFeedbackModal({ user: currentUser })
  }, [
    el('span', { className: 'feedback-widget-emoji', 'aria-hidden': 'true' }, [createDecorativeIcon('chat-circle', { size: 'sm' })]),
    el('span', { className: 'feedback-widget-label', text: 'Feedback' })
  ]);

  let currentUser = user || null;

  // Delayed scale-in (1500ms, §2.1) so the widget doesn't compete with page
  // load animations.
  const showTimer = setTimeout(() => trigger.classList.add('feedback-widget-visible'), 1500);

  trigger._setUser = nextUser => { currentUser = nextUser || null; };
  trigger._cleanup = () => clearTimeout(showTimer);

  return trigger;
}
