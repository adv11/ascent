import { describe, it, expect } from 'vitest';
import { svgEl, svgIcon } from '../../src/ui/utils/svg.js';

describe('svg.js', () => {
  it('svgEl creates a namespaced SVG element with the given attrs', () => {
    const rect = svgEl('rect', { x: '1', y: '2', width: '10', height: '10' });
    expect(rect.namespaceURI).toBe('http://www.w3.org/2000/svg');
    expect(rect.tagName).toBe('rect');
    expect(rect.getAttribute('x')).toBe('1');
    expect(rect.getAttribute('width')).toBe('10');
  });

  it('svgIcon builds a 24x24 viewBox <svg> with aria-hidden and the given size', () => {
    const svg = svgIcon([{ d: 'M0 0h24v24H0z' }], { size: 20 });
    expect(svg.tagName).toBe('svg');
    expect(svg.getAttribute('viewBox')).toBe('0 0 24 24');
    expect(svg.getAttribute('width')).toBe('20');
    expect(svg.getAttribute('height')).toBe('20');
    expect(svg.getAttribute('aria-hidden')).toBe('true');
  });

  it('svgIcon defaults each shape to currentColor stroke / no fill / 1.8 width, per-shape overridable', () => {
    const svg = svgIcon([
      { d: 'M0 0h24v24H0z' },
      { tag: 'circle', cx: '12', cy: '12', r: '2', fill: 'currentColor', stroke: 'none' }
    ]);
    const [path, circle] = svg.children;
    expect(path.getAttribute('fill')).toBe('none');
    expect(path.getAttribute('stroke')).toBe('currentColor');
    expect(path.getAttribute('stroke-width')).toBe('1.8');
    expect(circle.tagName).toBe('circle');
    expect(circle.getAttribute('fill')).toBe('currentColor');
    expect(circle.getAttribute('stroke')).toBe('none');
  });

  it('svgIcon defaults to a 24px size when none is given', () => {
    const svg = svgIcon([{ d: 'M0 0h24v24H0z' }]);
    expect(svg.getAttribute('width')).toBe('24');
    expect(svg.getAttribute('height')).toBe('24');
  });
});
