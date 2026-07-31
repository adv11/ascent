// Single source of truth for the app-wide developer/creator profile page
// (issue #414) — one owner-authored profile, not a per-user record. Same
// "one file, one edit, no rebuild" convention as changelog.js/changelog.json.
// `avatarUrl` points at the same headshot used on the source portfolio
// (adv-woad.vercel.app), served locally from public/developer-avatar.webp
// at the /public/ URL prefix every other public/** asset in this app uses
// (index.html's favicon/manifest/og-image links, same convention) — same-
// origin, no CSP img-src change needed — rather than hotlinked. A
// hotlinked cross-origin image would be a silent breakage risk if that
// external site's asset path ever changes, and index.html's CSP only
// allows 'self'/data: for img-src anyway. developerProfile.js's
// initialsFromName() fallback avatar is still used if this is ever unset
// (no photo-upload layer exists or is planned for this static page).
// Every `links[].url` still passes through isValidUrl() at render time (root
// CLAUDE.md's URL-validation rule) even though this file is static and
// owner-controlled — no special-cased trust path for this data source.
export const DEVELOPER_PROFILE = {
  name: 'Akash Deep Vishwakarma',
  tagline: 'Full stack developer — Java, Spring Boot, and GenAI',
  bio: 'Akash builds scalable, event-driven backend systems with Java, Spring Boot, and Kafka. He focuses on system design and clean, production-ready code, and is currently exploring generative AI to bring intelligent features into backend systems.',
  // `?v=1` follows the same cache-busting convention public/**'s other
  // immutable-cached assets use (icons.js's `?v=N`, issue #402/#403/#435) —
  // bump this if the photo file itself is ever replaced.
  avatarUrl: '/public/developer-avatar.webp?v=1',
  links: [
    { id: 'github', label: 'GitHub', url: 'https://github.com/adv11', icon: 'github' },
    { id: 'linkedin', label: 'LinkedIn', url: 'https://linkedin.com/in/adv11', icon: 'linkedin' },
    { id: 'x', label: 'X (Twitter)', url: 'https://twitter.com/adv2612', icon: 'x' },
    { id: 'leetcode', label: 'LeetCode', url: 'https://leetcode.com/u/adv01/', icon: 'leetcode' },
    { id: 'portfolio', label: 'Portfolio', url: 'https://adv-woad.vercel.app/', icon: 'globe' },
    { id: 'email', label: 'Email', url: 'mailto:adv1491714@gmail.com', icon: 'mail' }
  ]
};
