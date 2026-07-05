import { el } from '../dom.js';

/**
 * Score a password 0–4 based on length, character class diversity.
 * 0 = too short (<6 chars), 1 = weak, 2 = fair, 3–4 = strong.
 */
export function scorePassword(s) {
  if (!s || s.length < 6) return 0;
  let score = 1; // base: meets minimum length
  if (s.length >= 8) score++;
  if (s.length >= 12) score++;
  if (/[A-Z]/.test(s) && /[a-z]/.test(s)) score++;
  if (/[0-9]/.test(s)) score++;
  if (/[^A-Za-z0-9]/.test(s)) score++;
  return Math.min(score, 4);
}

/**
 * Create a show/hide toggle button for a password input.
 * The button is absolutely positioned — wrap the input in `.field-input-wrap`.
 */
export function makePasswordToggle(input) {
  const btn = el('button', {
    type: 'button',
    className: 'password-toggle',
    'aria-label': 'Show password',
    text: 'Show',
  });
  btn.addEventListener('click', () => {
    const hidden = input.type === 'password';
    input.type = hidden ? 'text' : 'password';
    btn.textContent = hidden ? 'Hide' : 'Show';
    btn.setAttribute('aria-label', hidden ? 'Hide password' : 'Show password');
  });
  return btn;
}
