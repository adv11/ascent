let root;

function ensureRoot() {
  if (!root) {
    root = document.createElement('div');
    root.className = 'toast-stack';
    // Issue #6 Phase 9 — a screen reader user gets no signal at all that a
    // toast appeared without this; 'polite' (not 'assertive') so a toast
    // doesn't interrupt whatever the user is already doing, same reasoning
    // as every other non-urgent status update in this app.
    root.setAttribute('aria-live', 'polite');
    root.setAttribute('role', 'status');
    document.body.appendChild(root);
  }
  return root;
}

export function showToast(message, type = 'info', duration = 3200) {
  const stack = ensureRoot();
  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  toast.textContent = message;
  stack.appendChild(toast);
  requestAnimationFrame(() => toast.classList.add('show'));
  setTimeout(() => {
    toast.classList.remove('show');
    setTimeout(() => toast.remove(), 260);
  }, duration);
}
