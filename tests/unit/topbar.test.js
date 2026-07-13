import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { createTopbar } from '../../src/ui/components/topbar.js';

function baseProps(overrides = {}) {
  return {
    breadcrumb: 'Dashboard',
    user: { isAnonymous: false },
    syncPill: null,
    themeToggleBtn: document.createElement('button'),
    dailyTodoNavBadge: null,
    notificationBell: null,
    onToggleMobileSidebar: () => {},
    ...overrides
  };
}

describe('createTopbar — command palette wiring (issue #125)', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
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
