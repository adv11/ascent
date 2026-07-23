import { describe, it, expect, beforeEach } from 'vitest';

const DIGEST_INTERVAL_MS = 7 * 24 * 60 * 60 * 1000;

function fakeStore(items = []) {
  return { getSnapshot: () => ({ items }) };
}

function fakeActivityLogStore(entries = {}, streakFreezes = { available: 0, usedDates: [] }) {
  return { getSnapshot: () => ({ entries, streakFreezes }) };
}

const user = { uid: 'uid-1', isAnonymous: false, email: 'user@example.com' };
const guestUser = { uid: 'uid-guest', isAnonymous: true, email: null };

const todayKey = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

beforeEach(() => {
  localStorage.clear();
});

describe('createProgressDigestBanner', () => {
  it('returns a banner the first time it is checked for an account with real activity', async () => {
    const { createProgressDigestBanner } = await import('../../src/ui/components/progressDigestBanner.js');
    const entries = { [todayKey()]: 3 };
    const banner = createProgressDigestBanner({ user, store: fakeStore(), activityLogStore: fakeActivityLogStore(entries) });
    expect(banner).not.toBeNull();
    expect(banner.className).toBe('progress-digest-banner');
    expect(banner.textContent).toContain('You completed 3 topics this week.');
  });

  it('returns null when there is nothing to summarize (no completions, no streak)', async () => {
    const { createProgressDigestBanner } = await import('../../src/ui/components/progressDigestBanner.js');
    const banner = createProgressDigestBanner({ user, store: fakeStore(), activityLogStore: fakeActivityLogStore({}) });
    expect(banner).toBeNull();
  });

  it('does not consume the once-per-week guard when there is nothing to summarize', async () => {
    const { createProgressDigestBanner } = await import('../../src/ui/components/progressDigestBanner.js');
    createProgressDigestBanner({ user, store: fakeStore(), activityLogStore: fakeActivityLogStore({}) });

    // Real activity shows up later in the same week — the banner should still be able to appear.
    const entries = { [todayKey()]: 1 };
    const banner = createProgressDigestBanner({ user, store: fakeStore(), activityLogStore: fakeActivityLogStore(entries) });
    expect(banner).not.toBeNull();
  });

  it('shows for an anonymous guest session too — local-only progress is still worth summarizing', async () => {
    const { createProgressDigestBanner } = await import('../../src/ui/components/progressDigestBanner.js');
    const entries = { [todayKey()]: 1 };
    const banner = createProgressDigestBanner({ user: guestUser, store: fakeStore(), activityLogStore: fakeActivityLogStore(entries) });
    expect(banner).not.toBeNull();
  });

  it('marks the guard on render so a second render within the same week returns null', async () => {
    const { createProgressDigestBanner } = await import('../../src/ui/components/progressDigestBanner.js');
    const entries = { [todayKey()]: 1 };
    const first = createProgressDigestBanner({ user, store: fakeStore(), activityLogStore: fakeActivityLogStore(entries) });
    expect(first).not.toBeNull();

    const second = createProgressDigestBanner({ user, store: fakeStore(), activityLogStore: fakeActivityLogStore(entries) });
    expect(second).toBeNull();
  });

  it('shows again once a full week has passed since it was last shown', async () => {
    const { createProgressDigestBanner } = await import('../../src/ui/components/progressDigestBanner.js');
    const entries = { [todayKey()]: 1 };
    createProgressDigestBanner({ user, store: fakeStore(), activityLogStore: fakeActivityLogStore(entries) });

    const key = `ascent-progress-digest-last-shown-${user.uid}`;
    const lastShown = Number(localStorage.getItem(key));
    localStorage.setItem(key, String(lastShown - DIGEST_INTERVAL_MS));

    const banner = createProgressDigestBanner({ user, store: fakeStore(), activityLogStore: fakeActivityLogStore(entries) });
    expect(banner).not.toBeNull();
  });

  it('"Dismiss" removes the banner from the DOM without re-arming the guard', async () => {
    const { createProgressDigestBanner } = await import('../../src/ui/components/progressDigestBanner.js');
    const entries = { [todayKey()]: 1 };
    const banner = createProgressDigestBanner({ user, store: fakeStore(), activityLogStore: fakeActivityLogStore(entries) });
    document.body.appendChild(banner);

    const dismissBtn = banner.querySelector('.progress-digest-dismiss');
    dismissBtn.click();

    expect(document.body.contains(banner)).toBe(false);
    // Still gated for the rest of the week — dismissing doesn't shorten it, but doesn't lengthen it either.
    expect(createProgressDigestBanner({ user, store: fakeStore(), activityLogStore: fakeActivityLogStore(entries) })).toBeNull();
  });
});
