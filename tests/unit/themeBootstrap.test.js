import { describe, it, expect, beforeEach, vi } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';

// Load the bootstrap source once — we eval it per-test via Function() so each
// test gets a fresh execution against the jsdom globals set up in tests/setup.js.
// Using Function() here is intentional: the bootstrap is a plain IIFE (not an ES
// module) and must be exercised as it runs in the browser — synchronously in
// the global scope — not via an import statement.
const bootstrapSrc = readFileSync(
  join(process.cwd(), 'src/services/themeBootstrap.js'),
  'utf8'
);

function runBootstrap() {
  // eslint-disable-next-line no-new-func
  new Function(bootstrapSrc)();
}

beforeEach(() => {
  delete document.documentElement.dataset.theme;
  delete document.documentElement.dataset.textSize;
  document.documentElement.removeAttribute('data-animations-off');
  localStorage.clear();
  // Reset matchMedia mock to default (light preference) from setup.js
  window.matchMedia.mockImplementation(query => ({
    matches: false,
    media: query,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  }));
});

describe('themeBootstrap — localStorage precedence', () => {
  it('applies stored "dark" theme', () => {
    localStorage.setItem('ascent-theme', 'dark');
    runBootstrap();
    expect(document.documentElement.dataset.theme).toBe('dark');
  });

  it('applies stored "light" theme', () => {
    localStorage.setItem('ascent-theme', 'light');
    runBootstrap();
    expect(document.documentElement.dataset.theme).toBe('light');
  });

  it('stored value takes priority over system dark preference', () => {
    localStorage.setItem('ascent-theme', 'light');
    window.matchMedia.mockImplementation(q => ({ matches: true, media: q, addEventListener: vi.fn(), removeEventListener: vi.fn() }));
    runBootstrap();
    expect(document.documentElement.dataset.theme).toBe('light');
  });
});

describe('themeBootstrap — pre-rename key fallback', () => {
  it('falls back to the pre-rename switchprep-theme key when ascent-theme is absent', () => {
    localStorage.setItem('switchprep-theme', 'dark');
    runBootstrap();
    expect(document.documentElement.dataset.theme).toBe('dark');
  });

  it('prefers ascent-theme over switchprep-theme when both are present', () => {
    localStorage.setItem('switchprep-theme', 'dark');
    localStorage.setItem('ascent-theme', 'light');
    runBootstrap();
    expect(document.documentElement.dataset.theme).toBe('light');
  });
});

describe('themeBootstrap — system preference fallback', () => {
  it('uses "dark" when no stored value and system prefers dark', () => {
    window.matchMedia.mockImplementation(q => ({ matches: true, media: q, addEventListener: vi.fn(), removeEventListener: vi.fn() }));
    runBootstrap();
    expect(document.documentElement.dataset.theme).toBe('dark');
  });

  it('uses "light" when no stored value and system prefers light', () => {
    runBootstrap();
    expect(document.documentElement.dataset.theme).toBe('light');
  });
});

describe('themeBootstrap — text size and animations-off (issue #495)', () => {
  it('applies a stored large/largest text size', () => {
    localStorage.setItem('ascent-text-size', 'largest');
    runBootstrap();
    expect(document.documentElement.dataset.textSize).toBe('largest');
  });

  it('leaves data-text-size unset for the default size', () => {
    runBootstrap();
    expect(document.documentElement.dataset.textSize).toBeUndefined();
  });

  it('ignores an invalid stored text size', () => {
    localStorage.setItem('ascent-text-size', 'huge');
    runBootstrap();
    expect(document.documentElement.dataset.textSize).toBeUndefined();
  });

  it('sets data-animations-off when the preference is stored', () => {
    localStorage.setItem('ascent-animations-off', 'true');
    runBootstrap();
    expect(document.documentElement.hasAttribute('data-animations-off')).toBe(true);
  });

  it('leaves data-animations-off unset by default', () => {
    runBootstrap();
    expect(document.documentElement.hasAttribute('data-animations-off')).toBe(false);
  });
});
