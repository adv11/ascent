import { KEYS } from './localStorageKeys.js';

const TEXT_SIZE_KEY = KEYS.TEXT_SIZE;
const ANIMATIONS_OFF_KEY = KEYS.ANIMATIONS_OFF;
const TEXT_SIZES = ['default', 'large', 'largest'];

const textSizeSubscribers = new Set();
const animationsOffSubscribers = new Set();

export function getTextSize() {
  const stored = localStorage.getItem(TEXT_SIZE_KEY);
  return TEXT_SIZES.includes(stored) ? stored : 'default';
}

// index.html's themeBootstrap.js already applied the correct data-text-size
// attribute before first paint (mirroring theme.js's own convention below) —
// this just persists the choice and keeps every open tab in sync.
export function setTextSize(size) {
  localStorage.setItem(TEXT_SIZE_KEY, size);
  document.documentElement.dataset.textSize = size;
  textSizeSubscribers.forEach(callback => callback(size));
}

export function onTextSizeChange(callback) {
  textSizeSubscribers.add(callback);
  return () => textSizeSubscribers.delete(callback);
}

export function getAnimationsOff() {
  return localStorage.getItem(ANIMATIONS_OFF_KEY) === 'true';
}

export function setAnimationsOff(off) {
  if (off) {
    localStorage.setItem(ANIMATIONS_OFF_KEY, 'true');
  } else {
    localStorage.removeItem(ANIMATIONS_OFF_KEY);
  }
  document.documentElement.toggleAttribute('data-animations-off', off);
  animationsOffSubscribers.forEach(callback => callback(off));
}

export function onAnimationsOffChange(callback) {
  animationsOffSubscribers.add(callback);
  return () => animationsOffSubscribers.delete(callback);
}
