import { el, debounce } from '../dom.js';
import { captureScreenshot, readUploadedImage } from './screenshotCapture.js';

// Shared form primitives for feedbackModal.js's three report-type forms
// (issue #9 §3.4) — field + char counter, radio groups, screenshot control.
// Kept dependency-free of feedbackModal.js itself so each primitive is a
// plain `{ node, getValue, setError }`-shaped builder, same composition
// style every other ad hoc modal in this app (addToDailyTodoModal.js, etc.)
// already uses.

// Validated on blur after the first edit, not on every keystroke (§3.4) —
// `touched` flips true on the field's first blur and stays true.
export function createField({ label, type = 'text', maxLength, placeholder, value = '', required = true, onChange }) {
  const isTextarea = type === 'textarea';
  const input = el(isTextarea ? 'textarea' : 'input', {
    className: 'field-input feedback-field-input',
    type: isTextarea ? null : type,
    placeholder,
    maxlength: maxLength ? String(maxLength) : null,
    value: isTextarea ? null : value
  });
  if (isTextarea) input.value = value;

  const counter = el('span', { className: 'feedback-char-counter', 'aria-live': 'polite' });
  counter.hidden = true;
  const errorEl = el('span', { className: 'field-error', role: 'alert' });
  errorEl.hidden = true;

  let touched = false;

  function updateCounter() {
    if (!maxLength) return;
    const len = input.value.length;
    counter.hidden = len < maxLength * 0.8;
    counter.textContent = `${len} / ${maxLength}`;
  }

  function setError(message) {
    if (message) {
      errorEl.textContent = message;
      errorEl.hidden = false;
      input.classList.add('field-input-invalid');
    } else {
      errorEl.hidden = true;
      input.classList.remove('field-input-invalid');
    }
  }

  input.addEventListener('input', () => {
    updateCounter();
    if (touched) setError(null);
    onChange?.();
  });
  input.addEventListener('blur', () => {
    touched = true;
  });
  // Enter in a single-line field moves to the next field instead of
  // submitting (§3.4) — Cmd/Ctrl+Enter from any textarea submits, handled by
  // the enclosing <form>'s own keydown listener in feedbackModal.js.
  if (!isTextarea) {
    input.addEventListener('keydown', e => {
      if (e.key === 'Enter') e.preventDefault();
    });
  }

  updateCounter();

  const node = el('label', { className: 'field feedback-field' }, [
    el('span', { className: 'field-label', text: `${label}${required ? ' *' : ''}` }),
    input,
    counter,
    errorEl
  ]);

  return {
    node,
    input,
    getValue: () => input.value,
    setValue: v => { input.value = v; updateCounter(); },
    setError,
    markTouched: () => { touched = true; }
  };
}

export function createRadioGroup({ name, label, options, required = true }) {
  let selected = null;
  const buttons = options.map(opt => {
    const radio = el('input', { type: 'radio', name, value: opt.value });
    radio.addEventListener('change', () => { selected = opt.value; });
    return el('label', { className: 'feedback-radio-option' }, [radio, el('span', { text: opt.label })]);
  });
  const errorEl = el('span', { className: 'field-error', role: 'alert' });
  errorEl.hidden = true;

  const node = el('fieldset', { className: 'field feedback-field' }, [
    el('legend', { className: 'field-label', text: `${label}${required ? ' *' : ''}` }),
    el('div', { className: 'feedback-radio-group' }, buttons),
    errorEl
  ]);

  return {
    node,
    getValue: () => selected,
    setError: message => {
      if (message) { errorEl.textContent = message; errorEl.hidden = false; } else { errorEl.hidden = true; }
    }
  };
}

// Capture / upload / preview / remove — issue #9 §4. `onChange({ dataUrl, omitted })`
// fires whenever the attached screenshot changes (including to `null` on remove).
export function createScreenshotControl({ onChange }) {
  let dataUrl = null;

  const fileInput = el('input', { type: 'file', accept: 'image/*', hidden: true });
  const preview = el('img', { className: 'feedback-screenshot-preview', alt: 'Screenshot preview' });
  preview.hidden = true;
  const errorEl = el('span', { className: 'field-error', role: 'alert' });
  errorEl.hidden = true;

  const removeBtn = el('button', {
    type: 'button',
    // `.feedback-screenshot-remove` (not just `.btn .btn-ghost .btn-sm`) so
    // app.css can add a `[hidden]` override — `.btn` sets `display:
    // inline-flex`, and author CSS declarations always beat the browser's
    // default `[hidden] { display: none }` UA rule regardless of
    // selector specificity, so `removeBtn.hidden = true` alone left the
    // button visibly rendered the whole time (same pre-existing pattern as
    // `.daily-todo-nav-badge[hidden]`/`.clear-filters-btn[hidden]` in
    // app.css) — reported live (issue #9 follow-up).
    className: 'btn btn-ghost btn-sm feedback-screenshot-remove',
    text: 'Remove',
    onClick: () => setScreenshot(null)
  });
  removeBtn.hidden = true;

  function setScreenshot(next, omitted = false) {
    dataUrl = next;
    preview.src = next || '';
    preview.hidden = !next;
    removeBtn.hidden = !next;
    onChange?.({ dataUrl: next, omitted });
  }

  const captureBtn = el('button', {
    type: 'button',
    className: 'btn btn-secondary btn-sm',
    text: '📷 Capture current screen',
    onClick: async () => {
      errorEl.hidden = true;
      captureBtn.disabled = true;
      try {
        const result = await captureScreenshot();
        if (!result.dataUrl) {
          errorEl.textContent = 'Screenshot was too large and was not attached.';
          errorEl.hidden = false;
          return;
        }
        setScreenshot(result.dataUrl, result.omitted);
      } catch {
        errorEl.textContent = 'Could not capture the screen. Try uploading an image instead.';
        errorEl.hidden = false;
      } finally {
        captureBtn.disabled = false;
      }
    }
  });

  const uploadBtn = el('button', {
    type: 'button',
    className: 'btn btn-secondary btn-sm',
    text: '📁 Upload image',
    onClick: () => fileInput.click()
  });

  fileInput.addEventListener('change', async () => {
    const file = fileInput.files?.[0];
    fileInput.value = '';
    if (!file) return;
    const result = await readUploadedImage(file);
    if (result.error) {
      errorEl.textContent = result.error;
      errorEl.hidden = false;
      return;
    }
    errorEl.hidden = true;
    setScreenshot(result.dataUrl);
  });

  const node = el('div', { className: 'field feedback-field feedback-screenshot' }, [
    el('span', { className: 'field-label', text: 'Screenshot' }),
    el('div', { className: 'feedback-screenshot-actions' }, [captureBtn, uploadBtn]),
    fileInput,
    preview,
    removeBtn,
    errorEl
  ]);

  return { node, getValue: () => dataUrl, reset: () => setScreenshot(null) };
}

export function createSystemInfoCheckbox({ checked = true, summaryText, onChange }) {
  const checkbox = el('input', { type: 'checkbox' });
  checkbox.checked = checked;
  checkbox.addEventListener('change', () => onChange?.(checkbox.checked));

  const node = el('label', { className: 'feedback-system-info-checkbox' }, [
    checkbox,
    el('span', {}, [
      'Include system info (browser, OS, screen size, current URL)',
      el('span', { className: 'feedback-system-info-summary', text: summaryText ? ` (${summaryText})` : '' })
    ])
  ]);

  return { node, checkbox, isChecked: () => checkbox.checked };
}

export { debounce };
