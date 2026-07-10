import { describe, it, expect, vi, beforeEach } from 'vitest';

const exportBackupJson = vi.fn();
vi.mock('../../src/ui/utils/backupActions.js', () => ({ exportBackupJson }));

const REMINDER_AFTER_MS = 14 * 24 * 60 * 60 * 1000;

function fakeStore(items = [{ id: 'a', done: true, custom: false }]) {
  return { getSnapshot: () => ({ items }) };
}

const user = { uid: 'uid-1', isAnonymous: false, email: 'user@example.com' };
const guestUser = { uid: 'uid-guest', isAnonymous: true, email: null };

beforeEach(() => {
  vi.resetModules();
  vi.clearAllMocks();
  localStorage.clear();
});

describe('createBackupReminderBanner', () => {
  it('returns null the very first time a fresh account is seen (nothing to nag about yet)', async () => {
    const { createBackupReminderBanner } = await import('../../src/ui/components/backupReminderBanner.js');
    expect(createBackupReminderBanner({ user, store: fakeStore() })).toBeNull();
  });

  it('returns null when the roadmap has no real progress, even after the interval elapses', async () => {
    localStorage.setItem(`ascent-backup-first-seen-${user.uid}`, String(Date.now() - REMINDER_AFTER_MS - 1));
    const { createBackupReminderBanner } = await import('../../src/ui/components/backupReminderBanner.js');
    const emptyStore = fakeStore([{ id: 'a', done: false, custom: false }]);
    expect(createBackupReminderBanner({ user, store: emptyStore })).toBeNull();
  });

  it('returns a banner once the reminder interval has elapsed since first seen, with real progress', async () => {
    localStorage.setItem(`ascent-backup-first-seen-${user.uid}`, String(Date.now() - REMINDER_AFTER_MS - 1));
    const { createBackupReminderBanner } = await import('../../src/ui/components/backupReminderBanner.js');
    const banner = createBackupReminderBanner({ user, store: fakeStore() });
    expect(banner).not.toBeNull();
    expect(banner.className).toBe('backup-reminder-banner');
  });

  it('shows for an anonymous guest session too — local-only progress is most at risk', async () => {
    localStorage.setItem(`ascent-backup-first-seen-${guestUser.uid}`, String(Date.now() - REMINDER_AFTER_MS - 1));
    const { createBackupReminderBanner } = await import('../../src/ui/components/backupReminderBanner.js');
    expect(createBackupReminderBanner({ user: guestUser, store: fakeStore() })).not.toBeNull();
  });

  it('"Download backup" triggers exportBackupJson and dismisses the banner', async () => {
    localStorage.setItem(`ascent-backup-first-seen-${user.uid}`, String(Date.now() - REMINDER_AFTER_MS - 1));
    const { createBackupReminderBanner } = await import('../../src/ui/components/backupReminderBanner.js');
    const store = fakeStore();
    const banner = createBackupReminderBanner({ user, store });
    document.body.appendChild(banner);

    const downloadBtn = [...banner.querySelectorAll('button')].find(b => b.textContent.includes('Download backup'));
    downloadBtn.click();

    expect(exportBackupJson).toHaveBeenCalledWith(store);
    expect(document.body.contains(banner)).toBe(false);
    expect(localStorage.getItem(`ascent-backup-reminder-dismissed-${user.uid}`)).not.toBeNull();
  });

  it('"Not now" dismisses without exporting, and the reminder stays hidden on the next render', async () => {
    localStorage.setItem(`ascent-backup-first-seen-${user.uid}`, String(Date.now() - REMINDER_AFTER_MS - 1));
    const { createBackupReminderBanner } = await import('../../src/ui/components/backupReminderBanner.js');
    const store = fakeStore();
    const banner = createBackupReminderBanner({ user, store });
    document.body.appendChild(banner);

    const dismissBtn = banner.querySelector('.backup-reminder-dismiss');
    dismissBtn.click();

    expect(exportBackupJson).not.toHaveBeenCalled();
    expect(document.body.contains(banner)).toBe(false);
    expect(createBackupReminderBanner({ user, store })).toBeNull();
  });
});
