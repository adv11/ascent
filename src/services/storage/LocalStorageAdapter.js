import { KEYS } from '../localStorageKeys.js';
import { StorageAdapter } from './StorageAdapter.js';

// Standalone reference implementation of the storage adapter contract over
// plain localStorage (issue #5). NOT wired into roadmapStore.js — closed as
// not planned (issue #125), same precedent as Google Drive sync (#5/#71
// part 2/3, see .claude/rules/roadmap-store.md). roadmapStore already
// maintains its own local cache (KEYS.ROADMAPS and friends) independently of
// the remote adapter, and that is left untouched here. This module is kept,
// tested, in case a future guest-only local mode or offline-cache adapter
// picks it up via adapterFactory.js — there is no active plan to do so.
//
// `uid` is accepted for interface conformance but ignored: a single browser
// profile is one local store, matching how roadmapStore's own local cache
// already behaves (wiped entirely on sign-out, never partitioned by uid).
export class LocalStorageAdapter extends StorageAdapter {
  readRoadmaps() {
    try {
      const raw = JSON.parse(localStorage.getItem(KEYS.LOCAL_ADAPTER_ROADMAPS) || '{}');
      return raw && typeof raw === 'object' ? raw : {};
    } catch {
      return {};
    }
  }

  writeRoadmaps(all) {
    localStorage.setItem(KEYS.LOCAL_ADAPTER_ROADMAPS, JSON.stringify(all));
  }

  // No push mechanism over plain localStorage — returns a no-op unsubscribe.
  listenRoadmap() {
    return () => {};
  }

  saveRoadmap(_uid, templateId, payload) {
    const all = this.readRoadmaps();
    all[templateId] = payload;
    this.writeRoadmaps(all);
    return Promise.resolve();
  }

  getRoadmap(_uid, templateId) {
    const all = this.readRoadmaps();
    return Promise.resolve(all[templateId] ?? null);
  }

  deleteRoadmap(_uid, templateId) {
    const all = this.readRoadmaps();
    delete all[templateId];
    this.writeRoadmaps(all);
    return Promise.resolve();
  }

  getMeta(_uid) {
    try {
      const raw = JSON.parse(localStorage.getItem(KEYS.LOCAL_ADAPTER_META) || 'null');
      return Promise.resolve(raw && typeof raw === 'object' ? raw : null);
    } catch {
      return Promise.resolve(null);
    }
  }

  async saveMeta(uid, meta) {
    const current = (await this.getMeta(uid)) || {};
    localStorage.setItem(KEYS.LOCAL_ADAPTER_META, JSON.stringify({ ...current, ...meta }));
  }

  now() {
    return Date.now();
  }
}

export const localStorageAdapter = new LocalStorageAdapter();
