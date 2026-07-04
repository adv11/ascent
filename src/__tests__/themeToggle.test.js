import { describe, it, expect, beforeEach, vi } from 'vitest';

// Reset module registry between tests so theme.js module-level state
// (subscribers Set, media listener) starts fresh each time.
beforeEach(async () => {
  vi.resetModules();
  document.documentElement.dataset.theme = 'light';
});

async function freshToggle() {
  const { createThemeToggle } = await import('../ui/components/themeToggle.js');
  return createThemeToggle();
}

async function freshTheme() {
  return import('../services/theme.js');
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

    let textBefore = btn.textContent;
    btn._cleanup();

    // After cleanup, toggling theme must NOT update this button's text
    setTheme(document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark');
    expect(btn.textContent).toBe(textBefore);
  });

  it('only 1 active subscriber remains after creating and cleaning up multiple toggles', async () => {
    const { createThemeToggle } = await import('../ui/components/themeToggle.js');
    const { setTheme } = await freshTheme();

    const buttons = Array.from({ length: 5 }, () => createThemeToggle());

    // Clean up all but the last one
    buttons.slice(0, -1).forEach(b => b._cleanup());

    let callCount = 0;
    const originalSet = setTheme;

    // Switch theme and count how many buttons update
    const initialTexts = buttons.map(b => b.textContent);
    setTheme('dark');

    const updatedCount = buttons.filter((b, i) => b.textContent !== initialTexts[i]).length;
    // Only the one surviving subscriber (last button) + the 4 cleaned up buttons should NOT have updated
    expect(updatedCount).toBe(1);
  });

  it('cleaned-up toggles do not fire after toggleTheme()', async () => {
    const { createThemeToggle } = await import('../ui/components/themeToggle.js');
    const { toggleTheme } = await freshTheme();

    document.documentElement.dataset.theme = 'light';
    const btn = await freshToggle();
    const snapshot = btn.textContent;

    btn._cleanup();
    toggleTheme();

    expect(btn.textContent).toBe(snapshot);
  });
});
