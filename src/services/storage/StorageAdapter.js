// Contract every storage backend must implement (issue #5). Shaped around what
// roadmapStore.js actually calls today — (uid, templateId) on every roadmap
// method plus a separate per-user `meta` document — not the issue's simpler
// single-roadmap `load(roadmapId)`/`save(roadmapId, data)` sketch, which
// predates the multi-user/multi-template data model issues #58 and #4 built.
export class StorageAdapter {
  /** Realtime listener for one template's roadmap. Returns an unsubscribe fn. */
  listenRoadmap(_uid, _templateId, _onData, _onError) {
    throw new Error('not implemented');
  }

  /** Full overwrite of one template's roadmap payload. */
  saveRoadmap(_uid, _templateId, _payload) {
    throw new Error('not implemented');
  }

  /** One-time read of one template's roadmap. Resolves null if none exists. */
  getRoadmap(_uid, _templateId) {
    throw new Error('not implemented');
  }

  /** Permanently removes one template's roadmap (custom roadmaps only). */
  deleteRoadmap(_uid, _templateId) {
    throw new Error('not implemented');
  }

  /** One-time read of the user's roadmap-selection/onboarding meta. */
  getMeta(_uid) {
    throw new Error('not implemented');
  }

  /** Partial update of the user's meta document. */
  saveMeta(_uid, _meta) {
    throw new Error('not implemented');
  }

  // Optional — only Firebase has pre-issue-#58 legacy single-roadmap data to
  // migrate from. Other backends have no equivalent and can rely on this
  // default.
  getLegacyRoadmap(_uid) {
    return Promise.resolve(null);
  }

  // Adapter-specific write timestamp: Firebase stamps its serverTimestamp()
  // sentinel, a future Drive adapter would stamp an ISO date string.
  now() {
    return Date.now();
  }

  /** Cleans up any open listeners/timers. No-op unless a backend needs it. */
  destroy() {}
}
