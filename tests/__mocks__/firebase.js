import { vi } from 'vitest';

export const auth = { currentUser: null };

export const authApi = {
  onChange: vi.fn(),
  signIn: vi.fn(),
  signUp: vi.fn(),
  guest: vi.fn(),
  signOut: vi.fn(),
  linkGuest: vi.fn(),
  sendResetEmail: vi.fn(),
  sendVerificationEmail: vi.fn(),
  setPersistence: vi.fn(),
  deleteAccount: vi.fn(),
};

export const dbApi = {
  listenRoadmap: vi.fn(() => () => {}),
  saveRoadmap: vi.fn(() => Promise.resolve()),
  getMeta: vi.fn(() => Promise.resolve(null)),
  saveMeta: vi.fn(() => Promise.resolve()),
  getRoadmap: vi.fn(() => Promise.resolve(null)),
};

export const firebaseClock = vi.fn(() => Date.now());

export function authErrorMessage(e) {
  return e?.message || 'error';
}
