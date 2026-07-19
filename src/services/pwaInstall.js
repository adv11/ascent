// Captures the `beforeinstallprompt` event (issue #19) so any UI (currently
// settings.js's Preferences section) can trigger the native install dialog
// on demand — the event only fires once and must be stashed, since the
// browser won't re-fire it just because a component mounted later wants it.
import { KEYS } from './localStorageKeys.js';

let deferredPrompt = null;
const listeners = new Set();

window.addEventListener('beforeinstallprompt', event => {
  event.preventDefault();
  deferredPrompt = event;
  listeners.forEach(fn => fn(true));
});

window.addEventListener('appinstalled', () => {
  deferredPrompt = null;
  localStorage.setItem(KEYS.PWA_INSTALL_DISMISSED, 'true');
  console.warn('Ascent installed as a PWA.');
  listeners.forEach(fn => fn(false));
});

export function isInstallable() {
  return deferredPrompt !== null && localStorage.getItem(KEYS.PWA_INSTALL_DISMISSED) !== 'true';
}

export function onInstallabilityChange(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

export async function promptInstall() {
  if (!deferredPrompt) return null;
  const prompt = deferredPrompt;
  // A captured beforeinstallprompt event can only be used once, and on some
  // mobile Chrome builds it silently goes stale (no dialog, no rejection) if
  // too much time has passed since it was captured. Clear it up front so a
  // second tap after a failed/stale attempt doesn't retry the same dead
  // event — the caller re-checks isInstallable()/onInstallabilityChange for
  // a fresh one instead.
  deferredPrompt = null;
  try {
    await prompt.prompt();
    const { outcome } = await prompt.userChoice;
    if (outcome === 'accepted') localStorage.setItem(KEYS.PWA_INSTALL_DISMISSED, 'true');
    return outcome;
  } catch (error) {
    console.error('PWA install prompt failed:', error);
    return 'unavailable';
  }
}

export function dismissInstallPrompt() {
  localStorage.setItem(KEYS.PWA_INSTALL_DISMISSED, 'true');
}
