// Pure version-comparison helpers for the in-app changelog (issue #20).
// Versions are plain integers (matching ROADMAP_VERSION's convention in
// src/data/templates/java-backend.js) rather than semver, since the
// changelog only ever needs to answer "is there anything newer than what
// this device has already seen" — an incrementing integer is enough.

const VALID_ENTRY_TYPES = new Set(['feat', 'fix', 'improvement']);

// `lastSeen` is `null`/`undefined` for a device that has never seen any
// changelog entry (fresh install, or pre-#20 account) — treated as older
// than every real version so the badge shows on first load after upgrade.
export function isNewerVersion(version, lastSeen) {
  if (lastSeen == null) return true;
  return version > lastSeen;
}

// Newest-first, matching the drawer's own display order.
export function getUnseenEntries(changelog, lastSeen) {
  return changelog
    .filter(entry => isNewerVersion(entry.version, lastSeen))
    .sort((a, b) => b.version - a.version);
}

export function hasUnseenEntries(changelog, lastSeen) {
  return changelog.some(entry => isNewerVersion(entry.version, lastSeen));
}

// Validates changelog.json's shape — every required field present, every
// item's `type` one of the taxonomy values. Returns an array of error
// strings, empty meaning valid (same convention as importValidator.js).
export function validateChangelog(changelog) {
  const errors = [];
  if (!Array.isArray(changelog)) return ['changelog must be an array'];
  changelog.forEach((entry, i) => {
    if (typeof entry.version !== 'number') errors.push(`entries[${i}].version must be a number`);
    if (typeof entry.date !== 'string' || !entry.date) errors.push(`entries[${i}].date is required`);
    if (!Array.isArray(entry.items) || !entry.items.length) errors.push(`entries[${i}].items must be a non-empty array`);
    (entry.items || []).forEach((item, j) => {
      if (!VALID_ENTRY_TYPES.has(item.type)) errors.push(`entries[${i}].items[${j}].type must be one of feat|fix|improvement`);
      if (typeof item.title !== 'string' || !item.title) errors.push(`entries[${i}].items[${j}].title is required`);
      if (typeof item.description !== 'string' || !item.description) errors.push(`entries[${i}].items[${j}].description is required`);
      // Optional — Phase C (issue #20) "New" feature badges. Only checked
      // when present; most items have no linked UI element to badge.
      if ('featureKey' in item && (typeof item.featureKey !== 'string' || !item.featureKey)) {
        errors.push(`entries[${i}].items[${j}].featureKey must be a non-empty string when present`);
      }
    });
  });
  return errors;
}
