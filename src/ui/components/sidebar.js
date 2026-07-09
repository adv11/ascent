import { el } from '../dom.js';
import { navigate } from '../router.js';
import { createBrandMark } from './brand.js';
import { createAvatar } from './avatar.js';
import { createDropdown } from './dropdown.js';
import { authApi } from '../../services/firebase.js';
import { confirmDialog } from './confirmDialog.js';
import { KEYS } from '../../services/localStorageKeys.js';

// Issue #6 Phase 2.1. Nav list is deliberately just Dashboard + My Roadmaps —
// the original spec also listed Resources/Settings, but neither page exists
// yet (confirmed against main.js's route table) and no issue currently scopes
// building them, so they're left out until they're real. The storage-backend
// indicator from the original spec was struck too (#5 closed as not planned —
// Firebase is the only backend).
const NAV_ITEMS = [
  { route: '/app', label: 'Dashboard', icon: '⌂' },
  { route: '/onboarding', label: 'My Roadmaps', icon: '📋' }
];

function readCollapsed() {
  return localStorage.getItem(KEYS.SIDEBAR_COLLAPSED) === '1';
}

async function handleSignOut(user, store) {
  if (user.isAnonymous && store.getSnapshot().dirty) {
    if (!await confirmDialog({
      title: 'Sign out anyway?',
      message: 'You have unsaved changes. Guest session data is only stored on this device and will be cleared on sign-out.',
      confirmText: 'Sign out',
      danger: true
    })) return;
  }
  await authApi.signOut();
  navigate('/signin', true);
}

// Returns the sidebar node with a `_toggleMobile()` method the topbar's
// hamburger button calls to open/close the mobile drawer. `onDeleteAccount`
// is optional — omitted (or a no-op) for anonymous users, since there's
// nothing to delete but the guest session itself (handled by sign-out).
export function createSidebar({ activeRoute, user, store, onDeleteAccount }) {
  const navEl = el('nav', { className: 'app-sidebar-nav', 'aria-label': 'Primary' },
    NAV_ITEMS.map(item => el('a', {
      href: `#${item.route}`,
      className: `nav-item${activeRoute === item.route ? ' active' : ''}`,
      'aria-current': activeRoute === item.route ? 'page' : null
    }, [
      el('span', { className: 'nav-item-icon', 'aria-hidden': 'true', text: item.icon }),
      el('span', { className: 'nav-item-label', text: item.label })
    ]))
  );

  const collapseBtn = el('button', {
    type: 'button',
    className: 'app-sidebar-collapse-btn',
    'aria-label': 'Collapse sidebar',
    text: '«'
  });

  const userLabel = user.isAnonymous ? 'Guest session' : (user.email || 'Signed in');
  const identityTrigger = el('button', {
    type: 'button',
    className: 'app-sidebar-identity',
    'aria-label': `Account menu — ${userLabel}`
  }, [
    createAvatar(user, 'sm'),
    el('span', { className: 'app-sidebar-user-email', text: userLabel })
  ]);
  const identity = (!user.isAnonymous && onDeleteAccount)
    ? createDropdown(identityTrigger, [
      { text: 'Delete account', danger: true, onClick: onDeleteAccount }
    ], { align: 'start' })
    : identityTrigger;

  const footer = el('div', { className: 'app-sidebar-footer' }, [
    identity,
    el('button', {
      type: 'button',
      className: 'btn btn-ghost btn-icon app-sidebar-signout',
      'aria-label': 'Sign out',
      text: '⏻',
      onClick: () => handleSignOut(user, store)
    })
  ]);

  const backdrop = el('div', { className: 'app-sidebar-backdrop' });

  const node = el('aside', { className: 'app-sidebar', 'aria-label': 'Sidebar' }, [
    el('a', { className: 'brand app-sidebar-brand', href: '#/onboarding', 'aria-label': 'Ascent — all roadmaps' }, createBrandMark()),
    navEl,
    el('div', { className: 'app-sidebar-spacer' }),
    collapseBtn,
    footer
  ]);

  if (readCollapsed()) node.classList.add('collapsed');

  collapseBtn.addEventListener('click', () => {
    const next = !node.classList.contains('collapsed');
    node.classList.toggle('collapsed', next);
    collapseBtn.setAttribute('aria-label', next ? 'Expand sidebar' : 'Collapse sidebar');
    localStorage.setItem(KEYS.SIDEBAR_COLLAPSED, next ? '1' : '0');
  });

  function closeMobile() {
    node.classList.remove('mobile-open');
    backdrop.classList.remove('show');
    document.body.classList.remove('scroll-locked');
  }

  function toggleMobile() {
    const opening = !node.classList.contains('mobile-open');
    node.classList.toggle('mobile-open', opening);
    backdrop.classList.toggle('show', opening);
    document.body.classList.toggle('scroll-locked', opening);
  }

  backdrop.addEventListener('click', closeMobile);
  navEl.addEventListener('click', e => {
    if (e.target.closest('a')) closeMobile();
  });

  node._toggleMobile = toggleMobile;
  node._backdrop = backdrop;
  node._cleanup = () => identity._cleanup?.();
  return node;
}
