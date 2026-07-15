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

export function isValidResource(resource) {
  return !!resource
    && typeof resource.label === 'string' && resource.label.length <= MAX_RESOURCE_LABEL_LENGTH
    && typeof resource.url === 'string' && resource.url.length <= MAX_RESOURCE_URL_LENGTH;
}
