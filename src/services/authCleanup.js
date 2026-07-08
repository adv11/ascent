// Pure, dependency-injected core of the anonymous-sign-out cleanup (issue #24) —
// no Firebase imports, so it's unit-testable without a real firebase.config.js
// or network access, unlike firebase.js itself.
export async function signOutWithCleanup({ user, removeUserData, deleteAuthUser, plainSignOut }) {
  if (user?.isAnonymous) {
    try {
      await removeUserData(user.uid);
      await deleteAuthUser(user);
      return;
    } catch {
      // Cleanup failing (e.g. a stale token) must never block the user from
      // leaving the app — fall through to a plain sign-out.
    }
  }
  return plainSignOut();
}
