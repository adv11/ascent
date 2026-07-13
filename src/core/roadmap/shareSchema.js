// Pure — no DOM, no store, no Firebase. Builds the frozen, public snapshot
// written to `sharedRoadmaps/{shareId}` (issue #131). Deliberately a
// separate schema from backupSchema.js's `buildRoadmapExport` even though
// both start from the same roadmapStore snapshot shape: a backup is a
// private, full-fidelity round-trip format (includes notes/completedAt, only
// ever read by its own owner); a share snapshot is a public, read-only
// display format with a strictly narrower field set — see
// ".claude/rules/roadmap-store.md"'s new "Roadmap sharing" section for why
// notes is excluded and this is a frozen snapshot, not a live pointer.

import { isValidUrl } from '../../ui/dom.js';

export const SHARE_SCHEMA_VERSION = 1;
export const MAX_SHARE_TITLE_LENGTH = 200;

// Never include notes, completedAt, or any Daily-Todo-link bookkeeping — a
// share snapshot is a display format for a stranger with the link, not a
// restorable backup. Resource URLs are re-validated here (not just trusted
// from the store) since this is the one place a roadmap's data becomes
// readable by an unauthenticated client.
function toShareItem(item) {
  return {
    title: item.title,
    phase: item.phase,
    section: item.section,
    priority: item.priority,
    done: !!item.done,
    resources: (item.resources || [])
      .filter(r => isValidUrl(r.url))
      .map(r => ({ label: r.label, url: r.url }))
  };
}

// `snapshot` is a roadmapStore getSnapshot() result; `title` is the
// human-readable roadmap name shown on the shared view (the active
// template's display name, or a custom roadmap's own title). Soft-deleted
// items are never included, same precedent as buildRoadmapExport.
export function buildRoadmapShareSnapshot(snapshot, { uid, title }) {
  const items = {};
  Object.entries(snapshot.allItems || {}).forEach(([id, item]) => {
    if (item.deleted) return;
    items[id] = toShareItem(item);
  });
  return {
    schemaVersion: SHARE_SCHEMA_VERSION,
    ownerUid: uid,
    templateId: snapshot.activeTemplateId,
    title: String(title || 'My roadmap').slice(0, MAX_SHARE_TITLE_LENGTH),
    phases: snapshot.phases || [],
    items,
    publishedAt: Date.now()
  };
}
