import { el } from '../dom.js';
import { navigate } from '../router.js';
import { createBrandMark } from './brand.js';
import { createAvatar } from './avatar.js';
import { createDropdown } from './dropdown.js';
import { createIcon } from './icons.js';
import { createThemeToggle } from './themeToggle.js';
import { attachTooltip } from './tooltip.js';
import { confirmAndSignOut } from '../utils/signOut.js';
import { KEYS } from '../../services/localStorageKeys.js';
import { exportBackupJson, exportBackupCsv, exportBackupMarkdown, exportTodosIcs, importBackupFromFile } from '../utils/backupActions.js';
import { triggerRoadmapPrint } from '../utils/printRoadmap.js';
import { openMyReports } from './myReports.js';
import { openShareRoadmapModal } from './shareRoadmapModal.js';

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
  { route: '/onboarding', label: 'Your roadmaps', icon: 'roadmaps' },
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
// Exported (issue #488) — topbar.js's own avatar dropdown reuses this
// exact item list, adding a "What's New" entry via `onOpenChangelog`
// (the bell folding into the avatar, see that file's own comment) since
// the sidebar isn't rendered below 900px and the topbar avatar is the only
// remaining account-menu entry point at that width.
export function buildAccountMenu({ user, store, dailyTodoStore, identityTrigger, onDeleteAccount, onStartTour, onOpenChangelog, align = 'start' }) {
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
    { text: 'Settings', onClick: () => navigate('/settings') }
  ];
  if (onOpenChangelog) dropdownItems.push({ text: "What's New", onClick: onOpenChangelog });
  // Issue #17 — only offered where the tour's spotlight targets actually
  // exist (dashboard.js is the only caller that passes this), never on
  // Progress/Settings/onboarding's own sidebar instance, where every
  // querySelector target would resolve to null and the tour would end
  // immediately with no explanation.
  if (onStartTour) dropdownItems.push({ text: 'Take a tour', onClick: onStartTour });
  dropdownItems.push(
    { text: 'My reports', onClick: () => openMyReports({ user }) },
    // Issue #414 — the app-wide developer/creator profile, visible to every
    // signed-in identity (never gated behind !user.isAnonymous, matching
    // "My reports"/backup export just above and below).
    { text: 'About the developer', onClick: () => navigate('/creator') },
    { text: 'Share this roadmap…', onClick: () => openShareRoadmapModal({ user, store }) },
    { text: 'Download backup (JSON)', onClick: () => exportBackupJson(store) },
    { text: 'Export CSV', onClick: () => exportBackupCsv(store) },
    { text: 'Export as Markdown', onClick: () => exportBackupMarkdown(store) },
    { text: 'Import backup…', onClick: () => importInput.click() },
    { text: 'Print roadmap…', onClick: () => triggerRoadmapPrint(store) }
  );
  if (dailyTodoStore) {
    dropdownItems.push({ text: 'Export to calendar (.ics)', onClick: () => exportTodosIcs(dailyTodoStore) });
  }
  if (!user.isAnonymous && onDeleteAccount) {
    dropdownItems.push({ text: 'Delete account', danger: true, onClick: onDeleteAccount });
  }

  const identity = createDropdown(identityTrigger, dropdownItems, { align });
  return { identity, importInput };
}

// Returns the sidebar node. Renders only at >=900px (app.css) — below that,
// bottomNav.js is the app's mobile/tablet navigation instead (issue #484,
// retiring this component's former hamburger-drawer mobile mode).
// `onDeleteAccount` is optional — omitted (or a no-op) for anonymous users,
// since there's nothing to delete but the guest session itself (handled by
// sign-out).
// `dailyTodoStore` is optional too (issue #143) — passed straight through to
// confirmAndSignOut() so a dirty Daily Todos list gets the same
// flush-before-sign-out protection the roadmap store already has.
export function createSidebar({ activeRoute, user, store, dailyTodoStore, onDeleteAccount, onStartTour }) {
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

  const userLabel = user.isAnonymous ? 'Guest session' : (user.displayName || user.email || 'Signed in');
  // Issue #123 — a persistent, unobtrusive risk indicator next to the "Guest
  // session" label, since nothing anywhere in the app previously told a guest
  // their roadmap is local-only and can be silently lost (cleared browser
  // data, a new device, a lost tab). Icon-only so it doesn't compete for
  // space with the identity label; the tooltip carries the actual warning.
  const guestRiskIndicator = user.isAnonymous ? el('span', {
    className: 'app-sidebar-guest-risk',
    'aria-label': 'Local-only guest session — your roadmap could be lost if you clear browser data or switch devices'
  }, [createIcon('info', { size: 'xs' })]) : null;
  if (guestRiskIndicator) {
    attachTooltip(guestRiskIndicator, 'Local-only — could be lost if you clear browser data or switch devices');
  }
  const identityTrigger = el('button', {
    type: 'button',
    className: 'app-sidebar-identity',
    'aria-label': `Account menu — ${userLabel}`
  }, [
    createAvatar(user, 'sm'),
    el('span', { className: 'app-sidebar-user-email', text: userLabel }),
    guestRiskIndicator
  ]);

  const { identity, importInput } = buildAccountMenu({ user, store, dailyTodoStore, identityTrigger, onDeleteAccount, onStartTour });

  // Issue #488 — theme now moves here (and to Settings' own theme select)
  // rather than living as a topbar icon button.
  const themeToggleBtn = createThemeToggle();

  const footer = el('div', { className: 'app-sidebar-footer' }, [
    identity,
    importInput,
    themeToggleBtn,
    el('button', {
      type: 'button',
      className: 'btn btn-ghost btn-icon app-sidebar-signout',
      'aria-label': 'Sign out',
      onClick: () => confirmAndSignOut(user, store, dailyTodoStore)
    }, [createIcon('signOut', { size: 'sm' })])
  ]);

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

  node._cleanup = () => {
    identity._cleanup?.();
    themeToggleBtn._cleanup?.();
  };
  return node;
}
