import { firebaseAdapter } from './FirebaseAdapter.js';

// Every signed-in uid (including anonymous/guest sessions, which already use
// Firebase today) gets the Firebase adapter — identical to current behavior.
// This is the seam a later PR (issue #5, part 2) extends to branch on auth
// type once a GoogleDriveAdapter exists.
export function getStorageAdapter() {
  return firebaseAdapter;
}
