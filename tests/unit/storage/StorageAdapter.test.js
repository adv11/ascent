import { describe, it, expect } from 'vitest';
import { StorageAdapter } from '../../../src/services/storage/StorageAdapter.js';

describe('StorageAdapter base contract', () => {
  it('throws not implemented for required methods', () => {
    const adapter = new StorageAdapter();
    expect(() => adapter.listenRoadmap()).toThrow('not implemented');
    expect(() => adapter.saveRoadmap()).toThrow('not implemented');
    expect(() => adapter.getRoadmap()).toThrow('not implemented');
    expect(() => adapter.deleteRoadmap()).toThrow('not implemented');
    expect(() => adapter.getMeta()).toThrow('not implemented');
    expect(() => adapter.saveMeta()).toThrow('not implemented');
  });

  it('provides safe defaults for optional methods', async () => {
    const adapter = new StorageAdapter();
    await expect(adapter.getLegacyRoadmap('uid')).resolves.toBeNull();
    expect(typeof adapter.now()).toBe('number');
    expect(adapter.destroy()).toBeUndefined();
  });
});
