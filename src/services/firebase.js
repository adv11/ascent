import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.12.5/firebase-app.js';
import {
  getAuth,
  onAuthStateChanged,
  signInAnonymously,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut,
  sendPasswordResetEmail,
  sendEmailVerification,
  setPersistence,
  browserLocalPersistence,
  browserSessionPersistence,
  deleteUser,
  EmailAuthProvider,
  linkWithCredential,
  reauthenticateWithCredential,
  verifyBeforeUpdateEmail,
  updatePassword,
  connectAuthEmulator
} from 'https://www.gstatic.com/firebasejs/10.12.5/firebase-auth.js';
import {
  getDatabase,
  ref,
  remove,
  serverTimestamp,
  connectDatabaseEmulator
} from 'https://www.gstatic.com/firebasejs/10.12.5/firebase-database.js';
import { firebaseConfig } from './firebase.config.js';
import { signOutWithCleanup } from './authCleanup.js';
import { assertAccountDeletable, assertHasPasswordCredential } from './accountGuards.js';

const app = initializeApp(firebaseConfig);

export const auth = getAuth(app);
export const database = getDatabase(app);

// In Playwright E2E tests the fixture injects this flag before any page scripts run.
if (typeof window !== 'undefined' && window.__USE_FIREBASE_EMULATOR__) {
  connectAuthEmulator(auth, 'http://127.0.0.1:9099', { disableWarnings: true });
  connectDatabaseEmulator(database, '127.0.0.1', 9000);
}
export const firebaseClock = serverTimestamp;

export const authApi = {
  onChange(callback) {
    return onAuthStateChanged(auth, callback);
  },
  signIn(email, password) {
    return signInWithEmailAndPassword(auth, email, password);
  },
  signUp(email, password) {
    return createUserWithEmailAndPassword(auth, email, password);
  },
  async linkGuest(email, password) {
    const user = auth.currentUser;
    if (!user?.isAnonymous) throw new Error('No guest session to link');
    const cred = EmailAuthProvider.credential(email, password);
    return linkWithCredential(user, cred);
  },
  guest() {
    return signInAnonymously(auth);
  },
  // Anonymous Firebase Auth users are never re-authenticatable once the session
  // token is gone, so an unlinked guest who signs out would otherwise leave
  // orphaned roadmap data in the database forever (issue #24). Delete the
  // account and its data on the way out instead. A guest who links to a real
  // account first (signUp.js) is no longer anonymous by the time this runs, so
  // that path is unaffected and never creates an orphan in the first place.
  // The decision logic itself lives in authCleanup.js so it can be unit tested
  // without a real Firebase project.
  signOut() {
    return signOutWithCleanup({
      user: auth.currentUser,
      removeUserData: uid => remove(ref(database, `users/${uid}`)),
      deleteAuthUser: deleteUser,
      plainSignOut: () => signOut(auth)
    });
  },
  sendResetEmail(email) {
    return sendPasswordResetEmail(auth, email);
  },
  sendVerificationEmail() {
    return sendEmailVerification(auth.currentUser);
  },
  setPersistence(rememberMe) {
    return setPersistence(auth, rememberMe ? browserLocalPersistence : browserSessionPersistence);
  },
  async deleteAccount(password) {
    const user = auth.currentUser;
    assertAccountDeletable(user);
    const cred = EmailAuthProvider.credential(user.email, password);
    await reauthenticateWithCredential(user, cred);
    // Delete DB data before Auth record to avoid orphaned data
    await remove(ref(database, `users/${user.uid}`));
    await deleteUser(user);
  },
  // Issue #16 — same reauth-first pattern as deleteAccount() above: Firebase
  // requires a freshly reauthenticated session for both of these "sensitive"
  // operations, and throws auth/requires-recent-login otherwise.
  // verifyBeforeUpdateEmail (not the deprecated updateEmail) sends a
  // verification link to the *new* address and only swaps auth.currentUser's
  // email over once that link is clicked — matches issue #16's spec ("Your
  // email won't change until verified") and is required by newer Firebase
  // projects, which reject a direct updateEmail() call outright.
  async updateEmail(newEmail, currentPassword) {
    const user = auth.currentUser;
    assertHasPasswordCredential(user);
    const cred = EmailAuthProvider.credential(user.email, currentPassword);
    await reauthenticateWithCredential(user, cred);
    await verifyBeforeUpdateEmail(user, newEmail);
  },
  async updatePassword(newPassword, currentPassword) {
    const user = auth.currentUser;
    assertHasPasswordCredential(user);
    const cred = EmailAuthProvider.credential(user.email, currentPassword);
    await reauthenticateWithCredential(user, cred);
    await updatePassword(user, newPassword);
  }
};

export function authErrorMessage(error) {
  const messages = {
    'auth/email-already-in-use': 'That email already has an account. Use sign in instead.',
    'auth/invalid-email': 'Enter a valid email address.',
    'auth/invalid-new-email': 'Enter a valid email address.',
    'auth/invalid-credential': 'Email or password is incorrect.',
    'auth/invalid-login-credentials': 'Email or password is incorrect.',
    'auth/missing-password': 'Enter your password.',
    'auth/network-request-failed': 'Network error. Check your connection and try again.',
    'auth/operation-not-allowed': 'This sign-in method is not enabled in Firebase Authentication.',
    'auth/too-many-requests': 'Too many attempts. Wait a little and try again.',
    'auth/user-not-found': 'No account found for that email.',
    'auth/weak-password': 'Use at least 6 characters for the password.',
    'auth/wrong-password': 'Email or password is incorrect.',
    'auth/requires-recent-login': 'For security, please sign out and sign in again before deleting your account.'
  };
  return messages[error?.code] || error?.message || 'Something went wrong. Please try again.';
}
