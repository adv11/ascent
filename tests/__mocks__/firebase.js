import { vi } from 'vitest';

export const authApi = {
  onChange: vi.fn(),
  signIn: vi.fn(),
  signUp: vi.fn(),
  guest: vi.fn(),
  signOut: vi.fn(),
  linkGuest: vi.fn(),
  sendResetEmail: vi.fn(),
};

export const dbApi = {
  listenRoadmap: vi.fn(() => () => {}),
  saveRoadmap: vi.fn(() => Promise.resolve()),
};

export const firebaseClock = vi.fn(() => Date.now());

export function authErrorMessage(e) {
  return e?.message || 'error';
}
