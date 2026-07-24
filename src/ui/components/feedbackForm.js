import { el, debounce } from '../dom.js';

// Shared form primitives for feedbackModal.js's three report-type forms
// (issue #9 §3.4, screenshot control removed in issue #348) — field + char
// counter, radio groups. Kept dependency-free of feedbackModal.js itself so
// each primitive is a plain `{ node, getValue, setError }`-shaped builder,
// same composition style every other ad hoc modal in this app
// (addToDailyTodoModal.js, etc.) already uses.

// The input/textarea's own attrs — a textarea can't take a `type`/`value`
// attribute the way an `<input>` can (its value is set as a property below
// instead). Extracted out of createField to keep its own complexity under
// the ESLint gate (root CLAUDE.md).
function buildFieldInputAttrs({ isTextarea, type, maxLength, placeholder, value }) {
  return {
    className: 'field-input feedback-field-input',
    type: isTextarea ? null : type,
    placeholder,
    maxlength: maxLength ? String(maxLength) : null,
    value: isTextarea ? null : value
  };
}

// Validated on blur after the first edit, not on every keystroke (§3.4) —
// `touched` flips true on the field's first blur and stays true.
export function createField({ label, type = 'text', maxLength, placeholder, value = '', required = true, onChange }) {
  const isTextarea = type === 'textarea';
  const input = el(isTextarea ? 'textarea' : 'input', buildFieldInputAttrs({ isTextarea, type, maxLength, placeholder, value }));
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

  const node = el('fieldset', { className: 'field feedback-field feedback-radio-fieldset' }, [
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
