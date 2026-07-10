import { describe, it, expect, vi, beforeEach } from 'vitest';

const downloadTextFile = vi.fn();
const readFileAsText = vi.fn();
const openImportBackupModal = vi.fn();
const showToast = vi.fn();
const markBackupTaken = vi.fn();

vi.mock('../../src/ui/utils/backupTransfer.js', () => ({ downloadTextFile, readFileAsText }));
vi.mock('../../src/ui/components/importBackupModal.js', () => ({ openImportBackupModal }));
vi.mock('../../src/ui/components/toast.js', () => ({ showToast }));
vi.mock('../../src/ui/utils/backupReminder.js', () => ({ markBackupTaken }));

const { exportBackupJson, exportBackupCsv, importBackupFromFile } = await import('../../src/ui/utils/backupActions.js');

function fakeStore(overrides = {}) {
  const allItems = overrides.allItems || {
    'existing-1': { id: 'existing-1', title: 'Existing topic', deleted: false }
  };
  return {
    getSnapshot: () => ({ uid: 'user-1', activeTemplateId: 'java-backend', allItems, ...overrides.snapshot }),
    importBackupItems: overrides.importBackupItems || vi.fn(() => ({ added: 1, updated: 0, skipped: 0 })),
    removeItem: overrides.removeItem || vi.fn()
  };
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('exportBackupJson', () => {
  it('downloads a .json file and marks a backup as taken', () => {
    const store = fakeStore();
    exportBackupJson(store);

    expect(downloadTextFile).toHaveBeenCalledTimes(1);
    const [filename, , mimeType] = downloadTextFile.mock.calls[0];
    expect(filename).toMatch(/\.json$/);
    expect(mimeType).toBe('application/json');
    expect(markBackupTaken).toHaveBeenCalledWith('user-1');
    expect(showToast).toHaveBeenCalledWith('Backup downloaded.', 'success');
  });
});

describe('exportBackupCsv', () => {
  it('downloads a .csv file and never marks a backup as taken (CSV is not restorable)', () => {
    const store = fakeStore();
    exportBackupCsv(store);

    const [filename, , mimeType] = downloadTextFile.mock.calls[0];
    expect(filename).toMatch(/\.csv$/);
    expect(mimeType).toBe('text/csv');
    expect(markBackupTaken).not.toHaveBeenCalled();
  });
});

describe('importBackupFromFile', () => {
  it('shows an error toast and stops when the file cannot be read', async () => {
    readFileAsText.mockRejectedValue(new Error('boom'));
    await importBackupFromFile(fakeStore(), new File(['x'], 'x.json'));

    expect(showToast).toHaveBeenCalledWith('Could not read that file.', 'error');
    expect(openImportBackupModal).not.toHaveBeenCalled();
  });

  it('shows a validation error and stops for an invalid backup file', async () => {
    readFileAsText.mockResolvedValue('{not valid json');
    await importBackupFromFile(fakeStore(), new File(['x'], 'x.json'));

    expect(showToast.mock.calls[0][1]).toBe('error');
    expect(openImportBackupModal).not.toHaveBeenCalled();
  });

  it('does nothing further when the diff modal is cancelled', async () => {
    readFileAsText.mockResolvedValue(JSON.stringify({ schemaVersion: 1, items: {} }));
    openImportBackupModal.mockResolvedValue(null);
    const store = fakeStore();

    await importBackupFromFile(store, new File(['x'], 'x.json'));

    expect(store.importBackupItems).not.toHaveBeenCalled();
  });

  it('strips a non-http(s) resource url before calling importBackupItems on merge', async () => {
    readFileAsText.mockResolvedValue(JSON.stringify({
      schemaVersion: 1,
      items: {
        'new-1': {
          title: 'New topic', phase: 'Core', section: 'Basics', priority: 'P1',
          resources: [{ label: 'evil', url: 'javascript:alert(1)' }, { label: 'ok', url: 'https://example.com' }]
        }
      }
    }));
    openImportBackupModal.mockResolvedValue('merge');
    const store = fakeStore();

    await importBackupFromFile(store, new File(['x'], 'x.json'));

    const [importedItems] = store.importBackupItems.mock.calls[0];
    expect(importedItems['new-1'].resources).toEqual([{ label: 'ok', url: 'https://example.com' }]);
  });

  it('removes every current item not present in the backup on overwrite, never touching an already-deleted one', async () => {
    readFileAsText.mockResolvedValue(JSON.stringify({ schemaVersion: 1, items: { 'keep-1': { title: 'Keep', phase: 'Core', section: 'Basics', priority: 'P1' } } }));
    openImportBackupModal.mockResolvedValue('overwrite');
    const store = fakeStore({
      allItems: {
        'keep-1': { id: 'keep-1', deleted: false },
        'drop-1': { id: 'drop-1', deleted: false },
        'already-gone': { id: 'already-gone', deleted: true }
      }
    });

    await importBackupFromFile(store, new File(['x'], 'x.json'));

    expect(store.removeItem).toHaveBeenCalledTimes(1);
    expect(store.removeItem).toHaveBeenCalledWith('drop-1');
  });

  it('reports a success toast naming the restored count', async () => {
    readFileAsText.mockResolvedValue(JSON.stringify({ schemaVersion: 1, items: { 'new-1': { title: 'New', phase: 'Core', section: 'Basics', priority: 'P1' } } }));
    openImportBackupModal.mockResolvedValue('merge');
    const store = fakeStore({ importBackupItems: vi.fn(() => ({ added: 2, updated: 3, skipped: 1 })) });

    await importBackupFromFile(store, new File(['x'], 'x.json'));

    expect(showToast).toHaveBeenCalledWith('Restored 5 topics (1 skipped).', 'success');
  });
});
