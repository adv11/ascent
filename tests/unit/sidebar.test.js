import { describe, it, expect, vi, beforeEach } from 'vitest';
import { KEYS } from '../../src/services/localStorageKeys.js';

vi.mock('../../src/services/firebase.js', () => ({
  authApi: { signOut: vi.fn() },
}));
vi.mock('../../src/ui/router.js', () => ({ navigate: vi.fn() }));

function fakeStore(dirty = false) {
  return { getSnapshot: () => ({ dirty }) };
}

beforeEach(() => {
  vi.resetModules();
  document.body.innerHTML = '';
  localStorage.clear();
});

async function freshSidebar(opts) {
  const { createSidebar } = await import('../../src/ui/components/sidebar.js');
  return createSidebar(opts);
}

describe('createSidebar — nav', () => {
  it('marks the item matching activeRoute as active with aria-current', async () => {
    const node = await freshSidebar({ activeRoute: '/app', user: { isAnonymous: true }, store: fakeStore() });
    const dashboardLink = node.querySelector('a[href="#/app"]');
    const roadmapsLink = node.querySelector('.app-sidebar-nav a[href="#/onboarding"]');
    expect(dashboardLink.classList.contains('active')).toBe(true);
    expect(dashboardLink.getAttribute('aria-current')).toBe('page');
    expect(roadmapsLink.classList.contains('active')).toBe(false);
    expect(roadmapsLink.getAttribute('aria-current')).toBeNull();
  });

  // Issue #16 — Settings nav item.
  it('includes a Settings link and marks it active on /settings', async () => {
    const node = await freshSidebar({ activeRoute: '/settings', user: { isAnonymous: true }, store: fakeStore() });
    const settingsLink = node.querySelector('.app-sidebar-nav a[href="#/settings"]');
    expect(settingsLink).not.toBeNull();
    expect(settingsLink.classList.contains('active')).toBe(true);
    expect(settingsLink.getAttribute('aria-current')).toBe('page');
  });
});

describe('createSidebar — manual collapse', () => {
  it('starts expanded and persists the collapsed state on toggle', async () => {
    const node = await freshSidebar({ activeRoute: '/app', user: { isAnonymous: true }, store: fakeStore() });
    expect(node.classList.contains('collapsed')).toBe(false);

    node.querySelector('.app-sidebar-collapse-btn').click();

    expect(node.classList.contains('collapsed')).toBe(true);
    expect(localStorage.getItem(KEYS.SIDEBAR_COLLAPSED)).toBe('1');
  });

  it('restores a previously collapsed state on render', async () => {
    localStorage.setItem(KEYS.SIDEBAR_COLLAPSED, '1');
    const node = await freshSidebar({ activeRoute: '/app', user: { isAnonymous: true }, store: fakeStore() });
    expect(node.classList.contains('collapsed')).toBe(true);
  });
});

describe('createSidebar — mobile drawer', () => {
  it('_toggleMobile opens and closes the drawer, locking/unlocking body scroll', async () => {
    const node = await freshSidebar({ activeRoute: '/app', user: { isAnonymous: true }, store: fakeStore() });
    document.body.append(node);

    node._toggleMobile();
    expect(node.classList.contains('mobile-open')).toBe(true);
    expect(node._backdrop.classList.contains('show')).toBe(true);
    expect(document.body.classList.contains('scroll-locked')).toBe(true);

    node._toggleMobile();
    expect(node.classList.contains('mobile-open')).toBe(false);
    expect(document.body.classList.contains('scroll-locked')).toBe(false);
  });

  it('clicking a nav link closes an open mobile drawer', async () => {
    const node = await freshSidebar({ activeRoute: '/app', user: { isAnonymous: true }, store: fakeStore() });
    document.body.append(node);

    node._toggleMobile();
    node.querySelector('.app-sidebar-nav a[href="#/onboarding"]').click();

    expect(node.classList.contains('mobile-open')).toBe(false);
  });
});

describe('createSidebar — account identity', () => {
  // Issue #18 — an anonymous/guest session's local-only progress is exactly
  // the data most at risk of being lost, so backup export/import is offered
  // here too, unlike "Delete account" which stays signed-in-only below.
  it('gives an anonymous user a Settings + backup dropdown with no "Delete account" item', async () => {
    const node = await freshSidebar({ activeRoute: '/app', user: { isAnonymous: true }, store: fakeStore() });
    expect(node.querySelector('.app-sidebar-identity').textContent).toContain('Guest session');
    expect(node.querySelector('.dropdown')).not.toBeNull();
    expect(node.querySelector('.dropdown-item-danger')).toBeNull();
    const itemText = Array.from(node.querySelectorAll('.dropdown-item')).map(el => el.textContent);
    expect(itemText).toEqual(['Settings', 'Download backup (JSON)', 'Export CSV', 'Import backup…']);
  });

  it('wraps the identity in a dropdown with a "Delete account" item for a signed-in user', async () => {
    const onDeleteAccount = vi.fn();
    const node = await freshSidebar({
      activeRoute: '/app',
      user: { isAnonymous: false, email: 'jane@example.com' },
      store: fakeStore(),
      onDeleteAccount
    });
    document.body.append(node);

    node.querySelector('.app-sidebar-identity').click();
    node.querySelector('.dropdown-item-danger').click();

    expect(onDeleteAccount).toHaveBeenCalledTimes(1);
  });
});
