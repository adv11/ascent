import { el } from '../dom.js';
import { shouldShowFeatureBadge, dismissFeatureBadge } from '../../services/featureBadgeSeen.js';

// "New" pill for a feature introduced by a specific changelog entry (issue
// #20 Phase C) — e.g. the Settings "Install Ascent" row after a user has
// opened the What's New drawer and seen the entry that introduced it.
// Returns `null` when the badge isn't eligible (never seen the introducing
// entry, already dismissed, or past the 7-day window) so call sites can do
// `createFeatureBadge('x')` straight into an `el()` children array with the
// existing `.filter(Boolean)` convention.
export function createFeatureBadge(featureKey) {
  if (!shouldShowFeatureBadge(featureKey)) return null;
  return el('span', { className: 'feature-new-badge', text: 'New' });
}

// Call from the feature's own interaction handler (e.g. a button's onClick)
// to permanently dismiss its badge, per the issue's "auto-dismisses after
// the user interacts with the feature" rule.
export { dismissFeatureBadge };
