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

  // Issue #143: a failed flush used to be swallowed (console.error only) and
  // sign-out proceeded anyway — silently converting a save failure into
  // permanent data loss, since roadmapStore.js's own uid-transition guard
  // wipes local storage right after. It must now block sign-out and ask the
  // user explicitly, rather than assume "fire and forget" success.
  it('does not sign out immediately when the flush fails — asks the user instead', async () => {
    const flush = vi.fn().mockRejectedValue(new Error('network error'));
    const { confirmAndSignOut } = await import('../../src/ui/utils/signOut.js');
    confirmAndSignOut({ isAnonymous: false }, fakeStore(true, flush));
    await vi.waitFor(() => expect(document.querySelector('.modal-overlay')).not.toBeNull());
    clickDialogAction('confirm');

    await vi.waitFor(() => expect(flush).toHaveBeenCalled());
    // A second dialog (stacked on top of the first) asks whether to sign out
    // anyway — sign-out must not have happened yet.
    await vi.waitFor(() => expect(document.querySelectorAll('.modal-overlay')).toHaveLength(2));
    expect(signOutMock).not.toHaveBeenCalled();
    expect(document.querySelectorAll('.modal-overlay')[1].textContent).toMatch(/couldn.t save/i);
  });

  it('signs out anyway once the user explicitly accepts losing the unsaved changes', async () => {
    const flush = vi.fn().mockRejectedValue(new Error('network error'));
    const { confirmAndSignOut } = await import('../../src/ui/utils/signOut.js');
    confirmAndSignOut({ isAnonymous: false }, fakeStore(true, flush));
    await vi.waitFor(() => expect(document.querySelector('.modal-overlay')).not.toBeNull());
    clickDialogAction('confirm');

    await vi.waitFor(() => expect(document.querySelectorAll('.modal-overlay')).toHaveLength(2));
    // The second (failure) dialog's own confirm button — "Sign out anyway".
    document.querySelectorAll('.modal-overlay')[1].querySelector('[data-action="confirm"]').click();

    await vi.waitFor(() => expect(signOutMock).toHaveBeenCalled());
  });

  it('stays signed in and lets the user retry when they choose to keep the unsaved changes', async () => {
    const flush = vi.fn().mockRejectedValue(new Error('network error'));
    const { confirmAndSignOut } = await import('../../src/ui/utils/signOut.js');
    confirmAndSignOut({ isAnonymous: false }, fakeStore(true, flush));
    await vi.waitFor(() => expect(document.querySelector('.modal-overlay')).not.toBeNull());
    clickDialogAction('confirm');

    await vi.waitFor(() => expect(document.querySelectorAll('.modal-overlay')).toHaveLength(2));
    // The second dialog's cancel button — "Stay signed in".
    document.querySelectorAll('.modal-overlay')[1].querySelector('[data-action="cancel"]').click();

    // Back to just the original dialog, re-enabled, ready for a retry.
    await vi.waitFor(() => expect(document.querySelectorAll('.modal-overlay')).toHaveLength(1));
    expect(signOutMock).not.toHaveBeenCalled();
    await vi.waitFor(() => expect(document.querySelector('[data-action="confirm"]').disabled).toBe(false));

    // Retrying (flush now succeeds) signs out normally.
    flush.mockResolvedValueOnce(undefined);
    clickDialogAction('confirm');
    await vi.waitFor(() => expect(signOutMock).toHaveBeenCalled());
  });

  it('flushes a dirty dailyTodoStore alongside a dirty roadmap store', async () => {
    const roadmapFlush = vi.fn().mockResolvedValue(undefined);
    const todoFlush = vi.fn().mockResolvedValue(undefined);
    const { confirmAndSignOut } = await import('../../src/ui/utils/signOut.js');
    confirmAndSignOut({ isAnonymous: false }, fakeStore(false, roadmapFlush), fakeStore(true, todoFlush));
    await vi.waitFor(() => expect(document.querySelector('.modal-overlay')).not.toBeNull());
    clickDialogAction('confirm');

    await vi.waitFor(() => expect(signOutMock).toHaveBeenCalled());
    expect(roadmapFlush).not.toHaveBeenCalled();
    expect(todoFlush).toHaveBeenCalled();
  });

  it('does not flush a dirty dailyTodoStore for a guest session either', async () => {
    const todoFlush = vi.fn().mockResolvedValue(undefined);
    const { confirmAndSignOut } = await import('../../src/ui/utils/signOut.js');
    confirmAndSignOut({ isAnonymous: true }, fakeStore(false), fakeStore(true, todoFlush));
    await vi.waitFor(() => expect(document.querySelector('.modal-overlay')).not.toBeNull());
    expect(document.querySelector('.confirm-dialog-body').textContent).toMatch(/unsaved changes/i);
    clickDialogAction('confirm');
    await vi.waitFor(() => expect(signOutMock).toHaveBeenCalled());
    expect(todoFlush).not.toHaveBeenCalled();
  });
});
