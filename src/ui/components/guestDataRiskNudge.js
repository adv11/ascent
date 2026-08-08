import { el } from '../dom.js';
import { navigate } from '../router.js';
import { createIcon } from './icons.js';
import { shouldShowGuestRiskNudge, markGuestRiskNudgeShown } from '../utils/guestDataRisk.js';

// Issue #123, restyled to a dismissible banner in issue #507 — after a guest
// has built real progress, nudge toward creating a real account so it isn't
// silently lost to a cleared cache/new device/closed tab. Same
// once-ever-per-uid guard as before (shouldShowGuestRiskNudge/
// markGuestRiskNudgeShown, unchanged), just rendered as a banner alongside
// backupReminderBanner.js/progressDigestBanner.js instead of a confirmDialog
// popup — the design reference groups all three as one "nudge" family.
//
// Issue #507's "two tones" rule: an informational nudge (backup reminder,
// progress digest) sits on the accent tint; this one is a warning about
// data at risk, so it sits on the neutral surface with a border instead —
// a warning must never read as a success/informational banner.
export function createGuestDataRiskNudge({ user, store }) {
  if (!user.isAnonymous) return null;

  const completedCount = store.getSnapshot().items.filter(item => item.done).length;
  if (!shouldShowGuestRiskNudge(user.uid, user.isAnonymous, completedCount)) return null;

  markGuestRiskNudgeShown(user.uid);

  function dismiss() {
    banner.remove();
  }

  const banner = el('div', { className: 'guest-risk-nudge', role: 'status', 'aria-live': 'polite' }, [
    el('span', { className: 'guest-risk-nudge-icon', 'aria-hidden': 'true' }, [createIcon('warning', { size: 'sm' })]),
    el('span', {
      className: 'guest-risk-nudge-msg',
      text: 'Your progress is only on this device. Clearing your browser data, switching devices, or losing this device would lose it for good.'
    }),
    el('button', {
      type: 'button',
      className: 'btn btn-primary btn-sm',
      text: 'Create an account',
      onClick: () => { navigate('/signup'); dismiss(); }
    }),
    el('button', {
      type: 'button',
      className: 'btn btn-ghost btn-sm guest-risk-nudge-dismiss',
      'aria-label': 'Dismiss for now',
      text: 'Not now',
      onClick: dismiss
    })
  ]);

  return banner;
}
