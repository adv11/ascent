import { describe, it, expect, vi, beforeEach } from 'vitest';
import { COMPLETED_THRESHOLD } from '../../src/ui/utils/guestDataRisk.js';
import { guestRiskNudgeShownKey } from '../../src/services/localStorageKeys.js';

vi.mock('../../src/ui/router.js', () => ({ navigate: vi.fn() }));

function fakeStore(doneCount) {
  const items = Array.from({ length: doneCount }, (_, i) => ({ id: `i${i}`, done: true }));
  return { getSnapshot: () => ({ items }) };
}

beforeEach(() => {
  vi.resetModules();
  document.body.innerHTML = '';
  localStorage.clear();
});

async function freshNudge(opts) {
  const { createGuestDataRiskNudge } = await import('../../src/ui/components/guestDataRiskNudge.js');
  return createGuestDataRiskNudge(opts);
}

describe('createGuestDataRiskNudge', () => {
  it('never shows for a non-anonymous account', async () => {
    const banner = await freshNudge({ user: { isAnonymous: false, uid: 'u1' }, store: fakeStore(COMPLETED_THRESHOLD) });
    expect(banner).toBeNull();
  });

  it('never shows before the completed-item threshold', async () => {
    const banner = await freshNudge({ user: { isAnonymous: true, uid: 'guest-1' }, store: fakeStore(COMPLETED_THRESHOLD - 1) });
    expect(banner).toBeNull();
  });

  it('returns a banner node for an anonymous account past the threshold and marks it shown', async () => {
    const banner = await freshNudge({ user: { isAnonymous: true, uid: 'guest-2' }, store: fakeStore(COMPLETED_THRESHOLD) });
    expect(banner).not.toBeNull();
    expect(banner.className).toBe('guest-risk-nudge');
    expect(localStorage.getItem(guestRiskNudgeShownKey('guest-2'))).toBe('1');
  });

  it('navigates to /signup when "Create an account" is clicked', async () => {
    const { navigate } = await import('../../src/ui/router.js');
    const banner = await freshNudge({ user: { isAnonymous: true, uid: 'guest-3' }, store: fakeStore(COMPLETED_THRESHOLD) });
    document.body.append(banner);

    banner.querySelector('.btn-primary').click();

    expect(navigate).toHaveBeenCalledWith('/signup');
  });

  it('does not fire again on a second call once already shown', async () => {
    const uid = 'guest-4';
    const firstBanner = await freshNudge({ user: { isAnonymous: true, uid }, store: fakeStore(COMPLETED_THRESHOLD) });
    expect(firstBanner).not.toBeNull();

    const secondBanner = await freshNudge({ user: { isAnonymous: true, uid }, store: fakeStore(COMPLETED_THRESHOLD + 5) });
    expect(secondBanner).toBeNull();
  });
});
