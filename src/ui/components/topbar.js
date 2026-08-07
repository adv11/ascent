import { el } from '../dom.js';
import { createIcon } from './icons.js';
import { navigate, getRoute } from '../router.js';
import { openCommandPalette, bindCommandPaletteShortcut } from './commandPalette.js';
import { searchTopicsAcrossRoadmaps } from '../../core/roadmap/globalTopicSearch.js';
import { KEYS } from '../../services/localStorageKeys.js';
import { createAvatar } from './avatar.js';
import { buildAccountMenu } from './sidebar.js';
import { createNotificationBell } from './notificationBell.js';

// Issue #125 — the app-wide navigation items the command palette searches.
function navigationItems() {
  return [
    { id: 'nav-app', title: 'Dashboard', subtitle: 'Your active roadmap', onSelect: () => navigate('/app') },
    { id: 'nav-onboarding', title: 'Your roadmaps', subtitle: 'Switch or start a roadmap', onSelect: () => navigate('/onboarding') },
    { id: 'nav-progress', title: 'Progress', subtitle: 'Streaks, heatmap, and stats', onSelect: () => navigate('/progress') },
    { id: 'nav-settings', title: 'Settings', subtitle: 'Account and preferences', onSelect: () => navigate('/settings') }
  ];
}

// Issue #283 — turns a pure globalTopicSearch.js match into a command-palette row
// with a real onSelect: switch to the match's roadmap (a no-op in roadmapStore.js
// if it's already active), write the one-shot cross-page "open this item" signal
// (dashboard.js's applyOpenItemSignal(), KEYS.OPEN_ITEM), then either navigate to
// /app (a different page was open) or dispatch the same-page 'ascent:open-item'
// event dashboard.js also listens for (already on /app — a same-roadmap switch is a
// no-op that never triggers a store notify/re-render on its own, so this is the
// only way that case gets picked up without a real navigation).
// Issue #380 — when the only reason a result matched was its notes text (not the
// title itself), the plain "roadmap · phase" subtitle gives no clue why it showed
// up. Appending the matched snippet lets a user tell at a glance, same as a search
// engine's highlighted excerpt.
function buildResultSubtitle(match) {
  const base = `${match.roadmapTitle} · ${match.phase}`;
  if (match.matchedFields.includes('title') || !match.noteSnippet) return base;
  return `${base} — "${match.noteSnippet}"`;
}

function buildTopicResultItem(match, store) {
  return {
    id: `topic-${match.roadmapId}-${match.itemId}`,
    title: match.itemTitle,
    subtitle: buildResultSubtitle(match),
    onSelect: async () => {
      const { activeTemplateId } = store.getSnapshot();
      if (match.roadmapId !== activeTemplateId) {
        await store.switchRoadmap(match.roadmapId);
      }
      sessionStorage.setItem(KEYS.OPEN_ITEM, JSON.stringify({ itemId: match.itemId }));
      if (getRoute() === '/app') {
        window.dispatchEvent(new CustomEvent('ascent:open-item'));
      } else {
        navigate('/app');
      }
    }
  };
}

// Issue #6 Phase 2.2, rebuilt clean in issue #488 once #484 removed the
// hamburger/mobile-drawer toggle: page title, search, one avatar button —
// no more review-due badge, daily-todo badge, sync pill, "Create account",
// or a separate bell/theme icon crowding this row (the `.app-topbar-status`
// wrap-order workaround from #463 is retired along with them). The avatar's
// own dropdown reuses `buildAccountMenu()` (`sidebar.js`) — below 900px the
// sidebar footer isn't rendered at all (bottomNav.js is the nav instead), so
// this is the only remaining account-menu entry point at that width; at
// >=900px it's a second, redundant-but-harmless way to reach the same menu
// the sidebar footer already offers.
export function createTopbar({ breadcrumb, user, store, dailyTodoStore, onDeleteAccount, onStartTour }) {
  const breadcrumbEl = el('div', { className: 'app-topbar-breadcrumb', text: breadcrumb });

  // Issue #283 — global topic search, layered on top of the existing nav-item
  // search once `store` is available (every real page passes it; kept optional so
  // a hypothetical future caller with no roadmap store still gets plain nav search
  // rather than a hard crash). Only kicks in once the query is 2+ characters —
  // below that, every roadmap's every topic would match, which is noise, not search.
  const crossRoadmapSearch = store ? {
    minQueryLength: 2,
    async search(query) {
      const roadmaps = await store.getAllRoadmapsForSearch();
      return searchTopicsAcrossRoadmaps(roadmaps, query).map(match => buildTopicResultItem(match, store));
    }
  } : undefined;

  function openPalette() {
    openCommandPalette(navigationItems(), { placeholder: 'Search pages or topics…', crossRoadmapSearch });
  }

  const commandPaletteBtn = el('button', {
    type: 'button',
    className: 'app-topbar-command-btn',
    'aria-label': 'Search (Ctrl+K)',
    onClick: openPalette
  }, [createIcon('search', { size: 'sm' })]);

  // Issue #503 (E3) — the bell is its own dot-badged icon button beside the
  // avatar, per the responsive-redesign design reference. notificationBell.js
  // owns its own unread-dot state and "What's New" trigger; the avatar no
  // longer carries a folded-in dot (see that file's comment for the #488
  // interim history this supersedes).
  const notificationBell = createNotificationBell();

  const userLabel = user.isAnonymous ? 'Guest session' : (user.displayName || user.email || 'Signed in');
  const avatarTrigger = el('button', {
    type: 'button',
    className: 'app-topbar-avatar-btn',
    'aria-label': `Account menu — ${userLabel}`
  }, [createAvatar(user, 'sm')]);

  const { identity: avatarMenu, importInput } = buildAccountMenu({
    user,
    store,
    dailyTodoStore,
    identityTrigger: avatarTrigger,
    onDeleteAccount,
    onStartTour,
    align: 'end'
  });

  // issue #155 (ZeBeyond direction) — search + the bell + the avatar trigger
  // grouped in a bordered pill container, matching the reference's
  // icon-button cluster. Grouping only, not a reimplementation of any
  // control.
  const iconGroup = el('div', { className: 'icon-btn-group' }, [
    commandPaletteBtn,
    notificationBell,
    avatarMenu
  ]);

  const node = el('header', { className: 'app-topbar' }, [
    breadcrumbEl,
    iconGroup,
    importInput
  ]);

  const unbindShortcut = bindCommandPaletteShortcut(openPalette);
  node._cleanup = () => {
    unbindShortcut();
    avatarMenu._cleanup?.();
  };
  return node;
}
