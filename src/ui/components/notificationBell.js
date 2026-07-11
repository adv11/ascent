import { el } from '../dom.js';
import { createIcon } from './icons.js';
import { createNotificationBadge } from './notificationBadge.js';
import { openChangelogDrawer } from './changelogDrawer.js';
import { CHANGELOG, APP_VERSION } from '../../data/changelog.js';
import { getLastSeenChangelogVersion, setLastSeenChangelogVersion } from '../../services/changelogSeen.js';
import { isNewerVersion } from '../../core/changelog/version.js';

// Topbar "What's New" trigger (issue #20). A plain button + dot badge, no
// subscription of its own — unread state is decided once at mount by the
// caller (dashboard.js/settings.js/progress.js), same as themeToggleBtn's
// shape. `hasUnread` toggles the dot; call `setUnread(false)` (returned on
// the node) after the drawer is opened so the dot clears without a full
// topbar re-render.
export function createNotificationBell({ hasUnread, onClick }) {
  const badge = createNotificationBadge(0, {});
  badge.hidden = !hasUnread;

  const btn = el('button', {
    type: 'button',
    className: 'app-topbar-bell',
    'aria-label': hasUnread ? "What's new — unread updates" : "What's new",
    onClick
  }, [createIcon('bell', { size: 'sm' }), badge]);

  btn.setUnread = unread => {
    badge.hidden = !unread;
    btn.setAttribute('aria-label', unread ? "What's new — unread updates" : "What's new");
  };

  return btn;
}

// Composed factory — the one thing dashboard.js/settings.js/progress.js each
// actually need: a bell wired to changelog.json + localStorage with no
// per-page bookkeeping. No subscription/timer of its own (unread state is
// decided once at mount, same as themeToggleBtn without its onThemeChange
// subscription), so there's no cleanup to wire into the route's teardown.
export function createChangelogBell() {
  const lastSeen = getLastSeenChangelogVersion();
  const bell = createNotificationBell({
    hasUnread: isNewerVersion(APP_VERSION, lastSeen),
    onClick: () => {
      openChangelogDrawer({
        entries: [...CHANGELOG].sort((a, b) => b.version - a.version),
        onClose: () => {}
      });
      setLastSeenChangelogVersion(APP_VERSION);
      bell.setUnread(false);
    }
  });
  return bell;
}
