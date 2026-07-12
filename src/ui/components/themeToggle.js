import { el } from '../dom.js';
import { toggleTheme, getTheme, onThemeChange } from '../../services/theme.js';
import { createIcon } from './icons.js';

// issue #136 Phase 2 follow-up — was raw '☀'/'☾' glyphs; now createIcon()
// (functional chrome), matching every other icon in the app shell.
const ICON_NAMES = { dark: 'sun', light: 'moon' };

function ariaLabel(theme) {
  return theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode';
}

export function createThemeToggle() {
  const btn = el('button', {
    type: 'button',
    className: 'btn btn-ghost btn-icon theme-toggle',
    'aria-label': ariaLabel(getTheme()),
    onClick: toggleTheme
  }, [createIcon(ICON_NAMES[getTheme()] || ICON_NAMES.light, { size: 'sm' })]);
  const unsubscribe = onThemeChange(theme => {
    btn.replaceChildren(createIcon(ICON_NAMES[theme] || ICON_NAMES.light, { size: 'sm' }));
    btn.setAttribute('aria-label', ariaLabel(theme));
  });
  btn._cleanup = unsubscribe;
  return btn;
}
