import { describe, it, expect, vi, beforeEach } from 'vitest';
import { KEYS } from '../../src/services/localStorageKeys.js';

beforeEach(() => {
  vi.resetModules();
  localStorage.clear();
});

function fireBeforeInstallPrompt(userChoice = { outcome: 'accepted' }) {
  const event = new Event('beforeinstallprompt', { cancelable: true });
  event.prompt = vi.fn();
  event.userChoice = Promise.resolve(userChoice);
  window.dispatchEvent(event);
  return event;
}

describe('pwaInstall', () => {
  it('is not installable until beforeinstallprompt fires', async () => {
    const { isInstallable } = await import('../../src/services/pwaInstall.js');
    expect(isInstallable()).toBe(false);
  });

  it('becomes installable after beforeinstallprompt fires and notifies listeners', async () => {
    const { isInstallable, onInstallabilityChange } = await import('../../src/services/pwaInstall.js');
    const listener = vi.fn();
    onInstallabilityChange(listener);
    fireBeforeInstallPrompt();
    expect(isInstallable()).toBe(true);
    expect(listener).toHaveBeenCalledWith(true);
  });

  it('promptInstall triggers the native prompt and persists dismissal on acceptance', async () => {
    const { promptInstall } = await import('../../src/services/pwaInstall.js');
    const event = fireBeforeInstallPrompt({ outcome: 'accepted' });
    const outcome = await promptInstall();
    expect(event.prompt).toHaveBeenCalled();
    expect(outcome).toBe('accepted');
    expect(localStorage.getItem(KEYS.PWA_INSTALL_DISMISSED)).toBe('true');
  });

  it('dismissInstallPrompt persists the dismissed flag without a prompt event', async () => {
    const { dismissInstallPrompt } = await import('../../src/services/pwaInstall.js');
    dismissInstallPrompt();
    expect(localStorage.getItem(KEYS.PWA_INSTALL_DISMISSED)).toBe('true');
  });

  it('isInstallable stays false once dismissed, even with a captured prompt event', async () => {
    const { isInstallable, dismissInstallPrompt } = await import('../../src/services/pwaInstall.js');
    fireBeforeInstallPrompt();
    dismissInstallPrompt();
    expect(isInstallable()).toBe(false);
  });
});
