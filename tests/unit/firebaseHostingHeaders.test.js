import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

// Issue #403 — manifest.json was falling under firebase.json's blanket
// `/public/**` rule (Cache-Control: max-age=31536000, immutable), so a
// device that had already cached it could never see an updated icon set
// without waiting out a full year. This asserts the carve-out stays in
// place: manifest.json gets its own short-lived Cache-Control, declared
// after the broader /public/** rule so it actually wins (Firebase Hosting
// applies a later-declared header for the same key over an earlier one).
describe('firebase.json hosting headers', () => {
  const config = JSON.parse(readFileSync(resolve(__dirname, '../../firebase.json'), 'utf8'));
  const headers = config.hosting.headers;

  it('carves manifest.json out of the /public/** immutable rule with a short-lived Cache-Control', () => {
    const manifestRuleIndex = headers.findIndex(rule => rule.source === '/public/manifest.json');
    const publicRuleIndex = headers.findIndex(rule => rule.source === '/public/**');

    expect(manifestRuleIndex).toBeGreaterThan(-1);
    expect(publicRuleIndex).toBeGreaterThan(-1);
    expect(manifestRuleIndex).toBeGreaterThan(publicRuleIndex);

    const cacheControl = headers[manifestRuleIndex].headers.find(h => h.key === 'Cache-Control').value;
    expect(cacheControl).not.toMatch(/immutable/);
    expect(cacheControl).not.toMatch(/max-age=31536000/);
  });
});
