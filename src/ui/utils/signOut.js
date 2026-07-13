import { authApi } from '../../services/firebase.js';
import { navigate } from '../router.js';
import { confirmDialog } from '../components/confirmDialog.js';

// Issue #143: flushes every dirty store passed in, concurrently (they touch
// independent Firebase paths — roadmapStore.js's roadmap write and
// dailyTodoStore.js's todo write never depend on each other). Returns
// `false` if at least one flush rejected instead of throwing itself, so the
// caller can decide what to do about a failure rather than a bare
// console.error silently converting into permanent data loss (the original
// bug: onConfirm swallowed the rejection, confirmDialog closed as if
// nothing went wrong, authApi.signOut() ran anyway, and roadmapStore.js's
// own uid-transition guard then wiped local storage right after — the edit
// was gone from both places with zero signal to the user).
async function flushDirtyStores(stores) {
  const dirtyStores = stores.filter(target => !!target?.getSnapshot().dirty);
  if (!dirtyStores.length) return true;
  const results = await Promise.allSettled(dirtyStores.map(target => target.flush()));
  results.forEach(result => {
    if (result.status === 'rejected') {
      console.error('Failed to flush pending changes before sign-out', result.reason);
    }
  });
  return results.every(result => result.status === 'fulfilled');
}

// Shown only after a flush attempt has already failed — gives the user an
// explicit, informed choice instead of the previous behavior (sign out and
// silently wipe local data no matter whether the save actually succeeded).
// Resolving `true` means "I understand, sign out and lose the unsaved
// changes anyway"; `false` means "keep me signed in so I can retry."
function confirmSignOutDespiteFailedFlush() {
  return confirmDialog({
    title: "Couldn't save your changes",
    message: 'Your latest changes could not be saved. Check your connection and try again. Signing out now will lose them.',
    confirmText: 'Sign out anyway',
    cancelText: 'Stay signed in',
    danger: true
  });
}

// Shared sign-out confirmation — used by every sign-out entry point in the
// app (sidebar.js's footer button, onboarding.js's top row) so the behavior
// stays identical no matter where a user signs out from. Previously
// sidebar.js only confirmed for a guest with unsaved changes; every other
// path (a real account, or a guest with nothing unsaved) signed out
// instantly with no confirmation at all — surprising and, for a guest,
// irreversible (their local-only data is gone). Now every sign-out asks
// first, with a message tailored to what's actually at stake.
// `dailyTodoStore` is optional (issue #143 follow-up — dailyTodoStore.js has
// the identical debounced-write race roadmapStore.js does, previously a
// documented-but-unfixed gap in .claude/rules/roadmap-store.md) — every call
// site should pass it once it has one available; omitting it just means
// Daily Todos aren't covered by the flush-before-sign-out protection below.
export async function confirmAndSignOut(user, store, dailyTodoStore) {
  const stores = [store, dailyTodoStore].filter(Boolean);
  const hasDirtyStore = stores.some(target => !!target.getSnapshot().dirty);
  const isDirtyGuest = user.isAnonymous && hasDirtyStore;
  const needsFlush = !user.isAnonymous && hasDirtyStore;
  const message = isDirtyGuest
    ? 'You have unsaved changes. Guest session data is only stored on this device and will be cleared on sign-out.'
    : user.isAnonymous
      ? 'Guest session data is only stored on this device and will be cleared on sign-out.'
      : "You'll need to sign in again to access your roadmap.";

  const confirmed = await confirmDialog({
    title: 'Sign out?',
    message,
    confirmText: 'Sign out',
    confirmingText: needsFlush ? 'Signing out…' : undefined,
    danger: isDirtyGuest,
    // A real (non-guest) account can still have a debounced roadmap/todo
    // write queued (queueSave()'s 500ms debounce) that hasn't reached
    // Firebase yet. authApi.signOut() invalidates the auth token
    // immediately, so any in-flight or not-yet-fired write after that point
    // silently fails — and the store's own setUser() uid-transition guard
    // wipes local storage right after, so the edit would be lost from both
    // places. Flushing here, while still authenticated, closes that window;
    // passed as onConfirm (rather than just awaited after the dialog
    // resolves) so the dialog itself stays open with a spinner instead of
    // the user watching nothing happen for however long the flush takes.
    // Guest data never reaches Firebase either way (and is deleted by
    // signOutWithCleanup() regardless — see .claude/rules/auth-security.md),
    // so this only ever runs for a real account. If the flush fails, this
    // deliberately does NOT swallow the error and proceed — it asks the
    // user for an explicit choice (see confirmSignOutDespiteFailedFlush).
    // Throwing here keeps THIS dialog open (confirmDialog.js re-enables its
    // buttons on a thrown onConfirm) instead of silently continuing, so the
    // user can retry once their connection recovers, or Cancel out of
    // sign-out entirely — sign-out only ever proceeds past a failed save
    // once the user has explicitly said to.
    onConfirm: needsFlush
      ? async () => {
          const flushed = await flushDirtyStores(stores);
          if (flushed) return;
          const signOutAnyway = await confirmSignOutDespiteFailedFlush();
          if (!signOutAnyway) {
            throw new Error('Sign-out cancelled: unsaved changes could not be saved');
          }
        }
      : undefined
  });
  if (!confirmed) return;

  await authApi.signOut();
  navigate('/signin', true);
}
