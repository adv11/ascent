import { describe, it, expect, vi, beforeEach } from 'vitest';

// router.js keeps module-level state (the routes Map, the current cleanup,
// and any still-attached hashchange listener from a previous startRouter()
// call) — reset the module registry and re-import fresh in every test so
// tests can't leak registered routes or listeners into each other.
async function freshRouter() {
  vi.resetModules();
  return import('../../src/ui/router.js');
}

beforeEach(() => {
  window.location.hash = '';
});

describe('router', () => {
  it('registerRoute + startRouter dispatches the current route on initial call', async () => {
    const { registerRoute, startRouter } = await freshRouter();
    const renderFn = vi.fn();
    registerRoute('/one', renderFn);
    window.location.hash = '#/one';
    const stop = await startRouter('/one');
    expect(renderFn).toHaveBeenCalledWith('/one');
    stop();
  });

  it('falls back to the fallback render function when the current hash has no registered route', async () => {
    const { registerRoute, startRouter } = await freshRouter();
    const fallbackFn = vi.fn();
    registerRoute('/known-fallback', fallbackFn);
    window.location.hash = '#/nowhere';
    const stop = await startRouter('/known-fallback');
    // The fallback render function runs, but is called with the actual
    // (unregistered) route it's substituting for, not the fallback path.
    expect(fallbackFn).toHaveBeenCalledWith('/nowhere');
    stop();
  });

  it('navigate updates the hash so a subsequent getRoute reflects it', async () => {
    const { navigate, getRoute } = await freshRouter();
    navigate('/somewhere');
    expect(getRoute()).toBe('/somewhere');
  });

  it('navigate is safe to call twice in a row with different paths', async () => {
    const { navigate, getRoute } = await freshRouter();
    navigate('/first');
    expect(getRoute()).toBe('/first');
    navigate('/second');
    expect(getRoute()).toBe('/second');
  });

  it('navigate is a no-op-safe when called twice with the same route', async () => {
    const { navigate, getRoute } = await freshRouter();
    navigate('/repeat');
    expect(getRoute()).toBe('/repeat');
    navigate('/repeat');
    expect(getRoute()).toBe('/repeat');
  });

  it('re-runs the render function on hashchange after startRouter is called', async () => {
    const { registerRoute, startRouter } = await freshRouter();
    const renderA = vi.fn();
    const renderB = vi.fn();
    registerRoute('/a', renderA);
    registerRoute('/b', renderB);
    window.location.hash = '#/a';
    const stop = await startRouter('/a');
    expect(renderA).toHaveBeenCalledTimes(1);

    window.location.hash = '#/b';
    window.dispatchEvent(new HashChangeEvent('hashchange'));
    await vi.waitFor(() => expect(renderB).toHaveBeenCalledTimes(1));
    stop();
  });

  it('calls the previous route render function\'s cleanup before running the next route', async () => {
    const { registerRoute, startRouter } = await freshRouter();
    const cleanupA = vi.fn();
    registerRoute('/with-cleanup', () => cleanupA);
    registerRoute('/plain', vi.fn());
    window.location.hash = '#/with-cleanup';
    const stop = await startRouter('/with-cleanup');
    expect(cleanupA).not.toHaveBeenCalled();

    window.location.hash = '#/plain';
    window.dispatchEvent(new HashChangeEvent('hashchange'));
    await vi.waitFor(() => expect(cleanupA).toHaveBeenCalledTimes(1));
    stop();
  });

  it('the returned stop function removes the hashchange listener', async () => {
    const { registerRoute, startRouter } = await freshRouter();
    const renderFn = vi.fn();
    registerRoute('/teardown', renderFn);
    window.location.hash = '#/teardown';
    const stop = await startRouter('/teardown');
    expect(renderFn).toHaveBeenCalledTimes(1);

    stop();
    window.location.hash = '#/teardown-again';
    window.dispatchEvent(new HashChangeEvent('hashchange'));
    await new Promise(resolve => setTimeout(resolve, 0));
    expect(renderFn).toHaveBeenCalledTimes(1);
  });

  it('getRoute defaults to "/" when there is no hash', async () => {
    const { getRoute } = await freshRouter();
    window.location.hash = '';
    expect(getRoute()).toBe('/');
  });

  it('a route registered with a trailing "*" matches any query-string suffix (issue #131)', async () => {
    const { registerRoute, startRouter } = await freshRouter();
    const renderFn = vi.fn();
    registerRoute('/shared*', renderFn);
    window.location.hash = '#/shared?id=abc123';
    const stop = await startRouter('/signin');
    expect(renderFn).toHaveBeenCalledWith('/shared?id=abc123');
    stop();
  });

  it('an exact route match still wins over a wildcard pattern', async () => {
    const { registerRoute, startRouter } = await freshRouter();
    const exactFn = vi.fn();
    const wildcardFn = vi.fn();
    registerRoute('/shared', exactFn);
    registerRoute('/shared*', wildcardFn);
    window.location.hash = '#/shared';
    const stop = await startRouter('/signin');
    expect(exactFn).toHaveBeenCalledTimes(1);
    expect(wildcardFn).not.toHaveBeenCalled();
    stop();
  });
});
