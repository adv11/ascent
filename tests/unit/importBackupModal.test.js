import { describe, it, expect, vi, beforeEach } from 'vitest';
import { openImportBackupModal } from '../../src/ui/components/importBackupModal.js';

function getOverlay() {
  return document.querySelector('.modal-overlay');
}

function findButton(overlay, textMatch) {
  return [...overlay.querySelectorAll('button')].find(b => b.textContent.includes(textMatch));
}

function backupData(items) {
  return { schemaVersion: 1, items };
}

beforeEach(() => {
  document.body.innerHTML = '';
  vi.useRealTimers();
});

describe('openImportBackupModal (issue #18)', () => {
  it('shows the new-vs-existing diff summary computed from the current roadmap', () => {
    openImportBackupModal(
      { 'existing-1': { title: 'Already here' } },
      backupData({ 'existing-1': {}, 'new-1': {}, 'new-2': {} })
    );
    const overlay = getOverlay();

    expect(overlay.textContent).toContain('3 items found in this backup');
    expect(overlay.textContent).toContain('1 already exist');
    expect(overlay.textContent).toContain('2 are new');
  });

  it('resolves "merge" when Merge is clicked', async () => {
    const promise = openImportBackupModal({}, backupData({ 'new-1': {} }));
    findButton(getOverlay(), 'Merge').click();
    await expect(promise).resolves.toBe('merge');
  });

  it('resolves "overwrite" when Overwrite is clicked', async () => {
    const promise = openImportBackupModal({}, backupData({ 'new-1': {} }));
    findButton(getOverlay(), 'Overwrite').click();
    await expect(promise).resolves.toBe('overwrite');
  });

  it('resolves null on Cancel and removes the overlay', async () => {
    const promise = openImportBackupModal({}, backupData({ 'new-1': {} }));
    findButton(getOverlay(), 'Cancel').click();
    await expect(promise).resolves.toBeNull();
    expect(getOverlay()).toBeNull();
  });

  it('resolves null on outside-overlay click', async () => {
    const promise = openImportBackupModal({}, backupData({}));
    getOverlay().click();
    await expect(promise).resolves.toBeNull();
  });

  it('resolves null on Escape', async () => {
    const promise = openImportBackupModal({}, backupData({}));
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    await expect(promise).resolves.toBeNull();
  });
});
