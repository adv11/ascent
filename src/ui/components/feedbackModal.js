import { el } from '../dom.js';
import { attachFocusTrap } from './modal.js';
import { setButtonLoading } from '../utils/buttonLoading.js';
import { KEYS } from '../../services/localStorageKeys.js';
import { validateReport } from '../../core/feedback/reportSchema.js';
import { collectCurrentMetadata } from '../../core/feedback/metadataCollector.js';
import { canSubmit, recordSubmit, msUntilNextSubmit } from '../../services/feedbackRateLimit.js';
import { submitReport } from '../../services/feedbackStore.js';
import { getTheme } from '../../services/theme.js';
import { getRoute } from '../router.js';
import { createField, createRadioGroup, createSystemInfoCheckbox, debounce } from './feedbackForm.js';
import { buildMyReportsView } from './myReports.js';
import { createIcon } from './icons.js';
import { createDecorativeIcon } from './decorativeIcon.js';

// issue #136 Phase 2 follow-up — was raw '🐛'/'💡'/'💬' glyphs; decorativeIcon.js names now
const REPORT_TYPE_META = {
  bug: { icon: 'bug', label: 'Bug report', ariaLabel: 'Bug report' },
  feature: { icon: 'lightbulb', label: 'Feature request', ariaLabel: 'Feature request' },
  feedback: { icon: 'chat-circle', label: 'General feedback', ariaLabel: 'General feedback' }
};

const SEVERITY_OPTIONS = [
  { value: 'critical', label: 'Critical — app unusable' },
  { value: 'high', label: 'High — major feature broken' },
  { value: 'medium', label: 'Medium — partial issue' },
  { value: 'low', label: 'Low — minor / cosmetic' }
];

const USAGE_FREQ_OPTIONS = [
  { value: 'daily', label: 'Daily' },
  { value: 'weekly', label: 'Weekly' },
  { value: 'occasionally', label: 'Occasionally' },
  { value: 'one-time', label: 'One-time' }
];

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

// Issue #281 — renderForm()/gatherFormValues() extraction. resolveTitlePlaceholder()
// and buildTypeFields() (+ its three per-type helpers) pull the type-branching logic
// that used to live inline in renderForm() out into named, module-scope functions;
// readFieldValue() does the same for gatherFormValues()'s repeated `field?.getValue()
// || null` pattern. Pure structural refactor — every field/placeholder/prefill value
// is unchanged from the original inline code.
function resolveTitlePlaceholder(type) {
  if (type === 'bug') return 'Short description of what went wrong';
  if (type === 'feature') return 'What would you like to see in Ascent?';
  return undefined;
}

function applyRadioPrefill(radioGroupField, value) {
  if (!value) return;
  const radio = radioGroupField.node.querySelector(`input[value="${value}"]`);
  if (radio) {
    radio.checked = true;
    radio.dispatchEvent(new Event('change'));
  }
}

// Issue #348 collapsed Steps/Expected/Actual into one free-text field, and
// made Severity optional (defaults to 'medium' — see reportSchema.js) rather
// than a required radio group, to cut required typing before Submit unlocks.
function buildBugTypeFields({ prefill, onChange }) {
  const severityField = createRadioGroup({ name: 'severity', label: 'Severity', options: SEVERITY_OPTIONS, required: false });
  applyRadioPrefill(severityField, prefill.severity);
  const whatHappenedField = createField({
    label: 'What happened?',
    type: 'textarea',
    maxLength: 2000,
    value: prefill.whatHappened || '',
    placeholder: 'What were you doing, what did you expect, and what happened instead?',
    onChange
  });
  return {
    fields: [whatHappenedField.node, severityField.node],
    severityField, whatHappenedField
  };
}

// Issue #348 collapsed "Describe the feature"/"Your use case" into one field.
function buildFeatureTypeFields({ prefill, onChange }) {
  const descriptionField = createField({
    label: 'Describe the feature',
    type: 'textarea',
    maxLength: 2000,
    value: prefill.description || '',
    placeholder: 'What would you like to see, and why?',
    onChange
  });
  const usageFreqField = createRadioGroup({ name: 'usageFreq', label: 'How often would you use it?', options: USAGE_FREQ_OPTIONS, required: false });
  applyRadioPrefill(usageFreqField, prefill.usageFreq);
  return {
    fields: [descriptionField.node, usageFreqField.node],
    descriptionField, usageFreqField
  };
}

function buildFeedbackTypeFields({ prefill, onChange }) {
  const descriptionField = createField({ label: 'Your feedback', type: 'textarea', maxLength: 2000, value: prefill.description || '', onChange });
  return {
    fields: [descriptionField.node],
    descriptionField
  };
}

function buildTypeFields(type, opts) {
  if (type === 'bug') return buildBugTypeFields(opts);
  if (type === 'feature') return buildFeatureTypeFields(opts);
  return buildFeedbackTypeFields(opts);
}

function readFieldValue(field) {
  return field?.getValue() || null;
}

// Multi-step modal: type select → form → success (issue #9 §2–§3, §8). One
// long-lived overlay/card pair for the whole flow (not re-opened per step)
// so `attachFocusTrap`/Escape/outside-click keep working across transitions —
// same reasoning openModal()'s doc comment gives for reusing one card.
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

  function renderTypeSelect() {
    const draft = readDraft();
    const myReportsBtn = el('button', {
      type: 'button',
      className: 'btn btn-ghost btn-sm',
      text: 'My reports',
      onClick: renderMyReports
    });
    setBody([
      el('div', { className: 'feedback-type-header' }, [
        el('h2', { className: 'modal-title', text: 'How can we help?' }),
        myReportsBtn
      ]),
      draft
        ? el('p', { className: 'form-message', text: `You have an unfinished ${REPORT_TYPE_META[draft.type].label.toLowerCase()} draft.` })
        : null,
      el('div', { className: 'feedback-type-grid' }, Object.entries(REPORT_TYPE_META).map(([type, meta]) =>
        el('button', {
          type: 'button',
          className: 'feedback-type-card',
          onClick: () => renderForm(type, draft?.type === type ? draft.form : {})
        }, [
          el('span', { className: 'feedback-type-emoji', 'aria-hidden': 'true' }, [createDecorativeIcon(meta.icon, { size: 'lg' })]),
          el('span', { text: meta.label })
        ])
      )),
      el('p', { className: 'feedback-privacy-note', text: 'Your feedback goes directly to the team.' })
    ]);
    myReportsBtn.focus();
  }

  function renderMyReports() {
    const view = buildMyReportsView({ user });
    const backBtn = el('button', { type: 'button', className: 'btn btn-ghost btn-sm', text: '← Back', onClick: renderTypeSelect });
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

  function renderForm(type, prefill = {}) {
    const meta = REPORT_TYPE_META[type];
    const form = {};
    const fields = [];

    const titleField = createField({ label: 'Title', maxLength: 120, value: prefill.title || '', placeholder: resolveTitlePlaceholder(type), onChange: persistDraft });
    fields.push(titleField.node);
    form.title = () => titleField.getValue();

    const typeFields = buildTypeFields(type, { prefill, onChange: persistDraft });
    fields.push(...typeFields.fields);
    const { severityField, whatHappenedField, descriptionField, usageFreqField } = typeFields;

    const systemInfoCheckbox = createSystemInfoCheckbox({
      checked: prefill.includeSystemInfo !== false,
      summaryText: metadataSummary(collectCurrentMetadata({ route: getRoute(), theme: getTheme(), user })),
      onChange: persistDraft
    });
    fields.push(systemInfoCheckbox.node);

    function gatherFormValues() {
      return {
        title: titleField.getValue(),
        severity: readFieldValue(severityField),
        whatHappened: readFieldValue(whatHappenedField),
        description: readFieldValue(descriptionField),
        usageFreq: readFieldValue(usageFreqField),
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

    const submitBtn = el('button', { type: 'submit', className: 'btn btn-primary', text: `Submit ${meta.label.toLowerCase()} →` });
    const cancelBtn = el('button', { type: 'button', className: 'btn btn-secondary', text: 'Cancel', onClick: renderTypeSelect });

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
      [titleField, whatHappenedField, descriptionField].forEach(f => f?.setError(null));
      if (errors.length) {
        const fieldMap = { 'title is required': titleField, 'whatHappened is required': whatHappenedField, 'description is required': descriptionField };
        errors.forEach(err => fieldMap[err]?.setError('This field is required.'));
        errorMessage.hidden = false;
        errorMessage.className = 'form-message error';
        errorMessage.textContent = 'Fill in the required fields before submitting.';
        return;
      }
      if (!canSubmit()) {
        updateCooldownUi();
        return;
      }

      setButtonLoading(submitBtn, true, 'Submitting…');
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
        errorMessage.textContent = 'Could not submit your report. Your draft has been saved — try again in a moment.';
      } finally {
        setButtonLoading(submitBtn, false);
      }
    }

    const formEl = el('form', { className: 'feedback-form', onSubmit: handleSubmit }, [
      ...fields,
      errorMessage,
      cooldownMessage,
      el('div', { className: 'feedback-form-actions' }, [cancelBtn, submitBtn])
    ]);

    formEl.addEventListener('keydown', e => {
      if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        formEl.requestSubmit();
      }
    });

    setBody([
      el('div', { className: 'feedback-type-header' }, [
        el('h2', { className: 'modal-title' }, [
          createDecorativeIcon(meta.icon, { size: 'sm' }),
          ` ${meta.label}`
        ]),
      ]),
      formEl,
      el('p', { className: 'feedback-privacy-note', text: "Your report is sent to the Ascent team only. We never share it. Uncheck 'Include system info' to submit without metadata." })
    ]);

    updateCooldownUi();
    titleField.input.focus();
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
          el('button', { type: 'button', className: 'btn btn-secondary', text: 'Send another', onClick: renderTypeSelect }),
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
  renderTypeSelect();

  return { close };
}
