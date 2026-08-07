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
//
// Issue #496 (C4) — `mode`/`onModeChange` add an optional segmented
// Sign in/Sign up switch to the card header, so a user who landed on the
// wrong screen doesn't have to navigate away and back. Both are optional:
// a caller that omits them (none currently do, but this keeps the shell
// reusable for a future non-mode-switching auth-adjacent screen) simply
// gets no switch rendered. The switch is returned as `modeSwitchEl` so the
// reset-password step can hide it — that step isn't a sign-in/sign-up
// choice, it's a third state layered on top of one of the two.
export function authShell({ title, subtitle, children, footer, footnote, mode, onModeChange }) {
  const toggleBtn = createThemeToggle();
  const titleEl = el('h1', { className: 'auth-title', text: title });
  const subtitleEl = el('p', { className: 'auth-subtitle', text: subtitle });
  const modeSwitchEl = mode && onModeChange
    ? el('div', { className: 'seg auth-mode-switch', role: 'tablist', 'aria-label': 'Sign in or sign up' }, [
      el('button', {
        type: 'button', className: 'seg-item', text: 'Sign in',
        role: 'tab', 'aria-selected': mode === 'signin' ? 'true' : 'false',
        onClick: () => onModeChange('signin')
      }),
      el('button', {
        type: 'button', className: 'seg-item', text: 'Sign up',
        role: 'tab', 'aria-selected': mode === 'signup' ? 'true' : 'false',
        onClick: () => onModeChange('signup')
      })
    ])
    : null;
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
          el('header', { className: 'auth-card-head' }, [modeSwitchEl, titleEl, subtitleEl].filter(Boolean)),
          el('div', { className: 'auth-card-body' }, children),
          footer ? el('footer', { className: 'auth-card-foot' }, footer) : null
        ].filter(Boolean)),
        el('p', { className: 'auth-footnote', text: footnote })
      ])
    ])
  ]);
  return { node, cleanup: toggleBtn._cleanup, titleEl, subtitleEl, modeSwitchEl };
}
