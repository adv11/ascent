import { el } from '../dom.js';

// Derives 1-2 initials from an email or a guest label — there's no photo
// source anywhere in the auth stack (no Google sign-in), so this is always
// the final rendered form, never a fallback-while-loading state.
export function initialsFor(user) {
  if (!user) return '?';
  if (user.isAnonymous) return 'G';
  const email = user.email || '';
  const name = email.split('@')[0] || '';
  const parts = name.split(/[.\-_+]/).filter(Boolean);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return name.slice(0, 2).toUpperCase() || '?';
}

// size: 'sm' | 'md' | 'lg' — matches the .avatar-sm/-md/-lg classes.
export function createAvatar(user, size = 'md') {
  return el('div', {
    className: `avatar avatar-${size}`,
    text: initialsFor(user),
    'aria-hidden': 'true'
  });
}
