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
  it('shows the new-vs-existing diff summary computed from the current roadmap, in end-user "topic" language', () => {
    openImportBackupModal(
      { 'existing-1': { title: 'Already here' } },
      backupData({ 'existing-1': {}, 'new-1': {}, 'new-2': {} })
    );
    const overlay = getOverlay();

    expect(overlay.textContent).toContain('This backup has 3 topics');
    expect(overlay.textContent).toContain('1 topic already in your current roadmap');
    expect(overlay.textContent).toContain('2 topics new');
    expect(overlay.textContent).not.toContain('item');
  });

  it('phrases the summary for an all-new backup without an awkward "0 topics" clause', () => {
    openImportBackupModal({}, backupData({ 'new-1': {}, 'new-2': {} }));
    expect(getOverlay().textContent).toContain('all new — none of them are in your current roadmap yet');
  });

  it('phrases the summary for a backup that is entirely already restored', () => {
    openImportBackupModal(
      { 'existing-1': {}, 'existing-2': {} },
      backupData({ 'existing-1': {}, 'existing-2': {} })
    );
    expect(getOverlay().textContent).toContain('every one of them is already in your current roadmap');
  });

  it('the merge button label adapts to whether there is anything new to add', () => {
    openImportBackupModal({ 'existing-1': {} }, backupData({ 'existing-1': {} }));
    expect(findButton(getOverlay(), 'Merge').textContent).toBe('Merge (updates 1 topic)');
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
