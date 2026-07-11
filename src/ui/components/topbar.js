import { el } from '../dom.js';
import { createIcon } from './icons.js';

// Issue #6 Phase 2.2. Kept deliberately thin — identity/sign-out/delete-account
// already live in the sidebar footer (createSidebar), so this doesn't duplicate
// an avatar or dropdown. The hamburger button is CSS-hidden above the mobile
// breakpoint (app.css); `onToggleMobileSidebar` wires it to the sidebar's own
// `_toggleMobile()`.
export function createTopbar({ breadcrumb, user, syncPill, themeToggleBtn, dailyTodoNavBadge, notificationBell, onToggleMobileSidebar }) {
  const hamburger = el('button', {
    type: 'button',
    className: 'app-topbar-hamburger',
    'aria-label': 'Open navigation',
    onClick: onToggleMobileSidebar
  }, [createIcon('menu', { size: 'sm' })]);

  const breadcrumbEl = el('div', { className: 'app-topbar-breadcrumb', text: breadcrumb });

  const actions = el('div', { className: 'app-topbar-actions' }, [
    dailyTodoNavBadge,
    syncPill,
    user.isAnonymous ? el('a', { href: '#/signup', className: 'btn btn-secondary btn-sm', text: 'Create account' }) : null,
    notificationBell,
    themeToggleBtn
  ].filter(Boolean));

  return el('header', { className: 'app-topbar' }, [
    hamburger,
    breadcrumbEl,
    actions
  ]);
}
