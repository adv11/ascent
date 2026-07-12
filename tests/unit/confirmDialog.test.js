import { describe, it, expect, vi, beforeEach } from 'vitest';
import { confirmDialog } from '../../src/ui/components/confirmDialog.js';

function clickDialogAction(action) {
  document.querySelector(`.modal-overlay [data-action="${action}"]`)?.click();
}

beforeEach(() => {
  document.body.innerHTML = '';
});

describe('confirmDialog', () => {
  it('resolves true immediately on confirm when no onConfirm is passed', async () => {
    const promise = confirmDialog({ title: 'Delete?', message: 'Sure?' });
    await vi.waitFor(() => expect(document.querySelector('.modal-overlay')).not.toBeNull());
    clickDialogAction('confirm');
    await expect(promise).resolves.toBe(true);
  });

  it('resolves false on cancel', async () => {
    const promise = confirmDialog({ title: 'Delete?', message: 'Sure?' });
    await vi.waitFor(() => expect(document.querySelector('.modal-overlay')).not.toBeNull());
    clickDialogAction('cancel');
    await expect(promise).resolves.toBe(false);
  });

  // Regression: sign-out's flush-before-signOut used to run after the dialog
  // already closed, leaving the user staring at a blank transition with no
  // feedback for however long the async work took. onConfirm keeps the
  // dialog open with a spinner instead.
  it('keeps the dialog open with a spinner while onConfirm runs, then resolves true', async () => {
    let resolveConfirm;
    const onConfirm = vi.fn(() => new Promise(resolve => { resolveConfirm = resolve; }));
    const promise = confirmDialog({ title: 'Sign out?', message: 'Sure?', confirmText: 'Sign out', onConfirm });
    await vi.waitFor(() => expect(document.querySelector('.modal-overlay')).not.toBeNull());

    clickDialogAction('confirm');
    await vi.waitFor(() => expect(onConfirm).toHaveBeenCalled());

    // Dialog must still be open and showing a busy state.
    expect(document.querySelector('.modal-overlay')).not.toBeNull();
    expect(document.querySelector('[data-action="confirm"]').disabled).toBe(true);
    expect(document.querySelector('[data-action="cancel"]').disabled).toBe(true);
    expect(document.querySelector('[data-action="confirm"] .btn-spinner')).not.toBeNull();

    resolveConfirm();
    await expect(promise).resolves.toBe(true);
    expect(document.querySelector('.modal-overlay')).toBeNull();
  });

  it('re-enables the dialog and stays open if onConfirm rejects', async () => {
    const onConfirm = vi.fn().mockRejectedValue(new Error('boom'));
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    confirmDialog({ title: 'Sign out?', message: 'Sure?', onConfirm });
    await vi.waitFor(() => expect(document.querySelector('.modal-overlay')).not.toBeNull());

    clickDialogAction('confirm');
    await vi.waitFor(() => expect(onConfirm).toHaveBeenCalled());
    await vi.waitFor(() => expect(document.querySelector('[data-action="confirm"]').disabled).toBe(false));

    expect(document.querySelector('.modal-overlay')).not.toBeNull();
    expect(document.querySelector('[data-action="cancel"]').disabled).toBe(false);
    errorSpy.mockRestore();
  });

  it('ignores cancel/Escape clicks while onConfirm is still running', async () => {
    let resolveConfirm;
    const onConfirm = vi.fn(() => new Promise(resolve => { resolveConfirm = resolve; }));
    const promise = confirmDialog({ title: 'Sign out?', message: 'Sure?', onConfirm });
    await vi.waitFor(() => expect(document.querySelector('.modal-overlay')).not.toBeNull());

    clickDialogAction('confirm');
    await vi.waitFor(() => expect(onConfirm).toHaveBeenCalled());
    clickDialogAction('cancel');
    expect(document.querySelector('.modal-overlay')).not.toBeNull();

    resolveConfirm();
    await expect(promise).resolves.toBe(true);
  });
});
