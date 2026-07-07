import { StorageAdapter } from './StorageAdapter.js';

const DRIVE_FILES_URL = 'https://www.googleapis.com/drive/v3/files';
const DRIVE_UPLOAD_URL = 'https://www.googleapis.com/upload/drive/v3/files';
const META_FILE_NAME = 'ascent-meta.json';

function roadmapFileName(templateId) {
  return `ascent-roadmap-${templateId}.json`;
}

// Last-write-wins per item, keyed by `item.updatedAt` (already part of this
// app's Item shape — docs/api.md). Used only when a save hits a 412 and has
// to merge against whatever landed on Drive in the meantime. `phases` is not
// merged the same way — the local copy wins outright on conflict, a
// deliberate scope simplification (custom-roadmap phase edits are rare and
// far less likely to race than per-item toggles).
function mergeItemsLastWriteWins(localItems = {}, remoteItems = {}) {
  const merged = { ...remoteItems };
  for (const [id, localItem] of Object.entries(localItems)) {
    const remoteItem = remoteItems[id];
    if (!remoteItem || (localItem.updatedAt || 0) >= (remoteItem.updatedAt || 0)) {
      merged[id] = localItem;
    }
  }
  return merged;
}

// Google Drive (appDataFolder) implementation of the storage adapter contract
// (issue #5, part 2 of 3). Raw `fetch` against the Drive REST API — no SDK
// dependency, consistent with this app's no-build-step/no-bundler approach.
//
// Decoupled from *how* an access token is obtained: the caller supplies a
// `getAccessToken()` provider (and optionally `onTokenExpired()`) rather than
// this class doing any OAuth/GIS work itself — that's part 3's job, wiring a
// real Google Identity Services flow to these hooks. `googleDriveAdapter`
// below is constructed with a placeholder provider that throws if actually
// invoked; nothing in production can reach it yet since no UI creates a
// Google-authenticated user (`providerData` with `providerId: 'google.com'`)
// until part 3 ships.
//
// `uid` is accepted on every method for interface conformance but ignored —
// the access token already scopes every request to one Drive account, unlike
// Firebase's per-uid paths.
export class GoogleDriveAdapter extends StorageAdapter {
  constructor({ getAccessToken, onTokenExpired } = {}) {
    super();
    this.getAccessToken = getAccessToken || (() => {
      throw new Error('GoogleDriveAdapter requires a getAccessToken() token provider — not yet wired up (issue #5 part 3)');
    });
    this.onTokenExpired = onTokenExpired || (() => {});
  }

  // Every Drive call flows through here so token-expiry handling is applied
  // once. A 401 calls `onTokenExpired` (a no-op until part 3 wires it to
  // GIS's silent-refresh) and then rejects like any other failed request —
  // callers already handle a rejected adapter call gracefully (see
  // `resolveRoadmapItems`'s try/catch and `queueSave()`'s `.catch()`), so this
  // never surfaces as an unhandled or user-facing error on its own.
  async request(url, options = {}) {
    const token = this.getAccessToken();
    const headers = { ...(options.headers || {}), Authorization: `Bearer ${token}` };
    const res = await fetch(url, { ...options, headers });
    if (res.status === 401) {
      this.onTokenExpired();
      throw new Error('Drive access token expired');
    }
    return res;
  }

  async findFile(name) {
    const query = encodeURIComponent(`name='${name}' and trashed=false`);
    const res = await this.request(`${DRIVE_FILES_URL}?spaces=appDataFolder&q=${query}&fields=files(id,name)`);
    if (!res.ok) throw new Error(`Drive file lookup failed: ${res.status}`);
    const data = await res.json();
    return data.files?.[0] || null;
  }

  // Drive v3 exposes the conditional-request ETag as an HTTP response header,
  // not a JSON field — captured here alongside the downloaded content so
  // saveRoadmap/saveMeta can send it back as `If-Match`.
  async downloadFile(fileId) {
    const res = await this.request(`${DRIVE_FILES_URL}/${fileId}?alt=media`);
    if (!res.ok) throw new Error(`Drive file download failed: ${res.status}`);
    const etag = res.headers.get('etag');
    const content = await res.json();
    return { content, etag };
  }

  async createFile(name, content) {
    const boundary = 'ascent-drive-boundary';
    const metadata = { name, parents: ['appDataFolder'] };
    const body = `--${boundary}\r\n`
      + 'Content-Type: application/json; charset=UTF-8\r\n\r\n'
      + `${JSON.stringify(metadata)}\r\n`
      + `--${boundary}\r\n`
      + 'Content-Type: application/json\r\n\r\n'
      + `${JSON.stringify(content)}\r\n`
      + `--${boundary}--`;
    const res = await this.request(`${DRIVE_UPLOAD_URL}?uploadType=multipart`, {
      method: 'POST',
      headers: { 'Content-Type': `multipart/related; boundary=${boundary}` },
      body
    });
    if (!res.ok) throw new Error(`Drive file create failed: ${res.status}`);
    return res.json();
  }

  updateFileContent(fileId, content, etag) {
    return this.request(`${DRIVE_UPLOAD_URL}/${fileId}?uploadType=media`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', ...(etag ? { 'If-Match': etag } : {}) },
      body: JSON.stringify(content)
    });
  }

  async deleteFile(fileId) {
    const res = await this.request(`${DRIVE_FILES_URL}/${fileId}`, { method: 'DELETE' });
    if (!res.ok && res.status !== 404) throw new Error(`Drive file delete failed: ${res.status}`);
  }

  async saveRoadmap(_uid, templateId, payload) {
    const name = roadmapFileName(templateId);
    const existing = await this.findFile(name);
    if (!existing) {
      await this.createFile(name, payload);
      return;
    }
    const { etag } = await this.downloadFile(existing.id);
    let res = await this.updateFileContent(existing.id, payload, etag);
    if (res.status === 412) {
      const { content: remoteContent, etag: freshEtag } = await this.downloadFile(existing.id);
      const merged = { ...payload, items: mergeItemsLastWriteWins(payload.items, remoteContent.items) };
      res = await this.updateFileContent(existing.id, merged, freshEtag);
    }
    if (!res.ok) throw new Error(`Drive roadmap save failed: ${res.status}`);
  }

  async getRoadmap(_uid, templateId) {
    const existing = await this.findFile(roadmapFileName(templateId));
    if (!existing) return null;
    const { content } = await this.downloadFile(existing.id);
    return content;
  }

  async deleteRoadmap(_uid, templateId) {
    const existing = await this.findFile(roadmapFileName(templateId));
    if (existing) await this.deleteFile(existing.id);
  }

  async getMeta(_uid) {
    const existing = await this.findFile(META_FILE_NAME);
    if (!existing) return null;
    const { content } = await this.downloadFile(existing.id);
    return content;
  }

  // Read-merge-write — mirrors Firebase's partial `update()` semantics
  // without the full etag-conflict-retry machinery `saveRoadmap` needs: meta
  // writes (template switches, hide/unhide) are infrequent and not
  // per-keystroke, a deliberate scope simplification for this PR.
  async saveMeta(_uid, meta) {
    const existing = await this.findFile(META_FILE_NAME);
    if (!existing) {
      await this.createFile(META_FILE_NAME, meta);
      return;
    }
    const { content, etag } = await this.downloadFile(existing.id);
    const merged = { ...content, ...meta };
    const res = await this.updateFileContent(existing.id, merged, etag);
    if (!res.ok) throw new Error(`Drive meta save failed: ${res.status}`);
  }

  // Drive has no realtime push. Polls on visibility-return and window focus
  // instead (per issue #5's spec) — errors are caught here (not propagated)
  // since nothing awaits this fire-and-forget path, matching how
  // FirebaseAdapter's `onValue(ref, callback, onError)` already routes
  // failures to `onError` rather than an unhandled rejection.
  listenRoadmap(uid, templateId, onData, onError) {
    const poll = async () => {
      try {
        const payload = await this.getRoadmap(uid, templateId);
        onData(payload);
      } catch (error) {
        onError?.(error);
      }
    };
    const onVisibility = () => { if (document.visibilityState === 'visible') poll(); };
    const onFocus = () => poll();
    document.addEventListener('visibilitychange', onVisibility);
    window.addEventListener('focus', onFocus);
    return () => {
      document.removeEventListener('visibilitychange', onVisibility);
      window.removeEventListener('focus', onFocus);
    };
  }

  now() {
    return new Date().toISOString();
  }
}

export const googleDriveAdapter = new GoogleDriveAdapter();
