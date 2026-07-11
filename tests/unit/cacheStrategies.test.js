import { describe, it, expect, vi } from 'vitest';
import { isFirebaseApiRequest, cacheFirst, networkFirst } from '../../src/services/sw/cacheStrategies.js';

function makeMockCache(matchResult = undefined) {
  return {
    match: vi.fn().mockResolvedValue(matchResult),
    put: vi.fn().mockResolvedValue(undefined)
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
});
