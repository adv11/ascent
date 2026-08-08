import { el } from '../dom.js';
import { attachFocusTrap } from './modal.js';
import { createIcon } from './icons.js';
import { diffBackupItems } from '../../core/roadmap/backupValidator.js';

// Issue #507 — the front door to restoring a backup: a drag-and-drop zone
// (design reference) shown before the diff-summary/merge-or-overwrite step
// below, rather than starting from a bare native file-picker click with no
// modal of its own. Resolves the chosen File, or null on cancel/Escape/
// outside-click — importBackupFromFile() (backupActions.js) still owns all
// the actual read/validate/diff/restore logic; this only replaces how the
// file is initially picked.
export function openImportBackupDropZoneModal() {
  return new Promise(resolve => {
    function close(file) {
      detachTrap();
      overlay.remove();
      resolve(file);
    }

    const fileInput = el('input', {
      type: 'file',
      accept: '.json,application/json',
      hidden: true,
      onChange: () => {
        const file = fileInput.files?.[0];
        if (file) close(file);
      }
    });

    const dropZone = el('div', {
      className: 'import-backup-dropzone',
      tabindex: '0',
      role: 'button',
      'aria-label': 'Drop your backup file here, or choose one from your device',
      onClick: () => fileInput.click(),
      onKeydown: e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); fileInput.click(); } },
      onDragover: e => { e.preventDefault(); dropZone.classList.add('drag-over'); },
      onDragleave: () => dropZone.classList.remove('drag-over'),
      onDrop: e => {
        e.preventDefault();
        dropZone.classList.remove('drag-over');
        const file = e.dataTransfer?.files?.[0];
        if (file) close(file);
      }
    }, [
      createIcon('upload', { size: 'md' }),
      el('p', { className: 'import-backup-dropzone-title', text: 'Drop your backup file here' }),
      el('p', { className: 'import-backup-dropzone-subtitle', text: 'or choose one from your device' }),
      fileInput
    ]);

    const cancelBtn = el('button', { type: 'button', className: 'btn btn-secondary btn-block', text: 'Cancel', onClick: () => close(null) });

    const card = el('div', { className: 'modal-card' }, [
      el('h2', { className: 'modal-title', text: 'Restore from a backup' }),
      el('p', { className: 'confirm-dialog-body', text: 'This replaces everything you have now with what is in the file. Download a backup of your current progress first if you might want it back.' }),
      dropZone,
      cancelBtn
    ]);

    const overlay = el('div', {
      className: 'modal-overlay',
      role: 'dialog',
      'aria-modal': 'true',
      'aria-label': 'Restore from a backup',
      onClick: e => { if (e.target === overlay) close(null); }
    }, [card]);

    const detachTrap = attachFocusTrap(card, { onEscape: () => close(null) });
    document.body.appendChild(overlay);
    dropZone.focus();
  });
}

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
