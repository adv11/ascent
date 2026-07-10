import { describe, it, expect, beforeEach } from 'vitest';
import {
  ensureBackupFirstSeenAt,
  markBackupTaken,
  dismissBackupReminder,
  shouldShowBackupReminder,
  REMINDER_AFTER_MS,
  SNOOZE_AFTER_DISMISS_MS
} from '../../src/ui/utils/backupReminder.js';

const UID = 'user-123';
const NOW = 1_800_000_000_000;

beforeEach(() => {
  localStorage.clear();
});

describe('shouldShowBackupReminder', () => {
  it('never shows for a signed-out user or a roadmap with no real progress', () => {
    expect(shouldShowBackupReminder(null, true, NOW)).toBe(false);
    expect(shouldShowBackupReminder(UID, false, NOW)).toBe(false);
  });

  it('does not nag a brand-new account that has never been seen before the reminder window elapses', () => {
    ensureBackupFirstSeenAt(UID, NOW);
    expect(shouldShowBackupReminder(UID, true, NOW)).toBe(false);
    expect(shouldShowBackupReminder(UID, true, NOW + REMINDER_AFTER_MS - 1)).toBe(false);
  });

  it('shows once REMINDER_AFTER_MS has passed since first seen, with no backup ever taken', () => {
    ensureBackupFirstSeenAt(UID, NOW);
    expect(shouldShowBackupReminder(UID, true, NOW + REMINDER_AFTER_MS + 1)).toBe(true);
  });

  it('resets the clock every time a backup is taken', () => {
    ensureBackupFirstSeenAt(UID, NOW);
    // Backup taken right when the reminder would otherwise have become due —
    // the clock restarts from here, not from the original first-seen time.
    markBackupTaken(UID, NOW + REMINDER_AFTER_MS);
    expect(shouldShowBackupReminder(UID, true, NOW + REMINDER_AFTER_MS + 1)).toBe(false);
    expect(shouldShowBackupReminder(UID, true, NOW + REMINDER_AFTER_MS * 2 + 1)).toBe(true);
  });

  it('snoozes for SNOOZE_AFTER_DISMISS_MS after a dismissal, then resurfaces', () => {
    ensureBackupFirstSeenAt(UID, NOW);
    const dueAt = NOW + REMINDER_AFTER_MS + 1;
    expect(shouldShowBackupReminder(UID, true, dueAt)).toBe(true);

    dismissBackupReminder(UID, dueAt);
    expect(shouldShowBackupReminder(UID, true, dueAt + 1)).toBe(false);
    expect(shouldShowBackupReminder(UID, true, dueAt + SNOOZE_AFTER_DISMISS_MS - 1)).toBe(false);
    expect(shouldShowBackupReminder(UID, true, dueAt + SNOOZE_AFTER_DISMISS_MS + 1)).toBe(true);
  });

  it('keeps two different accounts on this device fully independent', () => {
    ensureBackupFirstSeenAt('user-a', NOW);
    markBackupTaken('user-a', NOW + REMINDER_AFTER_MS);
    ensureBackupFirstSeenAt('user-b', NOW);

    expect(shouldShowBackupReminder('user-a', true, NOW + REMINDER_AFTER_MS + 1)).toBe(false);
    expect(shouldShowBackupReminder('user-b', true, NOW + REMINDER_AFTER_MS + 1)).toBe(true);
  });
});

describe('ensureBackupFirstSeenAt', () => {
  it('is idempotent — a second call never moves an already-recorded timestamp forward', () => {
    ensureBackupFirstSeenAt(UID, NOW);
    ensureBackupFirstSeenAt(UID, NOW + REMINDER_AFTER_MS); // a much later second visit
    // If the second call had overwritten the first, this would read as "not due yet".
    expect(shouldShowBackupReminder(UID, true, NOW + REMINDER_AFTER_MS + 1)).toBe(true);
  });
});
