import { el } from '../dom.js';
import { createIcon } from './icons.js';
import { navigate, getRoute } from '../router.js';
import { openCommandPalette, bindCommandPaletteShortcut } from './commandPalette.js';
import { searchTopicsAcrossRoadmaps } from '../../core/roadmap/globalTopicSearch.js';
import { KEYS } from '../../services/localStorageKeys.js';

// Issue #125 — the app-wide navigation items the command palette searches.
function navigationItems() {
  return [
    { id: 'nav-app', title: 'Dashboard', subtitle: 'Your active roadmap', onSelect: () => navigate('/app') },
    { id: 'nav-onboarding', title: 'All roadmaps', subtitle: 'Switch or start a roadmap', onSelect: () => navigate('/onboarding') },
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

// Issue #6 Phase 2.2. Kept deliberately thin — identity/sign-out/delete-account
// already live in the sidebar footer (createSidebar), so this doesn't duplicate
// an avatar or dropdown. The hamburger button is CSS-hidden above the mobile
// breakpoint (app.css); `onToggleMobileSidebar` wires it to the sidebar's own
// `_toggleMobile()`.
export function createTopbar({ breadcrumb, user, store, syncPill, themeToggleBtn, dailyTodoNavBadge, reviewDueBadge, notificationBell, onToggleMobileSidebar }) {
  const hamburger = el('button', {
    type: 'button',
    className: 'app-topbar-hamburger',
    'aria-label': 'Open navigation',
    onClick: onToggleMobileSidebar
  }, [createIcon('menu', { size: 'sm' })]);

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

  // issue #155 (ZeBeyond direction) — the three icon-only actions (search,
  // notifications, theme) grouped in a bordered pill container, matching the
  // reference's icon-button cluster. Grouping only, not a reimplementation —
  // each button keeps its own existing markup/behavior.
  const iconGroup = el('div', { className: 'icon-btn-group' }, [
    commandPaletteBtn,
    notificationBell,
    themeToggleBtn
  ]);

  // Issue #463 — real, reported clutter on narrow viewports: with everything
  // in one `flex-wrap` container, the review/todo badges, sync-pill, "Create
  // account" button, and icon group wrapped wherever they happened to run
  // out of row width, producing up to three uncontrolled, visually
  // unrelated-looking rows (hamburger alone, then a status-badge row, then
  // the icon row) before any real page content appeared. `.app-topbar-status`
  // groups the account/sync-status controls (review-due, daily-todo, sync
  // state, "Create account") into one flex child specifically so a narrow
  // viewport can wrap *that whole group* onto its own single second row —
  // see the `≤1023px` rule in app.css — instead of each control wrapping
  // independently wherever it happens to run out of space. `iconGroup` stays
  // a sibling, not a member of this group, since it belongs on the primary
  // row (with the hamburger/breadcrumb) at every width, not the status row.
  const statusGroup = el('div', { className: 'app-topbar-status' }, [
    reviewDueBadge,
    dailyTodoNavBadge,
    syncPill,
    user.isAnonymous ? el('a', { href: '#/signup', className: 'btn btn-secondary btn-sm', text: 'Create account' }) : null
  ].filter(Boolean));

  // `statusGroup`/`iconGroup` are direct `.app-topbar` children (not nested
  // in a shared wrapper) specifically so the `≤1023px` CSS can re-`order`
  // `iconGroup` onto the primary row with `hamburger`/`breadcrumbEl` while
  // `statusGroup` wraps to its own row below — see app.css's own comment on
  // that rule for why a nested wrapper can't express that split.
  const node = el('header', { className: 'app-topbar' }, [
    hamburger,
    breadcrumbEl,
    statusGroup,
    iconGroup
  ]);

  node._cleanup = bindCommandPaletteShortcut(openPalette);
  return node;
}
