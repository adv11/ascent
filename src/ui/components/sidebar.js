import { el, isValidUrl } from '../dom.js';
import { createBrandMark } from './brand.js';
import { createAvatar } from './avatar.js';
import { createDropdown } from './dropdown.js';
import { confirmAndSignOut } from '../utils/signOut.js';
import { KEYS } from '../../services/localStorageKeys.js';
import { buildRoadmapExport, buildRoadmapCsv, exportFileBaseName } from '../../core/roadmap/backupSchema.js';
import { validateBackupText } from '../../core/roadmap/backupValidator.js';
import { downloadTextFile, readFileAsText } from '../utils/backupTransfer.js';
import { openImportBackupModal } from './importBackupModal.js';
import { showToast } from './toast.js';

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

// Data export/backup (issue #18) — "Download backup"/"Export CSV" live in the
// account dropdown for now since the account settings page (#16) this was
// originally scoped to doesn't exist yet; move these there once it does.
function handleExportJson(store) {
  const snapshot = store.getSnapshot();
  const payload = buildRoadmapExport(snapshot);
  downloadTextFile(`${exportFileBaseName(snapshot.activeTemplateId)}.json`, JSON.stringify(payload, null, 2), 'application/json');
  showToast('Backup downloaded.', 'success');
}

function handleExportCsv(store) {
  const snapshot = store.getSnapshot();
  const csv = buildRoadmapCsv(snapshot);
  downloadTextFile(`${exportFileBaseName(snapshot.activeTemplateId)}.csv`, csv, 'text/csv');
  showToast('CSV exported.', 'success');
}

// Import from JSON (issue #18 Phase B). Validates, shows a diff summary, then
// restores through roadmapStore.importBackupItems()/removeItem() — never by
// mutating store state directly — so structuralVersion/queueSave fire
// correctly, same contract every other store mutation already has.
async function handleImportFile(store, file) {
  if (!file) return;
  let text;
  try {
    text = await readFileAsText(file);
  } catch {
    showToast('Could not read that file.', 'error');
    return;
  }

  const result = validateBackupText(text);
  if (!result.valid) {
    showToast(result.errors[0] || 'That file is not a valid Ascent backup.', 'error');
    return;
  }

  const snapshot = store.getSnapshot();
  const mode = await openImportBackupModal(snapshot.allItems, result.data);
  if (!mode) return;

  // Resource URLs are untrusted input here just like anywhere else a URL
  // enters the store (root CLAUDE.md's "Resource URLs must be validated
  // before use as href") — strip any non-http(s) resource before it ever
  // reaches importBackupItems(), the same save-time guard itemPanel.js
  // applies to a manually entered resource.
  const sanitizedItems = {};
  Object.entries(result.data.items).forEach(([id, item]) => {
    sanitizedItems[id] = {
      ...item,
      resources: (item.resources || []).filter(resource => isValidUrl(resource?.url))
    };
  });

  if (mode === 'overwrite') {
    const keepIds = new Set(Object.keys(sanitizedItems));
    Object.keys(snapshot.allItems).forEach(id => {
      if (!keepIds.has(id) && !snapshot.allItems[id].deleted) store.removeItem(id);
    });
  }

  const outcome = store.importBackupItems(sanitizedItems);
  const restoredCount = outcome.added + outcome.updated;
  showToast(
    `Restored ${restoredCount} item${restoredCount === 1 ? '' : 's'}${outcome.skipped ? ` (${outcome.skipped} skipped)` : ''}.`,
    restoredCount ? 'success' : 'error'
  );
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
      if (file) handleImportFile(store, file);
    }
  });

  const dropdownItems = [
    { text: 'Download backup (JSON)', onClick: () => handleExportJson(store) },
    { text: 'Export CSV', onClick: () => handleExportCsv(store) },
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

  const { identity, importInput } = buildAccountMenu({ user, store, identityTrigger, onDeleteAccount });

  const footer = el('div', { className: 'app-sidebar-footer' }, [
    identity,
    importInput,
    el('button', {
      type: 'button',
      className: 'btn btn-ghost btn-icon app-sidebar-signout',
      'aria-label': 'Sign out',
      text: '⏻',
      onClick: () => confirmAndSignOut(user, store)
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
