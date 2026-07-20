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
  it('registers the beforeinstallprompt listener as soon as the module is imported, independent of any route/page state (issue #261)', async () => {
    // Simulates main.js's eager, side-effect-only import at app boot — no
    // route has rendered, no page-specific module (e.g. settings.js) has
    // been touched, and nothing has called any exported function yet.
    await import('../../src/services/pwaInstall.js');
    const event = fireBeforeInstallPrompt();
    expect(event.defaultPrevented).toBe(true);

    // Only after the module import above do we ask for isInstallable() —
    // confirming the listener was live purely from the import, not from any
    // subsequent call into the module's API.
    const { isInstallable } = await import('../../src/services/pwaInstall.js');
    expect(isInstallable()).toBe(true);
  });

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

  it('promptInstall does not persist dismissal when the user declines', async () => {
    const { promptInstall } = await import('../../src/services/pwaInstall.js');
    fireBeforeInstallPrompt({ outcome: 'dismissed' });
    const outcome = await promptInstall();
    expect(outcome).toBe('dismissed');
    expect(localStorage.getItem(KEYS.PWA_INSTALL_DISMISSED)).toBeNull();
  });

  it('promptInstall returns "unavailable" and clears the stale prompt if prompt() rejects', async () => {
    const { promptInstall, isInstallable } = await import('../../src/services/pwaInstall.js');
    const event = new Event('beforeinstallprompt', { cancelable: true });
    event.prompt = vi.fn().mockRejectedValue(new DOMException('stale', 'InvalidStateError'));
    event.userChoice = Promise.resolve({ outcome: 'accepted' });
    window.dispatchEvent(event);

    const outcome = await promptInstall();
    expect(outcome).toBe('unavailable');
    expect(isInstallable()).toBe(false);
  });

  it('promptInstall clears the captured event even before it resolves, so it is never reused', async () => {
    const { promptInstall, isInstallable } = await import('../../src/services/pwaInstall.js');
    fireBeforeInstallPrompt({ outcome: 'accepted' });
    expect(isInstallable()).toBe(true);
    const pending = promptInstall();
    expect(isInstallable()).toBe(false);
    await pending;
  });
});
