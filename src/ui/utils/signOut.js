import { authApi } from '../../services/firebase.js';
import { navigate } from '../router.js';
import { confirmDialog } from '../components/confirmDialog.js';

// Shared sign-out confirmation — used by every sign-out entry point in the
// app (sidebar.js's footer button, onboarding.js's top row) so the behavior
// stays identical no matter where a user signs out from. Previously
// sidebar.js only confirmed for a guest with unsaved changes; every other
// path (a real account, or a guest with nothing unsaved) signed out
// instantly with no confirmation at all — surprising and, for a guest,
// irreversible (their local-only data is gone). Now every sign-out asks
// first, with a message tailored to what's actually at stake.
export async function confirmAndSignOut(user, store) {
  const isDirtyGuest = user.isAnonymous && !!store?.getSnapshot().dirty;
  const message = isDirtyGuest
    ? 'You have unsaved changes. Guest session data is only stored on this device and will be cleared on sign-out.'
    : user.isAnonymous
      ? 'Guest session data is only stored on this device and will be cleared on sign-out.'
      : "You'll need to sign in again to access your roadmap.";

  if (!await confirmDialog({
    title: 'Sign out?',
    message,
    confirmText: 'Sign out',
    danger: isDirtyGuest
  })) return;

  // A real (non-guest) account can still have a debounced roadmap write
  // queued (roadmapStore.js's 500ms queueSave()) that hasn't reached Firebase
  // yet. authApi.signOut() invalidates the auth token immediately, so any
  // in-flight or not-yet-fired write after that point silently fails — and
  // roadmapStore.js's own setUser() uid-transition guard wipes local storage
  // right after, so the edit is lost from both places with no error surfaced.
  // Flushing here, while still authenticated, closes that window. Guest data
  // never reaches Firebase either way, so this only matters for a real account.
  if (!user.isAnonymous && store?.getSnapshot().dirty) {
    try {
      await store.flush();
    } catch (error) {
      console.error('Failed to flush pending roadmap changes before sign-out', error);
    }
  }

  await authApi.signOut();
  navigate('/signin', true);
}
