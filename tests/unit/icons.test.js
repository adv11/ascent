import { describe, it, expect } from 'vitest';
import { createIcon } from '../../src/ui/components/icons.js';

const ICON_NAMES = [
  'dashboard', 'roadmaps', 'settings', 'signOut', 'menu', 'collapse', 'chevron',
  'check', 'search', 'timer', 'note', 'info', 'trash', 'close', 'plus', 'edit', 'sparkle'
];

describe('icons.js', () => {
  it.each(ICON_NAMES)('createIcon("%s") returns a valid 24x24 <svg> node', name => {
    const svg = createIcon(name);
    expect(svg.tagName).toBe('svg');
    expect(svg.getAttribute('viewBox')).toBe('0 0 24 24');
    expect(svg.getAttribute('aria-hidden')).toBe('true');
    expect(svg.classList.contains('icon')).toBe(true);
    expect(svg.children.length).toBeGreaterThan(0);
  });

  it('defaults to the "sm" size modifier class', () => {
    const svg = createIcon('settings');
    expect(svg.classList.contains('icon-sm')).toBe(true);
  });

  it('applies the requested size modifier class', () => {
    const svg = createIcon('settings', { size: 'lg' });
    expect(svg.classList.contains('icon-lg')).toBe(true);
    expect(svg.classList.contains('icon-sm')).toBe(false);
  });

  it('throws rather than silently rendering nothing for an unknown icon name', () => {
    expect(() => createIcon('not-a-real-icon')).toThrow(/Unknown icon/);
  });

  it('throws for an unknown size', () => {
    expect(() => createIcon('settings', { size: 'huge' })).toThrow(/Unknown icon size/);
  });
});
