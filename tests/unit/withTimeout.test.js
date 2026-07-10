import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { withTimeout } from '../../src/services/storage/withTimeout.js';

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

describe('withTimeout', () => {
  it('resolves with the original value when the promise settles before the timeout', async () => {
    const promise = withTimeout(Promise.resolve('ok'), 1000, 'timed out');
    await expect(promise).resolves.toBe('ok');
  });

  it('rejects with the original error when the promise rejects before the timeout', async () => {
    const promise = withTimeout(Promise.reject(new Error('boom')), 1000, 'timed out');
    await expect(promise).rejects.toThrow('boom');
  });

  it('rejects with the timeout message once the deadline passes without the promise settling', async () => {
    const never = new Promise(() => {});
    const promise = withTimeout(never, 1000, 'timed out');
    const assertion = expect(promise).rejects.toThrow('timed out');
    await vi.advanceTimersByTimeAsync(1000);
    await assertion;
  });

  it('does not leave a dangling timer once the promise settles first', async () => {
    const clearSpy = vi.spyOn(global, 'clearTimeout');
    await withTimeout(Promise.resolve('ok'), 1000, 'timed out');
    expect(clearSpy).toHaveBeenCalled();
  });
});
