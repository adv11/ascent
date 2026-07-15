// Client-side length/count caps (issue #53) — the client-side half of issue
// #24's server-side Firebase rules: the server rule rejects an oversized
// write, these give a friendly error before the write is even attempted.
// Kept in their own dependency-free module (rather than living directly in
// roadmapStore.js) so UI components like itemPanel.js can import just the
// constants without pulling in roadmapStore.js's Firebase-backed storage
// adapter chain.
export const MAX_TITLE_LENGTH = 200;
export const MAX_RESOURCE_LABEL_LENGTH = 120;
export const MAX_RESOURCE_URL_LENGTH = 2048;
// Issue #177 — at most this many roadmaps (built-in or custom, no
// distinction) may be favorited at once. Lives here (not roadmapStore.js)
// for the same reason as the constants above: onboarding.js's favorite-star
// UI needs just this number without pulling in roadmapStore.js's
// Firebase-backed storage adapter chain.
export const MAX_FAVORITE_ROADMAPS = 3;
// Issue #182 — freeform pattern/concept tags on an item, used to group
// spaced-repetition review reminders by shared tag instead of one item at a
// time. Caps mirror the resource label cap's reasoning: short enough to stay
// a scannable chip, capped in count so the tag row never grows unbounded.
export const MAX_TAG_LENGTH = 30;
export const MAX_TAGS_PER_ITEM = 5;

// Issue #122 — server-side rules cap a custom roadmap's title/description at
// these same lengths (firebase/database.rules.json's meta.customRoadmaps
// rule); createCustomRoadmap() clamps to them here so a write can never
// exceed what the rule allows. MAX_CUSTOM_ROADMAP_TITLE_LENGTH matches
// MAX_TITLE_LENGTH deliberately (a roadmap's own title has no reason to
// allow more than a single topic's title does), not re-declared as a
// separate identical constant.
export const MAX_CUSTOM_ROADMAP_TITLE_LENGTH = MAX_TITLE_LENGTH;
export const MAX_CUSTOM_ROADMAP_DESCRIPTION_LENGTH = 1000;

export function isValidResource(resource) {
  return !!resource
    && typeof resource.label === 'string' && resource.label.length <= MAX_RESOURCE_LABEL_LENGTH
    && typeof resource.url === 'string' && resource.url.length <= MAX_RESOURCE_URL_LENGTH;
}

export function isValidTags(tags) {
  return Array.isArray(tags)
    && tags.length <= MAX_TAGS_PER_ITEM
    && tags.every(tag => typeof tag === 'string' && tag.length > 0 && tag.length <= MAX_TAG_LENGTH);
}
