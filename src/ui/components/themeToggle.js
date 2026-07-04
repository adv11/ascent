import { el } from '../dom.js';
import { toggleTheme, getTheme, onThemeChange } from '../../services/theme.js';

const ICONS = { dark: '☀', light: '☾' };

function ariaLabel(theme) {
  return theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode';
}

export function createThemeToggle() {
  const btn = el('button', {
    type: 'button',
    className: 'btn btn-ghost btn-icon theme-toggle',
    'aria-label': ariaLabel(getTheme()),
    text: ICONS[getTheme()] || ICONS.light,
    onClick: toggleTheme
  });
  const unsubscribe = onThemeChange(theme => {
    btn.textContent = ICONS[theme] || ICONS.light;
    btn.setAttribute('aria-label', ariaLabel(theme));
  });
  btn._cleanup = unsubscribe;
  return btn;
}
