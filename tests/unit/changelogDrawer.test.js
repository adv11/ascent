import { describe, it, expect, afterEach } from 'vitest';
import { openChangelogDrawer } from '../../src/ui/components/changelogDrawer.js';

const ENTRIES = [
  { version: 2, date: '2026-02-01', items: [{ type: 'feat', title: 'New thing', description: 'It does a thing.' }] },
  { version: 1, date: '2026-01-01', items: [{ type: 'fix', title: 'Old fix', description: 'It fixed a thing.' }] }
];

describe('openChangelogDrawer', () => {
  afterEach(() => { document.body.innerHTML = ''; });

  it('renders a dialog labelled by the "What\'s New" heading', () => {
    openChangelogDrawer({ entries: ENTRIES });
    const dialog = document.querySelector('[role="dialog"].changelog-drawer');
    expect(dialog).not.toBeNull();
    const labelledBy = dialog.getAttribute('aria-labelledby');
    expect(document.getElementById(labelledBy).textContent).toBe("What's New");
  });

  it('groups entries by version, newest first', () => {
    openChangelogDrawer({ entries: ENTRIES });
    const versions = Array.from(document.querySelectorAll('.changelog-group-version')).map(n => n.textContent);
    expect(versions).toEqual(['Version 2', 'Version 1']);
  });

  it('shows a fallback message when there are no entries', () => {
    openChangelogDrawer({ entries: [] });
    expect(document.querySelector('.changelog-drawer-body').textContent).toContain('Nothing new yet');
  });

  it('closes on Escape and calls onClose', async () => {
    let closed = false;
    openChangelogDrawer({ entries: ENTRIES, onClose: () => { closed = true; } });
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    expect(closed).toBe(true);
  });

  it('the returned close function removes the drawer', async () => {
    const close = openChangelogDrawer({ entries: ENTRIES });
    close();
    await new Promise(r => setTimeout(r, 260));
    expect(document.querySelector('.changelog-drawer')).toBeNull();
  });
});
