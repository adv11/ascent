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

// Phase C (issue #20) "New" feature badges — finds the version of the
// changelog entry whose item carries this featureKey, or null if no shipped
// item references it. Not every changelog item has a UI element worth
// badging, so this is deliberately opt-in per item (see changelog.json's
// optional `featureKey` field), not derived from every entry automatically.
export function getFeatureIntroducedVersion(featureKey) {
  for (const entry of CHANGELOG) {
    if (entry.items.some(item => item.featureKey === featureKey)) return entry.version;
  }
  return null;
}
