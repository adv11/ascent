import { el } from '../dom.js';
import { createBrandMark } from '../components/brand.js';
import { createIcon } from '../components/icons.js';
import { DEVELOPER_PROFILE } from '../../data/developerProfile.js';

// isValidUrl() (dom.js) only allows http:/https: — correct for every other
// resource-URL call site in the app (roadmap-store.md's "Resource URLs must
// be validated" rule), but too narrow for this page's one legitimate
// mailto: link. This is the same protocol-allowlist discipline, just with
// mailto: added to the allowed set — never widen isValidUrl() itself for
// this one call site, since every other caller depends on it staying
// http/https-only.
function isValidProfileLinkUrl(value = '') {
  try {
    const url = new URL(value);
    return url.protocol === 'http:' || url.protocol === 'https:' || url.protocol === 'mailto:';
  } catch {
    return false;
  }
}

// No photo-upload layer exists for this static, owner-authored profile (see
// developerProfile.js's own comment) — same initials-from-name fallback
// avatar.js already uses for a user with no photo.
function initialsFromName(name = '') {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return '?';
}

// Points at '#/', not history.back() — '/' already redirects a signed-in
// visitor straight to '/app' (main.js's own registerRoute('/', ...)), so this
// single target is correct whether this page was reached signed in or signed
// out, and doesn't depend on there being any browser history to go back to
// (e.g. a bookmarked or directly-shared '#/creator' link).
function buildBackLink() {
  return el('a', { className: 'developer-profile-back', href: '#/' }, [
    createIcon('collapse', { size: 'sm' }),
    'Back'
  ]);
}

function buildHeader() {
  return el('header', { className: 'landing-nav' }, [
    el('div', { className: 'landing-nav-inner' }, [
      el('a', { className: 'brand', href: '#/', 'aria-label': 'Home' }, createBrandMark()),
      buildBackLink()
    ])
  ]);
}

// avatarUrl is a hardcoded local asset path in developerProfile.js (this
// page's own static data file, not something sourced from Firebase/
// localStorage), so it's exempt from isValidUrl()'s http/https-only check —
// that check exists for store-sourced URLs (root CLAUDE.md), and a
// same-origin relative path like '/developer-avatar.webp' isn't even a valid
// absolute URL for `new URL()` to parse without a base.
function buildAvatar(profile) {
  if (profile.avatarUrl) {
    return el('img', {
      className: 'developer-profile-avatar developer-profile-avatar-photo',
      src: profile.avatarUrl,
      alt: profile.name,
      width: '96',
      height: '96'
    });
  }
  return el('div', { className: 'developer-profile-avatar', 'aria-hidden': 'true', text: initialsFromName(profile.name) });
}

function buildHero(profile) {
  return el('section', { className: 'developer-profile-hero' }, [
    buildAvatar(profile),
    el('p', { className: 'eyebrow developer-profile-eyebrow' }, [
      el('span', { className: 'eyebrow-dot', 'aria-hidden': 'true' }),
      'About the developer'
    ]),
    el('h1', { className: 'developer-profile-name', text: profile.name }),
    el('p', { className: 'developer-profile-tagline', text: profile.tagline }),
    el('p', { className: 'developer-profile-bio', text: profile.bio })
  ]);
}

function buildLinkCard(link) {
  if (!isValidProfileLinkUrl(link.url)) return null;
  return el('a', {
    className: 'card developer-profile-link-card',
    href: link.url,
    target: '_blank',
    rel: 'noopener noreferrer'
  }, [
    el('span', { className: 'icon-tile', 'aria-hidden': 'true' }, [createIcon(link.icon, { size: 'md' })]),
    el('span', { className: 'developer-profile-link-label', text: link.label })
  ]);
}

function buildLinks(profile) {
  const cards = profile.links.map(buildLinkCard).filter(Boolean);
  return el('section', { className: 'developer-profile-links', 'aria-label': 'Connect' }, cards);
}

// Copyright line follows landing.js's buildFooter() precedent — no
// hardcoded brand-name string outside brand.js/index.html (root CLAUDE.md).
function buildFooter() {
  return el('footer', { className: 'landing-footer' }, [
    el('span', { className: 'brand' }, createBrandMark()),
    el('p', { className: 'landing-footer-copy', text: `© ${new Date().getFullYear()} · Engineer your next move.` })
  ]);
}

// Public, owner-authored developer/creator profile (issue #414) — reachable
// signed in or signed out, at '#/creator'. main.js registers this route
// outside guardApp entirely (same treatment as renderLanding/
// renderSharedRoadmapView), since it renders static, owner-controlled
// content, never the current user's own data.
export function renderDeveloperProfile(app) {
  const node = el('div', { className: 'landing-page developer-profile-page fade-in' }, [
    buildHeader(),
    el('main', { id: 'main-content', tabindex: '-1' }, [
      buildHero(DEVELOPER_PROFILE),
      buildLinks(DEVELOPER_PROFILE)
    ]),
    buildFooter()
  ]);
  app.replaceChildren(node);
}
