import { describe, it, expect, beforeEach } from 'vitest';
import { createNotificationBell, createChangelogBell } from '../../src/ui/components/notificationBell.js';
import { KEYS } from '../../src/services/localStorageKeys.js';
import { APP_VERSION } from '../../src/data/changelog.js';

describe('createNotificationBell', () => {
  it('shows the dot when hasUnread is true, hides it otherwise', () => {
    const unread = createNotificationBell({ hasUnread: true, onClick: () => {} });
    expect(unread.querySelector('.notification-badge-dot').hidden).toBe(false);

    const read = createNotificationBell({ hasUnread: false, onClick: () => {} });
    expect(read.querySelector('.notification-badge-dot').hidden).toBe(true);
  });

  it('setUnread toggles the dot and aria-label', () => {
    const btn = createNotificationBell({ hasUnread: true, onClick: () => {} });
    btn.setUnread(false);
    expect(btn.querySelector('.notification-badge-dot').hidden).toBe(true);
    expect(btn.getAttribute('aria-label')).toBe("What's new");
  });
});

describe('createChangelogBell', () => {
  beforeEach(() => {
    localStorage.clear();
    document.body.innerHTML = '';
  });

  it('starts unread on a device that has never seen the changelog', () => {
    const bell = createChangelogBell();
    expect(bell.querySelector('.notification-badge-dot').hidden).toBe(false);
  });

  it('starts read once already caught up to APP_VERSION', () => {
    localStorage.setItem(KEYS.LAST_SEEN_CHANGELOG_VERSION, String(APP_VERSION));
    const bell = createChangelogBell();
    expect(bell.querySelector('.notification-badge-dot').hidden).toBe(true);
  });

  it('clicking opens the drawer, clears the dot, and persists last-seen-version', () => {
    const bell = createChangelogBell();
    document.body.append(bell);
    bell.click();

    expect(document.querySelector('.changelog-drawer')).not.toBeNull();
    expect(bell.querySelector('.notification-badge-dot').hidden).toBe(true);
    expect(localStorage.getItem(KEYS.LAST_SEEN_CHANGELOG_VERSION)).toBe(String(APP_VERSION));
  });
});
