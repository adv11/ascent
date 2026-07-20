import { describe, it, expect } from 'vitest';
import { initialsFor, createAvatar } from '../../src/ui/components/avatar.js';

describe('initialsFor', () => {
  it('returns "G" for an anonymous (guest) user', () => {
    expect(initialsFor({ isAnonymous: true })).toBe('G');
  });

  it('returns "?" for a null user', () => {
    expect(initialsFor(null)).toBe('?');
  });

  it('derives two initials from a dotted/underscored email local part', () => {
    expect(initialsFor({ email: 'jane.doe@example.com' })).toBe('JD');
    expect(initialsFor({ email: 'john_smith@example.com' })).toBe('JS');
  });

  it('falls back to the first two characters when there is no separator', () => {
    expect(initialsFor({ email: 'admin@example.com' })).toBe('AD');
  });

  it('returns "?" for an empty email local part', () => {
    expect(initialsFor({ email: '@example.com' })).toBe('?');
  });

  it('prefers displayName over the email local part when set (issue #267)', () => {
    expect(initialsFor({ displayName: 'Jane Doe', email: 'admin@example.com' })).toBe('JD');
  });

  it('derives a single initial doubled when displayName has only one word', () => {
    expect(initialsFor({ displayName: 'Cher', email: 'admin@example.com' })).toBe('CH');
  });

  it('falls back to email-based logic when displayName is empty', () => {
    expect(initialsFor({ displayName: '', email: 'jane.doe@example.com' })).toBe('JD');
  });
});

describe('createAvatar', () => {
  it('renders the derived initials with the requested size class', () => {
    const node = createAvatar({ email: 'jane.doe@example.com' }, 'lg');
    expect(node.className).toBe('avatar avatar-lg');
    expect(node.textContent).toBe('JD');
  });

  it('defaults to size "md" when omitted', () => {
    const node = createAvatar({ isAnonymous: true });
    expect(node.className).toBe('avatar avatar-md');
    expect(node.textContent).toBe('G');
  });

  it('is aria-hidden (decorative, next to a visible text label)', () => {
    const node = createAvatar({ isAnonymous: true });
    expect(node.getAttribute('aria-hidden')).toBe('true');
  });
});
