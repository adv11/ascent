import changelogData from './changelog.json' with { type: 'json' };
import { getUnseenEntries, hasUnseenEntries } from '../core/changelog/version.js';

// Parallel to ROADMAP_VERSION (src/data/templates/java-backend.js) — bump
// this, and append a matching entry to changelog.json, every time a
// user-visible change ships that's worth announcing in the "What's New"
// drawer. See CLAUDE.md's changelog.json schema note for the required
// entry shape.
export const APP_VERSION = Math.max(...changelogData.map(entry => entry.version));

export const CHANGELOG = changelogData;

export function getUnseenChangelogEntries(lastSeen) {
  return getUnseenEntries(CHANGELOG, lastSeen);
}

export function hasUnseenChangelog(lastSeen) {
  return hasUnseenEntries(CHANGELOG, lastSeen);
}
