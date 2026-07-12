// Deterministic icon picker for custom/imported roadmap cards (issue #61 follow-up).
// Every custom roadmap used to render the same generic '✎' regardless of title,
// so once a user had more than one, the grid was only distinguishable by reading
// text. This derives a stable icon from a hash of the roadmap's id — same id
// always yields the same icon, across sessions and devices, with no new UI and
// no roadmapStore schema change. Returns a decorativeIcon.js icon name (issue
// #136 Phase 2, converted from emoji) — every custom card sits in the same
// onboarding grid row as the built-in templates' own Duotone icons, so this
// set must draw from the same vocabulary or the exact "two incompatible icon
// styles side by side" problem issue #136 flagged returns immediately.
const CUSTOM_ROADMAP_ICONS = [
  'book', 'book-open', 'notebook', 'books', 'notepad', 'folders', 'compass', 'target',
  'wrench', 'rocket', 'puzzle-piece', 'binoculars', 'brain', 'push-pin', 'bookmark-simple', 'map-trifold'
];

export function pickCustomRoadmapIcon(id) {
  let hash = 0;
  const str = String(id ?? '');
  for (let i = 0; i < str.length; i++) {
    hash = (hash * 31 + str.charCodeAt(i)) | 0;
  }
  const index = Math.abs(hash) % CUSTOM_ROADMAP_ICONS.length;
  return CUSTOM_ROADMAP_ICONS[index];
}
