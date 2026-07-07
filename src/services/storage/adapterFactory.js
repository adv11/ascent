import { firebaseAdapter } from './FirebaseAdapter.js';
import { googleDriveAdapter } from './GoogleDriveAdapter.js';

function isGoogleUser(user) {
  return !!user?.providerData?.some(p => p.providerId === 'google.com');
}

// Branches on the signed-in user's auth provider (issue #5, part 2). A user
// who signed in with Google gets Drive sync; every other case (anonymous
// guest, email/password) keeps using Firebase — identical to before this
// backend existed. `user` is optional/nullable — a `null`/missing user (not
// yet signed in, or a legacy call site) is never a Google user, so this
// resolves to `firebaseAdapter`.
//
// `googleDriveAdapter` is unreachable in production today: no UI can yet
// create a Google-authenticated user (`providerData` with
// `providerId: 'google.com'`) — that's part 3, which also wires its
// `getAccessToken`/`onTokenExpired` hooks to a real GIS flow. Until then this
// branch only exists so `roadmapStore.js`'s per-sign-in adapter reselection
// (see `setUser`) has something real to select between.
export function getStorageAdapter(user) {
  return isGoogleUser(user) ? googleDriveAdapter : firebaseAdapter;
}
