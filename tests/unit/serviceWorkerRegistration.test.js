import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { registerServiceWorker } from '../../src/services/serviceWorkerRegistration.js';

function mockNavigatorServiceWorker({ controller = null } = {}) {
  const listeners = {};
  const register = vi.fn().mockResolvedValue(undefined);
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
});
