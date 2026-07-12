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
import { createField, createRadioGroup, createScreenshotControl, createSystemInfoCheckbox, debounce } from './feedbackForm.js';
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
    setBody([
      el('div', { className: 'feedback-type-header' }, [
        el('h2', { className: 'modal-title', text: 'How can we help?' }),
        el('button', {
          type: 'button',
          className: 'btn btn-ghost btn-sm',
          text: 'My reports',
          onClick: renderMyReports
        })
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
  }

  function renderMyReports() {
    const view = buildMyReportsView({ user });
    setBody([
      el('div', { className: 'feedback-type-header' }, [
        el('h2', { className: 'modal-title', text: 'My reports' }),
        el('button', { type: 'button', className: 'btn btn-ghost btn-sm', text: '← Back', onClick: renderTypeSelect })
      ]),
      view
    ]);
    activeListenerCleanup = view._cleanup || null;
  }

  function renderForm(type, prefill = {}) {
    const meta = REPORT_TYPE_META[type];
    const form = {};
    const fields = [];

    const titleField = createField({ label: 'Title', maxLength: 120, value: prefill.title || '', placeholder: type === 'bug' ? 'Short description of what went wrong' : type === 'feature' ? 'What would you like to see in Ascent?' : undefined, onChange: persistDraft });
    fields.push(titleField.node);
    form.title = () => titleField.getValue();

    let severityField = null;
    let stepsField = null;
    let expectedField = null;
    let actualField = null;
    let descriptionField = null;
    let useCaseField = null;
    let usageFreqField = null;
    let screenshotControl = null;

    if (type === 'bug') {
      severityField = createRadioGroup({ name: 'severity', label: 'Severity', options: SEVERITY_OPTIONS });
      fields.push(severityField.node);
      if (prefill.severity) {
        const radio = severityField.node.querySelector(`input[value="${prefill.severity}"]`);
        if (radio) { radio.checked = true; radio.dispatchEvent(new Event('change')); }
      }
      stepsField = createField({ label: 'Steps to reproduce', type: 'textarea', maxLength: 2000, value: prefill.steps || '', placeholder: '1. ...\n2. ...\n3. ...', onChange: persistDraft });
      expectedField = createField({ label: 'Expected behaviour', type: 'textarea', maxLength: 2000, value: prefill.expected || '', onChange: persistDraft });
      actualField = createField({ label: 'Actual behaviour', type: 'textarea', maxLength: 2000, value: prefill.actual || '', onChange: persistDraft });
      fields.push(stepsField.node, expectedField.node, actualField.node);
      screenshotControl = createScreenshotControl({ onChange: persistDraft });
      fields.push(screenshotControl.node);
    } else if (type === 'feature') {
      descriptionField = createField({ label: 'Describe the feature', type: 'textarea', maxLength: 2000, value: prefill.description || '', onChange: persistDraft });
      useCaseField = createField({ label: 'Your use case', type: 'textarea', maxLength: 2000, value: prefill.useCase || '', placeholder: 'Why do you need this? What problem does it solve?', onChange: persistDraft });
      fields.push(descriptionField.node, useCaseField.node);
      usageFreqField = createRadioGroup({ name: 'usageFreq', label: 'How often would you use it?', options: USAGE_FREQ_OPTIONS, required: false });
      fields.push(usageFreqField.node);
      if (prefill.usageFreq) {
        const radio = usageFreqField.node.querySelector(`input[value="${prefill.usageFreq}"]`);
        if (radio) { radio.checked = true; radio.dispatchEvent(new Event('change')); }
      }
    } else {
      descriptionField = createField({ label: 'Your feedback', type: 'textarea', maxLength: 2000, value: prefill.description || '', onChange: persistDraft });
      fields.push(descriptionField.node);
      screenshotControl = createScreenshotControl({ onChange: persistDraft });
      fields.push(screenshotControl.node);
    }

    const systemInfoCheckbox = createSystemInfoCheckbox({
      checked: prefill.includeSystemInfo !== false,
      summaryText: metadataSummary(collectCurrentMetadata({ route: getRoute(), theme: getTheme(), user })),
      onChange: persistDraft
    });
    fields.push(systemInfoCheckbox.node);

    function gatherFormValues() {
      return {
        title: titleField.getValue(),
        severity: severityField?.getValue() || null,
        steps: stepsField?.getValue() || null,
        expected: expectedField?.getValue() || null,
        actual: actualField?.getValue() || null,
        description: descriptionField?.getValue() || null,
        useCase: useCaseField?.getValue() || null,
        usageFreq: usageFreqField?.getValue() || null,
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
      [titleField, severityField, stepsField, expectedField, actualField, descriptionField, useCaseField].forEach(f => f?.setError(null));
      if (errors.length) {
        const fieldMap = { 'title is required': titleField, 'severity is required': severityField, 'steps is required': stepsField, 'expected is required': expectedField, 'actual is required': actualField, 'description is required': descriptionField, 'useCase is required': useCaseField };
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
          isAnonymous: !!user?.isAnonymous,
          screenshotB64: screenshotControl?.getValue() || null,
          screenshotOmitted: false
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
    setBody([
      el('div', { className: 'feedback-success' }, [
        el('div', { className: 'feedback-success-icon', 'aria-hidden': 'true' }, [createIcon('check', { size: 'lg' })]),
        el('h2', { className: 'modal-title', text: 'Report received' }),
        el('p', { className: 'form-message', text: "Thanks for helping improve Ascent! We'll review your report and may follow up if we need more details." }),
        el('p', { className: 'feedback-reference', text: `Reference: #${reference}` }),
        el('div', { className: 'feedback-form-actions' }, [
          el('button', { type: 'button', className: 'btn btn-secondary', text: 'Send another', onClick: renderTypeSelect }),
          el('button', { type: 'button', className: 'btn btn-primary', text: 'Close', onClick: close })
        ])
      ])
    ]);
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
