// Single source of truth for the app-wide developer/creator profile page
// (issue #414) — one owner-authored profile, not a per-user record. Same
// "one file, one edit, no rebuild" convention as changelog.js/changelog.json.
// `avatarUrl` is deliberately omitted — no photo-upload layer exists (or is
// planned) for this, so the page falls back to initials derived from `name`,
// the same convention avatar.js already uses for a user with no photo.
// Every `links[].url` still passes through isValidUrl() at render time (root
// CLAUDE.md's URL-validation rule) even though this file is static and
// owner-controlled — no special-cased trust path for this data source.
export const DEVELOPER_PROFILE = {
  name: 'Akash Deep Vishwakarma',
  tagline: 'Full stack developer — Java, Spring Boot, and GenAI',
  bio: 'Akash builds scalable, event-driven backend systems with Java, Spring Boot, and Kafka. He focuses on system design and clean, production-ready code, and is currently exploring generative AI to bring intelligent features into backend systems.',
  links: [
    { id: 'github', label: 'GitHub', url: 'https://github.com/adv11', icon: 'github' },
    { id: 'linkedin', label: 'LinkedIn', url: 'https://linkedin.com/in/adv11', icon: 'linkedin' },
    { id: 'x', label: 'X (Twitter)', url: 'https://twitter.com/adv2612', icon: 'x' },
    { id: 'portfolio', label: 'Portfolio', url: 'https://adv-woad.vercel.app/', icon: 'globe' },
    { id: 'email', label: 'Email', url: 'mailto:codesmartly2020@gmail.com', icon: 'mail' }
  ]
};
