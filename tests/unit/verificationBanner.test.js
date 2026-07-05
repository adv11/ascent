import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../src/services/firebase.js', () => ({
  authApi: {
    sendVerificationEmail: vi.fn(),
  },
}));
vi.mock('../../src/ui/components/toast.js', () => ({ showToast: vi.fn() }));

const emailUser = { uid: 'uid-1', email: 'user@example.com', isAnonymous: false, emailVerified: false };
const verifiedUser = { uid: 'uid-2', email: 'v@example.com', isAnonymous: false, emailVerified: true };
const guestUser = { uid: 'uid-3', email: null, isAnonymous: true, emailVerified: false };

beforeEach(() => {
  vi.resetModules();
  sessionStorage.clear();
});

describe('createVerificationBanner', () => {
  it('returns a banner node for an unverified email user', async () => {
    const { createVerificationBanner } = await import('../../src/ui/components/verificationBanner.js');
    const banner = createVerificationBanner(emailUser);
    expect(banner).not.toBeNull();
    expect(banner.className).toBe('verification-banner');
  });

  it('returns null for a verified user', async () => {
    const { createVerificationBanner } = await import('../../src/ui/components/verificationBanner.js');
    expect(createVerificationBanner(verifiedUser)).toBeNull();
  });

  it('returns null for an anonymous user', async () => {
    const { createVerificationBanner } = await import('../../src/ui/components/verificationBanner.js');
    expect(createVerificationBanner(guestUser)).toBeNull();
  });

  it('returns null when user already dismissed in this session', async () => {
    sessionStorage.setItem(`switchprep-verify-dismissed-${emailUser.uid}`, '1');
    const { createVerificationBanner } = await import('../../src/ui/components/verificationBanner.js');
    expect(createVerificationBanner(emailUser)).toBeNull();
  });

  it('shows the user email in the banner text', async () => {
    const { createVerificationBanner } = await import('../../src/ui/components/verificationBanner.js');
    const banner = createVerificationBanner(emailUser);
    expect(banner.textContent).toContain(emailUser.email);
  });

  it('dismiss button removes banner from DOM and sets sessionStorage flag', async () => {
    const { createVerificationBanner } = await import('../../src/ui/components/verificationBanner.js');
    const banner = createVerificationBanner(emailUser);
    document.body.appendChild(banner);

    const dismissBtn = banner.querySelector('.verification-dismiss');
    expect(dismissBtn).not.toBeNull();
    dismissBtn.click();

    expect(document.body.contains(banner)).toBe(false);
    expect(sessionStorage.getItem(`switchprep-verify-dismissed-${emailUser.uid}`)).toBe('1');
  });

  it('resend button calls sendVerificationEmail and shows toast', async () => {
    const { createVerificationBanner } = await import('../../src/ui/components/verificationBanner.js');
    const { authApi } = await import('../../src/services/firebase.js');
    const { showToast } = await import('../../src/ui/components/toast.js');
    authApi.sendVerificationEmail.mockResolvedValue();

    const banner = createVerificationBanner(emailUser);
    document.body.appendChild(banner);

    const resendBtn = [...banner.querySelectorAll('button')].find(b => b.textContent.includes('Resend'));
    resendBtn.click();

    await vi.waitFor(() => expect(authApi.sendVerificationEmail).toHaveBeenCalledOnce());
    expect(showToast).toHaveBeenCalledWith(expect.stringContaining('sent'), 'success');
  });

  it('resend button shows error toast if sendVerificationEmail rejects', async () => {
    const { createVerificationBanner } = await import('../../src/ui/components/verificationBanner.js');
    const { authApi } = await import('../../src/services/firebase.js');
    const { showToast } = await import('../../src/ui/components/toast.js');
    authApi.sendVerificationEmail.mockRejectedValue(new Error('network'));

    const banner = createVerificationBanner(emailUser);
    document.body.appendChild(banner);

    const resendBtn = [...banner.querySelectorAll('button')].find(b => b.textContent.includes('Resend'));
    resendBtn.click();

    await vi.waitFor(() => expect(showToast).toHaveBeenCalledWith(expect.any(String), 'error'));
  });
});
