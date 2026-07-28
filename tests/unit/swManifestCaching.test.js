import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

// Issue #403 — sw.js is a real service-worker module (uses `self`/`caches`
// globals not present in jsdom), so it can't be imported directly like
// cacheStrategies.js can — this reads it as text instead, same "regression
// guard via source assertion" precedent as check-cache-version.mjs, to lock
// in the two specific behaviors that fix this bug: manifest.json is never
// precached cache-first, and the fetch handler routes it through
// networkFirst instead of falling into the generic cacheFirst branch.
describe('sw.js manifest.json caching strategy', () => {
  const source = readFileSync(resolve(__dirname, '../../sw.js'), 'utf8');

  it('does not precache manifest.json cache-first', () => {
    const precacheBlockMatch = source.match(/const PRECACHE_URLS = \[([\s\S]*?)\];/);
    expect(precacheBlockMatch).not.toBeNull();
    expect(precacheBlockMatch[1]).not.toMatch(/manifest\.json/);
  });

  it('routes manifest.json requests through networkFirst, not the generic cacheFirst branch', () => {
    expect(source).toMatch(/MANIFEST_URL/);
    const manifestBranchMatch = source.match(/if \(url\.pathname === MANIFEST_URL\) \{([\s\S]*?)\n  \}/);
    expect(manifestBranchMatch).not.toBeNull();
    expect(manifestBranchMatch[1]).toMatch(/networkFirst/);
  });
});
