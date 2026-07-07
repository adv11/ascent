import { ref, onValue, off, set, update, get, remove } from 'https://www.gstatic.com/firebasejs/10.12.5/firebase-database.js';
import { database, firebaseClock } from '../firebase.js';
import { StorageAdapter } from './StorageAdapter.js';

// Firebase Realtime Database implementation of the storage adapter contract.
// This is the exact logic that previously lived as `dbApi` in firebase.js —
// moved here verbatim so roadmapStore.js can go through the adapter interface
// instead of importing Firebase directly (issue #5).
export class FirebaseAdapter extends StorageAdapter {
  // Pre-#58 singular roadmap path. Never written to anymore — kept only as a
  // one-time migration source and safety net for accounts that predate
  // per-template roadmap storage.
  legacyRoadmapRef(uid) {
    return ref(database, `users/${uid}/roadmap`);
  }

  roadmapRef(uid, templateId) {
    return ref(database, `users/${uid}/roadmaps/${templateId}`);
  }

  metaRef(uid) {
    return ref(database, `users/${uid}/meta`);
  }

  listenRoadmap(uid, templateId, callback, onError) {
    const roadmapRef = this.roadmapRef(uid, templateId);
    // Unwrap Firebase's DataSnapshot here so the adapter interface's callback
    // contract stays backend-agnostic (issue #5 part 2) — callers must never
    // see a `.exists()`/`.val()` shape.
    onValue(roadmapRef, snapshot => callback(snapshot.exists() ? snapshot.val() : null), onError);
    return () => off(roadmapRef);
  }

  saveRoadmap(uid, templateId, payload) {
    return set(this.roadmapRef(uid, templateId), payload);
  }

  // Only ever called for a custom roadmap the user has explicitly deleted
  // (issue #4) — built-in template ids are never removed from Firebase.
  deleteRoadmap(uid, templateId) {
    return remove(this.roadmapRef(uid, templateId));
  }

  async getRoadmap(uid, templateId) {
    const snapshot = await get(this.roadmapRef(uid, templateId));
    return snapshot.exists() ? snapshot.val() : null;
  }

  async getLegacyRoadmap(uid) {
    const snapshot = await get(this.legacyRoadmapRef(uid));
    return snapshot.exists() ? snapshot.val() : null;
  }

  async getMeta(uid) {
    const snapshot = await get(this.metaRef(uid));
    return snapshot.exists() ? snapshot.val() : null;
  }

  saveMeta(uid, meta) {
    return update(this.metaRef(uid), meta);
  }

  now() {
    return firebaseClock();
  }
}

export const firebaseAdapter = new FirebaseAdapter();
