import { describe, it, expect } from 'vitest';
import { createProgressRing } from '../../src/ui/components/progressRing.js';

describe('createProgressRing', () => {
  it('renders an svg with a track and fill circle, sized per the size option', () => {
    const svg = createProgressRing(50, { size: 40, strokeWidth: 4 });
    expect(svg.tagName).toBe('svg');
    expect(svg.getAttribute('width')).toBe('40');
    expect(svg.getAttribute('height')).toBe('40');
    expect(svg.querySelector('.progress-ring-track')).not.toBeNull();
    expect(svg.querySelector('.progress-ring-fill')).not.toBeNull();
  });

  it('sets aria-label to the rounded percent', () => {
    const svg = createProgressRing(33.7);
    expect(svg.getAttribute('aria-label')).toBe('34% complete');
  });

  it('at 0%, stroke-dashoffset equals the full circumference (nothing filled)', () => {
    const svg = createProgressRing(0, { size: 40, strokeWidth: 4 });
    const fill = svg.querySelector('.progress-ring-fill');
    const dasharray = Number(fill.getAttribute('stroke-dasharray'));
    const dashoffset = Number(fill.getAttribute('stroke-dashoffset'));
    expect(dashoffset).toBeCloseTo(dasharray, 5);
  });

  it('at 100%, stroke-dashoffset is 0 (fully filled)', () => {
    const svg = createProgressRing(100);
    const fill = svg.querySelector('.progress-ring-fill');
    expect(Number(fill.getAttribute('stroke-dashoffset'))).toBeCloseTo(0, 5);
  });

  it('_setPct updates the dashoffset and aria-label, clamped to [0, 100]', () => {
    const svg = createProgressRing(0);
    const fill = svg.querySelector('.progress-ring-fill');
    const dasharray = Number(fill.getAttribute('stroke-dasharray'));

    svg._setPct(150);
    expect(Number(fill.getAttribute('stroke-dashoffset'))).toBeCloseTo(0, 5);
    expect(svg.getAttribute('aria-label')).toBe('100% complete');

    svg._setPct(-20);
    expect(Number(fill.getAttribute('stroke-dashoffset'))).toBeCloseTo(dasharray, 5);
    expect(svg.getAttribute('aria-label')).toBe('0% complete');
  });
});
