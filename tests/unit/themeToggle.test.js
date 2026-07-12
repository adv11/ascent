import { describe, it, expect, beforeEach, vi } from 'vitest';

// Reset module registry between tests so theme.js module-level state
// (subscribers Set, media listener) starts fresh each time.
beforeEach(async () => {
  vi.resetModules();
  document.documentElement.dataset.theme = 'light';
});

async function freshToggle() {
  const { createThemeToggle } = await import('../../src/ui/components/themeToggle.js');
  return createThemeToggle();
}

async function freshTheme() {
  return import('../../src/services/theme.js');
}

describe('createThemeToggle — aria-label', () => {
  it('shows "Switch to dark mode" when theme is light', async () => {
    document.documentElement.dataset.theme = 'light';
    const btn = await freshToggle();
    expect(btn.getAttribute('aria-label')).toBe('Switch to dark mode');
  });

  it('shows "Switch to light mode" when theme is dark', async () => {
    document.documentElement.dataset.theme = 'dark';
    const btn = await freshToggle();
    expect(btn.getAttribute('aria-label')).toBe('Switch to light mode');
  });

  it('updates aria-label when theme changes', async () => {
    document.documentElement.dataset.theme = 'light';
    const btn = await freshToggle();
    const { setTheme } = await freshTheme();
    setTheme('dark');
    expect(btn.getAttribute('aria-label')).toBe('Switch to light mode');
    setTheme('light');
    expect(btn.getAttribute('aria-label')).toBe('Switch to dark mode');
  });
});

describe('createThemeToggle — subscriber cleanup', () => {
  it('_cleanup unsubscribes the theme callback', async () => {
    const btn = await freshToggle();
    const { setTheme } = await freshTheme();

    // issue #136 Phase 2 follow-up — createIcon() returns an <svg> with no
    // text nodes, so textContent can no longer stand in for "did the icon
    // change"; compare the rendered SVG markup instead.
    const iconBefore = btn.querySelector('svg').outerHTML;
    btn._cleanup();

    setTheme(document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark');
    expect(btn.querySelector('svg').outerHTML).toBe(iconBefore);
  });

  it('only 1 active subscriber remains after creating and cleaning up multiple toggles', async () => {
    const { createThemeToggle } = await import('../../src/ui/components/themeToggle.js');
    const { setTheme } = await freshTheme();

    const buttons = Array.from({ length: 5 }, () => createThemeToggle());

    buttons.slice(0, -1).forEach(b => b._cleanup());

    const initialIcons = buttons.map(b => b.querySelector('svg').outerHTML);
    setTheme('dark');

    const updatedCount = buttons.filter((b, i) => b.querySelector('svg').outerHTML !== initialIcons[i]).length;
    expect(updatedCount).toBe(1);
  });

  it('cleaned-up toggles do not fire after toggleTheme()', async () => {
    const { createThemeToggle } = await import('../../src/ui/components/themeToggle.js');
    const { toggleTheme } = await freshTheme();

    document.documentElement.dataset.theme = 'light';
    const btn = await freshToggle();
    const snapshot = btn.querySelector('svg').outerHTML;

    btn._cleanup();
    toggleTheme();

    expect(btn.querySelector('svg').outerHTML).toBe(snapshot);
  });
});
