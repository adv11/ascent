import { describe, it, expect } from 'vitest';
import { collectMetadata } from '../../src/core/feedback/metadataCollector.js';

const CHROME_MAC_UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36';

describe('collectMetadata', () => {
  it('returns exactly the documented keys', () => {
    const metadata = collectMetadata({
      userAgent: CHROME_MAC_UA,
      innerWidth: 1440,
      innerHeight: 900,
      devicePixelRatio: 2,
      route: '#/dashboard',
      theme: 'dark',
      userId: 'uid-1',
      isAnonymous: false
    });
    expect(Object.keys(metadata).sort()).toEqual(
      ['appVersion', 'browser', 'currentRoute', 'devicePixelRatio', 'isAnonymous', 'os', 'theme', 'userId', 'viewport'].sort()
    );
  });

  it('parses browser and OS from a Chrome/macOS user agent', () => {
    const metadata = collectMetadata({ userAgent: CHROME_MAC_UA, innerWidth: 1440, innerHeight: 900, devicePixelRatio: 2 });
    expect(metadata.browser).toBe('Chrome 126');
    expect(metadata.os).toBe('macOS');
    expect(metadata.viewport).toBe('1440×900');
  });

  it('never includes email or any PII beyond the documented fields', () => {
    const metadata = collectMetadata({ userAgent: CHROME_MAC_UA, innerWidth: 100, innerHeight: 100, userId: 'uid-1' });
    const serialized = JSON.stringify(metadata);
    expect(serialized).not.toMatch(/@/);
    expect(metadata.userId).toBe('uid-1');
  });

  it('defaults isAnonymous/userId when omitted', () => {
    const metadata = collectMetadata({ userAgent: CHROME_MAC_UA, innerWidth: 100, innerHeight: 100 });
    expect(metadata.userId).toBeNull();
    expect(metadata.isAnonymous).toBe(false);
  });
});
