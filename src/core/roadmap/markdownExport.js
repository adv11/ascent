// Pure — no DOM, no store, no Firebase. Builds a single Markdown document from
// the active roadmap (issue #378), for pasting into Obsidian/Notion/a personal
// wiki. Distinct from backupSchema.js's JSON/CSV export (a restorable
// snapshot, not meant for reading) and printRoadmap.js's branded PDF export
// (meant for printing) — this is the one export meant to be read as plain
// text in another tool. One-way only, same precedent as the CSV export: there
// is no Markdown import.

// Escapes the four Markdown special characters that would otherwise corrupt
// list/heading structure or accidentally create emphasis/links out of a plain
// title (issue #378's own testing requirement).
function escapeMarkdown(text) {
  return String(text ?? '').replace(/[*_[\]]/g, '\\$&');
}

// Mirrors dashboard.js's groupItems() — the template's own phase/section
// skeleton (snapshot.phases) provides ordering, falling back to
// first-appearance order for any item whose phase/section isn't in the
// skeleton (a custom roadmap with no fixed skeleton, or stale phase/section
// text on an item).
function groupByPhaseAndSection(items, templatePhases) {
  const phases = [];
  const phaseMap = new Map();
  (templatePhases || []).forEach(phase => {
    const entry = { title: phase.title, sections: (phase.sections || []).map(section => ({ title: section.title, items: [] })) };
    phaseMap.set(phase.title, entry);
    phases.push(entry);
  });

  items.forEach(item => {
    let phase = phaseMap.get(item.phase);
    if (!phase) {
      phase = { title: item.phase, sections: [] };
      phaseMap.set(item.phase, phase);
      phases.push(phase);
    }
    let section = phase.sections.find(s => s.title === item.section);
    if (!section) {
      section = { title: item.section, items: [] };
      phase.sections.push(section);
    }
    section.items.push(item);
  });

  return phases.filter(phase => phase.sections.some(section => section.items.length));
}

function buildResourceLines(resources) {
  return (resources || [])
    .filter(resource => resource?.url)
    .map(resource => `  - [${escapeMarkdown(resource.label || resource.url)}](${resource.url})`);
}

function buildItemLines(item, { includeNotes }) {
  const checkbox = item.done ? '- [x]' : '- [ ]';
  const priority = item.priority ? ` (${item.priority})` : '';
  const lines = [`${checkbox} ${escapeMarkdown(item.title)}${priority}`];
  lines.push(...buildResourceLines(item.resources));
  if (includeNotes && item.notes) {
    item.notes.split('\n').forEach(line => lines.push(`  > ${line}`));
  }
  return lines;
}

// `snapshot` is a roadmapStore getSnapshot() result. `title` is the roadmap's
// display title (the active template's name, or a custom roadmap's own
// title). `includeNotes` defaults to on — unlike shareSchema.js's published
// share snapshot, this is the user's own download, not something handed to a
// stranger, so notes default to included (issue #378's own scope decision).
export function buildRoadmapMarkdown(snapshot, title, { includeNotes = true } = {}) {
  const items = snapshot?.items || [];
  const phases = groupByPhaseAndSection(items, snapshot?.phases);

  const lines = [`# ${escapeMarkdown(title || 'Roadmap')}`, ''];

  if (!phases.length) {
    lines.push('_No topics yet._');
    return lines.join('\n');
  }

  phases.forEach(phase => {
    lines.push(`## ${escapeMarkdown(phase.title)}`, '');
    phase.sections.forEach(section => {
      lines.push(`### ${escapeMarkdown(section.title)}`, '');
      section.items.forEach(item => {
        lines.push(...buildItemLines(item, { includeNotes }));
      });
      lines.push('');
    });
  });

  while (lines.length && lines[lines.length - 1] === '') lines.pop();
  return lines.join('\n');
}
