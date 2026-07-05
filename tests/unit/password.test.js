import { describe, it, expect, beforeEach } from 'vitest';
import { scorePassword, makePasswordToggle } from '../../src/ui/utils/password.js';

describe('scorePassword', () => {
  it('returns 0 for empty string', () => {
    expect(scorePassword('')).toBe(0);
  });

  it('returns 0 for string shorter than 6 chars', () => {
    expect(scorePassword('abc')).toBe(0);
    expect(scorePassword('12345')).toBe(0);
  });

  it('returns 4 for a strong password with all character classes and 12+ chars', () => {
    expect(scorePassword('abc123ABCdef!')).toBe(4);
  });

  it('returns 1 for a 6-char lowercase-only password', () => {
    expect(scorePassword('abcdef')).toBe(1);
  });

  it('increases score with length >= 8', () => {
    const short = scorePassword('abcdef');
    const longer = scorePassword('abcdefgh');
    expect(longer).toBeGreaterThan(short);
  });

  it('increases score with mixed case', () => {
    const lower = scorePassword('abcdefgh');
    const mixed = scorePassword('Abcdefgh');
    expect(mixed).toBeGreaterThan(lower);
  });

  it('increases score with digits', () => {
    const base = scorePassword('Abcdefgh');
    const withDigit = scorePassword('Abcdefg1');
    expect(withDigit).toBeGreaterThan(base);
  });

  it('returns at most 4', () => {
    expect(scorePassword('Abcdef1!XXXXXXXXXXXX')).toBeLessThanOrEqual(4);
  });
});

describe('makePasswordToggle', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
  });

  it('initial aria-label is "Show password"', () => {
    const input = document.createElement('input');
    input.type = 'password';
    const btn = makePasswordToggle(input);
    expect(btn.getAttribute('aria-label')).toBe('Show password');
  });

  it('initial button text is "Show"', () => {
    const input = document.createElement('input');
    input.type = 'password';
    const btn = makePasswordToggle(input);
    expect(btn.textContent).toBe('Show');
  });

  it('clicking changes input type to text', () => {
    const input = document.createElement('input');
    input.type = 'password';
    const btn = makePasswordToggle(input);
    btn.click();
    expect(input.type).toBe('text');
  });

  it('clicking updates aria-label to "Hide password"', () => {
    const input = document.createElement('input');
    input.type = 'password';
    const btn = makePasswordToggle(input);
    btn.click();
    expect(btn.getAttribute('aria-label')).toBe('Hide password');
  });

  it('clicking again restores type to password', () => {
    const input = document.createElement('input');
    input.type = 'password';
    const btn = makePasswordToggle(input);
    btn.click();
    btn.click();
    expect(input.type).toBe('password');
    expect(btn.getAttribute('aria-label')).toBe('Show password');
  });
});
