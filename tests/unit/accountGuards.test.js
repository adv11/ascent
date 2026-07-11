import { describe, it, expect } from 'vitest';
import { assertAccountDeletable, assertHasPasswordCredential } from '../../src/services/accountGuards.js';

// Pure unit test of issue #53's deleteAccount() anonymous guard. Deliberately
// does not import src/services/firebase.js — that module pulls in the real
// Firebase SDK and a gitignored firebase.config.js that doesn't exist in CI,
// same reasoning as firebaseSignOutCleanup.test.js.
describe('assertAccountDeletable — anonymous guard (issue #53)', () => {
  it('throws for an anonymous user', () => {
    expect(() => assertAccountDeletable({ uid: 'guest-1', isAnonymous: true }))
      .toThrow(/guest/i);
  });

  it('does not throw for a non-anonymous user', () => {
    expect(() => assertAccountDeletable({ uid: 'real-1', isAnonymous: false, email: 'a@b.com' }))
      .not.toThrow();
  });

  it('does not throw when there is no current user (defensive)', () => {
    expect(() => assertAccountDeletable(null)).not.toThrow();
  });
});

// Issue #16 — updateEmail()/updatePassword() share the same anonymous-guest
// defense-in-depth guard as deleteAccount() above, just with its own message.
describe('assertHasPasswordCredential — anonymous guard (issue #16)', () => {
  it('throws for an anonymous user', () => {
    expect(() => assertHasPasswordCredential({ uid: 'guest-1', isAnonymous: true }))
      .toThrow(/guest/i);
  });

  it('does not throw for a non-anonymous user', () => {
    expect(() => assertHasPasswordCredential({ uid: 'real-1', isAnonymous: false, email: 'a@b.com' }))
      .not.toThrow();
  });

  it('does not throw when there is no current user (defensive)', () => {
    expect(() => assertHasPasswordCredential(null)).not.toThrow();
  });
});
