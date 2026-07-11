import { el } from '../dom.js';
import { navigate } from '../router.js';
import { createBrandMark } from './brand.js';
import { createAvatar } from './avatar.js';
import { createDropdown } from './dropdown.js';
import { createIcon } from './icons.js';
import { confirmAndSignOut } from '../utils/signOut.js';
import { KEYS } from '../../services/localStorageKeys.js';
import { exportBackupJson, exportBackupCsv, importBackupFromFile } from '../utils/backupActions.js';

// Issue #6 Phase 2.1. Nav list was originally just Dashboard + My Roadmaps —
// the original spec also listed Resources/Settings, but neither page existed
// yet at the time. Settings shipped in issue #16; Resources still doesn't
// exist and stays out until it's real. The storage-backend indicator from the
// original spec was struck too (#5 closed as not planned — Firebase is the
// only backend). Icons moved off plain Unicode glyphs onto the shared
// createIcon() set in issue #107 — this specifically fixes the Settings gear
// (⚙) rendering undersized, since .nav-item-icon never set an explicit
// font-size and the glyph silently inherited .nav-item's body-text size.
const NAV_ITEMS = [
  { route: '/app', label: 'Dashboard', icon: 'dashboard' },
  { route: '/progress', label: 'Progress', icon: 'progress' },
  { route: '/onboarding', label: 'My Roadmaps', icon: 'roadmaps' },
  { route: '/settings', label: 'Settings', icon: 'settings' }
];

function readCollapsed() {
  return localStorage.getItem(KEYS.SIDEBAR_COLLAPSED) === '1';
}

// Extracted out of createSidebar() (issue #18) — builds the account
// dropdown's item list and the hidden file input "Import backup…" clicks to
// open a picker. Backup export/import is available to every signed-in
// identity, including an anonymous guest session — local-only progress is
// exactly the data most at risk of being lost, so it isn't gated behind
// `!user.isAnonymous` the way "Delete account" is.
function buildAccountMenu({ user, store, identityTrigger, onDeleteAccount }) {
  const importInput = el('input', {
    type: 'file',
    accept: '.json,application/json',
    hidden: true,
    onChange: () => {
      const file = importInput.files?.[0];
      importInput.value = '';
      if (file) importBackupFromFile(store, file);
    }
  });

  const dropdownItems = [
    { text: 'Settings', onClick: () => navigate('/settings') },
    { text: 'Download backup (JSON)', onClick: () => exportBackupJson(store) },
    { text: 'Export CSV', onClick: () => exportBackupCsv(store) },
    { text: 'Import backup…', onClick: () => importInput.click() }
  ];
  if (!user.isAnonymous && onDeleteAccount) {
    dropdownItems.push({ text: 'Delete account', danger: true, onClick: onDeleteAccount });
  }

  const identity = createDropdown(identityTrigger, dropdownItems, { align: 'start' });
  return { identity, importInput };
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
      el('span', { className: 'nav-item-icon' }, [createIcon(item.icon, { size: 'sm' })]),
      el('span', { className: 'nav-item-label', text: item.label })
    ]))
  );

  const collapseBtn = el('button', {
    type: 'button',
    className: 'app-sidebar-collapse-btn',
    'aria-label': 'Collapse sidebar'
  }, [createIcon('collapse', { size: 'sm' })]);

  const userLabel = user.isAnonymous ? 'Guest session' : (user.email || 'Signed in');
  const identityTrigger = el('button', {
    type: 'button',
    className: 'app-sidebar-identity',
    'aria-label': `Account menu — ${userLabel}`
  }, [
    createAvatar(user, 'sm'),
    el('span', { className: 'app-sidebar-user-email', text: userLabel })
  ]);

  const { identity, importInput } = buildAccountMenu({ user, store, identityTrigger, onDeleteAccount });

  const footer = el('div', { className: 'app-sidebar-footer' }, [
    identity,
    importInput,
    el('button', {
      type: 'button',
      className: 'btn btn-ghost btn-icon app-sidebar-signout',
      'aria-label': 'Sign out',
      onClick: () => confirmAndSignOut(user, store)
    }, [createIcon('signOut', { size: 'sm' })])
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
