import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

vi.mock('../../src/services/firebase.js', () => ({
  authApi: { signOut: vi.fn() },
  database: {},
  firebaseClock: vi.fn(),
}));
// topbar.js's avatar dropdown reuses sidebar.js's buildAccountMenu (issue
// #488), which pulls in myReports.js -> feedbackStore.js -> the Firebase
// Realtime Database SDK directly — same CDN-URL stub every other test
// touching a firebase.js-adjacent module needs (see sidebar.test.js).
vi.mock('https://www.gstatic.com/firebasejs/10.12.5/firebase-database.js', () => ({
  ref: vi.fn(), push: vi.fn(), update: vi.fn(), onValue: vi.fn(), off: vi.fn(),
}));

import { createTopbar } from '../../src/ui/components/topbar.js';

function fakeStore() {
  return { getSnapshot: () => ({ dirty: false }) };
}

function baseProps(overrides = {}) {
  return {
    breadcrumb: 'Dashboard',
    user: { isAnonymous: false },
    store: fakeStore(),
    ...overrides
  };
}

describe('createTopbar — command palette wiring (issue #125)', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
    localStorage.clear();
  });

  afterEach(() => {
    document.body.innerHTML = '';
  });

  it('clicking the command-palette button opens the palette', () => {
    const topbar = createTopbar(baseProps());
    document.body.append(topbar);

    topbar.querySelector('.app-topbar-command-btn').click();

    expect(document.querySelector('.command-palette-card')).not.toBeNull();
    topbar._cleanup();
  });

  it('Ctrl+K opens the palette', () => {
    const topbar = createTopbar(baseProps());
    document.body.append(topbar);

    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'k', ctrlKey: true }));

    expect(document.querySelector('.command-palette-card')).not.toBeNull();
    topbar._cleanup();
  });

  it('_cleanup unbinds the keyboard shortcut', () => {
    const topbar = createTopbar(baseProps());
    document.body.append(topbar);
    topbar._cleanup();

    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'k', ctrlKey: true }));

    expect(document.querySelector('.command-palette-card')).toBeNull();
  });

  it('palette items navigate via the hash router', () => {
    const topbar = createTopbar(baseProps());
    document.body.append(topbar);
    topbar.querySelector('.app-topbar-command-btn').click();

    document.querySelector('.command-palette-item').click();

    expect(window.location.hash).toBe('#/app');
    topbar._cleanup();
  });
});

describe('createTopbar — avatar menu (issue #488)', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
    localStorage.clear();
  });

  afterEach(() => {
    document.body.innerHTML = '';
  });

  it('renders a single avatar button with no separate bell/theme/create-account controls', () => {
    const topbar = createTopbar(baseProps({ user: { isAnonymous: true } }));
    document.body.append(topbar);

    expect(topbar.querySelector('.app-topbar-avatar-btn')).not.toBeNull();
    expect(topbar.querySelector('.app-topbar-bell')).toBeNull();
    expect(topbar.querySelector('.theme-toggle')).toBeNull();
    expect(topbar.querySelector('.app-topbar-status')).toBeNull();
    topbar._cleanup();
  });

  it('clicking the avatar opens a dropdown containing "What\'s New" and Settings', () => {
    const topbar = createTopbar(baseProps());
    document.body.append(topbar);

    topbar.querySelector('.app-topbar-avatar-btn').click();
    const labels = [...document.querySelectorAll('.dropdown-item')].map(el => el.textContent);

    expect(labels).toContain('Settings');
    expect(labels).toContain("What's New");
    topbar._cleanup();
  });
});
