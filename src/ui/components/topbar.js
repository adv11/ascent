import { el } from '../dom.js';
import { createIcon } from './icons.js';
import { navigate } from '../router.js';
import { openCommandPalette, bindCommandPaletteShortcut } from './commandPalette.js';

// Issue #125 — the app-wide navigation items the command palette searches.
// Kept to page navigation only: the palette's original spec (searching live
// roadmap items/sections/phases) is real feature work for its own follow-up
// issue, out of scope here.
function navigationItems() {
  return [
    { id: 'nav-app', title: 'Dashboard', subtitle: 'Your active roadmap', onSelect: () => navigate('/app') },
    { id: 'nav-onboarding', title: 'All roadmaps', subtitle: 'Switch or start a roadmap', onSelect: () => navigate('/onboarding') },
    { id: 'nav-progress', title: 'Progress', subtitle: 'Streaks, heatmap, and stats', onSelect: () => navigate('/progress') },
    { id: 'nav-settings', title: 'Settings', subtitle: 'Account and preferences', onSelect: () => navigate('/settings') }
  ];
}

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

  function openPalette() {
    openCommandPalette(navigationItems(), { placeholder: 'Search pages…' });
  }

  const commandPaletteBtn = el('button', {
    type: 'button',
    className: 'app-topbar-command-btn',
    'aria-label': 'Search (Ctrl+K)',
    onClick: openPalette
  }, [createIcon('search', { size: 'sm' })]);

  const actions = el('div', { className: 'app-topbar-actions' }, [
    dailyTodoNavBadge,
    syncPill,
    user.isAnonymous ? el('a', { href: '#/signup', className: 'btn btn-secondary btn-sm', text: 'Create account' }) : null,
    commandPaletteBtn,
    notificationBell,
    themeToggleBtn
  ].filter(Boolean));

  const node = el('header', { className: 'app-topbar' }, [
    hamburger,
    breadcrumbEl,
    actions
  ]);

  node._cleanup = bindCommandPaletteShortcut(openPalette);
  return node;
}
