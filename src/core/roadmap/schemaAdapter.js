// Converts a validated import payload (see importValidator.js) into the
// { phases, items } shape roadmapStore.createCustomRoadmap expects (issue
// #4). Pure — no DOM, no store, no Firebase — so a future schemaVersion bump
// means adding a new adapter function here, never touching the validator or
// the store. Only ever called on data that has already passed
// validateImportPayload(); it does not re-validate title/priority/resource
// *shape* (that already happened), but resource *URLs* are specifically
// normalized/filtered here — see normalizeResourceUrl()/isHttpUrl() below.
import { normalizePriority } from './importValidator.js';

function genId(prefix) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

// Same http(s)-only check as src/ui/dom.js's isValidUrl() — duplicated
// rather than imported since this module stays DOM/store/Firebase-free (see
// the file-level doc comment); both are tiny and unlikely to drift.
function isHttpUrl(value = '') {
  try {
    const url = new URL(value);
    return url.protocol === 'http:' || url.protocol === 'https:';
  } catch {
    return false;
  }
}

// AI-generated resource URLs very commonly omit the "https://" scheme
// entirely (e.g. "docs.docker.com" or "www.youtube.com/watch?v=..."), which
// otherwise reads as a plain relative path rather than a real link. If the
// value looks like a bare domain (letters/digits/hyphens/dots, optionally
// followed by a path/query/fragment, no scheme or colon anywhere), prepend
// "https://" before the final isHttpUrl() check — never for a string that
// already contains a colon (so a genuine "javascript:"/"mailto:" scheme is
// left untouched and still correctly rejected below, never silently
// upgraded to https).
const BARE_DOMAIN_RE = /^[a-z0-9-]+(\.[a-z0-9-]+)+(?:[/?#].*)?$/i;
function normalizeResourceUrl(rawUrl) {
  const trimmed = (rawUrl || '').trim();
  if (!trimmed) return '';
  if (BARE_DOMAIN_RE.test(trimmed)) return `https://${trimmed}`;
  return trimmed;
}

// A resource whose URL still isn't a valid http(s) link after normalization
// is silently dropped rather than failing the whole item — see
// importValidator.js's isValidResourceEntry() doc comment for why URL
// correctness moved from "reject the topic" (validation time) to "drop just
// this link" (here, conversion time). Still enforces the same
// "Resource URLs must be validated before use" rule (roadmap-store.md) — a
// bad/dangerous URL never reaches the store, it just doesn't reach it as
// silently-broken data attached to an otherwise-good topic either.
function sanitizeResources(rawResources) {
  return (rawResources || [])
    .map(r => ({ label: r.label.trim(), url: normalizeResourceUrl(r.url) }))
    .filter(r => isHttpUrl(r.url));
}

// Normalizes any of the three item shapes validateImportPayload() accepts
// (plain string / [title, priority] tuple / { title, priority?, resources? }
// object, issue #100) into { title, priority, resources }.
function normalizeItem(rawItem, phasePriority) {
  if (typeof rawItem === 'string') {
    return { title: rawItem, priority: normalizePriority(phasePriority), resources: [] };
  }
  if (Array.isArray(rawItem)) {
    const [title, priority] = rawItem;
    return { title, priority: normalizePriority(priority), resources: [] };
  }
  return {
    title: rawItem.title,
    priority: normalizePriority(rawItem.priority) || normalizePriority(phasePriority),
    resources: sanitizeResources(rawItem.resources)
  };
}

export function adaptImportToRoadmap(data) {
  const phases = [];
  const items = {};

  data.phases.forEach(phase => {
    const sections = [];
    const phasePriority = normalizePriority(phase.priority);
    phase.sections.forEach(section => {
      section.items.forEach(rawItem => {
        const { title, priority, resources } = normalizeItem(rawItem, phasePriority);
        const id = genId('custom');
        items[id] = {
          id,
          title: title.trim(),
          phase: phase.title,
          section: section.title,
          priority,
          done: false,
          custom: true,
          deleted: false,
          resources,
          createdAt: Date.now()
        };
      });
      sections.push({ id: genId('section'), title: section.title });
    });
    phases.push({ id: genId('phase'), title: phase.title, priority: phasePriority, resourceKey: null, sections });
  });

  return { phases, items };
}
