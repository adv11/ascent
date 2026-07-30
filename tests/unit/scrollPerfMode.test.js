import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

// initScrollPerfMode() is a deliberate app-lifetime singleton with no
// teardown (see its own doc comment) — fine in the real app (called once,
// ever), but each test importing a fresh module instance would otherwise
// leave its window-level 'scroll' listener registered forever, so later
// tests' dispatches would fire every earlier test's listener too. Capture
// and manually remove it after each test instead.
let addedScrollListener = null;

beforeEach(() => {
  vi.resetModules();
  vi.useFakeTimers();
  document.documentElement.removeAttribute('data-scrolling');
  const realAddEventListener = window.addEventListener.bind(window);
  vi.spyOn(window, 'addEventListener').mockImplementation((type, listener, options) => {
    if (type === 'scroll') addedScrollListener = listener;
    return realAddEventListener(type, listener, options);
  });
});

afterEach(() => {
  if (addedScrollListener) {
    window.removeEventListener('scroll', addedScrollListener, true);
    addedScrollListener = null;
  }
  vi.restoreAllMocks();
  vi.useRealTimers();
});

// requestAnimationFrame isn't driven by vi's fake timers by default — stub it
// to run synchronously so we can assert on the very next microtask/tick
// without depending on real frame timing.
function stubImmediateRaf() {
  vi.stubGlobal('requestAnimationFrame', cb => {
    cb(0);
    return 0;
  });
}

async function freshScrollPerfMode() {
  return import('../../src/services/scrollPerfMode.js');
}

describe('scrollPerfMode.js — initScrollPerfMode', () => {
  it('sets [data-scrolling] on <html> on the first scroll event', async () => {
    stubImmediateRaf();
    const { initScrollPerfMode } = await freshScrollPerfMode();
    initScrollPerfMode();

    expect(document.documentElement.hasAttribute('data-scrolling')).toBe(false);
    window.dispatchEvent(new Event('scroll'));
    expect(document.documentElement.hasAttribute('data-scrolling')).toBe(true);
  });

  it('clears [data-scrolling] once no further scroll event fires for the debounce window', async () => {
    stubImmediateRaf();
    const { initScrollPerfMode } = await freshScrollPerfMode();
    initScrollPerfMode();

    window.dispatchEvent(new Event('scroll'));
    expect(document.documentElement.hasAttribute('data-scrolling')).toBe(true);

    vi.advanceTimersByTime(149);
    expect(document.documentElement.hasAttribute('data-scrolling')).toBe(true);

    vi.advanceTimersByTime(1);
    expect(document.documentElement.hasAttribute('data-scrolling')).toBe(false);
  });

  it('a repeated scroll event resets the debounce window instead of letting it expire mid-scroll', async () => {
    stubImmediateRaf();
    const { initScrollPerfMode } = await freshScrollPerfMode();
    initScrollPerfMode();

    window.dispatchEvent(new Event('scroll'));
    vi.advanceTimersByTime(100);
    window.dispatchEvent(new Event('scroll'));
    vi.advanceTimersByTime(100);
    expect(document.documentElement.hasAttribute('data-scrolling')).toBe(true);

    vi.advanceTimersByTime(50);
    expect(document.documentElement.hasAttribute('data-scrolling')).toBe(false);
  });

  it('only schedules one requestAnimationFrame per animation frame regardless of scroll-event volume', async () => {
    const rafSpy = vi.fn(cb => {
      cb(0);
      return 0;
    });
    vi.stubGlobal('requestAnimationFrame', rafSpy);
    const { initScrollPerfMode } = await freshScrollPerfMode();
    initScrollPerfMode();

    window.dispatchEvent(new Event('scroll'));
    window.dispatchEvent(new Event('scroll'));
    window.dispatchEvent(new Event('scroll'));

    // The stub invokes the callback synchronously and resets the internal
    // "already scheduled" flag on every dispatch here, so each event does
    // get its own rAF call in this synchronous stub — the real guard this
    // asserts is that a *second* scroll event before the first rAF callback
    // has run does not schedule a second one.
    expect(rafSpy).toHaveBeenCalledTimes(3);
  });

  it('does not schedule a second requestAnimationFrame while one is still pending', async () => {
    let pendingCallback = null;
    const rafSpy = vi.fn(cb => {
      pendingCallback = cb;
      return 0;
    });
    vi.stubGlobal('requestAnimationFrame', rafSpy);
    const { initScrollPerfMode } = await freshScrollPerfMode();
    initScrollPerfMode();

    window.dispatchEvent(new Event('scroll'));
    window.dispatchEvent(new Event('scroll'));
    window.dispatchEvent(new Event('scroll'));
    expect(rafSpy).toHaveBeenCalledTimes(1);

    pendingCallback(0);
    window.dispatchEvent(new Event('scroll'));
    expect(rafSpy).toHaveBeenCalledTimes(2);
  });
});
