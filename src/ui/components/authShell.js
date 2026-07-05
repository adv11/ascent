import { el } from '../dom.js';
import { createThemeToggle } from './themeToggle.js';

export function authShell({ title, subtitle, children, footer, footnote }) {
  const toggleBtn = createThemeToggle();
  const titleEl = el('h1', { className: 'auth-title', text: title });
  const subtitleEl = el('p', { className: 'auth-subtitle', text: subtitle });
  const node = el('div', { className: 'auth-page fade-in' }, [
    el('div', { className: 'auth-page-bg' }),
    el('div', { className: 'auth-page-inner' }, [
      el('div', { className: 'auth-top-row' }, [
        el('a', { className: 'brand auth-brand', href: '#/signin' }, [
          el('span', { className: 'brand-mark', text: '✓' }),
          el('span', { className: 'brand-name', text: 'SwitchPrep' })
        ]),
        toggleBtn
      ]),
      el('div', { className: 'auth-card-lg' }, [
        el('header', { className: 'auth-card-head' }, [titleEl, subtitleEl]),
        el('div', { className: 'auth-card-body' }, children),
        footer ? el('footer', { className: 'auth-card-foot' }, footer) : null
      ].filter(Boolean)),
      el('p', { className: 'auth-footnote', text: footnote })
    ])
  ]);
  return { node, cleanup: toggleBtn._cleanup, titleEl, subtitleEl };
}
