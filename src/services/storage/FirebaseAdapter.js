import { ref, onValue, off, set, update, get, remove } from 'https://www.gstatic.com/firebasejs/10.12.5/firebase-database.js';
import { database, firebaseClock } from '../firebase.js';
import { StorageAdapter } from './StorageAdapter.js';
import { withTimeout } from './withTimeout.js';

// Every one-time get()/set()/update()/remove() below is wrapped — Firebase's
// realtime listeners (onValue, listenRoadmap/listenDailyTodos) are the one
// exception, since a stalled connection there just means no update arrives
// (nothing to time out; the existing stale-listener guard already handles a
// listener getting replaced). 15s comfortably covers a slow-but-working
// connection while still failing fast enough that a stalled one doesn't
// leave the UI stuck indefinitely — see withTimeout.js for why this exists
// at all (issue #6 Phase 5 follow-up: a user reported roadmap-switching
// hanging indefinitely, traced to switchRoadmap()'s unprotected `await
// flush()`/`await adapter.saveMeta()` calls having no way to ever give up).
const FIREBASE_TIMEOUT_MS = 15000;

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

  dailyTodosRef(uid) {
    return ref(database, `users/${uid}/dailyTodos`);
  }

  listenDailyTodos(uid, callback, onError) {
    const todosRef = this.dailyTodosRef(uid);
    onValue(todosRef, snapshot => callback(snapshot.exists() ? snapshot.val() : null), onError);
    return () => off(todosRef);
  }

  saveDailyTodos(uid, payload) {
    return withTimeout(set(this.dailyTodosRef(uid), payload), FIREBASE_TIMEOUT_MS, 'Timed out saving Daily Todos to Firebase');
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
    return withTimeout(set(this.roadmapRef(uid, templateId), payload), FIREBASE_TIMEOUT_MS, 'Timed out saving roadmap to Firebase');
  }

  // Only ever called for a custom roadmap the user has explicitly deleted
  // (issue #4) — built-in template ids are never removed from Firebase.
  deleteRoadmap(uid, templateId) {
    return withTimeout(remove(this.roadmapRef(uid, templateId)), FIREBASE_TIMEOUT_MS, 'Timed out deleting roadmap from Firebase');
  }

  async getRoadmap(uid, templateId) {
    const snapshot = await withTimeout(get(this.roadmapRef(uid, templateId)), FIREBASE_TIMEOUT_MS, 'Timed out loading roadmap from Firebase');
    return snapshot.exists() ? snapshot.val() : null;
  }

  async getLegacyRoadmap(uid) {
    const snapshot = await withTimeout(get(this.legacyRoadmapRef(uid)), FIREBASE_TIMEOUT_MS, 'Timed out loading legacy roadmap from Firebase');
    return snapshot.exists() ? snapshot.val() : null;
  }

  async getMeta(uid) {
    const snapshot = await withTimeout(get(this.metaRef(uid)), FIREBASE_TIMEOUT_MS, 'Timed out loading account data from Firebase');
    return snapshot.exists() ? snapshot.val() : null;
  }

  saveMeta(uid, meta) {
    return withTimeout(update(this.metaRef(uid), meta), FIREBASE_TIMEOUT_MS, 'Timed out saving account data to Firebase');
  }

  now() {
    return firebaseClock();
  }
}

export const firebaseAdapter = new FirebaseAdapter();
