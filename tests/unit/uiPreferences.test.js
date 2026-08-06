import { describe, it, expect, beforeEach, vi } from 'vitest';

beforeEach(async () => {
  vi.resetModules();
  localStorage.clear();
  delete document.documentElement.dataset.textSize;
  document.documentElement.removeAttribute('data-animations-off');
});

async function freshPrefs() {
  return import('../../src/services/uiPreferences.js');
}

describe('uiPreferences.js — text size (issue #495)', () => {
  it('defaults to "default" when nothing is stored', async () => {
    const { getTextSize } = await freshPrefs();
    expect(getTextSize()).toBe('default');
  });

  it('setTextSize persists to localStorage and sets the DOM attribute', async () => {
    const { setTextSize, getTextSize } = await freshPrefs();
    setTextSize('largest');
    expect(getTextSize()).toBe('largest');
    expect(document.documentElement.dataset.textSize).toBe('largest');
    expect(localStorage.getItem('ascent-text-size')).toBe('largest');
  });

  it('falls back to "default" for an invalid stored value', async () => {
    localStorage.setItem('ascent-text-size', 'huge');
    const { getTextSize } = await freshPrefs();
    expect(getTextSize()).toBe('default');
  });

  it('onTextSizeChange notifies subscribers and can unsubscribe', async () => {
    const { setTextSize, onTextSizeChange } = await freshPrefs();
    const callback = vi.fn();
    const unsubscribe = onTextSizeChange(callback);
    setTextSize('large');
    expect(callback).toHaveBeenCalledWith('large');
    unsubscribe();
    setTextSize('default');
    expect(callback).toHaveBeenCalledTimes(1);
  });
});

describe('uiPreferences.js — animations off (issue #495)', () => {
  it('defaults to false when nothing is stored', async () => {
    const { getAnimationsOff } = await freshPrefs();
    expect(getAnimationsOff()).toBe(false);
  });

  it('setAnimationsOff(true) persists and sets the DOM attribute', async () => {
    const { setAnimationsOff, getAnimationsOff } = await freshPrefs();
    setAnimationsOff(true);
    expect(getAnimationsOff()).toBe(true);
    expect(document.documentElement.hasAttribute('data-animations-off')).toBe(true);
    expect(localStorage.getItem('ascent-animations-off')).toBe('true');
  });

  it('setAnimationsOff(false) clears the stored key and attribute', async () => {
    const { setAnimationsOff, getAnimationsOff } = await freshPrefs();
    setAnimationsOff(true);
    setAnimationsOff(false);
    expect(getAnimationsOff()).toBe(false);
    expect(document.documentElement.hasAttribute('data-animations-off')).toBe(false);
    expect(localStorage.getItem('ascent-animations-off')).toBeNull();
  });
});
