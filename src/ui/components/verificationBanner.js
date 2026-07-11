import { el } from '../dom.js';
import { createIcon } from './icons.js';
import { authApi } from '../../services/firebase.js';
import { showToast } from './toast.js';
import { verifyDismissedKey } from '../../services/localStorageKeys.js';

// Shows when the signed-in user's email is not yet verified.
// Uses sessionStorage to remember dismissal per user per session.
export function createVerificationBanner(user) {
  if (user.isAnonymous || user.emailVerified) return null;

  const DISMISS_KEY = verifyDismissedKey(user.uid);
  if (sessionStorage.getItem(DISMISS_KEY)) return null;

  const resendBtn = el('button', {
    type: 'button',
    className: 'btn btn-ghost btn-sm',
    text: 'Resend email',
    onClick: async () => {
      resendBtn.disabled = true;
      try {
        await authApi.sendVerificationEmail();
        showToast('Verification email sent.', 'success');
      } catch {
        showToast('Could not send email. Try again later.', 'error');
        resendBtn.disabled = false;
      }
    }
  });

  const banner = el('div', { className: 'verification-banner', role: 'status', 'aria-live': 'polite' }, [
    el('span', { className: 'verification-msg', text: `Please verify your email (${user.email}).` }),
    resendBtn,
    el('button', {
      type: 'button',
      className: 'btn btn-ghost btn-sm verification-dismiss',
      'aria-label': 'Dismiss verification notice',
      onClick: () => {
        sessionStorage.setItem(DISMISS_KEY, '1');
        banner.remove();
      }
    }, [createIcon('close', { size: 'xs' })])
  ]);

  return banner;
}
