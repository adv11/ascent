// Issue #12B Phase 1 — pure, dependency-free link-type detection for the
// resource panel card UI. No DOM, no imports: detectLinkType() must be
// unit-testable without a browser environment.

const LINK_TYPES = [
  { type: 'youtube', test: url => /(^|\.)youtube\.com$/.test(url.hostname) && url.pathname.startsWith('/watch') || /(^|\.)youtu\.be$/.test(url.hostname) },
  { type: 'github', test: url => /(^|\.)github\.com$/.test(url.hostname) },
  { type: 'notion', test: url => /(^|\.)notion\.so$/.test(url.hostname) || /(^|\.)notion\.site$/.test(url.hostname) },
  { type: 'google-doc', test: url => /(^|\.)docs\.google\.com$/.test(url.hostname) && url.pathname.startsWith('/document') },
  { type: 'google-drive', test: url => /(^|\.)drive\.google\.com$/.test(url.hostname) },
  { type: 'medium', test: url => /(^|\.)medium\.com$/.test(url.hostname) },
  { type: 'stackoverflow', test: url => /(^|\.)stackoverflow\.com$/.test(url.hostname) }
];

// `icon` was a raw emoji glyph before issue #136 Phase 2 — now a
// decorativeIcon.js icon name (src/ui/components/decorativeIcon.js), still a
// plain string so this module stays DOM/import-free per the header comment
// above. Every key here is also a decorativeIcon.js key.
export const LINK_TYPE_META = {
  youtube: { label: 'YouTube', icon: 'youtube', badgeClass: 'link-badge-youtube' },
  github: { label: 'GitHub', icon: 'github', badgeClass: 'link-badge-github' },
  notion: { label: 'Notion', icon: 'notion', badgeClass: 'link-badge-notion' },
  'google-doc': { label: 'Doc', icon: 'google-doc', badgeClass: 'link-badge-google-doc' },
  'google-drive': { label: 'Drive', icon: 'google-drive', badgeClass: 'link-badge-google-drive' },
  medium: { label: 'Medium', icon: 'medium', badgeClass: 'link-badge-medium' },
  stackoverflow: { label: 'Stack Overflow', icon: 'stackoverflow', badgeClass: 'link-badge-stackoverflow' },
  article: { label: 'Article', icon: 'article', badgeClass: 'link-badge-article' }
};

/**
 * Detects the resource link type from a URL's hostname/path. Returns one of
 * LINK_TYPE_META's keys, always falling back to 'article' for any parseable
 * http/https URL and for anything that isn't a URL at all.
 */
export function detectLinkType(rawUrl) {
  let url;
  try {
    url = new URL(String(rawUrl ?? ''));
  } catch {
    return 'article';
  }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') return 'article';
  const match = LINK_TYPES.find(({ test }) => test(url));
  return match ? match.type : 'article';
}
