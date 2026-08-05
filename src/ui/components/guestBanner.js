import { el } from '../dom.js';
import { createIcon } from './icons.js';
import { KEYS } from '../../services/localStorageKeys.js';

// Issue #488 — replaces the old topbar-status pair (a "Local only" sync pill
// plus a "Create account" button) that used to crowd `.app-topbar` on every
// page for a guest session. Both signals now live in one dismissible banner
// at the top of the content area instead of topbar chrome. sessionStorage
// (not per-uid localStorage, unlike verificationBanner.js's dismiss key) —
// this is meant to reappear on a fresh session/tab, not be dismissed forever
// on this device, since a guest's local-only data risk is worth re-surfacing
// each time they come back.
export function createGuestBanner(user) {
  if (!user.isAnonymous) return null;
  if (sessionStorage.getItem(KEYS.GUEST_BANNER_DISMISSED)) return null;

  const banner = el('div', { className: 'guest-banner', role: 'status', 'aria-live': 'polite' }, [
    el('span', { className: 'guest-banner-msg', text: "Saved on this device — create an account to keep your progress safe and sync it across devices." }),
    el('a', { href: '#/signup', className: 'btn btn-secondary btn-sm', text: 'Create account' }),
    el('button', {
      type: 'button',
      className: 'btn btn-ghost btn-sm guest-banner-dismiss',
      'aria-label': 'Dismiss guest notice',
      onClick: () => {
        sessionStorage.setItem(KEYS.GUEST_BANNER_DISMISSED, '1');
        banner.remove();
      }
    }, [createIcon('close', { size: 'xs' })])
  ]);

  return banner;
}
