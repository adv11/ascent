import { el } from '../dom.js';

// Issue #6 Phase 5.3 — shared submit-button loading state, used by all three
// auth forms (sign-in, sign-up, reset-password) instead of three near-
// identical inline spinner/label swaps. The original label is stashed in a
// dataset field the first time this runs, so repeated loading/idle toggles
// never lose it.
export function setButtonLoading(btn, loading, loadingLabel) {
  if (btn.dataset.originalLabel == null) btn.dataset.originalLabel = btn.textContent;
  btn.disabled = loading;
  if (loading) {
    btn.replaceChildren(el('span', { className: 'btn-spinner' }), ` ${loadingLabel}`);
  } else {
    btn.textContent = btn.dataset.originalLabel;
  }
}
