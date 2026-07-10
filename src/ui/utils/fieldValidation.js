import { el } from '../dom.js';

// Issue #6 Phase 5.3 — a deliberately simple format check, matching the level
// of rigor `isValidUrl()` (src/ui/dom.js) already uses elsewhere in this app:
// not full RFC 5322, just enough to catch an obviously malformed address
// before it round-trips to Firebase.
export function isValidEmailFormat(value = '') {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

// Creates a small ✓/✕ icon inside `wrap` (an existing `.field-input-wrap`)
// and returns a `setState(valid)` setter — `true` shows a green check,
// `false` a red ✕, `null`/`undefined` hides it. Never shown before the
// caller's first `setState()` call, so a field the user hasn't reached yet
// (or has left empty) never renders as an error.
export function attachFieldValidationIcon(wrap) {
  const icon = el('span', { className: 'field-validation-icon', 'aria-hidden': 'true' });
  wrap.appendChild(icon);

  function setState(valid) {
    icon.classList.remove('valid', 'invalid');
    if (valid === true) {
      icon.classList.add('valid');
      icon.textContent = '✓';
    } else if (valid === false) {
      icon.classList.add('invalid');
      icon.textContent = '✕';
    } else {
      icon.textContent = '';
    }
  }

  setState(null);
  return { icon, setState };
}
