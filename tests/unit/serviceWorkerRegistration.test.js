import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { registerServiceWorker } from '../../src/services/serviceWorkerRegistration.js';

function mockNavigatorServiceWorker({ controller = null, registration } = {}) {
  const listeners = {};
  const register = vi.fn().mockResolvedValue(registration);
  Object.defineProperty(navigator, 'serviceWorker', {
    configurable: true,
    value: {
      controller,
      register,
      addEventListener: (type, handler) => {
        listeners[type] = handler;
      }
    }
  });
  return { register, fire: (type) => listeners[type] && listeners[type]() };
}

// jsdom's `window`/`document` persist across tests in this file, so
// dispatching real 'load'/'focus'/'visibilitychange' events would also
// invoke listeners left over from a prior test's registerServiceWorker()
// call. Spying on addEventListener and capturing handlers per-test (reset
// via vi.restoreAllMocks() in afterEach) keeps each test isolated instead.
function spyOnWindowAndDocumentListeners() {
  const windowListeners = {};
  const documentListeners = {};
  vi.spyOn(window, 'addEventListener').mockImplementation((type, handler) => {
    windowListeners[type] = handler;
  });
  vi.spyOn(document, 'addEventListener').mockImplementation((type, handler) => {
    documentListeners[type] = handler;
  });
  return {
    fireLoad: () => windowListeners.load?.(),
    fireFocus: () => windowListeners.focus?.(),
    fireVisibilityChange: () => documentListeners.visibilitychange?.()
  };
}

describe('registerServiceWorker', () => {
  const originalReload = window.location.reload;
  let reload;

  beforeEach(() => {
    reload = vi.fn();
    Object.defineProperty(window, 'location', {
      configurable: true,
      value: { ...window.location, reload }
    });
  });

  afterEach(() => {
    Object.defineProperty(window, 'location', { configurable: true, value: { ...window.location, reload: originalReload } });
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  it('does not reload on first-ever controllerchange (no prior controller)', () => {
    const sw = mockNavigatorServiceWorker({ controller: null });
    registerServiceWorker();
    sw.fire('controllerchange');
    expect(reload).not.toHaveBeenCalled();
  });

  it('reloads exactly once when a new worker takes over an already-controlled tab', () => {
    const sw = mockNavigatorServiceWorker({ controller: {} });
    registerServiceWorker();
    sw.fire('controllerchange');
    sw.fire('controllerchange');
    expect(reload).toHaveBeenCalledTimes(1);
  });

  it('no-ops when serviceWorker API is unavailable', () => {
    delete navigator.serviceWorker;
    expect(() => registerServiceWorker()).not.toThrow();
  });

  it('checks for an update on a recurring interval, with no navigation required', async () => {
    vi.useFakeTimers();
    const { fireLoad } = spyOnWindowAndDocumentListeners();
    const update = vi.fn().mockResolvedValue(undefined);
    mockNavigatorServiceWorker({ controller: {}, registration: { update } });
    registerServiceWorker();
    fireLoad();
    await vi.advanceTimersByTimeAsync(0);

    await vi.advanceTimersByTimeAsync(60 * 60 * 1000);
    expect(update).toHaveBeenCalledTimes(1);

    await vi.advanceTimersByTimeAsync(60 * 60 * 1000);
    expect(update).toHaveBeenCalledTimes(2);
  });

  it('checks for an update when the tab regains visibility', async () => {
    const { fireLoad, fireVisibilityChange } = spyOnWindowAndDocumentListeners();
    const update = vi.fn().mockResolvedValue(undefined);
    mockNavigatorServiceWorker({ controller: {}, registration: { update } });
    registerServiceWorker();
    fireLoad();
    await Promise.resolve();
    await Promise.resolve();

    Object.defineProperty(document, 'visibilityState', { configurable: true, value: 'visible' });
    fireVisibilityChange();
    await Promise.resolve();
    expect(update).toHaveBeenCalledTimes(1);
  });

  it('does not check for an update when the tab becomes hidden', async () => {
    const { fireLoad, fireVisibilityChange } = spyOnWindowAndDocumentListeners();
    const update = vi.fn().mockResolvedValue(undefined);
    mockNavigatorServiceWorker({ controller: {}, registration: { update } });
    registerServiceWorker();
    fireLoad();
    await Promise.resolve();
    await Promise.resolve();

    Object.defineProperty(document, 'visibilityState', { configurable: true, value: 'hidden' });
    fireVisibilityChange();
    await Promise.resolve();
    expect(update).not.toHaveBeenCalled();
  });

  it('checks for an update when the window regains focus', async () => {
    const { fireLoad, fireFocus } = spyOnWindowAndDocumentListeners();
    const update = vi.fn().mockResolvedValue(undefined);
    mockNavigatorServiceWorker({ controller: {}, registration: { update } });
    registerServiceWorker();
    fireLoad();
    await Promise.resolve();
    await Promise.resolve();

    fireFocus();
    await Promise.resolve();
    expect(update).toHaveBeenCalledTimes(1);
  });

  it('swallows a rejected update() rather than throwing unhandled', async () => {
    const { fireLoad, fireFocus } = spyOnWindowAndDocumentListeners();
    const update = vi.fn().mockRejectedValue(new Error('offline'));
    mockNavigatorServiceWorker({ controller: {}, registration: { update } });
    expect(() => {
      registerServiceWorker();
      fireLoad();
    }).not.toThrow();
    await Promise.resolve();
    await Promise.resolve();
    fireFocus();
    await Promise.resolve();
    expect(update).toHaveBeenCalled();
  });
});
