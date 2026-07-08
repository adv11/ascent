import { describe, it, expect, vi } from 'vitest';

// FirebaseAdapter.js imports the Firebase SDK from a CDN URL (both directly
// and via firebase.js) — the default ESM loader can't resolve that in tests,
// so both are stubbed the same way every other test file touching firebase.js
// already does. This test only cares about which singleton getStorageAdapter
// picks, not Firebase's actual behavior.
vi.mock('https://www.gstatic.com/firebasejs/10.12.5/firebase-database.js', () => ({
  ref: vi.fn(),
  onValue: vi.fn(),
  off: vi.fn(),
  set: vi.fn(),
  update: vi.fn(),
  get: vi.fn(),
  remove: vi.fn()
}));
vi.mock('../../../src/services/firebase.js', () => ({
  database: {},
  firebaseClock: vi.fn()
}));

const { getStorageAdapter } = await import('../../../src/services/storage/adapterFactory.js');
const { firebaseAdapter } = await import('../../../src/services/storage/FirebaseAdapter.js');

describe('adapterFactory — getStorageAdapter', () => {
  it('returns the Firebase adapter for a null/missing user', () => {
    expect(getStorageAdapter(null)).toBe(firebaseAdapter);
    expect(getStorageAdapter(undefined)).toBe(firebaseAdapter);
  });

  it('returns the Firebase adapter for an anonymous (guest) user', () => {
    const anonymousUser = { uid: 'guest-1', isAnonymous: true, providerData: [] };
    expect(getStorageAdapter(anonymousUser)).toBe(firebaseAdapter);
  });

  it('returns the Firebase adapter for an email/password user', () => {
    const emailUser = { uid: 'user-1', providerData: [{ providerId: 'password' }] };
    expect(getStorageAdapter(emailUser)).toBe(firebaseAdapter);
  });

  it('returns the Firebase adapter regardless of providerData contents', () => {
    const linkedUser = { uid: 'user-3', providerData: [{ providerId: 'password' }, { providerId: 'anonymous' }] };
    expect(getStorageAdapter(linkedUser)).toBe(firebaseAdapter);
  });
});
