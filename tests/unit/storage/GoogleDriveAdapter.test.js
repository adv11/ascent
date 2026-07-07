import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { GoogleDriveAdapter } from '../../../src/services/storage/GoogleDriveAdapter.js';

function jsonResponse({ ok = true, status = 200, body = {}, etag = null } = {}) {
  return {
    ok,
    status,
    headers: { get: key => (key.toLowerCase() === 'etag' ? etag : null) },
    json: () => Promise.resolve(body)
  };
}

function createAdapter() {
  return new GoogleDriveAdapter({ getAccessToken: () => 'test-token' });
}

describe('GoogleDriveAdapter', () => {
  let fetchMock;

  beforeEach(() => {
    fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  describe('saveRoadmap', () => {
    it('creates a new file when none exists yet', async () => {
      fetchMock
        .mockResolvedValueOnce(jsonResponse({ body: { files: [] } })) // findFile
        .mockResolvedValueOnce(jsonResponse({ body: { id: 'new-id', name: 'ascent-roadmap-java-backend.json' } })); // createFile

      const adapter = createAdapter();
      await adapter.saveRoadmap('uid', 'java-backend', { version: 3, items: {} });

      expect(fetchMock).toHaveBeenCalledTimes(2);
      const [createUrl, createOptions] = fetchMock.mock.calls[1];
      expect(createUrl).toContain('/upload/drive/v3/files?uploadType=multipart');
      expect(createOptions.method).toBe('POST');
      expect(createOptions.body).toContain('ascent-roadmap-java-backend.json');
    });

    it('updates an existing file with an If-Match etag, no conflict', async () => {
      fetchMock
        .mockResolvedValueOnce(jsonResponse({ body: { files: [{ id: 'file-1', name: 'ascent-roadmap-java-backend.json' }] } })) // findFile
        .mockResolvedValueOnce(jsonResponse({ body: { version: 3, items: {} }, etag: 'etag-1' })) // downloadFile (for etag)
        .mockResolvedValueOnce(jsonResponse({ ok: true, status: 200 })); // updateFileContent

      const adapter = createAdapter();
      await adapter.saveRoadmap('uid', 'java-backend', { version: 3, items: { a: { id: 'a' } } });

      expect(fetchMock).toHaveBeenCalledTimes(3);
      const [updateUrl, updateOptions] = fetchMock.mock.calls[2];
      expect(updateUrl).toContain('/upload/drive/v3/files/file-1?uploadType=media');
      expect(updateOptions.method).toBe('PATCH');
      expect(updateOptions.headers['If-Match']).toBe('etag-1');
    });

    it('on a 412, re-fetches, merges last-write-wins per item, and retries once', async () => {
      const localItems = {
        a: { id: 'a', title: 'local wins', updatedAt: 200 },
        b: { id: 'b', title: 'remote wins (stale local)', updatedAt: 50 }
      };
      const remoteItemsAfterConflict = {
        a: { id: 'a', title: 'stale remote', updatedAt: 100 },
        b: { id: 'b', title: 'remote is newer', updatedAt: 300 }
      };

      fetchMock
        .mockResolvedValueOnce(jsonResponse({ body: { files: [{ id: 'file-1', name: 'ascent-roadmap-java-backend.json' }] } })) // findFile
        .mockResolvedValueOnce(jsonResponse({ body: { version: 3, items: {} }, etag: 'etag-1' })) // downloadFile before update
        .mockResolvedValueOnce(jsonResponse({ ok: false, status: 412 })) // updateFileContent -> conflict
        .mockResolvedValueOnce(jsonResponse({ body: { version: 3, items: remoteItemsAfterConflict }, etag: 'etag-2' })) // re-download
        .mockResolvedValueOnce(jsonResponse({ ok: true, status: 200 })); // retry succeeds

      const adapter = createAdapter();
      await adapter.saveRoadmap('uid', 'java-backend', { version: 3, items: localItems });

      expect(fetchMock).toHaveBeenCalledTimes(5);
      const [retryUrl, retryOptions] = fetchMock.mock.calls[4];
      expect(retryUrl).toContain('/upload/drive/v3/files/file-1?uploadType=media');
      expect(retryOptions.headers['If-Match']).toBe('etag-2');
      const mergedBody = JSON.parse(retryOptions.body);
      expect(mergedBody.items.a.title).toBe('local wins');
      expect(mergedBody.items.b.title).toBe('remote is newer');
    });

    it('a network error rejects the returned promise (no unhandled/uncaught throw)', async () => {
      fetchMock.mockRejectedValueOnce(new Error('network down'));
      const adapter = createAdapter();
      await expect(adapter.saveRoadmap('uid', 'java-backend', { items: {} })).rejects.toThrow('network down');
    });
  });

  describe('getRoadmap', () => {
    it('resolves null when no file exists yet', async () => {
      fetchMock.mockResolvedValueOnce(jsonResponse({ body: { files: [] } }));
      const adapter = createAdapter();
      await expect(adapter.getRoadmap('uid', 'java-backend')).resolves.toBeNull();
    });

    it('resolves the file content when it exists', async () => {
      fetchMock
        .mockResolvedValueOnce(jsonResponse({ body: { files: [{ id: 'file-1', name: 'ascent-roadmap-java-backend.json' }] } }))
        .mockResolvedValueOnce(jsonResponse({ body: { version: 3, items: { a: { id: 'a' } } }, etag: 'etag-1' }));

      const adapter = createAdapter();
      await expect(adapter.getRoadmap('uid', 'java-backend')).resolves.toEqual({ version: 3, items: { a: { id: 'a' } } });
    });

    it('a network error rejects rather than resolving null silently', async () => {
      fetchMock.mockRejectedValueOnce(new Error('offline'));
      const adapter = createAdapter();
      await expect(adapter.getRoadmap('uid', 'java-backend')).rejects.toThrow('offline');
    });
  });

  describe('deleteRoadmap', () => {
    it('deletes the file when it exists', async () => {
      fetchMock
        .mockResolvedValueOnce(jsonResponse({ body: { files: [{ id: 'file-1', name: 'ascent-roadmap-java-backend.json' }] } }))
        .mockResolvedValueOnce(jsonResponse({ ok: true, status: 204 }));

      const adapter = createAdapter();
      await adapter.deleteRoadmap('uid', 'java-backend');

      expect(fetchMock).toHaveBeenCalledTimes(2);
      const [deleteUrl, deleteOptions] = fetchMock.mock.calls[1];
      expect(deleteUrl).toContain('/drive/v3/files/file-1');
      expect(deleteOptions.method).toBe('DELETE');
    });

    it('is a no-op when the file does not exist', async () => {
      fetchMock.mockResolvedValueOnce(jsonResponse({ body: { files: [] } }));
      const adapter = createAdapter();
      await adapter.deleteRoadmap('uid', 'java-backend');
      expect(fetchMock).toHaveBeenCalledTimes(1);
    });
  });

  describe('getMeta / saveMeta', () => {
    it('getMeta resolves null before any file exists', async () => {
      fetchMock.mockResolvedValueOnce(jsonResponse({ body: { files: [] } }));
      const adapter = createAdapter();
      await expect(adapter.getMeta('uid')).resolves.toBeNull();
    });

    it('saveMeta creates the meta file on first save', async () => {
      fetchMock
        .mockResolvedValueOnce(jsonResponse({ body: { files: [] } }))
        .mockResolvedValueOnce(jsonResponse({ body: { id: 'meta-id', name: 'ascent-meta.json' } }));

      const adapter = createAdapter();
      await adapter.saveMeta('uid', { onboardingDone: true });

      expect(fetchMock).toHaveBeenCalledTimes(2);
    });

    it('saveMeta performs a partial (read-merge-write) update, not a full overwrite', async () => {
      fetchMock
        .mockResolvedValueOnce(jsonResponse({ body: { files: [{ id: 'meta-id', name: 'ascent-meta.json' }] } })) // findFile
        .mockResolvedValueOnce(jsonResponse({ body: { onboardingDone: true, activeTemplateId: 'java-backend' }, etag: 'etag-1' })) // downloadFile
        .mockResolvedValueOnce(jsonResponse({ ok: true, status: 200 })); // updateFileContent

      const adapter = createAdapter();
      await adapter.saveMeta('uid', { activeTemplateId: 'frontend' });

      const [, updateOptions] = fetchMock.mock.calls[2];
      const mergedBody = JSON.parse(updateOptions.body);
      expect(mergedBody).toEqual({ onboardingDone: true, activeTemplateId: 'frontend' });
    });
  });

  describe('listenRoadmap — visibility/focus polling', () => {
    it('polls (and calls onData) when the tab becomes visible or the window is focused', async () => {
      fetchMock
        .mockResolvedValue(jsonResponse({ body: { files: [] } })); // every poll: no file yet

      const adapter = createAdapter();
      const onData = vi.fn();
      const unsubscribe = adapter.listenRoadmap('uid', 'java-backend', onData, vi.fn());

      Object.defineProperty(document, 'visibilityState', { value: 'visible', configurable: true });
      document.dispatchEvent(new Event('visibilitychange'));
      await vi.waitFor(() => expect(onData).toHaveBeenCalledTimes(1));

      window.dispatchEvent(new Event('focus'));
      await vi.waitFor(() => expect(onData).toHaveBeenCalledTimes(2));

      unsubscribe();
      document.dispatchEvent(new Event('visibilitychange'));
      window.dispatchEvent(new Event('focus'));
      await new Promise(resolve => setTimeout(resolve, 10));
      expect(onData).toHaveBeenCalledTimes(2); // no further calls after unsubscribe
    });

    it('routes a poll failure to onError instead of an unhandled rejection', async () => {
      fetchMock.mockRejectedValue(new Error('offline'));

      const adapter = createAdapter();
      const onError = vi.fn();
      adapter.listenRoadmap('uid', 'java-backend', vi.fn(), onError);

      Object.defineProperty(document, 'visibilityState', { value: 'visible', configurable: true });
      document.dispatchEvent(new Event('visibilitychange'));

      await vi.waitFor(() => expect(onError).toHaveBeenCalledTimes(1));
      expect(onError.mock.calls[0][0]).toBeInstanceOf(Error);
    });
  });

  describe('token expiry', () => {
    it('a 401 calls onTokenExpired and rejects (never an unhandled/uncaught error)', async () => {
      fetchMock.mockResolvedValueOnce(jsonResponse({ ok: false, status: 401 }));
      const onTokenExpired = vi.fn();
      const adapter = new GoogleDriveAdapter({ getAccessToken: () => 'expired-token', onTokenExpired });

      await expect(adapter.getRoadmap('uid', 'java-backend')).rejects.toThrow('expired');
      expect(onTokenExpired).toHaveBeenCalledTimes(1);
    });
  });

  describe('constructor without a token provider', () => {
    it('throws a clear error only when actually used, matching the "not yet wired up" contract', () => {
      const adapter = new GoogleDriveAdapter();
      expect(() => adapter.getAccessToken()).toThrow(/not yet wired up/);
    });
  });
});
