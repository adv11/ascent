import { describe, it, expect, beforeEach } from 'vitest';
import { KEYS } from '../../src/services/localStorageKeys.js';
import { readDefaultFilterPreference } from '../../src/ui/utils/defaultFilterPreference.js';

beforeEach(() => {
  localStorage.clear();
});

describe('readDefaultFilterPreference (issue #16)', () => {
  it('defaults to ALL when never set', () => {
    expect(readDefaultFilterPreference()).toBe('ALL');
  });

  it('reads whatever settings.js last persisted', () => {
    localStorage.setItem(KEYS.DEFAULT_FILTER, 'P2');
    expect(readDefaultFilterPreference()).toBe('P2');
  });
});
