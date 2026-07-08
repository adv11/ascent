import { firebaseAdapter } from './FirebaseAdapter.js';

// A single seam (issue #5, part 1) so `roadmapStore.js` never imports a
// backend adapter directly — today this always resolves to `firebaseAdapter`,
// but a future second backend would only mean adding a branch here, not
// touching any call site.
export function getStorageAdapter() {
  return firebaseAdapter;
}
