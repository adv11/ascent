import { el } from '../dom.js';
import { attachFocusTrap } from './modal.js';
import { setButtonLoading } from '../utils/buttonLoading.js';
import { KEYS } from '../../services/localStorageKeys.js';
import { validateReport, MAX_TITLE_LENGTH } from '../../core/feedback/reportSchema.js';
import { collectCurrentMetadata } from '../../core/feedback/metadataCollector.js';
import { canSubmit, recordSubmit, msUntilNextSubmit } from '../../services/feedbackRateLimit.js';
import { submitReport } from '../../services/feedbackStore.js';
import { getTheme } from '../../services/theme.js';
import { getRoute } from '../router.js';
import { createField, createSystemInfoCheckbox, debounce } from './feedbackForm.js';
import { buildMyReportsView } from './myReports.js';
import { createIcon } from './icons.js';

// Issue #505 — redesigned onto the E5 design reference's single-screen
// "kind chips + one textarea" shape, replacing the old two-step type-select
// grid → per-type multi-field form flow. Labels match the design image
// verbatim (not the old "Bug report"/"Feature request"/"General feedback"
// wording) — content-style.md's plain-language rule applies here same as
// everywhere else.
const REPORT_TYPE_META = {
  bug: { label: 'Something is broken', placeholder: 'What happened, and what were you doing when it did?' },
  feature: { label: 'An idea', placeholder: 'What would you like to see in Ascent?' },
  feedback: { label: 'Something else', placeholder: 'What happened?' }
};

function readDraft() {
  try {
    const raw = JSON.parse(localStorage.getItem(KEYS.FEEDBACK_DRAFT) || 'null');
    return raw && typeof raw === 'object' && raw.type && raw.form ? raw : null;
  } catch {
    return null;
  }
}

const saveDraft = debounce((type, form) => {
  localStorage.setItem(KEYS.FEEDBACK_DRAFT, JSON.stringify({ type, form }));
}, 300);

function clearDraft() {
  localStorage.removeItem(KEYS.FEEDBACK_DRAFT);
}

function metadataSummary(metadata) {
  if (!metadata) return '';
  return `${metadata.browser} · ${metadata.os} · ${metadata.viewport} · ${metadata.currentRoute || '/'}`;
}

// Issue #505 — the redesigned single screen has no separate Title field (the
// design image shows only kind chips + one textarea), but reportSchema.js's
// validators still require a non-empty `title` for every report type — the
// backend/schema contract is unchanged by this visual redesign. Title is
// derived from the body text itself: its first line, capped at
// MAX_TITLE_LENGTH, same as how a git commit's subject line is implicitly
// "the first line."
function deriveTitleFromBody(body) {
  const firstLine = (body || '').trim().split('\n')[0].trim();
  return firstLine.slice(0, MAX_TITLE_LENGTH);
}

// Single screen (kind chips + one textarea) → success, with "See my past
// reports" branching to its own screen — replaces the old type-select-grid →
// per-type-form two-step flow (issue #505). One long-lived overlay/card pair
// for the whole thing (not re-opened per screen) so `attachFocusTrap`/
// Escape/outside-click keep working across transitions — same reasoning
// openModal()'s doc comment gives for reusing one card.
export function openFeedbackModal({ user }) {
  let cooldownTimer = null;
  let activeListenerCleanup = null;

  function close() {
    clearInterval(cooldownTimer);
    activeListenerCleanup?.();
    detachTrap();
    document.body.classList.remove('scroll-locked');
    overlay.remove();
  }

  function setBody(nodes) {
    activeListenerCleanup?.();
    activeListenerCleanup = null;
    // Unlike el()'s children array, Node.replaceChildren(...) does not skip
    // `null`/`undefined` entries — per its (Node or DOMString) WebIDL union
    // type, a bare `null` argument coerces to the literal text "null"
    // instead of being omitted, so any conditionally-included node here
    // must be filtered before spreading.
    const list = (Array.isArray(nodes) ? nodes : [nodes]).filter(Boolean);
    body.replaceChildren(...list);
  }

  function renderMyReports() {
    const view = buildMyReportsView({ user });
    const backBtn = el('button', { type: 'button', className: 'btn btn-ghost btn-sm', text: '← Back', onClick: renderMain });
    setBody([
      el('div', { className: 'feedback-type-header' }, [
        el('h2', { className: 'modal-title', text: 'My reports' }),
        backBtn
      ]),
      view
    ]);
    activeListenerCleanup = view._cleanup || null;
    backBtn.focus();
  }

  // Issue #505 — one screen: kind chips (single-select, no separate step) +
  // one textarea + "Send it" + "See my past reports", matching the E5 design
  // reference exactly. `type` is plain closure state the chip row mutates —
  // no re-render of the whole screen on a chip click, just an active-class
  // swap and a placeholder update on the one shared textarea.
  function renderMain() {
    const draft = readDraft();
    let type = draft?.type && REPORT_TYPE_META[draft.type] ? draft.type : 'bug';

    const bodyField = createField({
      label: 'What happened?',
      type: 'textarea',
      maxLength: 2000,
      value: draft?.form ? (draft.form.whatHappened || draft.form.description || '') : '',
      placeholder: REPORT_TYPE_META[type].placeholder,
      onChange: persistDraft
    });

    const chipButtons = Object.entries(REPORT_TYPE_META).map(([value, meta]) =>
      el('button', {
        type: 'button',
        className: `filter-chip feedback-kind-chip ${value === type ? 'active' : ''}`,
        'aria-pressed': String(value === type),
        text: meta.label,
        onClick: () => {
          type = value;
          chipButtons.forEach(btn => {
            const isActive = btn.dataset.kind === type;
            btn.classList.toggle('active', isActive);
            btn.setAttribute('aria-pressed', String(isActive));
          });
          bodyField.input.placeholder = REPORT_TYPE_META[type].placeholder;
          persistDraft();
        }
      })
    );
    chipButtons.forEach((btn, i) => { btn.dataset.kind = Object.keys(REPORT_TYPE_META)[i]; });

    const systemInfoCheckbox = createSystemInfoCheckbox({
      checked: draft?.form?.includeSystemInfo !== false,
      summaryText: metadataSummary(collectCurrentMetadata({ route: getRoute(), theme: getTheme(), user })),
      onChange: persistDraft
    });

    function gatherFormValues() {
      const body = bodyField.getValue();
      return {
        title: deriveTitleFromBody(body),
        whatHappened: type === 'bug' ? body : null,
        description: type !== 'bug' ? body : null,
        severity: null,
        usageFreq: null,
        includeSystemInfo: systemInfoCheckbox.isChecked()
      };
    }

    function persistDraft() {
      saveDraft(type, gatherFormValues());
    }

    const errorMessage = el('p', { className: 'form-message', text: '' });
    errorMessage.hidden = true;

    const cooldownMessage = el('p', { className: 'form-message error feedback-cooldown-message', text: '' });
    cooldownMessage.hidden = true;

    const submitBtn = el('button', { type: 'submit', className: 'btn btn-primary btn-block', text: 'Send it' });

    function updateCooldownUi() {
      clearInterval(cooldownTimer);
      if (canSubmit()) {
        cooldownMessage.hidden = true;
        submitBtn.disabled = false;
        return;
      }
      submitBtn.disabled = true;
      const tick = () => {
        const ms = msUntilNextSubmit();
        if (ms <= 0) {
          clearInterval(cooldownTimer);
          cooldownMessage.hidden = true;
          submitBtn.disabled = false;
          return;
        }
        const seconds = Math.ceil(ms / 1000);
        const label = seconds > 60 ? `${Math.ceil(seconds / 60)} min` : `${seconds}s`;
        cooldownMessage.hidden = false;
        cooldownMessage.textContent = `You've sent 3 reports recently. Please wait before sending another. (${label})`;
      };
      tick();
      cooldownTimer = setInterval(tick, 1000);
    }

    async function handleSubmit(e) {
      e.preventDefault();
      errorMessage.hidden = true;
      const values = gatherFormValues();
      const errors = validateReport(type, values);
      bodyField.setError(null);
      if (errors.length) {
        bodyField.setError('Tell us what happened before sending.');
        errorMessage.hidden = false;
        errorMessage.className = 'form-message error';
        errorMessage.textContent = 'Fill in what happened before sending.';
        return;
      }
      if (!canSubmit()) {
        updateCooldownUi();
        return;
      }

      setButtonLoading(submitBtn, true, 'Sending…');
      try {
        const metadata = systemInfoCheckbox.isChecked() ? collectCurrentMetadata({ route: getRoute(), theme: getTheme(), user }) : null;
        const reportId = await submitReport({
          type,
          form: values,
          metadata,
          userId: user?.uid || null,
          isAnonymous: !!user?.isAnonymous
        });
        recordSubmit();
        clearDraft();
        renderSuccess(reportId);
      } catch (error) {
        console.error('Feedback submission failed', error);
        errorMessage.hidden = false;
        errorMessage.className = 'form-message error';
        errorMessage.textContent = 'Could not send your report. Your draft has been saved — try again in a moment.';
      } finally {
        setButtonLoading(submitBtn, false);
      }
    }

    const myReportsBtn = el('button', {
      type: 'button',
      className: 'btn btn-ghost btn-sm feedback-my-reports-link',
      text: 'See my past reports',
      onClick: renderMyReports
    });

    const formEl = el('form', { className: 'feedback-form', onSubmit: handleSubmit }, [
      el('div', { className: 'feedback-kind-chips' }, chipButtons),
      bodyField.node,
      systemInfoCheckbox.node,
      errorMessage,
      cooldownMessage,
      submitBtn,
      myReportsBtn
    ]);

    formEl.addEventListener('keydown', e => {
      if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        formEl.requestSubmit();
      }
    });

    setBody([
      el('h2', { className: 'modal-title', text: 'Send feedback' }),
      el('p', { className: 'feedback-privacy-note', text: 'Tell us what broke or what would help. We read every one.' }),
      formEl
    ]);

    updateCooldownUi();
    bodyField.input.focus();
  }

  function renderSuccess(reportId) {
    clearInterval(cooldownTimer);
    const reference = (reportId || '').slice(0, 5).toUpperCase();
    const closeBtn = el('button', { type: 'button', className: 'btn btn-primary', text: 'Close', onClick: close });
    setBody([
      el('div', { className: 'feedback-success' }, [
        el('div', { className: 'feedback-success-icon', 'aria-hidden': 'true' }, [createIcon('check', { size: 'lg' })]),
        el('h2', { className: 'modal-title', text: 'Report received' }),
        el('p', { className: 'form-message', text: "Thanks for helping improve Ascent! We'll review your report and may follow up if we need more details." }),
        el('p', { className: 'feedback-reference', text: `Reference: #${reference}` }),
        el('div', { className: 'feedback-form-actions' }, [
          el('button', { type: 'button', className: 'btn btn-secondary', text: 'Send another', onClick: renderMain }),
          closeBtn
        ])
      ])
    ]);
    closeBtn.focus();
  }

  const body = el('div', { className: 'feedback-modal-body' });
  const card = el('div', { className: 'modal-card feedback-modal-card' }, [
    el('button', { type: 'button', className: 'btn btn-ghost btn-icon feedback-modal-close', 'aria-label': 'Close', onClick: close }, [createIcon('close', { size: 'sm' })]),
    body
  ]);

  const overlay = el('div', {
    className: 'modal-overlay',
    role: 'dialog',
    'aria-modal': 'true',
    'aria-label': 'Send feedback',
    onClick: e => { if (e.target === overlay) close(); }
  }, [card]);

  const detachTrap = attachFocusTrap(card, { onEscape: close });
  document.body.classList.add('scroll-locked');
  document.body.appendChild(overlay);
  renderMain();

  return { close };
}
