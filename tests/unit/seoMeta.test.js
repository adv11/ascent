import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';

// Issue #127's explicit testing requirement: assert index.html carries the
// new twitter:* meta tags with non-empty content, and that the JSON-LD
// script block is valid, parseable JSON — a malformed JSON-LD block is a
// common, easy-to-ship mistake that fails structured-data validation
// silently (no runtime error, since the browser never executes it).
const indexPath = path.resolve(process.cwd(), 'index.html');
const html = readFileSync(indexPath, 'utf-8');

function metaContent(name) {
  const match = html.match(new RegExp(`<meta name="${name}" content="([^"]*)"`));
  return match ? match[1] : null;
}

describe('index.html — SEO & social-preview meta (issue #127)', () => {
  it('has non-empty twitter:card/title/description/image meta tags', () => {
    expect(metaContent('twitter:card')).toBe('summary_large_image');
    expect(metaContent('twitter:title')).toBeTruthy();
    expect(metaContent('twitter:description')).toBeTruthy();
    expect(metaContent('twitter:image')).toBeTruthy();
  });

  it('twitter:title/description mirror the existing og:title/og:description exactly', () => {
    const ogTitle = html.match(/<meta property="og:title" content="([^"]*)"/)[1];
    const ogDescription = html.match(/<meta property="og:description" content="([^"]*)"/)[1];
    expect(metaContent('twitter:title')).toBe(ogTitle);
    expect(metaContent('twitter:description')).toBe(ogDescription);
  });

  it('has a JSON-LD script block that parses as valid JSON with the expected shape', () => {
    const match = html.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/);
    expect(match, 'expected a JSON-LD <script> block in index.html').not.toBeNull();

    const data = JSON.parse(match[1]);
    expect(data['@context']).toBe('https://schema.org');
    expect(data['@type']).toBe('WebApplication');
    expect(data.name).toBeTruthy();
    expect(data.description).toBeTruthy();
    expect(data.applicationCategory).toBeTruthy();
  });

  it('JSON-LD description matches the page meta description verbatim', () => {
    const metaDescription = html.match(/<meta name="description" content="([^"]*)"/)[1];
    const match = html.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/);
    const data = JSON.parse(match[1]);
    expect(data.description).toBe(metaDescription);
  });
});
