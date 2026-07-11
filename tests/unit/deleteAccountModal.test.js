import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../src/services/firebase.js', () => ({
  authApi: {
    deleteAccount: vi.fn(),
  },
  authErrorMessage: e => e?.message || 'error',
}));

vi.mock('../../src/ui/router.js', () => ({ navigate: vi.fn() }));

beforeEach(() => {
  vi.resetModules();
  document.body.innerHTML = '';
});

// Moved out of dashboard.test.js when showDeleteModal (issue #53) was
// extracted from dashboard.js into its own component, openDeleteAccountModal
// (issue #16) — shared by the sidebar's account dropdown and the new
// settings page's danger zone.
describe('openDeleteAccountModal (issue #16)', () => {
  it('renders a delete-account modal overlay attached to document.body', async () => {
    const { openDeleteAccountModal } = await import('../../src/ui/components/deleteAccountModal.js');
    openDeleteAccountModal();
    const overlay = document.querySelector('.modal-overlay[aria-label="Delete account"]');
    expect(overlay).not.toBeNull();
    expect(overlay.querySelector('input[type="password"]')).not.toBeNull();
  });

  it('shows a validation message when submitting without a password', async () => {
    const { openDeleteAccountModal } = await import('../../src/ui/components/deleteAccountModal.js');
    openDeleteAccountModal();
    document.querySelector('.modal-overlay form').requestSubmit();
    const msg = document.querySelector('.form-message');
    expect(msg.textContent).toBe('Enter your password to confirm.');
  });

  it('calls authApi.deleteAccount with the entered password on submit', async () => {
    const { authApi } = await import('../../src/services/firebase.js');
    authApi.deleteAccount.mockResolvedValue();
    const { openDeleteAccountModal } = await import('../../src/ui/components/deleteAccountModal.js');
    openDeleteAccountModal();
    document.querySelector('.modal-overlay input[type="password"]').value = 'secret123';
    document.querySelector('.modal-overlay form').requestSubmit();
    await vi.waitFor(() => expect(authApi.deleteAccount).toHaveBeenCalledWith('secret123'));
  });

  it('cancel button removes the overlay', async () => {
    const { openDeleteAccountModal } = await import('../../src/ui/components/deleteAccountModal.js');
    openDeleteAccountModal();
    const cancelBtn = [...document.querySelectorAll('.modal-overlay button')].find(b => b.textContent === 'Cancel');
    cancelBtn.click();
    expect(document.querySelector('.modal-overlay')).toBeNull();
  });
});
