import { el } from '../dom.js';
import { attachFocusTrap } from './modal.js';
import { listenMyReports } from '../../services/feedbackStore.js';
import { createIcon } from './icons.js';
import { createDecorativeIcon } from './decorativeIcon.js';

// issue #136 Phase 2 follow-up — was raw '🐛'/'💡'/'💬' glyphs; decorativeIcon.js names now
const TYPE_ICON = { bug: 'bug', feature: 'lightbulb', feedback: 'chat-circle' };

const STATUS_LABEL = {
  new: 'New',
  under_review: 'Under review',
  in_progress: 'In progress',
  resolved: 'Resolved',
  wont_fix: "Won't fix"
};

function formatDate(ts) {
  if (!ts) return '';
  return new Date(ts).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}

function buildReportRow(report) {
  const details = el('div', { className: 'my-report-details' });
  details.hidden = true;

  function toggleDetails() {
    details.hidden = !details.hidden;
    if (!details.hidden && !details.childNodes.length) {
      details.append(
        report.description ? el('p', { text: report.description }) : null,
        report.steps ? el('p', {}, [el('strong', { text: 'Steps: ' }), report.steps]) : null,
        report.expected ? el('p', {}, [el('strong', { text: 'Expected: ' }), report.expected]) : null,
        report.actual ? el('p', {}, [el('strong', { text: 'Actual: ' }), report.actual]) : null,
        report.useCase ? el('p', {}, [el('strong', { text: 'Use case: ' }), report.useCase]) : null
      );
    }
  }

  const summaryBtn = el('button', {
    type: 'button',
    className: 'my-report-summary',
    'aria-expanded': 'false',
    onClick: () => {
      toggleDetails();
      summaryBtn.setAttribute('aria-expanded', String(!details.hidden));
    }
  }, [
    el('span', { className: 'my-report-title-row' }, [
      el('span', { 'aria-hidden': 'true' }, [createDecorativeIcon(TYPE_ICON[report.type] || 'chat-circle', { size: 'sm' })]),
      el('span', { className: 'my-report-title', text: report.title }),
      report.severity ? el('span', { className: `my-report-severity my-report-severity-${report.severity}`, text: report.severity.toUpperCase() }) : null
    ].filter(Boolean)),
    el('span', { className: 'my-report-meta', text: `Submitted ${formatDate(report.submittedAt)} · Status: ${STATUS_LABEL[report.status] || 'New'}` })
  ]);

  return el('div', { className: 'my-report-row' }, [summaryBtn, details]);
}

// Report history list — reused both as a tab inside feedbackModal.js and as
// its own standalone modal (openMyReports() below, reached from the sidebar
// "My reports" menu item). Returns a plain node; caller owns its lifecycle.
export function buildMyReportsView({ user }) {
  const list = el('div', { className: 'my-reports-list' });

  if (!user?.uid) {
    list.append(el('p', { className: 'form-message', text: 'Sign in to see your report history.' }));
    return list;
  }

  list.append(el('p', { className: 'form-message', text: 'Loading…' }));
  const unsubscribe = listenMyReports(user.uid, reports => {
    if (!reports.length) {
      list.replaceChildren(el('p', { className: 'form-message', text: "You haven't submitted any reports yet." }));
      return;
    }
    list.replaceChildren(...reports.map(buildReportRow));
  }, error => {
    console.error('Could not load report history', error);
    list.replaceChildren(el('p', { className: 'form-message error', text: 'Could not load your reports. Check your connection and try again.' }));
  });

  list._cleanup = unsubscribe;
  return list;
}

// Standalone entry point — the topbar/sidebar "My reports" menu item opens
// this directly rather than going through the full feedback flow.
export function openMyReports({ user }) {
  function close() {
    view._cleanup?.();
    detachTrap();
    document.body.classList.remove('scroll-locked');
    overlay.remove();
  }

  const view = buildMyReportsView({ user });
  const closeBtn = el('button', { type: 'button', className: 'btn btn-ghost btn-icon feedback-modal-close', 'aria-label': 'Close', onClick: close }, [createIcon('close', { size: 'sm' })]);
  const card = el('div', { className: 'modal-card feedback-modal-card' }, [
    closeBtn,
    el('h2', { className: 'modal-title', text: 'My reports' }),
    view
  ]);

  const overlay = el('div', {
    className: 'modal-overlay',
    role: 'dialog',
    'aria-modal': 'true',
    'aria-label': 'My reports',
    onClick: e => { if (e.target === overlay) close(); }
  }, [card]);

  const detachTrap = attachFocusTrap(card, { onEscape: close });
  document.body.classList.add('scroll-locked');
  document.body.appendChild(overlay);
  closeBtn.focus();
  return { close };
}
