import { el } from '../dom.js';
import { exportBackupJson } from '../utils/backupActions.js';
import { ensureBackupFirstSeenAt, shouldShowBackupReminder, dismissBackupReminder } from '../utils/backupReminder.js';

// Nudges a user to download a fresh JSON backup every so often (issue #18
// follow-up) — nothing else in the app ever prompts for one, and a backup
// taken months ago is as good as no backup once enough progress has piled up
// since. Same dismissible-banner shape as verificationBanner.js: a plain
// function that returns a node or `null` (never rendered at all), no
// subscription/timer of its own — the decision of whether to show is made
// once, at mount, same as verificationBanner.js's own dismiss check.
//
// Shown for every signed-in identity, including an anonymous guest session —
// local-only progress with no Firebase account behind it is exactly the data
// most at risk of being lost, same reasoning the account dropdown's backup
// items already use (issue #18).
export function createBackupReminderBanner({ user, store }) {
  const snapshot = store.getSnapshot();
  ensureBackupFirstSeenAt(user.uid);

  const hasRealProgress = snapshot.items.some(item => item.done || item.custom);
  if (!shouldShowBackupReminder(user.uid, hasRealProgress)) return null;

  function dismiss() {
    dismissBackupReminder(user.uid);
    banner.remove();
  }

  const downloadBtn = el('button', {
    type: 'button',
    className: 'btn btn-primary btn-sm',
    text: 'Download backup',
    onClick: () => {
      exportBackupJson(store);
      dismiss();
    }
  });

  const banner = el('div', { className: 'backup-reminder-banner', role: 'status', 'aria-live': 'polite' }, [
    el('span', { className: 'backup-reminder-icon', 'aria-hidden': 'true', text: '💾' }),
    el('span', {
      className: 'backup-reminder-msg',
      text: "It's been a couple of weeks since your last backup. Download one now so your roadmap progress is safe if this device is ever lost, or your data is corrupted or deleted."
    }),
    downloadBtn,
    el('button', {
      type: 'button',
      className: 'btn btn-ghost btn-sm backup-reminder-dismiss',
      'aria-label': 'Dismiss backup reminder for now',
      text: 'Not now',
      onClick: dismiss
    })
  ]);

  return banner;
}
