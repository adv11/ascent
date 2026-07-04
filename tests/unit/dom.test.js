import { describe, it, expect } from 'vitest';
import { isValidUrl, escapeHtml, debounce } from '../../src/ui/dom.js';

describe('isValidUrl', () => {
  it('accepts http URLs', () => {
    expect(isValidUrl('http://example.com')).toBe(true);
  });

  it('accepts https URLs', () => {
    expect(isValidUrl('https://example.com/path?q=1')).toBe(true);
  });

  it('rejects javascript: protocol', () => {
    expect(isValidUrl('javascript:alert(1)')).toBe(false);
  });

  it('rejects data: URIs', () => {
    expect(isValidUrl('data:text/html,<h1>hi</h1>')).toBe(false);
  });

  it('rejects plain strings', () => {
    expect(isValidUrl('not a url')).toBe(false);
  });

  it('rejects empty string', () => {
    expect(isValidUrl('')).toBe(false);
  });

  it('rejects undefined (default param)', () => {
    expect(isValidUrl()).toBe(false);
  });
});

describe('escapeHtml', () => {
  it('escapes & < > and "', () => {
    expect(escapeHtml('<script>"&"</script>')).toBe('&lt;script&gt;&quot;&amp;&quot;&lt;/script&gt;');
  });

  it('returns plain strings unchanged', () => {
    expect(escapeHtml('hello world')).toBe('hello world');
  });

  it('coerces numbers to string', () => {
    expect(escapeHtml(42)).toBe('42');
  });
});

describe('debounce', () => {
  it('calls the function after the delay', async () => {
    let calls = 0;
    const fn = debounce(() => { calls++; }, 10);
    fn();
    fn();
    fn();
    expect(calls).toBe(0);
    await new Promise(r => setTimeout(r, 20));
    expect(calls).toBe(1);
  });
});
