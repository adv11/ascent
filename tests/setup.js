// window.matchMedia is not implemented in jsdom — mock it so theme.js can import cleanly
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: vi.fn().mockImplementation(query => ({
    matches: false,
    media: query,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  }))
});

// jsdom doesn't implement the Web Animations API (Element.animate) — stub it
// so components using it (issue #6 Phase 7's animatePhaseBody) don't throw in
// tests. The stub resolves `onfinish` on the next microtask so a test can
// `await Promise.resolve()` (or any awaited call) to observe the "after
// animation completes" state, without a real 240ms wait.
if (!Element.prototype.animate) {
  Element.prototype.animate = function stubAnimate() {
    let finishHandler = null;
    return {
      set onfinish(fn) {
        finishHandler = fn;
        queueMicrotask(() => finishHandler && finishHandler());
      },
      get onfinish() { return finishHandler; },
      cancel() {},
      finish() {}
    };
  };
}

// localStorage is present in jsdom but broken in some vitest versions — provide a reliable in-memory stub
const _store = {};
Object.defineProperty(window, 'localStorage', {
  writable: true,
  value: {
    getItem: k => _store[k] ?? null,
    setItem: (k, v) => { _store[k] = String(v); },
    removeItem: k => { delete _store[k]; },
    clear: () => { Object.keys(_store).forEach(k => delete _store[k]); },
  }
});
