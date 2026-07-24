import { describe, it, expect, vi } from 'vitest';
import { isFirebaseApiRequest, isRealtimeDbStreamingRequest, cacheFirst, networkFirst, pruneCache } from '../../src/services/sw/cacheStrategies.js';

function makeMockCache(matchResult = undefined, keys = []) {
  return {
    match: vi.fn().mockResolvedValue(matchResult),
    put: vi.fn().mockResolvedValue(undefined),
    keys: vi.fn().mockResolvedValue(keys),
    delete: vi.fn().mockResolvedValue(true)
  };
}

describe('isFirebaseApiRequest', () => {
  it('matches firebaseio.com and googleapis.com hosts', () => {
    expect(isFirebaseApiRequest('https://ascent-app.firebaseio.com/roadmap.json')).toBe(true);
    expect(isFirebaseApiRequest('https://identitytoolkit.googleapis.com/v1/accounts')).toBe(true);
  });

  it('does not match first-party or unrelated hosts', () => {
    expect(isFirebaseApiRequest('https://ascent.app/src/main.js')).toBe(false);
    expect(isFirebaseApiRequest('https://cdn.jsdelivr.net/npm/chart.js')).toBe(false);
  });
});

describe('isRealtimeDbStreamingRequest', () => {
  it('matches RTDB long-poll and websocket-fallback channel paths', () => {
    expect(isRealtimeDbStreamingRequest('https://s-usc1c-nss-1.firebaseio.com/.lp?ver=5&ns=ascent-app')).toBe(true);
    expect(isRealtimeDbStreamingRequest('https://ascent-app.firebaseio.com/.ws?ver=5')).toBe(true);
  });

  it('does not match a normal RTDB REST GET or a non-firebaseio host', () => {
    expect(isRealtimeDbStreamingRequest('https://ascent-app.firebaseio.com/roadmap.json')).toBe(false);
    expect(isRealtimeDbStreamingRequest('https://identitytoolkit.googleapis.com/v1/accounts')).toBe(false);
  });
});

describe('cacheFirst', () => {
  it('returns the cached response without calling fetch when present', async () => {
    const cached = { ok: true };
    const cache = makeMockCache(cached);
    const fetcher = vi.fn();
    const result = await cacheFirst('request', cache, fetcher);
    expect(result).toBe(cached);
    expect(fetcher).not.toHaveBeenCalled();
  });

  it('falls back to network and caches a successful response on a miss', async () => {
    const cache = makeMockCache(undefined);
    const response = { ok: true, clone: () => 'cloned' };
    const fetcher = vi.fn().mockResolvedValue(response);
    const result = await cacheFirst('request', cache, fetcher);
    expect(result).toBe(response);
    expect(cache.put).toHaveBeenCalledWith('request', 'cloned');
  });
});

describe('networkFirst', () => {
  it('caches and returns a successful GET response', async () => {
    const cache = makeMockCache();
    const response = { ok: true, clone: () => 'cloned' };
    const fetcher = vi.fn().mockResolvedValue(response);
    const request = { method: 'GET' };
    const result = await networkFirst(request, cache, fetcher);
    expect(result).toBe(response);
    expect(cache.put).toHaveBeenCalledWith(request, 'cloned');
  });

  it('does not cache a non-GET response', async () => {
    const cache = makeMockCache();
    const response = { ok: true, clone: () => 'cloned' };
    const fetcher = vi.fn().mockResolvedValue(response);
    await networkFirst({ method: 'PUT' }, cache, fetcher);
    expect(cache.put).not.toHaveBeenCalled();
  });

  it('falls back to stale cached data when the network fails', async () => {
    const stale = { ok: true, stale: true };
    const cache = makeMockCache(stale);
    const fetcher = vi.fn().mockRejectedValue(new Error('offline'));
    const result = await networkFirst({ method: 'GET' }, cache, fetcher);
    expect(result).toBe(stale);
  });

  it('rethrows when the network fails and there is nothing cached', async () => {
    const cache = makeMockCache(undefined);
    const fetcher = vi.fn().mockRejectedValue(new Error('offline'));
    await expect(networkFirst({ method: 'GET' }, cache, fetcher)).rejects.toThrow('offline');
  });

  it('does not prune when maxEntries is not passed', async () => {
    const cache = makeMockCache();
    const response = { ok: true, clone: () => 'cloned' };
    const fetcher = vi.fn().mockResolvedValue(response);
    await networkFirst({ method: 'GET' }, cache, fetcher);
    expect(cache.keys).not.toHaveBeenCalled();
  });

  it('prunes the oldest entries once the cache exceeds maxEntries after caching', async () => {
    const keys = ['req-1', 'req-2', 'req-3', 'req-4'];
    const cache = makeMockCache(undefined, keys);
    const response = { ok: true, clone: () => 'cloned' };
    const fetcher = vi.fn().mockResolvedValue(response);
    await networkFirst({ method: 'GET' }, cache, fetcher, { maxEntries: 3 });
    expect(cache.delete).toHaveBeenCalledTimes(1);
    expect(cache.delete).toHaveBeenCalledWith('req-1');
  });

  it('does not prune when at or under maxEntries', async () => {
    const cache = makeMockCache(undefined, ['req-1', 'req-2']);
    const response = { ok: true, clone: () => 'cloned' };
    const fetcher = vi.fn().mockResolvedValue(response);
    await networkFirst({ method: 'GET' }, cache, fetcher, { maxEntries: 2 });
    expect(cache.delete).not.toHaveBeenCalled();
  });
});

describe('pruneCache', () => {
  it('deletes only the oldest entries past the cap, oldest-first', async () => {
    const cache = makeMockCache(undefined, ['a', 'b', 'c', 'd', 'e']);
    await pruneCache(cache, 2);
    expect(cache.delete).toHaveBeenCalledTimes(3);
    expect(cache.delete).toHaveBeenNthCalledWith(1, 'a');
    expect(cache.delete).toHaveBeenNthCalledWith(2, 'b');
    expect(cache.delete).toHaveBeenNthCalledWith(3, 'c');
  });

  it('does nothing when under the cap', async () => {
    const cache = makeMockCache(undefined, ['a']);
    await pruneCache(cache, 5);
    expect(cache.delete).not.toHaveBeenCalled();
  });
});
