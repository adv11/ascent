import { el } from '../dom.js';
import { createThemeToggle } from './themeToggle.js';
import { createBrandMark } from './brand.js';
import { createAuthMarketingPanel } from './authMarketingPanel.js';

// Issue #6 Phase 5.1 — `.auth-page` is now a two-column split (marketing
// panel + this card) above the existing ≤1024px breakpoint tier, single-
// column below it. The card itself — `.auth-page-bg`/`.auth-page-inner`/
// `.auth-top-row`/`.auth-card-lg`/`.auth-footnote` — is untouched from
// before this phase; only the wrapping structure around it changed, so the
// mobile view is exactly today's existing layout, not a second one to
// maintain (see `.claude/rules/ui-styling.md`).
export function authShell({ title, subtitle, children, footer, footnote }) {
  const toggleBtn = createThemeToggle();
  const titleEl = el('h1', { className: 'auth-title', text: title });
  const subtitleEl = el('p', { className: 'auth-subtitle', text: subtitle });
  const node = el('div', { className: 'auth-page fade-in' }, [
    createAuthMarketingPanel(),
    el('div', { className: 'auth-page-right' }, [
      el('div', { className: 'auth-page-bg' }),
      el('div', { className: 'auth-page-inner' }, [
        el('div', { className: 'auth-top-row' }, [
          el('a', { className: 'brand auth-brand', href: '#/signin' }, createBrandMark()),
          toggleBtn
        ]),
        el('div', { className: 'auth-card-lg' }, [
          el('header', { className: 'auth-card-head' }, [titleEl, subtitleEl]),
          el('div', { className: 'auth-card-body' }, children),
          footer ? el('footer', { className: 'auth-card-foot' }, footer) : null
        ].filter(Boolean)),
        el('p', { className: 'auth-footnote', text: footnote })
      ])
    ])
  ]);
  return { node, cleanup: toggleBtn._cleanup, titleEl, subtitleEl };
}
