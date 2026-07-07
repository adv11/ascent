import { describe, it, expect, beforeEach } from 'vitest';
import { LocalStorageAdapter } from '../../../src/services/storage/LocalStorageAdapter.js';

describe('LocalStorageAdapter', () => {
  let adapter;

  beforeEach(() => {
    localStorage.clear();
    adapter = new LocalStorageAdapter();
  });

  it('round-trips a roadmap through saveRoadmap/getRoadmap', async () => {
    await expect(adapter.getRoadmap('uid', 'java-backend')).resolves.toBeNull();
    const payload = { version: 1, items: { a: { id: 'a', done: false } } };
    await adapter.saveRoadmap('uid', 'java-backend', payload);
    await expect(adapter.getRoadmap('uid', 'java-backend')).resolves.toEqual(payload);
  });

  it('keeps separate templates independent', async () => {
    await adapter.saveRoadmap('uid', 'frontend', { items: { x: 1 } });
    await adapter.saveRoadmap('uid', 'data-science', { items: { y: 2 } });
    await expect(adapter.getRoadmap('uid', 'frontend')).resolves.toEqual({ items: { x: 1 } });
    await expect(adapter.getRoadmap('uid', 'data-science')).resolves.toEqual({ items: { y: 2 } });
  });

  it('deleteRoadmap removes only the targeted template', async () => {
    await adapter.saveRoadmap('uid', 'frontend', { items: {} });
    await adapter.saveRoadmap('uid', 'data-science', { items: {} });
    await adapter.deleteRoadmap('uid', 'frontend');
    await expect(adapter.getRoadmap('uid', 'frontend')).resolves.toBeNull();
    await expect(adapter.getRoadmap('uid', 'data-science')).resolves.toEqual({ items: {} });
  });

  it('getMeta resolves null before any saveMeta call', async () => {
    await expect(adapter.getMeta('uid')).resolves.toBeNull();
  });

  it('saveMeta performs a partial update, not a full overwrite', async () => {
    await adapter.saveMeta('uid', { onboardingDone: true, activeTemplateId: 'java-backend' });
    await adapter.saveMeta('uid', { activeTemplateId: 'frontend' });
    await expect(adapter.getMeta('uid')).resolves.toEqual({
      onboardingDone: true,
      activeTemplateId: 'frontend'
    });
  });

  it('listenRoadmap returns a no-op unsubscribe', () => {
    const unsubscribe = adapter.listenRoadmap();
    expect(typeof unsubscribe).toBe('function');
    expect(() => unsubscribe()).not.toThrow();
  });

  it('ignores the uid argument — a single local store for the browser profile', async () => {
    await adapter.saveRoadmap('uid-a', 'java-backend', { items: { a: 1 } });
    await expect(adapter.getRoadmap('uid-b', 'java-backend')).resolves.toEqual({ items: { a: 1 } });
  });
});
