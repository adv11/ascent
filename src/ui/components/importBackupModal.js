import { el } from '../dom.js';
import { attachFocusTrap } from './modal.js';
import { diffBackupItems } from '../../core/roadmap/backupValidator.js';

// Diff-summary confirmation shown after a backup JSON file has already
// passed validateBackupText() (issue #18) — never shown for an invalid file.
// Built the same ad hoc modal/attachFocusTrap way as confirmDialog.js and
// importRoadmapModal.js (not openModal() — its `close` has no hook back to
// the caller on Escape/outside-click, which a promise-resolving modal needs
// so those paths still resolve `null` instead of leaving the promise
// hanging forever).
//
// Resolves `'merge' | 'overwrite' | null` (cancel/Escape/outside-click).
export function openImportBackupModal(currentAllItems, backupData) {
  const diff = diffBackupItems(currentAllItems, backupData.items);

  return new Promise(resolve => {
    function close(result) {
      detachTrap();
      overlay.remove();
      resolve(result);
    }

    const summaryText = `${diff.totalCount} item${diff.totalCount === 1 ? '' : 's'} found in this backup — `
      + `${diff.existingCount} already exist in this roadmap, ${diff.newCount} ${diff.newCount === 1 ? 'is' : 'are'} new.`;

    const mergeBtn = el('button', {
      type: 'button',
      className: 'btn btn-primary btn-block',
      text: `Merge (add ${diff.newCount} new, update ${diff.existingCount} existing)`,
      onClick: () => close('merge')
    });
    const overwriteBtn = el('button', {
      type: 'button',
      className: 'btn btn-danger btn-block',
      text: 'Overwrite (also remove anything not in this backup)',
      onClick: () => close('overwrite')
    });
    const cancelBtn = el('button', {
      type: 'button',
      className: 'btn btn-secondary btn-block',
      text: 'Cancel',
      onClick: () => close(null)
    });

    const card = el('div', { className: 'modal-card import-modal-card' }, [
      el('h2', { className: 'modal-title', text: 'Restore backup' }),
      el('p', { className: 'confirm-dialog-body', text: summaryText }),
      el('p', { className: 'confirm-dialog-body', text: 'Merge leaves everything else in your roadmap untouched. Overwrite also deletes any item currently in your roadmap that isn’t in this backup file.' }),
      mergeBtn,
      overwriteBtn,
      cancelBtn
    ]);

    const overlay = el('div', {
      className: 'modal-overlay',
      role: 'dialog',
      'aria-modal': 'true',
      'aria-label': 'Restore backup',
      onClick: e => { if (e.target === overlay) close(null); }
    }, [card]);

    const detachTrap = attachFocusTrap(card, { onEscape: () => close(null) });
    document.body.appendChild(overlay);
    mergeBtn.focus();
  });
}
