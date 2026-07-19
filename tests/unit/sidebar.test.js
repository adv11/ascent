import { describe, it, expect, vi, beforeEach } from 'vitest';
import { KEYS } from '../../src/services/localStorageKeys.js';

vi.mock('../../src/services/firebase.js', () => ({
  authApi: { signOut: vi.fn() },
  database: {},
  firebaseClock: vi.fn(),
}));
// sidebar.js pulls in myReports.js (issue #9's "My reports" menu item),
// which imports feedbackStore.js, which imports the Firebase Realtime
// Database SDK directly (not just through firebase.js) — same CDN-URL stub
// every other test touching a firebase.js-adjacent module needs, per
// tests/unit/storage/adapterFactory.test.js's precedent.
vi.mock('https://www.gstatic.com/firebasejs/10.12.5/firebase-database.js', () => ({
  ref: vi.fn(), push: vi.fn(), update: vi.fn(), onValue: vi.fn(), off: vi.fn(),
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

  // Issue #8 — Progress nav item, between Dashboard and My Roadmaps.
  it('includes a Progress link and marks it active on /progress', async () => {
    const node = await freshSidebar({ activeRoute: '/progress', user: { isAnonymous: true }, store: fakeStore() });
    const progressLink = node.querySelector('.app-sidebar-nav a[href="#/progress"]');
    expect(progressLink).not.toBeNull();
    expect(progressLink.classList.contains('active')).toBe(true);
    expect(progressLink.getAttribute('aria-current')).toBe('page');

    const labels = Array.from(node.querySelectorAll('.app-sidebar-nav .nav-item-label')).map(el => el.textContent);
    expect(labels).toEqual(['Dashboard', 'Progress', 'My Roadmaps', 'Settings']);
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
    document.body.append(node);
    expect(node.querySelector('.app-sidebar-identity').textContent).toContain('Guest session');
    expect(node.querySelector('.dropdown')).not.toBeNull();

    // The dropdown menu is portaled to document.body on open (issue #121
    // follow-up, dropdown.js) — its items only exist in the document once
    // opened, not always-in-DOM-but-hidden inside .dropdown.
    node.querySelector('.app-sidebar-identity').click();
    expect(document.querySelector('.dropdown-item-danger')).toBeNull();
    const itemText = Array.from(document.querySelectorAll('.dropdown-item')).map(el => el.textContent);
    expect(itemText).toEqual(['Settings', 'My reports', 'Share this roadmap…', 'Download backup (JSON)', 'Export CSV', 'Import backup…', 'Print roadmap…']);
  });

  // Issue #17 — only the dashboard's sidebar instance passes onStartTour;
  // every other page's sidebar (progress/settings/onboarding) omits it, so
  // "Take a tour" never appears where its spotlight targets don't exist.
  it('adds a "Take a tour" item, right after Settings, only when onStartTour is passed', async () => {
    const onStartTour = vi.fn();
    const node = await freshSidebar({
      activeRoute: '/app',
      user: { isAnonymous: true },
      store: fakeStore(),
      onStartTour
    });
    document.body.append(node);
    node.querySelector('.app-sidebar-identity').click();
    const items = Array.from(document.querySelectorAll('.dropdown-item'));
    expect(items[0].textContent).toBe('Settings');
    expect(items[1].textContent).toBe('Take a tour');

    items[1].click();
    expect(onStartTour).toHaveBeenCalledTimes(1);
  });

  // Issue #133 — the ICS export item only appears when a dailyTodoStore is
  // actually passed in, same optional-prop precedent as confirmAndSignOut's
  // third param.
  it('adds an "Export to calendar (.ics)" item only when dailyTodoStore is passed', async () => {
    const node = await freshSidebar({
      activeRoute: '/app',
      user: { isAnonymous: true },
      store: fakeStore(),
      dailyTodoStore: { getSnapshot: () => ({ todos: [] }) }
    });
    document.body.append(node);
    node.querySelector('.app-sidebar-identity').click();
    const itemText = Array.from(document.querySelectorAll('.dropdown-item')).map(el => el.textContent);
    expect(itemText).toContain('Export to calendar (.ics)');
  });

  // Issue #123 — persistent local-only-data risk indicator, guest only.
  it('shows a guest-only local-data risk indicator in the identity area', async () => {
    const guestNode = await freshSidebar({ activeRoute: '/app', user: { isAnonymous: true }, store: fakeStore() });
    expect(guestNode.querySelector('.app-sidebar-guest-risk')).not.toBeNull();

    const realNode = await freshSidebar({ activeRoute: '/app', user: { isAnonymous: false, email: 'jane@example.com' }, store: fakeStore() });
    expect(realNode.querySelector('.app-sidebar-guest-risk')).toBeNull();
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
    document.querySelector('.dropdown-item-danger').click();

    expect(onDeleteAccount).toHaveBeenCalledTimes(1);
  });
});

// Issue #143 follow-up — dailyTodoStore.js has the same debounced-write race
// roadmapStore.js does; createSidebar() must thread it through to
// confirmAndSignOut() (src/ui/utils/signOut.js) so a dirty Daily Todos list
// gets flushed before sign-out too, not just the roadmap.
describe('createSidebar — sign-out flush', () => {
  it('flushes a dirty dailyTodoStore passed in alongside the roadmap store', async () => {
    const todoFlush = vi.fn().mockResolvedValue(undefined);
    const dailyTodoStore = { getSnapshot: () => ({ dirty: true }), flush: todoFlush };
    const node = await freshSidebar({
      activeRoute: '/app',
      user: { isAnonymous: false, email: 'jane@example.com' },
      store: fakeStore(false),
      dailyTodoStore
    });
    document.body.append(node);

    node.querySelector('.app-sidebar-signout').click();
    await vi.waitFor(() => expect(document.querySelector('.modal-overlay')).not.toBeNull());
    document.querySelector('[data-action="confirm"]').click();

    await vi.waitFor(() => expect(todoFlush).toHaveBeenCalled());
  });
});
