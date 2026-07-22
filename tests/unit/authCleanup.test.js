import { describe, it, expect, vi } from 'vitest';
import { signOutWithCleanup } from '../../src/services/authCleanup.js';

// Pure unit test of the issue #24 anonymous-cleanup decision logic. This
// deliberately does not import src/services/firebase.js — that module pulls
// in the real Firebase SDK and a gitignored firebase.config.js that doesn't
// exist in CI, so the branching logic was extracted into a dependency-free
// helper (authCleanup.js) specifically to make it unit-testable.
describe('authCleanup.js — signOutWithCleanup anonymous cleanup (issue #24)', () => {
  it('deletes the database node and the anonymous auth user instead of a plain sign-out', async () => {
    const removeUserData = vi.fn(() => Promise.resolve());
    const deleteAuthUser = vi.fn(() => Promise.resolve());
    const plainSignOut = vi.fn(() => Promise.resolve());
    const user = { uid: 'guest-1', isAnonymous: true };

    await signOutWithCleanup({ user, removeUserData, deleteAuthUser, plainSignOut });

    expect(removeUserData).toHaveBeenCalledWith('guest-1');
    expect(deleteAuthUser).toHaveBeenCalledWith(user);
    expect(plainSignOut).not.toHaveBeenCalled();
  });

  it('falls back to a plain sign-out for a non-anonymous user', async () => {
    const removeUserData = vi.fn(() => Promise.resolve());
    const deleteAuthUser = vi.fn(() => Promise.resolve());
    const plainSignOut = vi.fn(() => Promise.resolve());
    const user = { uid: 'real-1', isAnonymous: false };

    await signOutWithCleanup({ user, removeUserData, deleteAuthUser, plainSignOut });

    expect(removeUserData).not.toHaveBeenCalled();
    expect(deleteAuthUser).not.toHaveBeenCalled();
    expect(plainSignOut).toHaveBeenCalled();
  });

  it('falls back to a plain sign-out if anonymous cleanup throws', async () => {
    const removeUserData = vi.fn(() => Promise.reject(new Error('offline')));
    const deleteAuthUser = vi.fn(() => Promise.resolve());
    const plainSignOut = vi.fn(() => Promise.resolve());
    const user = { uid: 'guest-2', isAnonymous: true };

    await signOutWithCleanup({ user, removeUserData, deleteAuthUser, plainSignOut });

    expect(plainSignOut).toHaveBeenCalled();
  });

  it('falls back to a plain sign-out when there is no current user', async () => {
    const removeUserData = vi.fn();
    const deleteAuthUser = vi.fn();
    const plainSignOut = vi.fn(() => Promise.resolve());

    await signOutWithCleanup({ user: null, removeUserData, deleteAuthUser, plainSignOut });

    expect(removeUserData).not.toHaveBeenCalled();
    expect(plainSignOut).toHaveBeenCalled();
  });
});
