import { el } from '../dom.js';
import { createIcon } from './icons.js';
import { openChangelogDrawer } from './changelogDrawer.js';
import { CHANGELOG, APP_VERSION } from '../../data/changelog.js';
import { getLastSeenChangelogVersion, setLastSeenChangelogVersion } from '../../services/changelogSeen.js';
import { isNewerVersion } from '../../core/changelog/version.js';

// Re-introduced (issue #503, E3) as its own topbar icon button, beside the
// avatar — per the responsive-redesign design reference
// (docs/screenshots/responsive-redesign/03-dashboard.png), which shows a
// dot-badged bell distinct from the avatar/account-menu trigger, not folded
// into it. Issue #488 had briefly folded this into the avatar dropdown as an
// interim call ahead of this issue landing — see topbar.js's own comment,
// now updated to match. `openChangelogDrawer` (itemPanel.js's slide-in
// shell) and `changelogSeen.js`'s persisted "last seen version" are
// unchanged from that interim version, just moved back into their own
// component.
export function createNotificationBell() {
  const lastSeenVersion = getLastSeenChangelogVersion();
  const dot = el('span', {
    className: 'notification-badge notification-badge-dot app-topbar-bell-dot',
    hidden: !isNewerVersion(APP_VERSION, lastSeenVersion)
  });

  function openChangelog() {
    openChangelogDrawer({
      entries: [...CHANGELOG].sort((a, b) => b.version - a.version),
      onClose: () => {}
    });
    setLastSeenChangelogVersion(APP_VERSION);
    dot.hidden = true;
  }

  const button = el('button', {
    type: 'button',
    className: 'app-topbar-bell',
    'aria-label': "What's New",
    onClick: openChangelog
  }, [createIcon('bell', { size: 'sm' }), dot]);

  return button;
}
