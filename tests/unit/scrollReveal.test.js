import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { observeReveal } from '../../src/ui/utils/scrollReveal.js';

class MockIntersectionObserver {
  constructor(callback, options) {
    this.callback = callback;
    this.options = options;
    this.observed = [];
    MockIntersectionObserver.instances.push(this);
  }
  observe(el) { this.observed.push(el); }
  unobserve(el) { this.observed = this.observed.filter((o) => o !== el); }
  disconnect() { this.observed = []; }
}
MockIntersectionObserver.instances = [];

function mockMatchMedia(reduceMotion) {
  window.matchMedia = vi.fn().mockImplementation((query) => ({
    matches: reduceMotion && query.includes('prefers-reduced-motion'),
    media: query,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn()
  }));
}

describe('scrollReveal.js', () => {
  const originalIO = window.IntersectionObserver;

  beforeEach(() => {
    MockIntersectionObserver.instances = [];
    window.IntersectionObserver = MockIntersectionObserver;
  });

  afterEach(() => {
    window.IntersectionObserver = originalIO;
  });

  it('adds .is-revealed and unobserves once the element intersects', () => {
    mockMatchMedia(false);
    const el = document.createElement('div');
    observeReveal(el);

    expect(el.classList.contains('is-revealed')).toBe(false);
    const observer = MockIntersectionObserver.instances[0];
    expect(observer.observed).toContain(el);

    observer.callback([{ target: el, isIntersecting: true }]);

    expect(el.classList.contains('is-revealed')).toBe(true);
    expect(observer.observed).not.toContain(el);
  });

  it('does not reveal on a non-intersecting entry', () => {
    mockMatchMedia(false);
    const el = document.createElement('div');
    observeReveal(el);
    const observer = MockIntersectionObserver.instances[0];

    observer.callback([{ target: el, isIntersecting: false }]);

    expect(el.classList.contains('is-revealed')).toBe(false);
    expect(observer.observed).toContain(el);
  });

  it('adds .is-revealed synchronously with no observer under prefers-reduced-motion', () => {
    mockMatchMedia(true);
    const el = document.createElement('div');

    const result = observeReveal(el);

    expect(el.classList.contains('is-revealed')).toBe(true);
    expect(result).toBeNull();
    expect(MockIntersectionObserver.instances.length).toBe(0);
  });

  it('applies a reveal-delay-N class when a delay is passed', () => {
    mockMatchMedia(false);
    const el = document.createElement('div');
    observeReveal(el, { delay: 2 });
    expect(el.classList.contains('reveal-delay-2')).toBe(true);
  });
});
