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
  connectAuthEmulator
} from 'https://www.gstatic.com/firebasejs/10.12.5/firebase-auth.js';
import {
  getDatabase,
  ref,
  onValue,
  off,
  set,
  remove,
  serverTimestamp,
  connectDatabaseEmulator
} from 'https://www.gstatic.com/firebasejs/10.12.5/firebase-database.js';
import { firebaseConfig } from './firebase.config.js';

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
  signOut() {
    return signOut(auth);
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
    const cred = EmailAuthProvider.credential(user.email, password);
    await reauthenticateWithCredential(user, cred);
    // Delete DB data before Auth record to avoid orphaned data
    await remove(ref(database, `users/${user.uid}`));
    await deleteUser(user);
  }
};

export const dbApi = {
  roadmapRef(uid) {
    return ref(database, `users/${uid}/roadmap`);
  },
  listenRoadmap(uid, callback, onError) {
    const roadmapRef = this.roadmapRef(uid);
    onValue(roadmapRef, callback, onError);
    return () => off(roadmapRef);
  },
  saveRoadmap(uid, payload) {
    return set(this.roadmapRef(uid), payload);
  }
};

export function authErrorMessage(error) {
  const messages = {
    'auth/email-already-in-use': 'That email already has an account. Use sign in instead.',
    'auth/invalid-email': 'Enter a valid email address.',
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
