import { describe, it, expect } from 'vitest';
import { readFileSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const rootDir = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const manifest = JSON.parse(readFileSync(resolve(rootDir, 'public/manifest.json'), 'utf8'));

describe('public/manifest.json', () => {
  it('is valid JSON with the required PWA fields', () => {
    expect(manifest.name).toBe('Ascent');
    expect(manifest.short_name).toBe('Ascent');
    expect(manifest.display).toBe('standalone');
    expect(manifest.start_url).toBe('/?source=pwa');
    expect(Array.isArray(manifest.icons)).toBe(true);
    expect(manifest.icons.length).toBeGreaterThan(0);
  });

  it('every icon path resolves to a real file on disk', () => {
    manifest.icons.forEach(icon => {
      const path = resolve(rootDir, icon.src.replace(/^\//, ''));
      expect(existsSync(path), `${icon.src} should exist on disk`).toBe(true);
    });
  });

  it('includes at least a 192x192 and a 512x512 icon', () => {
    const sizes = manifest.icons.map(icon => icon.sizes);
    expect(sizes).toContain('192x192');
    expect(sizes).toContain('512x512');
  });
});
