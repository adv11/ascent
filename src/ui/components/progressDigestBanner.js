import { el } from '../dom.js';
import { createIcon } from './icons.js';
import { buildEffectiveActivityLog } from '../../core/analytics/analyticsEngine.js';
import { computeProgressDigest, hasDigestContent, formatDigestMessage } from '../../core/analytics/progressDigest.js';
import { shouldShowProgressDigest, markProgressDigestShown } from '../utils/progressDigest.js';

// Weekly progress digest banner (issue #284) — a dismissible, once-per-week
// summary of the prior 7 days' activity, computed from the existing
// analytics engine (streaks.js/analyticsEngine.js) with no new backend
// computation, per the issue's explicit scope. Same dismissible-banner shape
// as backupReminderBanner.js/verificationBanner.js: a plain function that
// returns a node or `null` (never rendered at all), no subscription/timer of
// its own — the decision of whether to show is made once, at mount.
//
// Shown for every signed-in identity, including an anonymous guest session —
// local-only progress is still real progress worth summarizing, same
// reasoning backupReminderBanner.js already uses for guests.
export function createProgressDigestBanner({ user, store, activityLogStore }) {
  if (!shouldShowProgressDigest(user.uid)) return null;

  const { items } = store.getSnapshot();
  const { entries, streakFreezes } = activityLogStore.getSnapshot();
  const effectiveLog = buildEffectiveActivityLog(items, entries);
  const digest = computeProgressDigest(effectiveLog, Date.now(), streakFreezes?.usedDates);

  // Nothing worth summarizing — leave the "last shown" guard untouched so
  // the banner can still appear the moment there's real activity to report,
  // rather than burning this week's slot on an empty sentence.
  if (!hasDigestContent(digest)) return null;

  // Marked as shown the moment it's actually rendered (not just computed) —
  // a reload within the same week never shows it again, dismissed or not.
  markProgressDigestShown(user.uid);

  function dismiss() {
    banner.remove();
  }

  const banner = el('div', { className: 'progress-digest-banner', role: 'status', 'aria-live': 'polite' }, [
    el('span', { className: 'progress-digest-icon', 'aria-hidden': 'true' }, [createIcon('trendingUp', { size: 'sm' })]),
    el('span', { className: 'progress-digest-msg', text: formatDigestMessage(digest) }),
    el('a', { href: '#/progress', className: 'btn btn-ghost btn-sm', text: 'View progress' }),
    el('button', {
      type: 'button',
      className: 'btn btn-ghost btn-sm progress-digest-dismiss',
      'aria-label': 'Dismiss weekly progress digest',
      text: 'Dismiss',
      onClick: dismiss
    })
  ]);

  return banner;
}
