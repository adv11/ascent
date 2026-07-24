import { describe, it, expect, beforeEach, vi } from 'vitest';

beforeEach(async () => {
  vi.resetModules();
  localStorage.clear();
  document.documentElement.removeAttribute('data-theme');
});

async function freshTheme() {
  return import('../../src/services/theme.js');
}

describe('theme.js — getTheme/setTheme/toggleTheme', () => {
  it('falls back to the system theme when no data-theme is set', async () => {
    const { getTheme } = await freshTheme();
    expect(['light', 'dark']).toContain(getTheme());
  });

  it('setTheme persists to localStorage and updates the DOM', async () => {
    const { setTheme, getTheme } = await freshTheme();
    setTheme('dark');
    expect(getTheme()).toBe('dark');
    expect(document.documentElement.dataset.theme).toBe('dark');
    expect(localStorage.getItem('ascent-theme')).toBe('dark');
  });

  it('toggleTheme flips between light and dark', async () => {
    const { setTheme, toggleTheme, getTheme } = await freshTheme();
    setTheme('light');
    toggleTheme();
    expect(getTheme()).toBe('dark');
    toggleTheme();
    expect(getTheme()).toBe('light');
  });

  it('hasExplicitPreference reflects whether a theme has been explicitly set', async () => {
    const { setTheme, hasExplicitPreference } = await freshTheme();
    expect(hasExplicitPreference()).toBe(false);
    setTheme('dark');
    expect(hasExplicitPreference()).toBe(true);
  });
});

describe('theme.js — onThemeChange subscription', () => {
  it('calls a subscribed callback on every setTheme', async () => {
    const { setTheme, onThemeChange } = await freshTheme();
    const callback = vi.fn();
    onThemeChange(callback);
    setTheme('dark');
    setTheme('light');
    expect(callback).toHaveBeenCalledTimes(2);
    expect(callback).toHaveBeenNthCalledWith(1, 'dark');
    expect(callback).toHaveBeenNthCalledWith(2, 'light');
  });

  it('the returned unsubscribe function stops further callbacks — issue #27 regression at the store level', async () => {
    const { setTheme, onThemeChange } = await freshTheme();
    const callback = vi.fn();
    const unsubscribe = onThemeChange(callback);
    setTheme('dark');
    expect(callback).toHaveBeenCalledTimes(1);

    unsubscribe();
    setTheme('light');
    setTheme('dark');
    expect(callback).toHaveBeenCalledTimes(1);
  });

  it('unsubscribing one callback does not affect another still-subscribed callback', async () => {
    const { setTheme, onThemeChange } = await freshTheme();
    const callbackA = vi.fn();
    const callbackB = vi.fn();
    const unsubscribeA = onThemeChange(callbackA);
    onThemeChange(callbackB);

    unsubscribeA();
    setTheme('dark');

    expect(callbackA).not.toHaveBeenCalled();
    expect(callbackB).toHaveBeenCalledTimes(1);
  });

  it('calling unsubscribe twice is a harmless no-op', async () => {
    const { setTheme, onThemeChange } = await freshTheme();
    const callback = vi.fn();
    const unsubscribe = onThemeChange(callback);
    unsubscribe();
    unsubscribe();
    setTheme('dark');
    expect(callback).not.toHaveBeenCalled();
  });
});
