import { describe, it, expect, vi, afterEach } from 'vitest';
import { animateCountUp } from '../../src/utils/countUp.js';

afterEach(() => {
  vi.restoreAllMocks();
});

describe('animateCountUp', () => {
  it('sets the target value immediately when prefers-reduced-motion is set', () => {
    vi.spyOn(window, 'matchMedia').mockReturnValue({ matches: true });
    const el = document.createElement('span');
    animateCountUp(el, 42);
    expect(el.textContent).toBe('42');
  });

  it('sets the target value immediately when already at that value (no-op animation)', () => {
    vi.spyOn(window, 'matchMedia').mockReturnValue({ matches: false });
    const el = document.createElement('span');
    el.textContent = '10';
    animateCountUp(el, 10);
    expect(el.textContent).toBe('10');
  });

  it('animates from the element\'s current numeric text up to the target', () => {
    vi.spyOn(window, 'matchMedia').mockReturnValue({ matches: false });
    let rafCallback;
    vi.spyOn(window, 'requestAnimationFrame').mockImplementation(cb => { rafCallback = cb; return 1; });
    vi.spyOn(performance, 'now').mockReturnValue(0);

    const el = document.createElement('span');
    animateCountUp(el, 100, { duration: 100 });
    expect(rafCallback).toBeTypeOf('function');

    performance.now.mockReturnValue(100);
    rafCallback(100);
    expect(el.textContent).toBe('100');
  });

  it('applies a custom formatFn to the target value', () => {
    vi.spyOn(window, 'matchMedia').mockReturnValue({ matches: true });
    const el = document.createElement('span');
    animateCountUp(el, 7, { formatFn: v => `${v}%` });
    expect(el.textContent).toBe('7%');
  });
});
