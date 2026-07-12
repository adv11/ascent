import { describe, it, expect, vi, beforeEach } from 'vitest';

const signOutMock = vi.fn().mockResolvedValue(undefined);
vi.mock('../../src/services/firebase.js', () => ({
  authApi: { signOut: signOutMock },
}));
vi.mock('../../src/ui/router.js', () => ({ navigate: vi.fn() }));

function fakeStore(dirty = false, flush = vi.fn().mockResolvedValue(undefined)) {
  return { getSnapshot: () => ({ dirty }), flush };
}

function clickDialogAction(action) {
  document.querySelector(`.modal-overlay [data-action="${action}"]`)?.click();
}

beforeEach(() => {
  vi.resetModules();
  document.body.innerHTML = '';
  signOutMock.mockClear();
});

// Issue: sign-out used to skip confirmation entirely for a real account, or
// for a guest with no unsaved changes — only a dirty guest ever saw a
// dialog. Every path now confirms first, every time.
describe('confirmAndSignOut', () => {
  it('always shows a confirmation dialog, even for a real account with no unsaved changes', async () => {
    const { confirmAndSignOut } = await import('../../src/ui/utils/signOut.js');
    confirmAndSignOut({ isAnonymous: false }, fakeStore(false));
    await vi.waitFor(() => expect(document.querySelector('.modal-overlay')).not.toBeNull());
    expect(signOutMock).not.toHaveBeenCalled();
  });

  it('always shows a confirmation dialog for a guest with no unsaved changes', async () => {
    const { confirmAndSignOut } = await import('../../src/ui/utils/signOut.js');
    confirmAndSignOut({ isAnonymous: true }, fakeStore(false));
    await vi.waitFor(() => expect(document.querySelector('.modal-overlay')).not.toBeNull());
    expect(signOutMock).not.toHaveBeenCalled();
  });

  it('signs out and navigates on confirm', async () => {
    const { confirmAndSignOut } = await import('../../src/ui/utils/signOut.js');
    const { navigate } = await import('../../src/ui/router.js');
    confirmAndSignOut({ isAnonymous: false }, fakeStore(false));
    await vi.waitFor(() => expect(document.querySelector('.modal-overlay')).not.toBeNull());
    clickDialogAction('confirm');
    await vi.waitFor(() => expect(signOutMock).toHaveBeenCalled());
    await vi.waitFor(() => expect(navigate).toHaveBeenCalledWith('/signin', true));
  });

  it('does nothing on cancel', async () => {
    const { confirmAndSignOut } = await import('../../src/ui/utils/signOut.js');
    confirmAndSignOut({ isAnonymous: false }, fakeStore(false));
    await vi.waitFor(() => expect(document.querySelector('.modal-overlay')).not.toBeNull());
    clickDialogAction('cancel');
    await new Promise(r => setTimeout(r, 0));
    expect(signOutMock).not.toHaveBeenCalled();
  });

  it('uses a stronger, danger-styled warning for a guest with unsaved changes', async () => {
    const { confirmAndSignOut } = await import('../../src/ui/utils/signOut.js');
    confirmAndSignOut({ isAnonymous: true }, fakeStore(true));
    await vi.waitFor(() => expect(document.querySelector('.modal-overlay')).not.toBeNull());
    expect(document.querySelector('.confirm-dialog-body').textContent).toMatch(/unsaved changes/i);
    expect(document.querySelector('[data-action="confirm"]').className).toContain('btn-danger');
  });

  // Regression: a real account's debounced roadmap write (roadmapStore.js's
  // 500ms queueSave()) could still be pending when the user clicked "Sign
  // out" — authApi.signOut() invalidates the auth token before that write
  // fires, silently dropping the edit, which is then also wiped from local
  // storage by roadmapStore.js's own uid-transition guard. Flushing before
  // signOut() closes that window.
  it('flushes a dirty real account before signing out', async () => {
    const flush = vi.fn().mockResolvedValue(undefined);
    const { confirmAndSignOut } = await import('../../src/ui/utils/signOut.js');
    confirmAndSignOut({ isAnonymous: false }, fakeStore(true, flush));
    await vi.waitFor(() => expect(document.querySelector('.modal-overlay')).not.toBeNull());
    clickDialogAction('confirm');
    await vi.waitFor(() => expect(signOutMock).toHaveBeenCalled());
    expect(flush).toHaveBeenCalled();
    expect(flush.mock.invocationCallOrder[0]).toBeLessThan(signOutMock.mock.invocationCallOrder[0]);
  });

  it('does not flush a dirty guest session — guest data never reaches Firebase anyway', async () => {
    const flush = vi.fn().mockResolvedValue(undefined);
    const { confirmAndSignOut } = await import('../../src/ui/utils/signOut.js');
    confirmAndSignOut({ isAnonymous: true }, fakeStore(true, flush));
    await vi.waitFor(() => expect(document.querySelector('.modal-overlay')).not.toBeNull());
    clickDialogAction('confirm');
    await vi.waitFor(() => expect(signOutMock).toHaveBeenCalled());
    expect(flush).not.toHaveBeenCalled();
  });

  it('does not flush a clean (non-dirty) real account', async () => {
    const flush = vi.fn().mockResolvedValue(undefined);
    const { confirmAndSignOut } = await import('../../src/ui/utils/signOut.js');
    confirmAndSignOut({ isAnonymous: false }, fakeStore(false, flush));
    await vi.waitFor(() => expect(document.querySelector('.modal-overlay')).not.toBeNull());
    clickDialogAction('confirm');
    await vi.waitFor(() => expect(signOutMock).toHaveBeenCalled());
    expect(flush).not.toHaveBeenCalled();
  });

  it('still signs out even if the flush fails', async () => {
    const flush = vi.fn().mockRejectedValue(new Error('network error'));
    const { confirmAndSignOut } = await import('../../src/ui/utils/signOut.js');
    confirmAndSignOut({ isAnonymous: false }, fakeStore(true, flush));
    await vi.waitFor(() => expect(document.querySelector('.modal-overlay')).not.toBeNull());
    clickDialogAction('confirm');
    await vi.waitFor(() => expect(signOutMock).toHaveBeenCalled());
  });
});
