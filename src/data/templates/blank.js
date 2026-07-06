export const RESOURCE_LIBRARY = {};

// Four empty placeholder phases with no seeded topics — the user fills these in
// themselves via the dashboard's "Add a custom topic…" row. Each phase still needs
// one (unlabeled) section so dashboard.js has an add-row anchor to render even
// though there are zero items to group under it.
export const PHASES = [
  { title: 'Learn', priority: 'P1', resourceKey: null, sections: [{ title: '', items: [] }] },
  { title: 'Practice', priority: 'P1', resourceKey: null, sections: [{ title: '', items: [] }] },
  { title: 'Build', priority: 'P1', resourceKey: null, sections: [{ title: '', items: [] }] },
  { title: 'Review', priority: 'P1', resourceKey: null, sections: [{ title: '', items: [] }] }
];

export function buildSeedItems() {
  return {};
}
