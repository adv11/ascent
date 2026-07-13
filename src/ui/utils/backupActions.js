import { isValidUrl } from '../dom.js';
import { buildRoadmapExport, buildRoadmapCsv, exportFileBaseName } from '../../core/roadmap/backupSchema.js';
import { validateBackupText } from '../../core/roadmap/backupValidator.js';
import { buildTodosIcs } from '../../core/dailyTodo/icsExport.js';
import { downloadTextFile, readFileAsText } from './backupTransfer.js';
import { openImportBackupModal } from '../components/importBackupModal.js';
import { showToast } from '../components/toast.js';
import { markBackupTaken } from './backupReminder.js';

// Shared export/import handlers (issue #18, extracted in a follow-up so both
// sidebar.js's account dropdown and backupReminderBanner.js's "Download
// backup" CTA drive the exact same logic instead of two copies drifting
// apart). Only a JSON export counts toward markBackupTaken()'s "how long
// since your last backup" clock — CSV is a one-way, lossy spreadsheet view,
// not a restorable backup.
export function exportBackupJson(store) {
  const snapshot = store.getSnapshot();
  const payload = buildRoadmapExport(snapshot);
  downloadTextFile(`${exportFileBaseName(snapshot.activeTemplateId)}.json`, JSON.stringify(payload, null, 2), 'application/json');
  markBackupTaken(snapshot.uid);
  showToast('Backup downloaded.', 'success');
}

export function exportBackupCsv(store) {
  const snapshot = store.getSnapshot();
  const csv = buildRoadmapCsv(snapshot);
  downloadTextFile(`${exportFileBaseName(snapshot.activeTemplateId)}.csv`, csv, 'text/csv');
  showToast('CSV exported.', 'success');
}

// Issue #133 Part 1 — exports active Daily Todos as an ICS file. Separate
// from the roadmap export helpers above since it reads dailyTodoStore, not
// roadmapStore, but lives alongside them for the same "sidebar's export menu
// drives this directly" reason.
export function exportTodosIcs(dailyTodoStore) {
  const snapshot = dailyTodoStore.getSnapshot();
  const ics = buildTodosIcs(snapshot.todos);
  const date = new Date().toISOString().slice(0, 10);
  downloadTextFile(`ascent-daily-todos-${date}.ics`, ics, 'text/calendar');
  showToast('Calendar file downloaded.', 'success');
}

// Resource URLs are untrusted input here just like anywhere else a URL
// enters the store (root CLAUDE.md's "Resource URLs must be validated before
// use as href") — strip any non-http(s) resource before it ever reaches
// importBackupItems(), the same save-time guard itemPanel.js applies to a
// manually entered resource.
function sanitizeBackupItems(items) {
  const sanitized = {};
  Object.entries(items).forEach(([id, item]) => {
    sanitized[id] = { ...item, resources: (item.resources || []).filter(resource => isValidUrl(resource?.url)) };
  });
  return sanitized;
}

function applyOverwrite(store, snapshot, keepIds) {
  Object.keys(snapshot.allItems).forEach(id => {
    if (!keepIds.has(id) && !snapshot.allItems[id].deleted) store.removeItem(id);
  });
}

// Import from JSON (issue #18 Phase B). Validates, shows a diff summary, then
// restores through roadmapStore.importBackupItems()/removeItem() — never by
// mutating store state directly — so structuralVersion/queueSave fire
// correctly, same contract every other store mutation already has.
export async function importBackupFromFile(store, file) {
  if (!file) return;
  let text;
  try {
    text = await readFileAsText(file);
  } catch {
    showToast('Could not read that file.', 'error');
    return;
  }

  const result = validateBackupText(text);
  if (!result.valid) {
    showToast(result.errors[0] || 'That file is not a valid Ascent backup.', 'error');
    return;
  }

  const snapshot = store.getSnapshot();
  const mode = await openImportBackupModal(snapshot.allItems, result.data);
  if (!mode) return;

  const sanitizedItems = sanitizeBackupItems(result.data.items);
  if (mode === 'overwrite') applyOverwrite(store, snapshot, new Set(Object.keys(sanitizedItems)));

  const outcome = store.importBackupItems(sanitizedItems);
  const restoredCount = outcome.added + outcome.updated;
  showToast(
    `Restored ${restoredCount} topic${restoredCount === 1 ? '' : 's'}${outcome.skipped ? ` (${outcome.skipped} skipped)` : ''}.`,
    restoredCount ? 'success' : 'error'
  );
}
