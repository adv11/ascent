// Pure — no DOM, no store, no Firebase. Builds the exportable JSON/CSV
// representations of the currently active roadmap (issue #18). Kept separate
// from importValidator.js/schemaAdapter.js (AI-import, issue #4) — that pair
// validates/converts a *generated* roadmap-shape payload into a brand-new
// custom roadmap; this pair snapshots/restores a roadmap the user already
// has, item-by-item, including done/completedAt/resources/notes state.

// Bumped only when the exported/imported item shape changes in a way an
// older app version couldn't read — see docs/adr/ for the versioning policy.
export const EXPORT_SCHEMA_VERSION = 1;

// Only the fields a backup needs to round-trip are exported — never `custom`/
// `deleted`/`createdAt`/`updatedAt`/`completedViaTodoAt`, which are either
// derived, soft-delete bookkeeping, or tied to a Daily Todo link that has no
// meaning outside the account it was created in.
function toExportItem(item) {
  return {
    title: item.title,
    phase: item.phase,
    section: item.section,
    priority: item.priority,
    done: !!item.done,
    completedAt: item.completedAt ?? null,
    resources: (item.resources || []).map(r => ({ label: r.label, url: r.url })),
    notes: item.notes || ''
  };
}

// `snapshot` is a roadmapStore getSnapshot() result. Soft-deleted items
// (`item.deleted === true`, present in `allItems` but never rendered) are
// never included — a backup restores what the user can currently see, not
// their full tombstone history.
export function buildRoadmapExport(snapshot) {
  const items = {};
  Object.entries(snapshot.allItems || {}).forEach(([id, item]) => {
    if (item.deleted) return;
    items[id] = toExportItem(item);
  });
  return {
    schemaVersion: EXPORT_SCHEMA_VERSION,
    exportedAt: new Date().toISOString(),
    // Informational only — never used to scope an import. Importing this
    // file into a different account still writes through that account's own
    // store/adapter, so there is nothing to "strip"; see backupValidator.js.
    exportedByUid: snapshot.uid || null,
    templateId: snapshot.activeTemplateId,
    itemCount: Object.keys(items).length,
    items
  };
}

export function exportFileBaseName(templateId) {
  const date = new Date().toISOString().slice(0, 10);
  const safeTemplateId = (templateId || 'roadmap').replace(/[^a-z0-9-]/gi, '-');
  return `ascent-roadmap-${safeTemplateId}-${date}`;
}

function csvField(value) {
  const str = String(value ?? '');
  return /[",\r\n]/.test(str) ? `"${str.replace(/"/g, '""')}"` : str;
}

const CSV_COLUMNS = ['phase', 'section', 'title', 'priority', 'done', 'completedAt', 'resourceCount', 'notes'];

// RFC 4180: CRLF row separators, double-quote fields containing a comma,
// quote, or newline, doubled internal quotes.
export function buildRoadmapCsv(snapshot) {
  const rows = [CSV_COLUMNS.join(',')];
  Object.values(snapshot.allItems || {})
    .filter(item => !item.deleted)
    .forEach(item => {
      rows.push([
        item.phase,
        item.section,
        item.title,
        item.priority,
        item.done ? 'true' : 'false',
        item.completedAt ? new Date(item.completedAt).toISOString() : '',
        (item.resources || []).length,
        item.notes || ''
      ].map(csvField).join(','));
    });
  return rows.join('\r\n');
}
