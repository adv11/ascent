import { el } from '../dom.js';
import { attachFocusTrap } from './modal.js';
import { diffBackupItems } from '../../core/roadmap/backupValidator.js';

// "Topic" is this app's user-facing word for a roadmap item everywhere else
// (itemPanel.js's "Edit topic"/"Delete topic", dashboard.js's "Add a custom
// topic…", the 800-topic-limit toast) — this modal used to say "item(s)"
// instead, the only place in the whole import/export surface that didn't
// match, confusing for anyone comparing this dialog to the rest of the app.
function summarySentence(diff) {
  const topics = n => `${n} topic${n === 1 ? '' : 's'}`;
  if (diff.newCount === 0) {
    return `This backup has ${topics(diff.totalCount)}, and every one of them is already in your current roadmap.`;
  }
  if (diff.existingCount === 0) {
    return `This backup has ${topics(diff.totalCount)}, all new — none of them are in your current roadmap yet.`;
  }
  return `This backup has ${topics(diff.totalCount)}: ${topics(diff.existingCount)} already in your current roadmap, `
    + `and ${topics(diff.newCount)} new.`;
}

function mergeButtonLabel(diff) {
  if (diff.newCount === 0) return `Merge (updates ${diff.existingCount} topic${diff.existingCount === 1 ? '' : 's'})`;
  if (diff.existingCount === 0) return `Merge (adds ${diff.newCount} new topic${diff.newCount === 1 ? '' : 's'})`;
  return `Merge (adds ${diff.newCount} new, updates ${diff.existingCount})`;
}

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

    const mergeBtn = el('button', {
      type: 'button',
      className: 'btn btn-primary btn-block',
      text: mergeButtonLabel(diff),
      onClick: () => close('merge')
    });
    const overwriteBtn = el('button', {
      type: 'button',
      className: 'btn btn-danger btn-block',
      text: 'Overwrite my whole roadmap with this backup',
      onClick: () => close('overwrite')
    });
    const cancelBtn = el('button', {
      type: 'button',
      className: 'btn btn-secondary btn-block',
      text: 'Cancel',
      onClick: () => close(null)
    });

    const card = el('div', { className: 'modal-card import-modal-card' }, [
      el('h2', { className: 'modal-title', text: 'Restore from backup' }),
      el('p', { className: 'confirm-dialog-body', text: summarySentence(diff) }),
      el('p', { className: 'confirm-dialog-body', text: 'Merge (recommended) only adds and updates topics from this backup — everything else in your roadmap stays exactly as it is.' }),
      el('p', { className: 'confirm-dialog-body', text: 'Overwrite replaces your entire roadmap with this backup — any topic here that isn’t in the file will be permanently deleted.' }),
      mergeBtn,
      overwriteBtn,
      cancelBtn
    ]);

    const overlay = el('div', {
      className: 'modal-overlay',
      role: 'dialog',
      'aria-modal': 'true',
      'aria-label': 'Restore from backup',
      onClick: e => { if (e.target === overlay) close(null); }
    }, [card]);

    const detachTrap = attachFocusTrap(card, { onEscape: () => close(null) });
    document.body.appendChild(overlay);
    mergeBtn.focus();
  });
}
