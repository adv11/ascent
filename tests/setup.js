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
