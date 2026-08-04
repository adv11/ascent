import { el } from '../dom.js';
import { createIcon } from './icons.js';

// Issue #484 — replaces the hamburger-drawer mobile nav with a fixed bottom
// tab bar, reachable one-handed and requiring no discovery. Rendered only
// below the sidebar's >=900px breakpoint (app.css); the >=900px sidebar is
// unchanged and still the only nav shown there.
const NAV_ITEMS = [
  { route: '/app', label: 'My roadmap', icon: 'dashboard' },
  { route: '/progress', label: 'Progress', icon: 'progress' },
  { route: '/onboarding', label: 'Browse', icon: 'roadmaps' },
  { route: '/settings', label: 'Settings', icon: 'settings' }
];

export function createBottomNav({ activeRoute }) {
  const node = el('nav', { className: 'bottom-nav', 'aria-label': 'Primary' },
    NAV_ITEMS.map(item => el('a', {
      href: `#${item.route}`,
      className: `bottom-nav-item${activeRoute === item.route ? ' active' : ''}`,
      'aria-current': activeRoute === item.route ? 'page' : null
    }, [
      el('span', { className: 'bottom-nav-item-icon' }, [createIcon(item.icon, { size: 'sm' })]),
      el('span', { className: 'bottom-nav-item-label', text: item.label })
    ]))
  );

  node._cleanup = () => {};
  return node;
}
