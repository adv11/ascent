import { el, debounce, isValidUrl } from '../dom.js';
import { navigate } from '../router.js';
import { openItemPanel } from '../components/itemPanel.js';
import { showToast } from '../components/toast.js';
import { createThemeToggle } from '../components/themeToggle.js';
import { createChangelogBell } from '../components/notificationBell.js';
import { createVerificationBanner } from '../components/verificationBanner.js';
import { createBackupReminderBanner } from '../components/backupReminderBanner.js';
import { maybeShowGuestDataRiskNudge } from '../components/guestDataRiskNudge.js';
import { confirmDialog } from '../components/confirmDialog.js';
import { openDeleteAccountModal } from '../components/deleteAccountModal.js';
import { readDefaultFilterPreference } from '../utils/defaultFilterPreference.js';
import { createSidebar } from '../components/sidebar.js';
import { createTopbar } from '../components/topbar.js';
import { getTemplate } from '../../data/templates/index.js';
import { MAX_TITLE_LENGTH } from '../../core/roadmap/limits.js';
import { isExpired, remainingMs, formatRemaining, remainingBand } from '../utils/dailyTodo.js';
import { openAddToDailyTodoModal } from '../components/addToDailyTodoModal.js';
import { MAX_ACTIVE_TODOS } from '../../core/dailyTodo/limits.js';
import { createProgressRing } from '../components/progressRing.js';
import { animateCountUp } from '../../utils/countUp.js';
import { detectLinkType, LINK_TYPE_META } from '../utils/linkDetector.js';
import { attachTooltip } from '../components/tooltip.js';
import { createIcon } from '../components/icons.js';
import { createEmptyState } from '../components/emptyState.js';
import { createDecorativeIcon } from '../components/decorativeIcon.js';
import { KEYS } from '../../services/localStorageKeys.js';
import { isReviewDue, getReviewDueItems, groupReviewDueItemsByTag } from '../../core/roadmap/reviewSchedule.js';
import { isRoadmapComplete, getCompletedPhaseTitles } from '../../core/roadmap/completionCelebration.js';
import { hasShownRoadmapCelebration, hasShownPhaseCelebration, markRoadmapCelebrationShown, markPhaseCelebrationShown } from '../../services/celebrationShownStore.js';
import { triggerConfetti } from '../components/confetti.js';
import { openBadgeShareModal } from '../components/shareModal.js';
import { startTour } from '../components/featureTour.js';

// Issue #12B Phase 3 — resource-count badge type breakdown. Ordered so the
// "most valuable" type (a video worth watching over a plain article, etc.)
// wins the inline icon when a topic has resources of more than one type.
const RESOURCE_TYPE_PRIORITY = ['youtube', 'github', 'notion', 'google-doc', 'google-drive', 'medium', 'stackoverflow', 'article'];
const RESOURCE_TYPE_NOUN = {
  youtube: 'video', github: 'repo', notion: 'page', 'google-doc': 'doc',
  'google-drive': 'file', medium: 'article', stackoverflow: 'answer', article: 'link'
};

// Issue #100 follow-up — real feedback: with AI-generated roadmaps now
// commonly carrying resource links, there was no way to see them "in one
// go" without opening each topic's edit panel individually. When the
// Resources filter chip is active, renderItemRow() appends this expanded,
// always-visible list of clickable links (in addition to, not instead of,
// the collapsed count badge above, which still opens the full edit panel).
// `isValidUrl()`-guards each href the same way itemPanel.js already does
// for every other resource link render (roadmap-store.md's "Resource URLs
// must be validated before use as href").
function renderInlineResources(item) {
  if (!item.resources?.length) return null;
  return el('div', { className: 'check-resources-inline' }, item.resources.map(r => {
    const type = detectLinkType(r.url);
    const meta = LINK_TYPE_META[type];
    return el('a', {
      className: `link-badge resource-inline-link ${meta.badgeClass}`,
      href: isValidUrl(r.url) ? r.url : '#',
      target: '_blank',
      rel: 'noopener noreferrer',
      'data-action': 'open-resource',
      onClick: e => { e.stopPropagation(); if (!isValidUrl(r.url)) e.preventDefault(); }
    }, [
      el('span', { className: 'link-badge-icon', 'aria-hidden': 'true' }, [createDecorativeIcon(meta.icon, { size: 'xs' })]),
      r.label
    ]);
  }));
}

function buildResourceCountBadge(item, onOpen) {
  const { primaryIcon, breakdown } = summarizeResourceTypes(item.resources);
  const badge = el('button', {
    type: 'button',
    className: 'resource-count',
    'data-action': 'resources',
    'aria-label': `View resources for ${item.title}`,
    onClick: e => { e.stopPropagation(); onOpen(); }
  }, [
    el('span', { className: 'link-badge-icon', 'aria-hidden': 'true' }, [createDecorativeIcon(primaryIcon, { size: 'xs' })]),
    el('span', { text: `${item.resources.length} resource${item.resources.length > 1 ? 's' : ''}` })
  ]);
  attachTooltip(badge, breakdown);
  return badge;
}

// `breakdown` feeds attachTooltip(), which only ever renders plain text
// (tooltip.js's `text:` prop) — never a DOM node — so it deliberately stays
// glyph-free (issue #136 Phase 2: LINK_TYPE_META.icon is now a
// decorativeIcon.js name, not an emoji glyph, and can't be inlined into a
// text string the way the old emoji could).
function summarizeResourceTypes(resources) {
  const counts = {};
  resources.forEach(r => {
    const type = detectLinkType(r.url);
    counts[type] = (counts[type] || 0) + 1;
  });
  const orderedTypes = RESOURCE_TYPE_PRIORITY.filter(type => counts[type]);
  const primaryIcon = LINK_TYPE_META[orderedTypes[0]].icon;
  const breakdown = orderedTypes
    .map(type => `${counts[type]} ${RESOURCE_TYPE_NOUN[type]}${counts[type] > 1 ? 's' : ''}`)
    .join(' · ');
  return { primaryIcon, breakdown };
}

// `templatePhases` is the current user's chosen template's phase/section skeleton
// (store.getSnapshot().phases) rather than a hardcoded import, so a template with
// phases that have no items yet (e.g. the "blank" template's 4 empty phases) still
// renders a phase-card for each one instead of only ever showing phases that already
// have at least one item.
function groupItems(items, templatePhases = []) {
  const phases = [];
  const phaseMap = new Map();
  templatePhases.forEach((phase, index) => {
    const entry = { ...phase, index, sections: (phase.sections || []).map((section, sIndex) => ({ ...section, sIndex, items: [] })) };
    phaseMap.set(phase.title, entry);
    phases.push(entry);
  });

  items.forEach(item => {
    let phase = phaseMap.get(item.phase);
    if (!phase) {
      phase = {
        title: item.phase,
        priority: item.priority || 'P2',
        index: phases.length,
        sections: []
      };
      phaseMap.set(item.phase, phase);
      phases.push(phase);
    }
    let section = phase.sections.find(s => s.title === item.section);
    if (!section) {
      section = { title: item.section, sIndex: phase.sections.length, items: [] };
      phase.sections.push(section);
    }
    section.items.push(item);
  });
  return phases;
}

function countStats(items) {
  const total = items.length;
  const done = items.filter(i => i.done).length;
  const pct = total ? Math.round((done / total) * 100) : 0;
  return { total, done, pct };
}

// `priority` is really "which filter chip is active" — issue #100 follow-up
// added a fifth value, 'RESOURCES', alongside ALL/P0-P3, matching items that
// carry at least one resource link rather than filtering by priority at all.
function matchesActiveFilter(item, priority) {
  if (priority === 'ALL') return true;
  if (priority === 'RESOURCES') return !!item.resources?.length;
  if (priority === 'REVIEW') return isReviewDue(item);
  return item.priority === priority;
}

function filterItems(items, { priority, query, tag }) {
  const q = query.trim().toLowerCase();
  return items.filter(item => {
    const matchesQuery = !q || item.title.toLowerCase().includes(q) || item.phase.toLowerCase().includes(q) || item.section.toLowerCase().includes(q);
    const matchesTag = !tag || (item.tags || []).includes(tag);
    return matchesActiveFilter(item, priority) && matchesQuery && matchesTag;
  });
}

// Issue #182 — every distinct tag currently in use across the roadmap, for
// the tag filter-chip row. Sorted alphabetically for a stable chip order.
function collectAllTags(items) {
  const tags = new Set();
  items.forEach(item => (item.tags || []).forEach(tag => tags.add(tag)));
  return [...tags].sort((a, b) => a.localeCompare(b));
}

function priorityCounts(items, priority) {
  const list = priority === 'ALL' ? items : items.filter(i => matchesActiveFilter(i, priority));
  return { total: list.length, done: list.filter(i => i.done).length };
}

// Module-scope, pure (issue #6 Phase 4.4) — turns a "when did we last
// successfully save" timestamp into the roadmap-header meta row's freshness
// text. No store change needed: dashboard.js's own updateSaveBadge() already
// observes every saveState transition, so it just remembers the last time
// state was 'synced'/'saved'/'local' in a local variable and feeds it here
// on each render — the same "derive it from what's already visible" approach
// remainingBand/formatRemaining (src/ui/utils/dailyTodo.js) use for countdown
// text, just counting up from the past instead of down to the future.
export function formatLastSynced(ms) {
  if (ms == null) return 'Not synced yet';
  if (ms < 60_000) return 'Last synced just now';
  if (ms < 3_600_000) return `Last synced ${Math.floor(ms / 60_000)}m ago`;
  if (ms < 86_400_000) return `Last synced ${Math.floor(ms / 3_600_000)}h ago`;
  return `Last synced ${new Date(Date.now() - ms).toLocaleDateString()}`;
}

// Module-scope (issue #53) — was previously inlined inside render(). Returns
// the priority filter-chip buttons; onFilterChange receives the clicked
// priority id and the caller owns re-rendering/persisting the new filter.
// Issue #6 Phase 4.3 — the active non-ALL chip gets an inline ✕ to clear
// just that filter, a lower-friction alternative to re-clicking the chip.
// Issue #100 follow-up — a fifth chip, 'RESOURCES', filters to topics that
// carry at least one resource link (real feedback: with resources now a
// first-class part of AI-generated roadmaps, there was no way to see them
// all "in one go" without opening each topic's edit panel individually).
// When it's active, renderItemRow() also expands each matched row's
// resources inline instead of just showing the collapsed count badge — see
// the "Render resource links inline" comment there.
export function renderFilterChips(items, activeFilter, onFilterChange) {
  return ['ALL', 'P0', 'P1', 'P2', 'P3', 'RESOURCES', 'REVIEW'].map(p => {
    const { total, done } = priorityCounts(items, p);
    const label = p === 'ALL' ? 'All' : p === 'RESOURCES' ? 'Resources' : p === 'REVIEW' ? 'Review due' : p;
    const isActive = activeFilter === p;
    const chip = el('button', {
      type: 'button',
      className: `filter-chip ${isActive ? 'active' : ''}`,
      dataset: { p },
      'aria-pressed': String(isActive),
      onClick: () => onFilterChange(p)
    }, [
      p === 'RESOURCES' ? createIcon('link', { size: 'xs' }) : null,
      p === 'REVIEW' ? createIcon('bell', { size: 'xs' }) : null,
      ` ${label} `,
      el('span', { className: 'chip-count', text: `${done}/${total}` }),
      // Issue #6 Phase 9 — a plain <span> with only an onClick was never
      // reachable by keyboard (a nested <button> inside this chip's own
      // <button> isn't valid HTML), so a keyboard-only user could clear the
      // active filter by re-clicking the chip itself but never via this
      // faster inline control at all. role="button" + tabindex + Enter/Space
      // handling is the standard pattern for a non-native interactive
      // element nested this way — same shape as .check-item's own
      // role="checkbox" handling elsewhere in this file.
      isActive && p !== 'ALL' ? el('span', {
        className: 'filter-chip-clear',
        role: 'button',
        tabindex: '0',
        'aria-label': `Clear ${label} filter`,
        onClick: e => {
          e.stopPropagation();
          onFilterChange('ALL');
        },
        onKeydown: e => {
          if (e.key !== 'Enter' && e.key !== ' ') return;
          e.preventDefault();
          e.stopPropagation();
          onFilterChange('ALL');
        }
      }, [createIcon('close', { size: 'xs' })]) : null
    ].filter(Boolean));
    if (p === 'REVIEW') {
      attachTooltip(chip, 'Topics you complete reappear here 14 days later, as a reminder to revisit them. Click "Mark reviewed" on a topic to reset its clock.');
    }
    return chip;
  });
}

// Issue #17 — the feature tour's step list. Every target is a live
// querySelector call against the real, current DOM (re-mapped from the
// issue's original, now-stale spec — see the issue's own re-audit comment):
// `.phase-card`/`.check-item`/`.resource-count` are unchanged, but "Switch
// template" moved to the sidebar's "My Roadmaps" nav item, the old
// `.progress-card` header widget became a full `/progress` page reached via
// the sidebar's "Progress" nav item, and the theme toggle now lives in the
// topbar's icon group. A 6th step (the already-wired Ctrl/Cmd+K command
// palette) was added on top of the original 5 — a natural "power user"
// capstone the issue's own re-audit flagged as worth including since the
// palette exists and works today; sidebar-collapse/notification-bell/Daily
// Todo-badge were deliberately left out to keep this a tight, day-one-only
// walkthrough (ongoing discovery is the changelog "New" badge system's job,
// not this feature's, per that same re-audit).
function buildTourSteps() {
  return [
    {
      // The first phase is open by default on a fresh roadmap (openPhases
      // defaults to Set([0])) — prefer a still-collapsed card so this step
      // actually demonstrates "click to expand" instead of spotlighting an
      // already-open, potentially very tall card and scrolling into its
      // middle (found via manual testing, not a hypothetical).
      target: () => document.querySelector('.phase-card:not(.open)') || document.querySelector('.phase-card'),
      title: 'Expand a phase',
      body: 'Click any phase to expand it and see the topics inside.'
    },
    {
      target: () => document.querySelector('.check-item'),
      title: 'Track a topic',
      body: 'Click a topic to mark it done. Click the resources badge to view or add links without toggling it.'
    },
    {
      target: () => document.querySelector('.app-sidebar-nav a[href="#/progress"]'),
      title: 'See your progress',
      body: 'Streaks, charts, and your full history live on the Progress page.'
    },
    {
      target: () => document.querySelector('.app-topbar .theme-toggle'),
      title: 'Switch themes',
      body: 'Switch between light and dark anytime in the top bar — it’s remembered across visits.'
    },
    {
      target: () => document.querySelector('.app-sidebar-nav a[href="#/onboarding"]'),
      title: 'Manage your roadmaps',
      body: 'Manage and switch between all your roadmaps anytime — your progress stays intact.'
    },
    {
      target: () => document.querySelector('.app-topbar-command-btn'),
      title: 'Jump anywhere, fast',
      body: 'Press Ctrl+K (or Cmd+K on Mac) anytime to jump to any page.'
    }
  ];
}

// Reads a duration/easing straight off the live CSS custom property instead
// of hardcoding a second copy of the value here, so Phase 1's token stays the
// single source of truth for both the CSS-driven animations and this
// JS-driven one.
function cssToken(name, fallback) {
  const raw = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  return raw || fallback;
}

// See the comment at animatePhaseBody()'s skipForSize check below for why
// this exists — chosen as comfortably above what a typical phase/section has
// (single digits to low tens of items) but well below what the largest
// built-in template phases run (some exceed 50-100), so almost every
// expand/collapse keeps the animation and only the handful of genuinely huge
// phases skip it.
const LARGE_PHASE_ITEM_THRESHOLD = 40;

// Issue #6 Phase 7 — FLIP height animation for phase-card expand/collapse,
// replacing the previous plain `display: none/block` + CSS fade (native
// `display` toggles can't be transitioned at all). Element.animate() runs on
// its own compositor-driven effect stack, never touching the `style`
// attribute — unaffected by index.html's no-`unsafe-inline` style-src CSP,
// unlike the imperative `.style.height`/`.style.overflow`/`.style.display`
// assignments below (direct DOM property mutation, not the `style` HTML
// attribute — same safe pattern `importRoadmapModal.js` already uses).
// Respects `prefers-reduced-motion` itself since a JS-driven WAAPI call
// doesn't pick up the global CSS `animation-duration: 0.01ms !important`
// override the way CSS transitions do.
//
// Takes the `.phase-card`, not the `.phase-body`, and toggles the 'open'
// class itself — the CSS rule `.phase-card.open .phase-body { display: block }`
// means removing 'open' before measuring the closing height would already
// have collapsed the body to `display: none` (0 layout height) before this
// function ever got to read it. Measuring must happen while the card is
// still visually open, before the class change takes effect.
export function animatePhaseBody(phaseCardEl, opening) {
  // Issue #6 Phase 9 — kept in sync here (not in the onToggle callback) so
  // every caller of animatePhaseBody gets the right aria-expanded value for
  // free, the same way the 'open' class itself is handled below.
  phaseCardEl.querySelector('.phase-head')?.setAttribute('aria-expanded', String(opening));

  const phaseBodyEl = phaseCardEl.querySelector('.phase-body');
  if (!phaseBodyEl) {
    phaseCardEl.classList.toggle('open', opening);
    return;
  }

  // A real, reported bug: a phase-head clicked twice in quick succession
  // (a frustrated re-click on what feels like a slow/laggy toggle is exactly
  // the kind of double-click this hits) started a second animation without
  // canceling the first — the first animation's `onfinish` closure was still
  // pending and fired later, stomping the *second* animation's intended
  // display/height/overflow state after the fact. That's what made a topic
  // list look "cut off" for a couple of seconds before "fixing itself": the
  // first animation's stale finish handler eventually overwrote whatever the
  // second one had already settled into. `getAnimations()` + `cancel()`
  // (cancel, not finish — cancel never fires `onfinish`) stops any animation
  // already running on this element before a new one starts, so at most one
  // animation (and one pending finish handler) is ever in flight per element.
  phaseBodyEl.getAnimations().forEach(anim => anim.cancel());

  // Animating `height` is never compositor-only — every frame forces a full
  // layout + paint of this subtree (and everything below it on the page),
  // unlike a `transform`/`opacity` animation. For a phase with a lot of
  // topics (some built-in templates' phases run 50-100+ items, each with its
  // own border/box-shadow/backdrop-filter-adjacent styling), that per-frame
  // cost can genuinely make a nominal 240ms animation take several real
  // seconds to visually settle on a slower device — reported live as a topic
  // list looking "cut off" for a couple of seconds. Past this many items, skip
  // the animation and jump straight to the end state, same as the
  // reduced-motion path — the animation is a nice-to-have, not worth risking
  // a multi-second stutter over.
  const skipForSize = phaseBodyEl.querySelectorAll('.check-item').length > LARGE_PHASE_ITEM_THRESHOLD;
  const reduceMotion = skipForSize || window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const duration = parseFloat(cssToken('--duration-base', '240ms')) || 240;
  const easing = cssToken('--ease-spring', 'cubic-bezier(0.2, 0.9, 0.3, 1)');

  if (!opening) {
    const current = phaseBodyEl.getBoundingClientRect().height;
    phaseCardEl.classList.remove('open');
    if (reduceMotion) {
      phaseBodyEl.style.display = 'none';
      return;
    }
    // `overflow: hidden` (below) makes `.phase-body` a scroll container for
    // the CSS Overflow spec's purposes — and per the Position spec, that
    // makes it the sticky positioning context for every `.section-label`
    // inside it (normally the page/viewport is). For the animation's
    // duration, each sticky label recalculates its "stuck" position against
    // this tiny/growing container instead of the page, which is exactly the
    // reported bug: labels briefly jump and overlap sibling content before
    // snapping to their correct position once `overflow` is cleared below.
    // `.phase-body-animating` (app.css) drops `.section-label` to `position:
    // static` for exactly this window so there's nothing for the browser to
    // reposition mid-animation.
    phaseBodyEl.classList.add('phase-body-animating');
    phaseBodyEl.style.display = 'block';
    phaseBodyEl.style.overflow = 'hidden';
    phaseBodyEl.style.height = `${current}px`;
    const anim = phaseBodyEl.animate([{ height: `${current}px` }, { height: '0px' }], { duration, easing });
    anim.onfinish = () => {
      phaseBodyEl.style.display = 'none';
      phaseBodyEl.style.height = '';
      phaseBodyEl.style.overflow = '';
      phaseBodyEl.classList.remove('phase-body-animating');
    };
    return;
  }

  phaseCardEl.classList.add('open');
  if (reduceMotion) {
    phaseBodyEl.style.display = 'block';
    return;
  }
  phaseBodyEl.classList.add('phase-body-animating');
  phaseBodyEl.style.display = 'block';
  phaseBodyEl.style.overflow = 'hidden';
  phaseBodyEl.style.height = '0px';
  const target = phaseBodyEl.scrollHeight;
  const anim = phaseBodyEl.animate([{ height: '0px' }, { height: `${target}px` }], { duration, easing });
  anim.onfinish = () => {
    phaseBodyEl.style.height = '';
    phaseBodyEl.style.overflow = '';
    phaseBodyEl.classList.remove('phase-body-animating');
  };
}

// Module-scope (issue #53) — was previously a ~50-line anonymous forEach body
// inline inside render(). Returns null when every section under this phase is
// hidden by the current filter/search, so the caller can skip rendering (and
// counting) it entirely.
export function renderPhaseCard(phase, pi, {
  openPhases,
  filteredIds,
  isCustomRoadmap,
  onToggle,
  onAddSection,
  renderItemRow,
  renderAddRow,
  renderPhaseManageRow,
  renderSectionManageRow,
  renderInlineCreate
}) {
  // A section that has no topics at all (e.g. the "blank" template's empty
  // phases) always stays visible — only a section that HAS topics but none
  // matching the current filter/search gets hidden.
  const visibleSections = phase.sections.map(section => ({
    ...section,
    items: section.items.filter(i => filteredIds.has(i.id))
  })).filter((section, sIdx) => phase.sections[sIdx].items.length === 0 || section.items.length > 0);

  // A custom roadmap's freshly-added phase (issue #4) starts with zero
  // sections — without this, it would never render at all, leaving no way to
  // reach the "+ Add section" control inside its phase-body.
  if (!visibleSections.length && phase.sections.length > 0) return null;

  const sectionDone = visibleSections.reduce((acc, s) => acc + s.items.filter(i => i.done).length, 0);
  const sectionTotal = visibleSections.reduce((acc, s) => acc + s.items.length, 0);
  const isOpen = openPhases.has(pi);
  const pct = sectionTotal ? Math.round((sectionDone / sectionTotal) * 100) : 0;

  return el('section', { className: `phase-card ${isOpen ? 'open' : ''}`, dataset: { phase: String(pi), phaseTitle: phase.title, priority: phase.priority } }, [
    el('button', {
      type: 'button',
      className: 'phase-head',
      'aria-expanded': String(isOpen),
      onClick: () => onToggle(pi)
    }, [
      el('span', { className: 'phase-index', text: String(pi + 1).padStart(2, '0') }),
      el('span', { className: 'phase-name', text: phase.title }),
      el('span', { className: `badge ${phase.priority}`, text: phase.priority }),
      // Issue #6 Phase 4.2 — the ring is the visible progress affordance now;
      // .phase-progress stays in the DOM as an sr-only label so assistive
      // tech (and tests/unit/dashboard.test.js, which asserts on it) keep
      // working unchanged.
      createProgressRing(pct, { size: 28, strokeWidth: 3 }),
      el('span', { className: 'phase-progress sr-only', text: `${sectionDone}/${sectionTotal}` }),
      el('span', { className: 'chevron' }, [createIcon('chevron', { size: 'sm' })])
    ]),
    el('div', { className: 'phase-body' }, [
      (isCustomRoadmap && phase.id) ? renderPhaseManageRow(phase) : null,
      ...visibleSections.flatMap(section => [
        (isCustomRoadmap && phase.id)
          ? renderSectionManageRow(phase, section)
          : (section.title ? el('div', { className: 'section-label', text: section.title }) : null),
        ...section.items.map(renderItemRow),
        renderAddRow(phase, section)
      ]),
      (isCustomRoadmap && phase.id) ? renderInlineCreate('New section name…', '+ Add section', title => onAddSection(phase.id, title)) : null
    ].filter(Boolean))
  ]);
}


export function renderDashboard(app, { user, store, dailyTodoStore }) {
  if (!user) {
    navigate('/signin', true);
    return;
  }
  if (!store.getSnapshot().onboardingDone) {
    navigate('/onboarding', true);
    return;
  }

  let ui = store.getUiState();
  // ui.filter is this roadmap's own sticky session filter (set the moment the
  // user ever changes it); readDefaultFilterPreference() (settings.js, issue
  // #16) only ever applies before that — the very first time a roadmap is
  // opened, before ui.filter has been set at all.
  let activeFilter = ui.filter || readDefaultFilterPreference();
  let searchQuery = ui.search || '';
  // Issue #182 — tag filter is a separate, in-memory-only AND condition on
  // top of activeFilter (not persisted — a lighter-weight control than the
  // sticky priority filter chips above it).
  let tagFilter = null;
  let openPhases = new Set(Array.isArray(ui.openPhases) ? ui.openPhases : [0]);
  let saveBadgeTimer;
  let lastStructuralVersion = null;
  // Issue #17 — set while a feature tour is on screen (auto-started or a
  // manual "Take a tour" replay), so the route's own cleanup return can tear
  // it down if the user navigates away mid-tour.
  let activeTourCleanup = null;
  // Issue #6 Phase 4.4 — set inside updateSaveBadge() whenever a save
  // actually completes; feeds formatLastSynced() in the roadmap-header meta
  // row. Purely a UI-layer freshness read, not persisted anywhere.
  let lastSyncedAt = null;
  // Issue #6 Phase 4.1 — the stat strip's CountUp only plays once, on the
  // dashboard's first render; every later render (including the
  // patchDoneStates fast-path) sets the numbers directly with no animation.
  let hasAnimatedStats = false;
  // Issue #6 Phase 4.2 — id-diff based "just added" tracking for the new
  // item stagger-entry animation. Populated at the end of every render();
  // any item id present now that wasn't in the previous set gets the
  // `entering` class on its next render. No roadmapStore.js change needed —
  // addItem() only returns a boolean, so this is a pure before/after
  // comparison entirely in the UI layer.
  let knownItemIds = new Set();

  const offlineBanner = el('div', { className: 'offline-banner', id: 'offlineBanner' }, [
    el('span', { className: 'sync-dot error' }),
    ' Offline — changes stay on this device until you reconnect.'
  ]);

  const doneStat = el('span', { className: 'stat-tile-number', text: '0' });
  const doneStatTotal = el('span', { className: 'stat-tile-total', text: '/ 0' });
  const percentStat = el('span', { className: 'stat-tile-number', text: '0' });
  const percentRing = createProgressRing(0, { size: 64, strokeWidth: 6 });
  const roadmapMetaRow = el('p', { className: 'roadmap-meta-row', text: '' });
  const filterContainer = el('div', { className: 'filter-row' });
  const tagFilterContainer = el('div', { className: 'filter-row tag-filter-row' });
  const reviewTagGroupBanner = el('div', { className: 'review-tag-group-banner' });
  const searchInput = el('input', { className: 'search-input', placeholder: 'Search topics…', value: searchQuery });
  const clearFiltersBtn = el('button', {
    type: 'button',
    className: 'btn btn-ghost btn-sm clear-filters-btn',
    text: 'Clear all filters',
    hidden: true,
    onClick: () => {
      activeFilter = 'ALL';
      searchQuery = '';
      tagFilter = null;
      searchInput.value = '';
      persistUi();
      render(store.getSnapshot());
    }
  });
  const content = el('main', { className: 'dashboard-content', id: 'main-content', tabindex: '-1' });
  // Issue #6 Phase 9 — aria-live so "Saving…"/"Saved to cloud"/"Save failed"
  // reaches a screen-reader user instead of only ever being a silent visual
  // change; 'polite' since a save-state change is never urgent enough to
  // interrupt whatever the user is doing.
  const saveBadge = el('div', { className: 'save-badge', id: 'saveBadge', 'aria-live': 'polite', role: 'status' });
  const syncPill = el('span', { className: 'sync-pill', text: 'Syncing' });

  const userPillClass = user.isAnonymous ? 'guest' : 'online';
  const activeTemplateId = store.getSnapshot().activeTemplateId;
  const isCustomRoadmap = store.isCustomRoadmapId(activeTemplateId);
  // Surfaced in the hero so it's never ambiguous which roadmap is currently
  // loaded — easy to lose track of after switching templates a few times. A
  // custom roadmap (issue #4) has no entry in the template registry, so its
  // name/icon come from customRoadmaps meta instead of getTemplate().
  const currentTemplate = isCustomRoadmap
    ? (() => {
      const custom = store.getSnapshot().customRoadmaps.find(r => r.id === activeTemplateId);
      return { icon: createIcon('edit', { size: 'sm' }), name: custom ? custom.title : 'Custom roadmap' };
    })()
    : getTemplate(activeTemplateId);

  function persistUi() {
    store.setUiState({
      filter: activeFilter,
      search: searchQuery,
      openPhases: [...openPhases]
    });
  }

  // One-shot cross-page signal (issue #8) — progress.js's phase-breakdown
  // row click writes the target phase's title to KEYS.SCROLL_TO_PHASE right
  // before navigating here. Read once, on this mount only, then cleared
  // immediately so a later reload/re-visit never re-triggers it. Looks the
  // target phase up by its already-rendered `data-phase-title` (not by
  // re-deriving groupItems' index ordering here) since the DOM is already
  // the source of truth for which index a given phase title landed at.
  function applyScrollToPhaseSignal() {
    const targetTitle = sessionStorage.getItem(KEYS.SCROLL_TO_PHASE);
    if (!targetTitle) return;
    sessionStorage.removeItem(KEYS.SCROLL_TO_PHASE);
    const card = content.querySelector(`.phase-card[data-phase-title="${CSS.escape(targetTitle)}"]`);
    if (!card) return;
    const pi = Number(card.dataset.phase);
    if (!openPhases.has(pi)) {
      openPhases.add(pi);
      persistUi();
      render(store.getSnapshot());
    }
    requestAnimationFrame(() => {
      content.querySelector(`.phase-card[data-phase-title="${CSS.escape(targetTitle)}"]`)
        ?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
  }

  // Issue #153 root cause #2 — the error-state badge now carries a real
  // "Retry now" button (roadmapStore.js's retrySaveNow()) instead of a
  // static "retrying…" claim that was never actually true. Extracted out of
  // updateSaveBadge() below to keep that function's own complexity from
  // growing past the ESLint gate (root CLAUDE.md's "prefer extracting a
  // named, module-scope function" convention).
  function renderSaveBadgeError(retryAttempt, retryInMs) {
    const retrySecs = retryInMs ? Math.round(retryInMs / 1000) : null;
    const retryBtn = el('button', {
      type: 'button',
      className: 'btn btn-ghost btn-sm save-badge-retry',
      text: 'Retry now',
      onClick: () => store.retrySaveNow()
    });
    saveBadge.replaceChildren(
      el('span', {
        text: retryAttempt && retrySecs
          ? `Save failed — retrying in ${retrySecs}s…`
          : 'Save failed.'
      }),
      retryBtn
    );
    saveBadge.classList.add('show', 'error');
  }

  // `retryAttempt`/`retryInMs` come straight off the snapshot
  // roadmapStore.js's scheduleSaveRetry() notifies with.
  function updateSaveBadge({ saveState: state, retryAttempt, retryInMs }) {
    clearTimeout(saveBadgeTimer);
    saveBadge.className = 'save-badge';
    if (state === 'saving') {
      saveBadge.replaceChildren(el('span', { className: 'spin' }), ' Saving…');
      saveBadge.classList.add('show');
    } else if (state === 'saved' || state === 'synced') {
      saveBadge.textContent = user.isAnonymous ? 'Saved locally' : 'Saved to cloud';
      saveBadge.classList.add('show');
      saveBadgeTimer = setTimeout(() => saveBadge.classList.remove('show'), 1800);
      lastSyncedAt = Date.now();
    } else if (state === 'local') {
      saveBadge.textContent = 'Saved on this device';
      saveBadge.classList.add('show');
      saveBadgeTimer = setTimeout(() => saveBadge.classList.remove('show'), 1800);
      lastSyncedAt = Date.now();
    } else if (state === 'error') {
      renderSaveBadgeError(retryAttempt, retryInMs);
    } else {
      saveBadge.classList.remove('show');
    }

    syncPill.textContent = user.isAnonymous ? 'Local only' : (state === 'synced' ? 'Synced' : state === 'saving' ? 'Saving…' : state === 'error' ? 'Save failed' : 'Ready');
    syncPill.className = `sync-pill ${userPillClass}${state === 'error' ? ' error' : ''}`;
  }

  // A checklist toggle is normally cosmetic-only (see updateItem's
  // isCosmetic check), but unchecking an item that carries a
  // completedViaTodoAt annotation (issue #56 follow-up — set when this item
  // was last marked done via a linked Today's Todo) must clear it too, so
  // the badge below never shows a stale "completed via todo" date on a
  // topic that's since been unchecked — either by re-toggling it here
  // directly, or by un-checking the linked todo itself (dailyTodoPanel.js's
  // uncheck-sync path calls this same store method, not this handler).
  // `checkBoxEl` (issue #206 §5) — when passed and the toggle is marking the
  // item *done* (never on uncheck, per the spec's "on marking done" wording),
  // fires the checkbox's scale(1)->scale(1.15)->scale(1) pop
  // (`.check-pop`, app.css) directly and synchronously here, not via
  // patchDoneStates()'s snapshot diff — that function re-touches every
  // item's `.done` class on every store update with no "did this specific
  // row just flip" signal, so it can't distinguish a genuine toggle from an
  // unrelated re-render without extra state. Removing the class before
  // re-adding it (with a forced reflow in between) is required for the
  // animation to replay on rapid repeated clicks — otherwise a second toggle
  // before the first animation's `animationend` fires would be a no-op class
  // add, and the pop simply wouldn't restart.
  function toggleDone(item, checkBoxEl) {
    const live = store.getSnapshot().allItems[item.id];
    if (!live) return;
    const nextDone = !live.done;
    const patch = { done: nextDone };
    if (!nextDone && live.completedViaTodoAt) patch.completedViaTodoAt = null;
    if (nextDone && checkBoxEl) {
      checkBoxEl.classList.remove('check-pop');
      void checkBoxEl.offsetWidth;
      checkBoxEl.classList.add('check-pop');
      checkBoxEl.addEventListener('animationend', () => checkBoxEl.classList.remove('check-pop'), { once: true });
    }
    store.updateItem(item.id, patch);
  }

  // Opens the duration prompt and, once confirmed, creates a Today's Todo
  // linked back to this exact (activeTemplateId, item.id) pair — never just
  // the title, since the same topic title can exist in more than one
  // roadmap (issue #56 follow-up).
  async function handleAddToDailyTodo(item) {
    if (!dailyTodoStore) return;
    const result = await openAddToDailyTodoModal({ topicTitle: item.title });
    if (!result) return;
    const added = dailyTodoStore.addTodo({
      title: result.title,
      durationMs: result.durationMs,
      linkedTemplateId: activeTemplateId,
      linkedItemId: item.id,
      linkedItemTitle: item.title
    });
    if (!added) {
      showToast(`You can have at most ${MAX_ACTIVE_TODOS} active todos at once.`, 'error');
      return;
    }
    showToast(`Added "${result.title}" to Today's Todos.`, 'success');
  }

  // Issue #6 Phase 4.2 — `sectionIdx` (this item's position within its own
  // section) feeds the stagger delay for newly-added rows only; existing
  // rows re-rendered on a structural change (e.g. toggling a different
  // phase open) never carry `entering` since their id is already in
  // knownItemIds from a prior render.
  function renderItemRow(item, sectionIdx = 0) {
    const isNew = !knownItemIds.has(item.id);
    // No inline `style` attribute — index.html's CSP has no 'unsafe-inline'
    // in style-src (see .claude/rules/auth-security.md), so an inline
    // animation-delay would be silently dropped by the browser. A capped
    // set of discrete delay classes (CSS below) gets the same staggered
    // fan-in effect without violating it.
    const enteringClass = isNew ? `entering entering-delay-${Math.min(sectionIdx, 6)}` : '';
    // Issue #6 Phase 9 — role="checkbox" moved off the whole row and onto
    // just .check-box below. axe-core's no-focusable-content rule (WCAG
    // 4.1.2) correctly flags a role="checkbox" element that contains other
    // focusable descendants — the Edit button, resource-count badge, and
    // add-todo button inside this row are all real, independently-focusable
    // controls, which an ARIA checkbox (a leaf widget in the accessibility
    // tree) isn't allowed to contain. The row itself keeps its onClick
    // (click-anywhere-to-toggle, guarded by the data-action convention
    // below) purely as a mouse/touch convenience — it carries no ARIA role
    // of its own now, so it isn't part of the accessibility tree as an
    // interactive control; keyboard toggling now happens via .check-box's
    // own role/tabindex/keydown handling.
    return el('div', {
      className: `check-item ${item.done ? 'done' : ''} ${enteringClass}`,
      dataset: { id: item.id },
      onClick: e => {
        if (e.target.closest('[data-action]')) return;
        toggleDone(item, e.currentTarget.querySelector('.check-box'));
      }
    }, [
      el('div', {
        className: 'check-box',
        role: 'checkbox',
        tabindex: '0',
        'aria-checked': String(item.done),
        'aria-label': item.title,
        onClick: e => {
          e.stopPropagation();
          toggleDone(item, e.currentTarget);
        },
        onKeydown: e => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            toggleDone(item, e.currentTarget);
          }
        }
      }, [el('span', { className: 'check-mark', 'aria-hidden': 'true' }, [createIcon('check', { size: 'xs' })])]),
      el('div', { className: 'check-body' }, [
        el('span', { className: 'check-title', text: item.title }),
        el('span', { className: `priority-tag ${item.priority}`, text: item.priority }),
        item.resources?.length ? buildResourceCountBadge(item, () => openItemPanel({
          item,
          onSave: patch => store.updateItem(item.id, patch),
          onDelete: () => store.removeItem(item.id)
        })) : null,
        item.notes ? el('button', {
          type: 'button',
          className: 'notes-indicator',
          'data-action': 'notes',
          'aria-label': 'Has notes',
          title: 'Has notes',
          onClick: e => {
            e.stopPropagation();
            openItemPanel({
              item,
              focusField: 'notes',
              onSave: patch => store.updateItem(item.id, patch),
              onDelete: () => store.removeItem(item.id)
            });
          }
        }, [createIcon('note', { size: 'xs' })]) : null,
        item.completedViaTodoAt ? el('span', {
          className: 'completed-via-todo-indicator',
          'data-action': 'completed-via-todo',
          title: `Completed via Today's Todo on ${new Date(item.completedViaTodoAt).toLocaleDateString()}`,
          'aria-label': `Completed via Today's Todo on ${new Date(item.completedViaTodoAt).toLocaleDateString()}`
        }, [createIcon('timer', { size: 'xs' }), createIcon('check', { size: 'xs' })]) : null,
        activeFilter === 'RESOURCES' ? renderInlineResources(item) : null
      ].filter(Boolean)),
      el('div', { className: 'check-actions' }, [
        isReviewDue(item) ? el('button', {
          type: 'button',
          className: 'btn btn-ghost btn-sm',
          'data-action': 'mark-reviewed',
          'aria-label': `Mark "${item.title}" reviewed`,
          onClick: e => {
            e.stopPropagation();
            store.updateItem(item.id, { lastReviewedAt: Date.now() });
            showToast(`Marked "${item.title}" as reviewed.`, 'success');
          }
        }, [createIcon('bell', { size: 'xs' }), 'Mark reviewed']) : null,
        dailyTodoStore ? el('button', {
          type: 'button',
          className: 'btn btn-ghost btn-sm',
          'data-action': 'add-todo',
          'aria-label': `Add "${item.title}" to Today's Todos`,
          title: "Add to Today's Todos",
          onClick: e => {
            e.stopPropagation();
            handleAddToDailyTodo(item);
          }
        }, [createIcon('timer', { size: 'xs' })]) : null,
        el('button', {
          type: 'button',
          className: 'btn btn-ghost btn-sm',
          'data-action': 'edit',
          'aria-label': `Edit ${item.title}`,
          text: 'Edit',
          onClick: e => {
            e.stopPropagation();
            openItemPanel({
              item,
              onSave: patch => store.updateItem(item.id, patch),
              onDelete: () => store.removeItem(item.id)
            });
          }
        })
      ].filter(Boolean))
    ]);
  }

  function renderAddRow(phase, section) {
    const input = el('input', { className: 'field-input compact inline-add', placeholder: 'Add a custom topic…' });
    return el('div', { className: 'add-row' }, [
      input,
      el('button', {
        type: 'button',
        className: 'btn btn-secondary btn-sm',
        text: 'Add',
        onClick: () => {
          const title = input.value.trim();
          if (!title) return;
          if (title.length > MAX_TITLE_LENGTH) {
            showToast(`Topic title must be ${MAX_TITLE_LENGTH} characters or fewer.`, 'error');
            return;
          }
          const added = store.addItem({ title, phase: phase.title, section: section.title, priority: phase.priority });
          if (!added) {
            showToast('This roadmap has reached its 800-topic limit.', 'error');
            return;
          }
          input.value = '';
          showToast(`Added "${title}".`, 'success');
        }
      })
    ]);
  }

  // Generic "type a name, click to create" row (issue #4) — used for both
  // "+ Add phase" and "+ Add section", only ever rendered for a custom
  // roadmap (built-in templates' phase/section skeleton is fixed content).
  // "+ Add phase" renders as a direct sibling of `.phase-card` inside
  // `.dashboard-content` (no wrapping box), unlike "+ Add section"/"Add a
  // custom topic…" which render inside an already-boxed `.phase-body` — so
  // it needs its own card framing to avoid looking like a rendering glitch
  // next to the fully-boxed phase-cards (issue #65 follow-up).
  function renderInlineCreate(placeholder, buttonLabel, onCreate, { standalone = false } = {}) {
    const input = el('input', { className: 'field-input compact inline-add', placeholder });
    return el('div', { className: standalone ? 'add-row add-row-standalone' : 'add-row' }, [
      input,
      el('button', {
        type: 'button',
        className: 'btn btn-secondary btn-sm',
        text: buttonLabel,
        onClick: () => {
          const value = input.value.trim();
          if (!value) return;
          onCreate(value);
          input.value = '';
        }
      })
    ]);
  }

  function renderPhaseManageRow(phase) {
    const renameInput = el('input', {
      className: 'field-input compact',
      value: phase.title,
      'aria-label': `Rename phase "${phase.title}"`
    });
    return el('div', { className: 'phase-manage-row' }, [
      el('span', { className: 'field-hint', text: 'Rename or delete this phase' }),
      el('div', { className: 'phase-manage-row-controls' }, [
        renameInput,
        el('button', {
          type: 'button',
          className: 'btn btn-ghost btn-sm',
          text: 'Rename',
          onClick: () => {
            const value = renameInput.value.trim();
            if (!value || value === phase.title) return;
            store.renamePhase(phase.id, value);
          }
        }),
        el('button', {
          type: 'button',
          className: 'btn btn-ghost btn-sm btn-danger-text',
          text: 'Delete phase',
          onClick: async () => {
            if (!await confirmDialog({
              title: `Delete "${phase.title}"?`,
              message: 'This deletes the phase and every topic inside it. This cannot be undone.',
              confirmText: 'Delete',
              danger: true
            })) return;
            store.removePhase(phase.id);
            showToast(`Deleted phase "${phase.title}".`, 'success');
          }
        })
      ])
    ]);
  }

  function renderSectionManageRow(phase, section) {
    const renameInput = el('input', {
      className: 'field-input compact',
      value: section.title,
      placeholder: 'Section name',
      'aria-label': `Rename section "${section.title}"`
    });
    return el('div', { className: 'section-manage-row' }, [
      el('span', { className: 'field-hint', text: 'Rename or delete this section' }),
      el('div', { className: 'section-manage-row-controls' }, [
        renameInput,
        el('button', {
          type: 'button',
          className: 'btn btn-ghost btn-sm',
          text: 'Rename',
          onClick: () => {
            const value = renameInput.value.trim();
            if (!value || value === section.title) return;
            store.renameSection(phase.id, section.id, value);
          }
        }),
        el('button', {
          type: 'button',
          className: 'btn btn-ghost btn-sm btn-danger-text',
          text: 'Delete section',
          onClick: async () => {
            if (!await confirmDialog({
              title: `Delete "${section.title || 'this section'}"?`,
              message: 'This deletes the section and every topic inside it. This cannot be undone.',
              confirmText: 'Delete',
              danger: true
            })) return;
            store.removeSection(phase.id, section.id);
            showToast('Section deleted.', 'success');
          }
        })
      ])
    ]);
  }

  // Detects a phase/roadmap that has just reached 100% and celebrates it
  // once (issue #181). `seedOnly` marks an already-complete phase/roadmap
  // as "shown" without celebrating — used on initial mount and any
  // structural re-render so a roadmap that was already finished before this
  // session doesn't celebrate on load; only a done-toggle that actually
  // crosses into 100% (routed through patchDoneStates) celebrates for real.
  function checkForCelebration(allItems, { seedOnly = false } = {}) {
    const uid = user.uid;
    let confettiFired = false;
    if (isRoadmapComplete(allItems) && !hasShownRoadmapCelebration(uid, activeTemplateId)) {
      markRoadmapCelebrationShown(uid, activeTemplateId);
      if (!seedOnly) confettiFired = celebrate('roadmap', currentTemplate.name, confettiFired);
    }
    getCompletedPhaseTitles(allItems).forEach(title => {
      if (hasShownPhaseCelebration(uid, activeTemplateId, title)) return;
      markPhaseCelebrationShown(uid, activeTemplateId, title);
      if (!seedOnly) confettiFired = celebrate('phase', title, confettiFired);
    });
  }

  // Returns whether confetti has now fired, so a roadmap-complete and its
  // simultaneous final phase-complete (a roadmap this small finishes both at
  // once) share a single burst instead of stacking two .confetti-burst nodes.
  function celebrate(kind, label, confettiAlreadyFired) {
    const message = kind === 'roadmap' ? `Roadmap complete! You finished every topic in "${label}".` : `Phase complete: "${label}".`;
    showToast(message, 'success');
    if (!confettiAlreadyFired) triggerConfetti();
    openBadgeShareModal(kind, label).catch(() => {});
    return true;
  }

  function render(snapshot) {
    const allItems = snapshot.items;
    const filtered = filterItems(allItems, { priority: activeFilter, query: searchQuery, tag: tagFilter });
    const stats = countStats(allItems);
    doneStatTotal.textContent = `/ ${stats.total}`;
    roadmapMetaRow.textContent = `${stats.total} item${stats.total === 1 ? '' : 's'} · ${stats.pct}% complete · ${formatLastSynced(lastSyncedAt == null ? null : Date.now() - lastSyncedAt)}`;
    updateSaveBadge(snapshot);
    updateReviewDueBadge(allItems);
    if (hasAnimatedStats) {
      doneStat.textContent = String(stats.done);
      percentStat.textContent = String(stats.pct);
      percentRing._setPct(stats.pct);
    } else {
      animateCountUp(doneStat, stats.done);
      animateCountUp(percentStat, stats.pct);
      percentRing._setPct(stats.pct);
      hasAnimatedStats = true;
    }

    clearFiltersBtn.hidden = activeFilter === 'ALL' && !searchQuery && !tagFilter;

    filterContainer.replaceChildren(...renderFilterChips(allItems, activeFilter, p => {
      activeFilter = activeFilter === p && p !== 'ALL' ? 'ALL' : p;
      persistUi();
      render(store.getSnapshot());
    }));

    const allTags = collectAllTags(allItems);
    tagFilterContainer.hidden = allTags.length === 0;
    tagFilterContainer.replaceChildren(...allTags.map(tag => {
      const isActive = tagFilter === tag;
      return el('button', {
        type: 'button',
        className: `filter-chip ${isActive ? 'active' : ''}`,
        'aria-pressed': String(isActive),
        onClick: () => {
          tagFilter = isActive ? null : tag;
          render(store.getSnapshot());
        }
      }, [tag]);
    }));

    if (activeFilter === 'REVIEW') {
      const groups = groupReviewDueItemsByTag(allItems).filter(g => g.tag);
      reviewTagGroupBanner.hidden = groups.length === 0;
      reviewTagGroupBanner.replaceChildren(...groups.map(g => el('p', {
        className: 'review-tag-group-line',
        text: `${g.items.length} items tagged "${g.tag}" are due for review.`
      })));
    } else {
      reviewTagGroupBanner.hidden = true;
      reviewTagGroupBanner.replaceChildren();
    }

    const filteredIds = new Set(filtered.map(i => i.id));
    const phases = groupItems(allItems, snapshot.phases);
    content.replaceChildren();

    // A custom roadmap (issue #4) has no fixed phase/section skeleton, so
    // "+ Add phase" always renders here regardless of how many phases exist
    // yet — including zero, for a freshly created roadmap.
    if (isCustomRoadmap) {
      content.append(renderInlineCreate('New phase name…', '+ Add phase', title => {
        store.addPhase(title);
      }, { standalone: true }));
    }

    let visibleCount = 0;
    phases.forEach((phase, pi) => {
      const phaseEl = renderPhaseCard(phase, pi, {
        openPhases,
        filteredIds,
        isCustomRoadmap,
        // Issue #6 Phase 7 — a plain expand/collapse never changes which items
        // are visible or how they're grouped (same reasoning as
        // patchDoneStates() below for a done-toggle), so this patches the one
        // affected phase-card in place instead of calling the full render()
        // that used to tear down and rebuild every phase-card on the page —
        // which also replayed every card's entrance animation on every click.
        onToggle: targetPi => {
          const opening = !openPhases.has(targetPi);
          if (opening) openPhases.add(targetPi); else openPhases.delete(targetPi);
          persistUi();

          const phaseCard = content.querySelector(`.phase-card[data-phase="${targetPi}"]`);
          if (phaseCard) animatePhaseBody(phaseCard, opening);

          const toggleAllBtn = app.querySelector('[data-toggle-all]');
          if (toggleAllBtn) {
            const snapshot = store.getSnapshot();
            const currentPhases = groupItems(snapshot.items, snapshot.phases);
            const allOpen = currentPhases.length > 0 && currentPhases.every((_, i) => openPhases.has(i));
            toggleAllBtn.textContent = allOpen ? 'Collapse all' : 'Expand all';
          }
        },
        onAddSection: (phaseId, title) => store.addSection(phaseId, title),
        renderItemRow,
        renderAddRow,
        renderPhaseManageRow,
        renderSectionManageRow,
        renderInlineCreate
      });
      if (!phaseEl) return;
      visibleCount += 1;
      content.append(phaseEl);
    });

    if (!visibleCount) {
      content.append(createEmptyState({ icon: 'search', title: 'No matching topics. Try another filter or search term.' }));
    }

    const toggleAllBtn = app.querySelector('[data-toggle-all]');
    if (toggleAllBtn) {
      const allOpen = phases.length > 0 && phases.every((_, i) => openPhases.has(i));
      toggleAllBtn.textContent = allOpen ? 'Collapse all' : 'Expand all';
    }

    // Issue #6 Phase 4.2 — must run last: renderItemRow() (called above, via
    // renderPhaseCard) reads knownItemIds to decide which rows are "new"
    // this render, so it can't be updated until after that pass completes.
    knownItemIds = new Set(allItems.map(i => i.id));

    checkForCelebration(allItems, { seedOnly: true });
  }

  // A "done" toggle only flips one item's checked state — it never changes which
  // topics are visible or how they're grouped. Patching in place (instead of
  // running render() again) avoids tearing down every phase-card, which was
  // replaying the open-phase fade-in animation and flickering the whole list.
  function patchDoneStates(snapshot) {
    const allItems = snapshot.items;
    const stats = countStats(allItems);
    doneStat.textContent = String(stats.done);
    percentStat.textContent = String(stats.pct);
    percentRing._setPct(stats.pct);
    updateSaveBadge(snapshot);
    updateReviewDueBadge(allItems);
    roadmapMetaRow.textContent = `${stats.total} item${stats.total === 1 ? '' : 's'} · ${stats.pct}% complete · ${formatLastSynced(lastSyncedAt == null ? null : Date.now() - lastSyncedAt)}`;

    filterContainer.querySelectorAll('.filter-chip').forEach(chip => {
      const { total, done } = priorityCounts(allItems, chip.dataset.p);
      const countEl = chip.querySelector('.chip-count');
      if (countEl) countEl.textContent = `${done}/${total}`;
    });

    allItems.forEach(item => {
      const row = content.querySelector(`.check-item[data-id="${CSS.escape(item.id)}"]`);
      if (!row) return;
      row.classList.toggle('done', !!item.done);
      row.querySelector('.check-box')?.setAttribute('aria-checked', String(!!item.done));
    });

    const filtered = filterItems(allItems, { priority: activeFilter, query: searchQuery });
    const filteredIds = new Set(filtered.map(i => i.id));
    groupItems(allItems, snapshot.phases).forEach((phase, pi) => {
      const phaseCard = content.querySelector(`.phase-card[data-phase="${pi}"]`);
      if (!phaseCard) return;
      const progressEl = phaseCard.querySelector('.phase-progress');
      if (!progressEl) return;
      const visible = phase.sections.flatMap(s => s.items.filter(i => filteredIds.has(i.id)));
      const visibleDone = visible.filter(i => i.done).length;
      progressEl.textContent = `${visibleDone}/${visible.length}`;
      const ring = phaseCard.querySelector('.progress-ring');
      if (ring) ring._setPct(visible.length ? Math.round((visibleDone / visible.length) * 100) : 0);
    });

    checkForCelebration(allItems);
  }

  function handleSnapshot(snapshot) {
    if (snapshot.structuralVersion === lastStructuralVersion) {
      patchDoneStates(snapshot);
      return;
    }
    lastStructuralVersion = snapshot.structuralVersion;
    render(snapshot);
  }

  const toggleAllBtn = el('button', {
    type: 'button',
    className: 'btn btn-ghost',
    dataset: { toggleAll: '1' },
    text: 'Expand all',
    onClick: () => {
      const snapshot = store.getSnapshot();
      const phases = groupItems(snapshot.items, snapshot.phases);
      const allOpen = phases.every((_, i) => openPhases.has(i));
      openPhases = allOpen ? new Set() : new Set(phases.map((_, i) => i));
      persistUi();
      render(store.getSnapshot());
    }
  });

  searchInput.addEventListener('input', debounce(e => {
    searchQuery = e.target.value.trim().toLowerCase();
    persistUi();
    render(store.getSnapshot());
  }, 160));

  const themeToggleBtn = createThemeToggle();
  const verificationBanner = createVerificationBanner(user);
  const backupReminderBanner = createBackupReminderBanner({ user, store });

  // Small header notification badge (not a per-roadmap feature — Daily Todos
  // are intentionally global, see onboarding.js) surfacing the soonest active
  // todo's countdown no matter which roadmap is currently open. Links to
  // /onboarding, the only page the actual todo list/editor lives on.
  const dailyTodoNavText = el('span', { className: 'daily-todo-nav-text' });
  const dailyTodoNavBadge = dailyTodoStore ? el('a', {
    href: '#/onboarding',
    className: 'daily-todo-nav-badge',
    title: "Today's Todos",
    hidden: true
  }, [
    el('span', { className: 'daily-todo-nav-icon' }, [createIcon('timer', { size: 'xs' })]),
    dailyTodoNavText
  ]) : null;

  // Issue #134 — a small header pill showing how many completed topics are
  // due for a spaced-repetition-style review, next to the Daily Todo
  // countdown badge (same header-badge precedent). Clicking it jumps
  // straight to the REVIEW filter chip rather than a separate page.
  const reviewDueText = el('span', { className: 'review-due-nav-text' });
  const reviewDueBadge = el('button', {
    type: 'button',
    className: 'review-due-nav-badge',
    title: 'Topics you completed 14+ days ago, due for a review.',
    hidden: true,
    onClick: () => {
      activeFilter = 'REVIEW';
      persistUi();
      render(store.getSnapshot());
    }
  }, [
    el('span', { className: 'review-due-nav-icon' }, [createIcon('bell', { size: 'xs' })]),
    reviewDueText
  ]);

  function updateReviewDueBadge(allItems) {
    const dueCount = getReviewDueItems(allItems).length;
    reviewDueBadge.hidden = dueCount === 0;
    if (dueCount === 0) return;
    reviewDueText.textContent = `${dueCount} due for review`;
    reviewDueBadge.setAttribute('aria-label', `${dueCount} topic${dueCount === 1 ? '' : 's'} due for review`);
  }

  function updateDailyTodoBadge() {
    if (!dailyTodoStore) return;
    const now = Date.now();
    const active = dailyTodoStore.getSnapshot().todos
      .filter(t => !t.done && !isExpired(t, now))
      .sort((a, b) => a.expiresAt - b.expiresAt);
    if (!active.length) {
      dailyTodoNavBadge.hidden = true;
      return;
    }
    const soonest = active[0];
    const ms = remainingMs(soonest, now);
    dailyTodoNavBadge.hidden = false;
    dailyTodoNavBadge.className = `daily-todo-nav-badge ${remainingBand(ms)}`;
    dailyTodoNavText.textContent = active.length > 1 ? `${formatRemaining(ms)} · ${active.length} due` : formatRemaining(ms);
    dailyTodoNavBadge.setAttribute('aria-label', `Today's Todos — "${soonest.title}", ${formatRemaining(ms)}${active.length > 1 ? `, ${active.length} active todos` : ''}`);
  }

  // Issue #17 — (re)starts the tour. `resetTour()` is only meaningful for a
  // manual "Take a tour" replay (in-memory only, per the store's own
  // contract) — the auto-start call site below never needs it, since
  // tourDone is already false there. Any tour already on screen is torn down
  // first so a stray double-invocation can't leave two sets of listeners
  // running.
  function runFeatureTour() {
    activeTourCleanup?.();
    activeTourCleanup = startTour(buildTourSteps(), {
      onEnd: () => {
        activeTourCleanup = null;
        store.completeTour();
      }
    });
  }

  // Issue #6 Phase 2 — app shell (sidebar + topbar) replaces the old
  // single `.header-top` action row. Identity/sign-out/delete-account now
  // live in the sidebar footer; "Switch template" is superseded by the
  // sidebar's "My Roadmaps" nav item (same destination, #/onboarding).
  // `.dashboard` stays on the outer element (alongside the new
  // `.app-shell-2` layout class) since e2e/unit tests already assert on it
  // as the dashboard-is-rendered marker.
  const sidebar = createSidebar({
    activeRoute: '/app',
    user,
    store,
    dailyTodoStore,
    onDeleteAccount: user.isAnonymous ? null : () => openDeleteAccountModal(),
    // Issue #17 — only the dashboard's own sidebar instance offers this
    // (progress.js/settings.js/onboarding.js's sidebars don't pass it) since
    // every spotlight target above only exists on this page.
    onStartTour: () => {
      // Issue #17 mobile follow-up — "Take a tour" is reached through the
      // sidebar's own account menu, which on a phone-width viewport only
      // opens by first opening the fixed-position mobile drawer (see
      // `.claude/rules/ui-styling.md`'s six-tier breakpoint scale, <640px
      // tier). The tour's own scrim/ring/popover render at a higher
      // z-index than the drawer's backdrop, so leaving the drawer open
      // stranded it pinned on screen with no way to tap through to close
      // it — closing it here before the tour starts is what the drawer's
      // own backdrop-click handler would have done had the tour not been
      // sitting on top of it.
      sidebar._closeMobile?.();
      store.resetTour();
      runFeatureTour();
    }
  });
  const topbar = createTopbar({
    breadcrumb: `Roadmaps / ${currentTemplate.name}`,
    user,
    syncPill,
    themeToggleBtn,
    dailyTodoNavBadge,
    reviewDueBadge,
    notificationBell: createChangelogBell(),
    onToggleMobileSidebar: () => sidebar._toggleMobile()
  });

  const shell = el('div', { className: 'app-shell-2 dashboard fade-in' }, [
    sidebar,
    sidebar._backdrop,
    el('div', { className: 'app-shell-main' }, [
      topbar,
      el('div', { className: 'app-content' }, [
        verificationBanner,
        backupReminderBanner,
        offlineBanner,
        el('header', { className: 'dashboard-header' }, [
          // Issue #6 Phase 4.4 — the "Official/read-only" lock-badge concept
          // from the original spec is stale post-#4/#58 (every roadmap is
          // equally "yours" now); this extends the existing identity badge
          // with a meta row instead of a separate header section.
          el('div', { className: 'roadmap-header' }, [
            el('div', { className: 'current-roadmap-badge' }, [
              // currentTemplate.icon is a decorativeIcon.js name string for a
              // built-in template (getTemplate(), issue #136 Phase 2 — was a
              // raw emoji string before), or the shared createIcon() "edit"
              // node for a custom roadmap's fallback icon (issue #107).
              typeof currentTemplate.icon === 'string'
                ? el('span', { 'aria-hidden': 'true' }, [createDecorativeIcon(currentTemplate.icon, { size: 'sm' })])
                : el('span', { 'aria-hidden': 'true' }, [currentTemplate.icon]),
              el('span', { text: `${currentTemplate.name} roadmap` })
            ]),
            roadmapMetaRow
          ]),
          el('div', { className: 'stat-strip' }, [
            el('div', { className: 'stat-tile' }, [
              el('span', { className: 'stat-tile-icon' }, [createIcon('check', { size: 'sm' })]),
              el('div', { className: 'stat-tile-value' }, [doneStat, doneStatTotal]),
              el('span', { className: 'stat-tile-label', text: 'Items done' })
            ]),
            el('div', { className: 'stat-tile stat-tile-ring' }, [
              el('div', { className: 'stat-tile-ring-wrap' }, [
                percentRing,
                el('div', { className: 'stat-tile-ring-value' }, [percentStat, el('span', { text: '%' })])
              ]),
              el('span', { className: 'stat-tile-label', text: 'Complete' })
            ])
          ]),
          el('div', { className: 'toolbar' }, [
            el('div', { className: 'toolbar-block' }, [
              el('span', { className: 'toolbar-label', text: 'Priority' }),
              filterContainer
            ]),
            el('div', { className: 'toolbar-block toolbar-right' }, [
              clearFiltersBtn,
              searchInput,
              toggleAllBtn
            ])
          ]),
          el('div', { className: 'toolbar-block' }, [
            el('span', { className: 'toolbar-label', text: 'Tags' }),
            tagFilterContainer
          ]),
          reviewTagGroupBanner
        ]),
        content,
        saveBadge
      ])
    ])
  ]);

  app.replaceChildren(shell);

  const unsubStore = store.subscribe(handleSnapshot);
  lastStructuralVersion = store.getSnapshot().structuralVersion;
  render(store.getSnapshot());
  applyScrollToPhaseSignal();
  maybeShowGuestDataRiskNudge({ user, store });

  // Issue #17 — auto-starts once, only for an account that has genuinely
  // finished onboarding but never seen the tour (a freshly-backfilled
  // existing account never reaches this, since backfillTourDoneIfNeeded()
  // in roadmapStore.js already resolved tourDone to true for it before this
  // page ever mounted).
  {
    const tourSnapshot = store.getSnapshot();
    if (tourSnapshot.onboardingDone === true && tourSnapshot.tourDone === false) {
      runFeatureTour();
    }
  }

  // 30s resolution matches dailyTodoPanel.js's own countdown tick — enough
  // for hour/minute-granularity text without a busier interval.
  const unsubDailyTodo = dailyTodoStore ? dailyTodoStore.subscribe(updateDailyTodoBadge) : null;
  const dailyTodoTickTimer = dailyTodoStore ? setInterval(updateDailyTodoBadge, 30000) : null;

  function setOnlineState() {
    offlineBanner.classList.toggle('show', !navigator.onLine);
  }
  window.addEventListener('online', setOnlineState);
  window.addEventListener('offline', setOnlineState);
  setOnlineState();

  // Issue #254 — a native browser/OS print action (bypassing printRoadmap.js's
  // own dedicated .print-mode flow, which builds a fresh full-content DOM
  // snapshot regardless of expand state) prints the live dashboard as-is, so a
  // collapsed .phase-card's `.phase-body { display: none }` means its topics
  // are genuinely absent from the printed page, not just visually hidden.
  // Force every phase open for the duration of the print — directly toggling
  // the class/aria-expanded rather than animatePhaseBody()'s Element.animate()
  // path, since nothing needs to visibly transition for a print render — then
  // restore exactly the phases that were open beforehand once printing ends.
  let openPhasesBeforePrint = null;
  function handleBeforePrint() {
    openPhasesBeforePrint = new Set(openPhases);
    content.querySelectorAll('.phase-card').forEach(phaseCardEl => {
      phaseCardEl.classList.add('open');
      phaseCardEl.querySelector('.phase-head')?.setAttribute('aria-expanded', 'true');
    });
  }
  function handleAfterPrint() {
    if (!openPhasesBeforePrint) return;
    content.querySelectorAll('.phase-card').forEach(phaseCardEl => {
      const pi = Number(phaseCardEl.dataset.phase);
      const wasOpen = openPhasesBeforePrint.has(pi);
      phaseCardEl.classList.toggle('open', wasOpen);
      phaseCardEl.querySelector('.phase-head')?.setAttribute('aria-expanded', String(wasOpen));
    });
    openPhasesBeforePrint = null;
  }
  window.addEventListener('beforeprint', handleBeforePrint);
  window.addEventListener('afterprint', handleAfterPrint);

  return () => {
    activeTourCleanup?.();
    themeToggleBtn._cleanup?.();
    sidebar._cleanup?.();
    topbar._cleanup?.();
    unsubStore();
    unsubDailyTodo?.();
    if (dailyTodoTickTimer) clearInterval(dailyTodoTickTimer);
    window.removeEventListener('online', setOnlineState);
    window.removeEventListener('offline', setOnlineState);
    window.removeEventListener('beforeprint', handleBeforePrint);
    window.removeEventListener('afterprint', handleAfterPrint);
    clearTimeout(saveBadgeTimer);
  };
}
