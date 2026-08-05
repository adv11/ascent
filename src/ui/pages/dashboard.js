import { el, debounce, isValidUrl } from '../dom.js';
import { navigate } from '../router.js';
import { openItemPanel } from '../components/itemPanel.js';
import { showToast } from '../components/toast.js';
import { createVerificationBanner } from '../components/verificationBanner.js';
import { createGuestBanner } from '../components/guestBanner.js';
import { createBackupReminderBanner } from '../components/backupReminderBanner.js';
import { createProgressDigestBanner } from '../components/progressDigestBanner.js';
import { maybeShowGuestDataRiskNudge } from '../components/guestDataRiskNudge.js';
import { confirmDialog } from '../components/confirmDialog.js';
import { readDefaultFilterPreference } from '../utils/defaultFilterPreference.js';
import { createSidebar } from '../components/sidebar.js';
import { createDropdown } from '../components/dropdown.js';
import { createTopbar } from '../components/topbar.js';
import { createBottomNav } from '../components/bottomNav.js';
import { createDailyTodoPanel } from '../components/dailyTodoPanel.js';
import { getTemplate } from '../../data/templates/index.js';
import { MAX_TITLE_LENGTH } from '../../core/roadmap/limits.js';
import { isExpired, remainingMs, formatRemaining, remainingBand } from '../utils/dailyTodo.js';
import { MAX_ACTIVE_TODOS } from '../../core/dailyTodo/limits.js';
import { createProgressRing } from '../components/progressRing.js';
import { animateCountUp } from '../../utils/countUp.js';
import { detectLinkType, LINK_TYPE_META } from '../utils/linkDetector.js';
import { attachTooltip } from '../components/tooltip.js';
import { createIcon } from '../components/icons.js';
import { createEmptyState } from '../components/emptyState.js';
import { createDecorativeIcon } from '../components/decorativeIcon.js';
import { KEYS } from '../../services/localStorageKeys.js';
import { priorityLabel } from '../utils/priorityLabels.js';
import { isReviewDue, getReviewDueItems, groupReviewDueItemsByTag } from '../../core/roadmap/reviewSchedule.js';
import { selectNextUpTopics } from '../../core/roadmap/nextUp.js';
import { isRoadmapComplete, getCompletedPhaseTitles } from '../../core/roadmap/completionCelebration.js';
import { hasShownRoadmapCelebration, hasShownPhaseCelebration, markRoadmapCelebrationShown, markPhaseCelebrationShown } from '../../services/celebrationShownStore.js';
import { mountPrintSnapshot, attachPrintCleanup } from '../utils/printRoadmap.js';
import { openModal, attachFocusTrap } from '../components/modal.js';
import { createSelect } from '../components/select.js';
// openAddToDailyTodoModal, openDeleteAccountModal, triggerConfetti,
// openBadgeShareModal, and startTour are all dynamically imported below,
// right where each is used — every one of them only ever runs behind a rare,
// later-triggered user action (adding a daily todo, deleting the account,
// a phase/roadmap completion celebration, the first-time/replayed feature
// tour), never during the dashboard's initial render. With no bundler, every
// static top-of-file import here is one more fetch this route's module-graph
// waterfall has to resolve before first paint, so keeping these lazy shrinks
// that waterfall for the common case (a load that never touches any of
// them) without changing behavior for the rare case that does.
// mountPrintSnapshot/attachPrintCleanup above stay a static import
// deliberately — they're wired to the native `beforeprint` event, and an
// async import() there risks losing the race against the browser's own
// print-capture timing (see this file's `handleBeforePrint` comment and
// `.claude/rules/ui-styling.md`'s already-documented print-timing bugs).

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

// Issue #489 — the single summary card's meta line uses "Saved", not "Last
// synced", matching content-style.md's canonical plain-language mapping
// ("Synced to cloud" -> "Saved"). Same freshness math as formatLastSynced()
// above (kept separate, not reworded in place, since that function's exact
// strings are already asserted by its own unit tests).
export function formatSavedAgo(ms) {
  if (ms == null) return 'Not saved yet';
  if (ms < 60_000) return 'Saved a moment ago';
  if (ms < 3_600_000) return `Saved ${Math.floor(ms / 60_000)}m ago`;
  if (ms < 86_400_000) return `Saved ${Math.floor(ms / 3_600_000)}h ago`;
  return `Saved ${new Date(Date.now() - ms).toLocaleDateString()}`;
}

// Issue #477 — the priority levels (All/P0-P3) used to be five of the seven
// pills renderFilterChips() built, crowding the row before a user even
// reaches Resources/Review due/Search/Expand all. Collapsed into one
// createSelect() dropdown (the app's existing native-`<select>` replacement,
// src/ui/components/select.js) — 'Resources' and 'Review due' deliberately
// stay as standalone .filter-chip toggles below, not folded into the same
// dropdown: they're independent boolean filters a user toggles frequently
// mid-browsing, not part of the mutually-exclusive priority set, so hiding
// them behind an extra click would hurt discoverability more than it helps
// decluttering. Counts are baked into each option's label ("P0 · 0/234")
// since createSelect's listbox only ever renders plain text, mirroring how
// the old chips' `.chip-count` badge showed the same numbers.
export function renderPriorityFilterSelect(items, activeFilter, onFilterChange) {
  const options = ['ALL', 'P0', 'P1', 'P2', 'P3'].map(p => {
    const { total, done } = priorityCounts(items, p);
    const label = p === 'ALL' ? 'All' : priorityLabel(p);
    return { value: p, label: `${label} · ${done}/${total}` };
  });
  const select = createSelect(options, {
    value: activeFilter,
    ariaLabel: 'Filter by priority',
    className: 'priority-filter-select'
  });
  select.addEventListener('change', () => onFilterChange(select.value));
  return select;
}

// Module-scope (issue #53) — was previously inlined inside render(). Returns
// the "Resources"/"Review due" filter-chip buttons; onFilterChange receives
// the clicked filter id and the caller owns re-rendering/persisting the new
// filter. Issue #6 Phase 4.3 — the active chip gets an inline ✕ to clear
// just that filter, a lower-friction alternative to re-clicking the chip.
// Issue #100 follow-up — 'RESOURCES' filters to topics that carry at least
// one resource link (real feedback: with resources now a first-class part of
// AI-generated roadmaps, there was no way to see them all "in one go"
// without opening each topic's edit panel individually). When it's active,
// renderItemRow() also expands each matched row's resources inline instead
// of just showing the collapsed count badge — see the "Render resource links
// inline" comment there. Issue #477 — the five priority levels (All/P0-P3)
// that used to render here moved to renderPriorityFilterSelect() above; this
// function now only builds the two non-priority toggles.
export function renderFilterChips(items, activeFilter, onFilterChange) {
  return ['RESOURCES', 'REVIEW'].map(p => {
    const { total, done } = priorityCounts(items, p);
    const label = p === 'ALL' ? 'All' : p === 'RESOURCES' ? 'Links' : p === 'REVIEW' ? 'Review due' : p;
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
// `.phase-card`/`.check-item` are unchanged, but "Switch
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
//
// Issue #293 — re-audited against every feature shipped since #17 and added
// 4 more stops: Settings, the account menu (share/backup/reports), the
// feedback widget, and the changelog bell. All four resolve reliably on a
// brand-new dashboard (a fixed nav link, a fixed sidebar footer button, an
// app-lifetime `document.body` trigger, and a fixed topbar button — none of
// them conditionally rendered), unlike `.daily-todo-nav-badge`/
// `.review-due-nav-badge` just above them in this same file, which are
// `hidden` until a matching todo/review-due item exists and would end the
// tour early (`showStep()`'s `if (!target) { end(); return; }`) for a
// fresh account with neither yet — deliberately still left out of this list
// for that reason, same as the original re-audit's own reasoning above.
// Favorite roadmaps and AI-import/"Create your own roadmap" have no
// dashboard-page target at all — they live on `onboarding.js` instead, so
// they're folded into the "Manage your roadmaps" step's body copy as a
// pointer rather than given their own spotlight step; that page's own
// second, contextual tour (`buildOnboardingTourSteps()`) is what actually
// spotlights them. Issue #490 moved the Daily Todos panel itself onto this
// page, so — unlike those two — it now gets a real "Track daily todos"
// spotlight step below instead of a body-copy pointer.
// Exported (issue #293) for the same reason `renderFilterChips`/
// `renderPhaseCard` are module-scope rather than closures inside
// `renderDashboard` (issue #53's extraction precedent, see the comment above
// `renderFilterChips`'s own describe block in dashboard.test.js) — so this
// step list is independently testable against real, separately-mounted
// component instances without needing to render the whole dashboard.
export function buildTourSteps() {
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
      body: 'Click a topic to mark it done. Click the links badge to view or add links without toggling it.'
    },
    {
      // Issue #490 — moved here from onboarding.js's own tour once the Daily
      // Todos panel itself moved to this page (`.claude/rules/roadmap-store.md`'s
      // "Placement" note). Not gated on the panel existing the way
      // `.daily-todo-nav-badge`/`.review-due-nav-badge` are just below — the
      // panel itself is always rendered (never conditionally hidden) whenever
      // dailyTodoStore is present, same as it always was on onboarding.js.
      target: () => document.querySelector('.daily-todo-panel'),
      title: 'Track daily todos',
      body: 'Add anything you want to get done today — a rolling list, separate from your roadmap topics.'
    },
    {
      // Issue #484 — below the sidebar's >=900px breakpoint there's no
      // sidebar at all (no off-canvas drawer to open, unlike the retired
      // hamburger drawer this replaced) — bottomNav.js's own "Progress" tab
      // is the equivalent target there instead.
      target: () => document.querySelector('.app-sidebar-nav a[href="#/progress"]') || document.querySelector('.bottom-nav-item[href="#/progress"]'),
      title: 'See your progress',
      body: 'Streaks, charts, and your full history live on the Progress page.'
    },
    {
      target: () => document.querySelector('.app-sidebar-nav a[href="#/onboarding"]') || document.querySelector('.bottom-nav-item[href="#/onboarding"]'),
      title: 'Manage your roadmaps',
      body: 'Switch between all your roadmaps anytime — your progress stays intact. This is also where you\'ll find favorite roadmaps and the option to build your own roadmap with AI.'
    },
    {
      target: () => document.querySelector('.app-sidebar-nav a[href="#/settings"]') || document.querySelector('.bottom-nav-item[href="#/settings"]'),
      title: 'Update your settings',
      body: 'Manage your profile, password, and account preferences from Settings.'
    },
    {
      // No bottom-nav equivalent for the account menu (identity trigger only
      // exists in the >=900px sidebar) — featureTour.js skips a step whose
      // target() resolves to null instead of ending the tour early.
      target: () => document.querySelector('.app-sidebar-identity'),
      title: 'Share, back up, and review reports',
      body: 'Open your account menu to share a read-only roadmap link, download a backup, or see your past feedback reports.'
    },
    {
      target: () => document.querySelector('.feedback-widget-trigger'),
      title: 'Send feedback anytime',
      body: 'Spotted a bug or have an idea? Use this button to send feedback straight to us.'
    },
    {
      target: () => document.querySelector('.app-topbar-avatar-btn'),
      title: 'See what\'s new',
      body: 'Open your account menu and choose "What\'s New" to see recent updates and new features as they ship.'
    },
    {
      target: () => document.querySelector('.app-sidebar-footer .theme-toggle'),
      title: 'Switch themes',
      body: 'Switch between light and dark anytime from the sidebar — it\'s remembered across visits.'
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

// Row-level windowed rendering (issue #433, follow-up to #432/#430). Real,
// reported bug: fast/sustained scrolling through a fully-expanded 19-phase
// Java Backend roadmap (484 topic rows, ~37800px tall page) still showed
// large black/unpainted regions after #432's `[data-scrolling]` mitigation
// (which only ever addressed backdrop-filter compositing cost, not raw
// paint/raster volume). A live isolation test in the issue ruled out glass
// compositing as the sole cause; a scripted repro (headless Chromium, fast
// scroll + pixel-sampling the content area against the page's own background
// color) confirmed a genuine paint bottleneck: worst-frame blank-content
// fraction of 38-100% depending on scroll pattern, before any fix.
//
// `content-visibility: auto` was tried twice for this symptom and made
// things measurably *worse* both times — first at `.phase-card` level (see
// that rule's own long comment in app.css: whole-page blank-paint states
// that never recovered, no `contain-intrinsic-size` set at all), and again
// here at `.check-item` row level with a real, measured `contain-intrinsic-
// size: 67px` (this file's own repro script — see the PR — measured every
// row in the fully-expanded template at exactly 67px). Row-level
// content-visibility was expected to fix this (a much smaller unit than a
// whole card, with an accurate size hint this time) but the same scripted
// repro showed it reliably *increased* the worst-frame blank fraction under
// both a fast synthetic jump-scroll (79-93% before -> 97-100% after) and a
// realistic ~60fps mouse-wheel scroll (37% before -> 88% after) — confirmed
// twice, not a fluke. The likely reason: `content-visibility: auto` on ~500
// individual small elements makes the browser run its own
// intersection-relevance bookkeeping for every one of them on every scroll
// frame, and that per-element overhead outweighs the paint it saves for text
// this cheap to paint in the first place — a different failure mode than the
// card-level attempt, but the same practical outcome (don't ship it).
//
// The fix that actually measured better: real windowed/virtualized
// rendering, kept as simple as this codebase's "no framework, no build step"
// constraint allows. `.check-item` rows for an *open* phase-card's section
// are pruned from the DOM once they're further than
// `VIRTUALIZE_BUFFER_VIEWPORTS` viewport-heights from the current scroll
// position, replaced by a single top/bottom `.row-spacer` per section sized
// to the *real* height of whatever it's standing in for (falling back to
// `ROW_HEIGHT_ESTIMATE` only for a row that's never actually been mounted
// and measured yet) — the "estimate, then correct from real measurements"
// approach. Every row is still a real DOM node the moment it's near the
// viewport, and pruning only ever runs off a `scroll`/`resize` listener
// (never during a phase-card's own open/close FLIP animation, guarded via
// `.phase-body-animating` — see `virtualizeOpenSections()` below), so
// `animatePhaseBody()`'s `scrollHeight` measurement is never taken against a
// partially-pruned body mid-animation. `j`/`k` keyboard nav's
// `getVisibleRows()` (issue #379) and every E2E test that locates a row
// (`.check-item[data-id="…"]`) keep working unmodified against whatever's
// currently mounted — Playwright's own auto-scroll-into-view before an
// interaction, and `setRowFocus()`'s `scrollIntoView()` call, both trigger a
// real `scroll` event that re-mounts the target row before anything tries to
// click it. Measured fix result (same repro script, same steps): worst-frame
// blank-content fraction dropped to 0% under both the jump-scroll and the
// realistic mouse-wheel scroll tests — see the PR for the exact numbers.
const ROW_HEIGHT_ESTIMATE = 66; // px — issue #486 (B1): the two-line row (checkbox,
                                 // title, one grey meta line) has a fixed 66px
                                 // `min-height` in app.css, replacing the old up-to-
                                 // four-line row this constant used to be measured
                                 // against (was 67px). Used only as the cold-start
                                 // fallback before any row in a given section has
                                 // actually been measured — see
                                 // `estimateRowHeight()` below for why a single global
                                 // constant is no longer used on its own.
// issue #465 follow-up — raised 2.5 -> 4.5, live-measured, not a guess. A real fast-scroll
// stress test (real `scroll` events fired in rapid back-to-back bursts, not the jump-scroll/
// mouse-wheel scripted repro this file's own history above used) reliably reproduced a
// Chromium checkerboard/blank-paint artifact within the first handful of scroll ticks at
// 2.5 — confirmed via a controlled diagnostic (backdrop-filter/box-shadow entirely disabled
// on every glass surface, bug reproduced identically) that this specific artifact is *not*
// caused by this app's CSS at all, only by how far ahead of the visible viewport real content
// is already mounted/painted before it's needed. At 4.5, the identical stress test (14 rapid
// scroll bursts across two separate rounds) produced zero failures. This does cost more
// mounted DOM (~3000 nodes vs ~2000 at 2.5, live-measured on the fully-expanded Java Backend
// template) — still a small fraction of the ~11,200 nodes an unvirtualized render would need,
// so the tradeoff is worth it. If you ever retune this constant, re-run the same kind of real
// (not synthetic-jump) fast-scroll stress test before shipping a change — a smaller value that
// "looks fine" under gentle scrolling can still reproduce this exact bug under a real fling.
const VIRTUALIZE_BUFFER_VIEWPORTS = 4.5;

// issue #444 follow-up — real, reported bug: fast-scrolling a roadmap page on a phone
// viewport showed content blanking out for a moment before reappearing. Root cause:
// #444's mobile checklist-row layout fix (`.check-item { flex-wrap: wrap }`, Edit/⏱
// controls pushed onto their own row under `≤480px`) made real mobile rows
// significantly taller than `ROW_HEIGHT_ESTIMATE` (67px, measured on desktop's
// single-line rows) — but both the top/bottom spacer sizing (`sumRowHeights()`) and the
// scroll-position-to-row-index math (`virtualizeOpenSections()`) used that fixed
// constant as their *only* estimate for any row not yet individually measured. Every
// row starts unmeasured (a real height is only captured the moment a row is pruned out
// of the mounted window — see `pruneMountedRowsFromTop/Bottom` below), so on a phone,
// where every row is taller than the estimate, the spacers stayed systematically
// undersized and the index math mounted the wrong window — both self-correct once
// enough rows get individually measured, but the correction itself is a sudden,
// visible layout jump (spacer heights snapping to their real size mid-scroll), which is
// what a fast scroll perceives as a momentary blank/disappearing region before content
// reappears in the right place.
//
// Fix: track a running average of every row height actually measured so far
// (`_measuredHeightSum`/`_measuredHeightCount`, updated by `recordMeasuredHeight()`)
// and use that average — not the fixed constant — as the estimate for any row that
// hasn't been individually measured yet. `measureMountedRows()` also seeds this average
// from whatever's already mounted the first time a section is virtualized, instead of
// waiting for the first prune to happen, so the very first scroll on a phone already
// uses a mobile-accurate estimate rather than the desktop-tuned constant. The constant
// itself is kept only as the true cold-start fallback (nothing measured anywhere yet).

// Wraps a section's item rows in a single container with a top/bottom spacer,
// instead of rendering every row's DOM node directly under `.phase-body`.
// Every row is still built and mounted here, up front — pruning (removing
// far-off-screen rows and growing the matching spacer) only happens later,
// off a scroll/resize event, via syncSectionRowsWindow() below. This means a
// freshly-rendered or freshly-opened phase-card is byte-for-byte the same DOM
// shape it always was — the FLIP open/close animation's `scrollHeight`
// measurement (animatePhaseBody()) is never affected by anything in this
// file, since nothing is ever pruned until after that settles.
export function buildSectionRows(items, renderItemRow) {
  const topSpacer = el('div', { className: 'row-spacer', 'aria-hidden': 'true' });
  const bottomSpacer = el('div', { className: 'row-spacer', 'aria-hidden': 'true' });
  const wrapper = el('div', { className: 'section-rows' }, [topSpacer, ...items.map(renderItemRow), bottomSpacer]);
  wrapper._items = items;
  wrapper._renderRow = renderItemRow;
  wrapper._mountStart = 0;
  wrapper._mountEnd = items.length;
  wrapper._topSpacer = topSpacer;
  wrapper._bottomSpacer = bottomSpacer;
  // Per-row measured height, seeded with 0 ("unknown" — a real rendered row is never
  // 0px tall) and overwritten with a row's real getBoundingClientRect().height the
  // moment it's pruned (i.e. the one point a row's real height is known but about to
  // stop being directly measurable) — this is what lets the spacers stay accurate even
  // for a row taller than the estimate (wrapped inline resources, an unusually long
  // title, or #444's mobile-wrapped layout) instead of compounding a fixed-height
  // guess. Deliberately *not* seeded with ROW_HEIGHT_ESTIMATE: `sumRowHeights()` below
  // only falls back to its caller-supplied estimate for a falsy entry, so a truthy
  // placeholder here would make that fallback unreachable for any row that hasn't
  // actually been measured yet — silently reintroducing the exact "always trust the
  // 67px constant" bug this whole block exists to fix.
  wrapper._rowHeights = new Array(items.length).fill(0);
  // Parallel to `_rowHeights` — tracks which indices hold a *real* measured height,
  // so `recordMeasuredHeight()` can maintain a running sum/count without
  // double-counting a row measured twice.
  wrapper._rowMeasured = new Array(items.length).fill(false);
  wrapper._measuredHeightSum = 0;
  wrapper._measuredHeightCount = 0;
  wrapper._initiallyMeasured = false;
  return wrapper;
}

// Running-average estimate of this section's real row height, falling back to the
// cold-start constant only until at least one row has actually been measured — see
// this block's own comment above for why a single fixed constant isn't enough.
export function estimateRowHeight(wrapper) {
  return wrapper._measuredHeightCount > 0
    ? wrapper._measuredHeightSum / wrapper._measuredHeightCount
    : ROW_HEIGHT_ESTIMATE;
}

// Records (or updates) index `idx`'s real measured height, keeping
// `_measuredHeightSum`/`_measuredHeightCount` in sync so `estimateRowHeight()` stays a
// true running average rather than drifting on repeated re-measurement of the same row.
export function recordMeasuredHeight(wrapper, idx, height) {
  if (!height) return;
  if (wrapper._rowMeasured[idx]) {
    wrapper._measuredHeightSum += height - wrapper._rowHeights[idx];
  } else {
    wrapper._rowMeasured[idx] = true;
    wrapper._measuredHeightSum += height;
    wrapper._measuredHeightCount++;
  }
  wrapper._rowHeights[idx] = height;
}

// Seeds the running average from whatever's already mounted, the first time a section
// is virtualized — without this, the very first scroll pass has nothing measured yet
// and falls all the way back to the desktop-tuned `ROW_HEIGHT_ESTIMATE`, which is
// exactly the mismatch that caused the mobile blank-flash bug this block fixes.
function measureMountedRows(wrapper) {
  if (wrapper._initiallyMeasured) return;
  wrapper._initiallyMeasured = true;
  let node = wrapper._topSpacer.nextElementSibling;
  let idx = wrapper._mountStart;
  while (node && node !== wrapper._bottomSpacer) {
    recordMeasuredHeight(wrapper, idx, node.getBoundingClientRect().height);
    node = node.nextElementSibling;
    idx++;
  }
}

export function sumRowHeights(heights, start, end, fallback) {
  let sum = 0;
  for (let i = start; i < end; i++) sum += heights[i] || fallback;
  return sum;
}

// Reconciles one section's mounted-row window to [desiredStart, desiredEnd)
// (item indices), inserting/removing real `.check-item` DOM nodes and
// resizing the top/bottom spacers to match — direct DOM property mutation
// (`.style.height`), not the CSP-blocked inline `style` attribute (same safe
// pattern `animatePhaseBody()`/`tooltip.js`/`dropdown.js` already use, see
// their own comments). No-op if the window hasn't actually changed.
//
// issue #470, and its own follow-up — split into a resolve phase (every
// layout-forcing `getBoundingClientRect()` read, zero DOM writes) and an
// apply phase (every DOM write, zero geometry reads), rather than one
// function that interleaves both. The first #470 fix batched reads *within*
// one section's own prune calls (one forced layout per section instead of
// one per pruned row), which fixed the common case — but a roadmap with
// several/many sections open at once still paid one forced layout *per open
// section*, since each section's writes dirty the layout the next section's
// own reads depend on. Java Backend (19 phases) is the one built-in template
// big enough for that per-section cost to still read as a brief flicker
// under a very fast real scroll, even after the first fix — every other
// template's smaller phase count kept it below the threshold of visibility.
// `virtualizeOpenSections()` below now resolves every currently-open
// section's plan first (all reads, in one pass, no writes anywhere) and only
// then applies every plan (all writes) — collapsing the whole batch down to
// one forced layout for however many sections happen to be open, not one
// per section. Output is byte-identical to the pre-split code — same rows
// removed, same heights recorded, same final `_mountStart`/`_mountEnd` in
// every case (verified against `tests/unit/dashboard.test.js`'s existing
// virtualization suites, none of which needed updating for this change).

// Pure DOM traversal via `.nextElementSibling`/`.previousElementSibling` —
// neither forces a layout recalculation (only a geometry-reading call like
// `getBoundingClientRect()` does), so these collect *which* rows would need
// pruning without costing anything layout-wise on their own.
function collectPrunableRowsFromTop(wrapper, start) {
  const rows = [];
  let rowEl = wrapper._topSpacer.nextElementSibling;
  for (let idx = wrapper._mountStart; idx < start; idx++) {
    if (!rowEl || rowEl === wrapper._bottomSpacer) continue;
    rows.push({ idx, rowEl });
    rowEl = rowEl.nextElementSibling;
  }
  return rows;
}

function collectPrunableRowsFromBottom(wrapper, end) {
  const rows = [];
  let rowEl = wrapper._bottomSpacer.previousElementSibling;
  for (let idx = wrapper._mountEnd - 1; idx >= end; idx--) {
    if (!rowEl || rowEl === wrapper._topSpacer) continue;
    rows.push({ idx, rowEl });
    rowEl = rowEl.previousElementSibling;
  }
  return rows;
}

function collectAllMountedRows(wrapper) {
  const rows = [];
  let rowEl = wrapper._topSpacer.nextElementSibling;
  let idx = wrapper._mountStart;
  while (rowEl && rowEl !== wrapper._bottomSpacer) {
    rows.push({ idx, rowEl });
    rowEl = rowEl.nextElementSibling;
    idx++;
  }
  return rows;
}

// Removes every row in `rows`, recording each one's already-measured real
// height first — a pure write, no `getBoundingClientRect()` call of its own;
// every height was already read up front by `resolveSectionPlan()`.
function removeMeasuredRows(wrapper, rows, heights) {
  rows.forEach((row, i) => {
    recordMeasuredHeight(wrapper, row.idx, heights[i]);
    row.rowEl.remove();
  });
}

// Resolves everything one section's mounted-window reconciliation needs,
// doing every layout-forcing read up front and *no DOM write at all* — see
// this block's own comment above for why the split matters. Returns null
// when there's nothing to do for this section this frame.
export function resolveSectionPlan(wrapper, desiredStart, desiredEnd) {
  const items = wrapper._items;
  const start = Math.max(0, Math.min(desiredStart, items.length));
  const end = Math.max(start, Math.min(desiredEnd, items.length));
  if (start === wrapper._mountStart && end === wrapper._mountEnd) return null;

  // Real, reported bug (issue #465 follow-up): a fast scroll can jump
  // [start, end) past the currently mounted range with zero overlap — the
  // buffer zone gets skipped entirely between two virtualize passes. Pruning
  // from just one side would leave the other side's pointer stale (see the
  // historical account in this repo's git history for the exact corruption
  // that caused). Collapsing the whole old window first — reading every
  // currently-mounted row's height up front, same as every other branch here
  // — keeps that fix intact under this plan shape: nothing survives a
  // non-overlapping jump, so the entire new [start, end) window is mounted
  // fresh in the apply phase.
  const nonOverlapping = start >= wrapper._mountEnd || end <= wrapper._mountStart;
  // Mirrors pruneMountedRowsFromTop/Bottom's original early-return guards
  // exactly (`wrapper._mountStart >= start` / `wrapper._mountEnd <= end`) —
  // whether a side is pruned at all, not just how many rows, has to be
  // decided from the *original* mountStart/mountEnd, before anything in this
  // plan gets applied.
  const pruneTop = !nonOverlapping && wrapper._mountStart < start;
  const pruneBottom = !nonOverlapping && wrapper._mountEnd > end;
  const topRows = pruneTop ? collectPrunableRowsFromTop(wrapper, start) : [];
  const bottomRows = pruneBottom ? collectPrunableRowsFromBottom(wrapper, end) : [];
  const collapseRows = nonOverlapping ? collectAllMountedRows(wrapper) : [];

  const rowsToMeasure = [...topRows, ...bottomRows, ...collapseRows];
  const heights = rowsToMeasure.map(row => row.rowEl.getBoundingClientRect().height);
  const topHeights = heights.slice(0, topRows.length);
  const bottomHeights = heights.slice(topRows.length, topRows.length + bottomRows.length);
  const collapseHeights = heights.slice(topRows.length + bottomRows.length);

  return { wrapper, start, end, nonOverlapping, pruneTop, pruneBottom, topRows, topHeights, bottomRows, bottomHeights, collapseRows, collapseHeights };
}

// Applies a plan resolved by resolveSectionPlan() — every operation here is
// a DOM write (row removal, row insertion, a spacer's `.style.height`) or
// plain JS bookkeeping; nothing here calls `getBoundingClientRect()` or any
// other layout-forcing read, so applying N plans back-to-back costs exactly
// the writes themselves, with no forced layout recalculation interleaved.
export function applySectionPlan(plan) {
  const { wrapper, start, end, nonOverlapping, pruneTop, pruneBottom, topRows, topHeights, bottomRows, bottomHeights, collapseRows, collapseHeights } = plan;

  if (nonOverlapping) {
    removeMeasuredRows(wrapper, collapseRows, collapseHeights);
    wrapper._mountStart = start;
    wrapper._mountEnd = start;
  } else {
    removeMeasuredRows(wrapper, topRows, topHeights);
    if (pruneTop) wrapper._mountStart = start;
    removeMeasuredRows(wrapper, bottomRows, bottomHeights);
    if (pruneBottom) wrapper._mountEnd = end;
  }

  mountRowsAtTop(wrapper, start);
  mountRowsAtBottom(wrapper, end);

  const fallback = estimateRowHeight(wrapper);
  wrapper._topSpacer.style.height = `${sumRowHeights(wrapper._rowHeights, 0, wrapper._mountStart, fallback)}px`;
  wrapper._bottomSpacer.style.height = `${sumRowHeights(wrapper._rowHeights, wrapper._mountEnd, wrapper._items.length, fallback)}px`;
}

function mountRowsAtTop(wrapper, start) {
  while (wrapper._mountStart > start) {
    wrapper._mountStart--;
    wrapper._topSpacer.after(wrapper._renderRow(wrapper._items[wrapper._mountStart]));
  }
}

function mountRowsAtBottom(wrapper, end) {
  while (wrapper._mountEnd < end) {
    wrapper._bottomSpacer.before(wrapper._renderRow(wrapper._items[wrapper._mountEnd]));
    wrapper._mountEnd++;
  }
}

// Single-section convenience wrapper over resolve+apply — this is what every
// existing test, and any future single-section call site, calls directly.
// `virtualizeOpenSections()` below deliberately does *not* call this: it
// needs to resolve every open section's plan before applying any of them,
// which this combined function can't express on its own.
export function syncSectionRowsWindow(wrapper, desiredStart, desiredEnd) {
  const plan = resolveSectionPlan(wrapper, desiredStart, desiredEnd);
  if (plan) applySectionPlan(plan);
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
        // issue #433 — a wrapper with top/bottom spacers, not a bare list of
        // rows, so far-off-screen rows can be pruned from the DOM later
        // without disturbing this section's total flowed height. See this
        // file's block comment above buildSectionRows() for the full story.
        buildSectionRows(section.items, renderItemRow),
        renderAddRow(phase, section)
      ]),
      (isCustomRoadmap && phase.id) ? renderInlineCreate('New section name…', '+ Add section', title => onAddSection(phase.id, title)) : null
    ].filter(Boolean))
  ]);
}


export function renderDashboard(app, { user, store, dailyTodoStore, activityLogStore }) {
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
  // Issue #491 — "Not today" reshuffles the Next up card's selection for the
  // rest of this session only; never persisted, never marks a topic done.
  // Cleared implicitly the moment a topic finishes done (it drops out of the
  // unfinished pool selectNextUpTopics reads regardless of this set).
  let nextUpExcludedIds = new Set();
  // Issue #379 — keyboard-nav focus state, declared up here (not down by the
  // keydown-handler wiring below) since render() reads focusedRowId to
  // reapply the visual focus ring after a full re-render, and render() is
  // both defined and first called earlier in this function than the
  // keyboard-nav wiring itself; a `let` referenced before its own
  // declaration executes throws in its temporal dead zone.
  let focusedRowId = null;
  let shortcutsOverlay = null;

  const offlineBanner = el('div', { className: 'offline-banner', id: 'offlineBanner' }, [
    el('span', { className: 'sync-dot error' }),
    ' Offline — changes stay on this device until you reconnect.'
  ]);

  const doneStat = el('span', { className: 'roadmap-summary-count-number', text: '0' });
  const doneStatTotal = el('span', { className: 'roadmap-summary-count-total', text: '/ 0' });
  const percentStat = el('span', { className: 'roadmap-summary-count-number', text: '0' });
  // Issue #489 — the two `.stat-tile`/`.stat-tile-ring` boxes (issue #6 Phase
  // 4.1) are replaced by one block: name + save state, a large "N / M topics
  // done" figure, a right-aligned percentage, and a 12px linear bar.
  // `progressRing.js` (imported below) stays in use at phase-head call sites
  // (a ring is harder to read at a glance than a bar for the older end of
  // this app's audience, at this larger summary scale — issue #489) — only
  // this one 64px ring instance is removed.
  const roadmapSummaryBarFill = el('div', { className: 'roadmap-summary-bar-fill' });
  const roadmapMetaRow = el('p', { className: 'roadmap-meta-row', text: '' });
  // Issue #491 — "Next up" card, rebuilt in place (replaceChildren) from
  // updateNextUpCard() below, called from both render() and the cosmetic-
  // done-toggle fast path (patchDoneStates()) — same "recompute on every
  // snapshot, not just structural ones" reasoning updateReviewDueBadge()
  // already uses, since a done toggle is exactly the thing that changes
  // this card's own selection.
  const nextUpCard = el('div', { className: 'card next-up-card', hidden: true });
  // Issue #477 — rebuilt (via replaceChildren, with the outgoing select's
  // own _cleanup() called first) on every render()/patchDoneStates() pass,
  // same lifecycle every other filter-row element here already has; see
  // renderPriorityFilterSelect()'s own comment for why counts are baked
  // into option labels rather than patched in place.
  const prioritySelectContainer = el('div', { className: 'priority-select-wrap' });
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
  // Issue #488 — no longer rendered in the topbar; kept computed/updated,
  // unattached, same "awaiting #489's new home" note as the daily-todo/
  // review-due badges above. `saveBadge` (the fixed-corner toast-like
  // indicator) already carries this same save-state to the user regardless.
  const syncPill = el('span', { className: 'sync-pill', text: 'Syncing' });

  const userPillClass = user.isAnonymous ? 'guest' : 'online';
  // Surfaced in the hero so it's never ambiguous which roadmap is currently
  // loaded — easy to lose track of after switching templates a few times. A
  // custom roadmap (issue #4) has no entry in the template registry, so its
  // name/icon come from customRoadmaps meta instead of getTemplate().
  //
  // Extracted to a function (issue #283): the global topic search's
  // cross-roadmap selection can call store.switchRoadmap() while dashboard.js
  // is already mounted on /app (no navigation, so renderDashboard() itself
  // never re-runs) — activeTemplateId/isCustomRoadmap/currentTemplate used to
  // be resolved once at mount and never touched again, leaving the header
  // badge (and, since render() reads the same isCustomRoadmap closure
  // variable, the custom-roadmap-only "+ Add phase"/"+ Add section" controls
  // too) stuck showing the roadmap active *before* the switch. refreshRoadmapIdentity()
  // below reassigns all three from handleSnapshot() whenever activeTemplateId
  // actually changed, ahead of the render(snapshot) call that already runs on
  // every structural change — so this is a single fix, not two.
  function resolveCurrentTemplate(snapshot, templateId) {
    if (store.isCustomRoadmapId(templateId)) {
      const custom = snapshot.customRoadmaps.find(r => r.id === templateId);
      return { icon: createIcon('edit', { size: 'sm' }), name: custom ? custom.title : 'Custom roadmap' };
    }
    return getTemplate(templateId);
  }

  const initialSnapshot = store.getSnapshot();
  let activeTemplateId = initialSnapshot.activeTemplateId;
  let isCustomRoadmap = store.isCustomRoadmapId(activeTemplateId);
  let currentTemplate = resolveCurrentTemplate(initialSnapshot, activeTemplateId);

  // currentTemplate.icon is a decorativeIcon.js name string for a built-in
  // template (getTemplate(), issue #136 Phase 2 — was a raw emoji string
  // before), or the shared createIcon() "edit" node for a custom roadmap's
  // fallback icon (issue #107). Held as stable elements (not rebuilt inline
  // in the header markup below) so refreshRoadmapIdentity() can update them
  // in place after a same-page cross-roadmap switch (issue #283).
  const roadmapBadgeIconSlot = el('span', { 'aria-hidden': 'true' }, [
    typeof currentTemplate.icon === 'string'
      ? createDecorativeIcon(currentTemplate.icon, { size: 'sm' })
      : currentTemplate.icon
  ]);
  const roadmapBadgeNameEl = el('span', { text: `${currentTemplate.name} roadmap` });

  function refreshRoadmapIdentity(snapshot) {
    if (snapshot.activeTemplateId === activeTemplateId) return;
    activeTemplateId = snapshot.activeTemplateId;
    isCustomRoadmap = store.isCustomRoadmapId(activeTemplateId);
    currentTemplate = resolveCurrentTemplate(snapshot, activeTemplateId);
    roadmapBadgeIconSlot.replaceChildren(
      typeof currentTemplate.icon === 'string'
        ? createDecorativeIcon(currentTemplate.icon, { size: 'sm' })
        : currentTemplate.icon
    );
    roadmapBadgeNameEl.textContent = `${currentTemplate.name} roadmap`;
    const breadcrumbEl = topbar.querySelector('.app-topbar-breadcrumb');
    if (breadcrumbEl) breadcrumbEl.textContent = `Roadmaps / ${currentTemplate.name}`;
  }

  function persistUi() {
    store.setUiState({
      filter: activeFilter,
      search: searchQuery,
      openPhases: [...openPhases]
    });
  }

  // Issue #477 — rebuilds prioritySelectContainer's createSelect() instance
  // from the current items/activeFilter, cleaning up the outgoing instance
  // first (it owns a document click listener + a portaled listbox — see
  // select.js's own _cleanup() contract). Called from both render() (every
  // structural change) and patchDoneStates() (every plain done-toggle, which
  // still needs to refresh each option's "done/total" count).
  function refreshPrioritySelect(allItems) {
    prioritySelectContainer.firstElementChild?._cleanup?.();
    prioritySelectContainer.replaceChildren(renderPriorityFilterSelect(allItems, activeFilter, p => {
      activeFilter = p;
      persistUi();
      render(store.getSnapshot());
    }));
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

  // One-shot cross-roadmap signal (issue #283) — commandPalette.js's global topic
  // search (wired in topbar.js) writes the target item's id to KEYS.OPEN_ITEM right
  // before calling store.switchRoadmap()+navigate('/app') for a result in a
  // *different* roadmap than the one currently active. Read once, then cleared
  // immediately, same "read once, then clear" precedent as
  // applyScrollToPhaseSignal() above. Unlike that signal, this one also has a
  // same-page trigger (the 'ascent:open-item' window event, below) — switching to a
  // roadmap that's already the active one is a no-op in roadmapStore.js, so no
  // navigation or structural re-render happens for a same-roadmap search result,
  // and this function needs to run immediately instead of waiting for a mount that
  // was never going to happen.
  function applyOpenItemSignal() {
    const raw = sessionStorage.getItem(KEYS.OPEN_ITEM);
    if (!raw) return;
    sessionStorage.removeItem(KEYS.OPEN_ITEM);
    let payload;
    try {
      payload = JSON.parse(raw);
    } catch {
      return;
    }
    const targetItem = store.getSnapshot().allItems[payload?.itemId];
    if (!targetItem || targetItem.deleted) return;
    const card = content.querySelector(`.phase-card[data-phase-title="${CSS.escape(targetItem.phase)}"]`);
    if (card) {
      const pi = Number(card.dataset.phase);
      if (!openPhases.has(pi)) {
        openPhases.add(pi);
        persistUi();
        render(store.getSnapshot());
      }
      requestAnimationFrame(() => {
        content.querySelector(`.phase-card[data-phase-title="${CSS.escape(targetItem.phase)}"]`)
          ?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      });
    }
    openItemPanel({
      item: targetItem,
      allItems: store.getSnapshot().items,
      onSave: patch => store.updateItem(targetItem.id, patch),
      onDelete: () => store.removeItem(targetItem.id)
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
      saveBadge.textContent = user.isAnonymous ? 'Saved locally' : 'Saved';
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

    syncPill.textContent = user.isAnonymous ? 'Saved on this device' : (state === 'synced' ? 'Saved' : state === 'saving' ? 'Saving…' : state === 'error' ? 'Save failed' : 'Ready');
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
  // Issue #381 — a topic with an unmet prerequisite renders locked and can't
  // be toggled done. A dangling reference (the prerequisite topic was since
  // deleted) or one already marked done is treated as "no prerequisite" —
  // the lock is purely derived at render/toggle time from the current
  // snapshot, never a separate persisted "unlocked" flag to keep in sync.
  function getPrerequisite(item) {
    if (!item.prerequisiteItemId) return null;
    const prerequisite = store.getSnapshot().allItems[item.prerequisiteItemId];
    if (!prerequisite || prerequisite.deleted) return null;
    return prerequisite;
  }

  function isBlocked(item) {
    const prerequisite = getPrerequisite(item);
    return !!prerequisite && !prerequisite.done;
  }

  function buildPrerequisiteLockChip(prerequisite) {
    return el('span', {
      className: 'prerequisite-lock-chip',
      'data-action': 'prerequisite-lock',
      title: `Blocked by "${prerequisite.title}" — complete it first to unlock this topic.`
    }, [createIcon('lock', { size: 'xs' }), ` Blocked by: ${prerequisite.title}`]);
  }

  function toggleDone(item, checkBoxEl) {
    const live = store.getSnapshot().allItems[item.id];
    if (!live || isBlocked(live)) return;
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
    const { openAddToDailyTodoModal } = await import('../components/addToDailyTodoModal.js');
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

  function formatTrackedMinutes(seconds) {
    const mins = Math.round(seconds / 60);
    if (mins < 60) return `${mins} min tracked`;
    const hrs = Math.floor(mins / 60);
    const rem = mins % 60;
    return rem ? `${hrs} hr ${rem} min tracked` : `${hrs} hr tracked`;
  }

  // "Must do · 2 links · 25 min tracked" — omits any segment that has
  // nothing to say (no links, no time tracked yet).
  function buildRowMetaText(item) {
    const parts = [priorityLabel(item.priority)];
    if (item.resources?.length) parts.push(`${item.resources.length} link${item.resources.length === 1 ? '' : 's'}`);
    if (item.timeSpentSeconds > 0) parts.push(formatTrackedMinutes(item.timeSpentSeconds));
    return parts.join(' · ');
  }

  function editItemPanelProps(item) {
    return {
      item,
      allItems: store.getSnapshot().items,
      onSave: patch => store.updateItem(item.id, patch),
      onDelete: () => store.removeItem(item.id)
    };
  }

  async function handleDeleteItem(item) {
    if (!await confirmDialog({
      title: `Delete "${item.title}"?`,
      message: 'This removes the topic and its resources from your roadmap. This cannot be undone.',
      confirmText: 'Delete',
      danger: true
    })) return;
    store.removeItem(item.id);
    showToast(`Deleted "${item.title}".`, 'success');
  }

  // Issue #486 (B1) — every per-row secondary control (Open/Edit, Add to
  // today, Mark reviewed, Add a link, Delete) collapses into this single ⋮
  // overflow menu, replacing the row's old always-hover-visible button
  // cluster. "Mark reviewed" only appears while the topic is actually
  // review-due, matching the old button's own gating.
  function buildRowOverflowMenu(item) {
    const trigger = el('button', {
      type: 'button',
      className: 'check-item-overflow-btn',
      'data-action': 'overflow',
      'aria-label': `More actions for ${item.title}`,
      title: 'More actions',
      onClick: e => e.stopPropagation()
    }, [createIcon('overflow', { size: 'xs' })]);
    const actions = [
      { text: 'Open', onClick: () => openItemPanel(editItemPanelProps(item)) },
      dailyTodoStore ? { text: 'Add to today', onClick: () => handleAddToDailyTodo(item) } : null,
      isReviewDue(item) ? {
        text: 'Mark reviewed',
        onClick: () => {
          store.updateItem(item.id, { lastReviewedAt: Date.now() });
          showToast(`Marked "${item.title}" as reviewed.`, 'success');
        }
      } : null,
      { text: 'Add a link', onClick: () => openItemPanel({ ...editItemPanelProps(item), focusField: 'resources' }) },
      { text: 'Delete', danger: true, onClick: () => handleDeleteItem(item) }
    ].filter(Boolean);
    const dropdown = createDropdown(trigger, actions, { align: 'end' });
    dropdown.classList.add('check-item-overflow');
    return dropdown;
  }

  // Issue #6 Phase 4.2 — `sectionIdx` (this item's position within its own
  // section) feeds the stagger delay for newly-added rows only; existing
  // rows re-rendered on a structural change (e.g. toggling a different
  // phase open) never carry `entering` since their id is already in
  // knownItemIds from a prior render.
  //
  // Issue #486 (B1) — rebuilt as a fixed two-line row (checkbox, title, one
  // grey meta line) plus the single ⋮ overflow menu above. Priority is now a
  // 3px `check-item-p-{priority}` left edge (CSS), not a pill; notes glyph,
  // "completed via todo" glyph, timer button, "Mark reviewed" button, and
  // "Edit" all moved into that menu.
  function renderItemRow(item, sectionIdx = 0) {
    const isNew = !knownItemIds.has(item.id);
    // No inline `style` attribute — index.html's CSP has no 'unsafe-inline'
    // in style-src (see .claude/rules/auth-security.md), so an inline
    // animation-delay would be silently dropped by the browser. A capped
    // set of discrete delay classes (CSS below) gets the same staggered
    // fan-in effect without violating it.
    const enteringClass = isNew ? `entering entering-delay-${Math.min(sectionIdx, 6)}` : '';
    const prerequisite = getPrerequisite(item);
    const locked = !!prerequisite && !prerequisite.done;
    // Issue #6 Phase 9 — role="checkbox" moved off the whole row and onto
    // just .check-box below. axe-core's no-focusable-content rule (WCAG
    // 4.1.2) correctly flags a role="checkbox" element that contains other
    // focusable descendants — the ⋮ overflow trigger inside this row is a
    // real, independently-focusable control, which an ARIA checkbox (a leaf
    // widget in the accessibility tree) isn't allowed to contain. The row
    // itself keeps its onClick (click-anywhere-to-toggle, guarded by the
    // data-action convention below) purely as a mouse/touch convenience — it
    // carries no ARIA role of its own now, so it isn't part of the
    // accessibility tree as an interactive control; keyboard toggling now
    // happens via .check-box's own role/tabindex/keydown handling.
    return el('div', {
      className: `check-item check-item-p-${item.priority} ${item.done ? 'done' : ''} ${locked ? 'locked' : ''} ${enteringClass}`,
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
        'aria-disabled': String(locked),
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
        el('span', { className: 'check-meta', text: buildRowMetaText(item) }),
        locked ? buildPrerequisiteLockChip(prerequisite) : null,
        activeFilter === 'RESOURCES' ? renderInlineResources(item) : null
      ].filter(Boolean)),
      buildRowOverflowMenu(item)
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
    if (!confettiAlreadyFired) {
      import('../components/confetti.js').then(({ triggerConfetti }) => triggerConfetti());
    }
    // issue #474 — a failure here (e.g. generateBadgeCard()'s font-load await
    // rejecting) used to be swallowed with zero trace. The primary completion
    // feedback (toast + confetti above) has already fired independently by
    // this point, so there's nothing more to show the user for an optional
    // share card that failed to generate — but it must not vanish silently,
    // matching this app's own "log the raw error to the console" convention
    // (.claude/rules/content-style.md) that every other catch block follows.
    import('../components/shareModal.js').then(({ openBadgeShareModal }) => openBadgeShareModal(kind, label).catch(error => {
      console.error('Failed to generate/open the completion share card', error);
    }));
    return true;
  }

  // issue #433 — recomputes, for every currently-open phase-card's section,
  // which rows should be mounted vs. pruned given the current scroll
  // position, and reconciles the DOM to match. Skips a section whose
  // phase-body is mid-open/close FLIP animation (`.phase-body-animating`,
  // animatePhaseBody()) so a `scroll` event that happens to land during that
  // animation never prunes rows out from under `animatePhaseBody()`'s own
  // `scrollHeight` measurement.
  //
  // issue #470 follow-up — resolves every currently-open section's plan
  // first (a read-only pass: each wrapper's own `getBoundingClientRect()`
  // plus `resolveSectionPlan()`'s own row-height reads, with zero DOM writes
  // anywhere in this loop) and only *then* applies every plan in a second
  // pass. Calling `syncSectionRowsWindow()` per wrapper inline here — read,
  // then immediately write, one wrapper at a time — was already fixed once
  // for the within-a-section case (issue #470's first fix), but still cost
  // one forced layout recalculation per *open section*: wrapper i's own
  // `getBoundingClientRect()` read needs a fresh layout the moment wrapper
  // i-1's writes (row removal/insertion, spacer resize) have run. On the
  // Java Backend template specifically — 19 phases, the one built-in roadmap
  // with enough sections open at once for that per-section cost to still
  // read as a brief flicker under a very fast real scroll — this two-phase
  // split collapses however many sections are open into one forced layout
  // total instead of one per section. See resolveSectionPlan()'s own comment
  // (above syncSectionRowsWindow()) for the full reasoning and the
  // read/write split it and applySectionPlan() are each held to.
  function virtualizeOpenSections() {
    const buffer = window.innerHeight * VIRTUALIZE_BUFFER_VIEWPORTS;
    const desiredTop = -buffer;
    const desiredBottom = window.innerHeight + buffer;
    const plans = [];
    content.querySelectorAll('.phase-card.open .section-rows').forEach(wrapper => {
      if (!wrapper._items || !wrapper._items.length) return;
      if (wrapper.closest('.phase-body-animating')) return;
      measureMountedRows(wrapper);
      const rowHeight = estimateRowHeight(wrapper);
      const rect = wrapper.getBoundingClientRect();
      const start = Math.floor((desiredTop - rect.top) / rowHeight);
      const end = Math.ceil((desiredBottom - rect.top) / rowHeight);
      const plan = resolveSectionPlan(wrapper, start, end);
      if (plan) plans.push(plan);
    });
    plans.forEach(applySectionPlan);
  }

  // rAF-throttled, matching this file's existing scroll-driven update
  // conventions (e.g. scrollPerfMode.js) — a `scroll` event can fire many
  // times per frame, and there's nothing to gain from recomputing more than
  // once per paint.
  let virtualizeRaf = null;
  function scheduleVirtualizeRows() {
    if (virtualizeRaf != null) return;
    virtualizeRaf = requestAnimationFrame(() => {
      virtualizeRaf = null;
      virtualizeOpenSections();
    });
  }

  function render(snapshot) {
    const allItems = snapshot.items;
    const filtered = filterItems(allItems, { priority: activeFilter, query: searchQuery, tag: tagFilter });
    const stats = countStats(allItems);
    doneStatTotal.textContent = `/ ${stats.total}`;
    roadmapMetaRow.textContent = formatSavedAgo(lastSyncedAt == null ? null : Date.now() - lastSyncedAt);
    updateSaveBadge(snapshot);
    updateReviewDueBadge(allItems);
    updateNextUpCard(snapshot);
    roadmapSummaryBarFill.style.width = `${stats.pct}%`;
    if (hasAnimatedStats) {
      doneStat.textContent = String(stats.done);
      percentStat.textContent = String(stats.pct);
    } else {
      animateCountUp(doneStat, stats.done);
      animateCountUp(percentStat, stats.pct);
      hasAnimatedStats = true;
    }

    const hasActiveFilters = activeFilter !== 'ALL' || !!tagFilter;
    clearFiltersBtn.hidden = !hasActiveFilters && !searchQuery;
    filterPanelFooter.hidden = !hasActiveFilters && !searchQuery;
    const activeFilterCount = (activeFilter !== 'ALL' ? 1 : 0) + (tagFilter ? 1 : 0);
    filterBtnBadge.hidden = activeFilterCount === 0;
    filterBtnBadge.textContent = String(activeFilterCount);
    const summaryParts = [];
    if (activeFilter !== 'ALL') {
      summaryParts.push(activeFilter === 'RESOURCES' ? 'Links' : activeFilter === 'REVIEW' ? 'Review due' : priorityLabel(activeFilter));
    }
    if (tagFilter) summaryParts.push(`tag "${tagFilter}"`);
    filterPanelSummary.textContent = summaryParts.length ? `Filtering by ${summaryParts.join(' and ')}.` : '';

    refreshPrioritySelect(allItems);
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

    // A full render() tears down and rebuilds every row's DOM node — reapply
    // the (purely visual) keyboard-focus ring if the previously-focused row
    // still exists and is still visible; drop it otherwise rather than
    // leaving a stale id nothing points at.
    if (focusedRowId != null) {
      const stillVisible = getVisibleRows().some(r => r.dataset.id === focusedRowId);
      if (stillVisible) {
        content.querySelector(`.check-item[data-id="${CSS.escape(focusedRowId)}"]`)?.classList.add('check-item-focused');
      } else {
        focusedRowId = null;
      }
    }

    // issue #433 — a fresh full render() always mounts every row (see
    // buildSectionRows()'s own comment), so a pruning pass right after is
    // what actually shrinks the DOM back down for whichever phase-cards are
    // already open and far from the current scroll position (a restored
    // `openPhases` from a previous session, or a phase reopened via
    // KEYS.SCROLL_TO_PHASE/the command palette's cross-roadmap search).
    scheduleVirtualizeRows();
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
    roadmapSummaryBarFill.style.width = `${stats.pct}%`;
    updateSaveBadge(snapshot);
    updateReviewDueBadge(allItems);
    updateNextUpCard(snapshot);
    roadmapMetaRow.textContent = formatSavedAgo(lastSyncedAt == null ? null : Date.now() - lastSyncedAt);

    filterContainer.querySelectorAll('.filter-chip').forEach(chip => {
      const { total, done } = priorityCounts(allItems, chip.dataset.p);
      const countEl = chip.querySelector('.chip-count');
      if (countEl) countEl.textContent = `${done}/${total}`;
    });
    refreshPrioritySelect(allItems);

    allItems.forEach(item => {
      const row = content.querySelector(`.check-item[data-id="${CSS.escape(item.id)}"]`);
      if (!row) return;
      row.classList.toggle('done', !!item.done);
      const checkBox = row.querySelector('.check-box');
      checkBox?.setAttribute('aria-checked', String(!!item.done));

      // Issue #381 — a plain `done` toggle is cosmetic and never bumps
      // structuralVersion (see this function's own doc comment above), but
      // it can still change *another* item's locked state if that item names
      // this one as its prerequisite. Recomputed here, on every snapshot,
      // rather than only on a structural re-render — otherwise a dependent
      // row would stay visibly locked until some unrelated structural change
      // happened to force a full render.
      const prerequisite = getPrerequisite(item);
      const locked = !!prerequisite && !prerequisite.done;
      row.classList.toggle('locked', locked);
      checkBox?.setAttribute('aria-disabled', String(locked));
      const existingChip = row.querySelector('.prerequisite-lock-chip');
      if (locked && !existingChip) {
        row.querySelector('.check-meta')?.after(buildPrerequisiteLockChip(prerequisite));
      } else if (locked && existingChip) {
        existingChip.title = `Blocked by "${prerequisite.title}" — complete it first to unlock this topic.`;
        existingChip.replaceChildren(createIcon('lock', { size: 'xs' }), ` Blocked by: ${prerequisite.title}`);
      } else if (!locked && existingChip) {
        existingChip.remove();
      }
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
    refreshRoadmapIdentity(snapshot);
    render(snapshot);
    // A cross-roadmap topic-search selection (issue #283) that required a real
    // store.switchRoadmap() call lands here — the switch bumps structuralVersion,
    // which is exactly the render this signal needs to already have happened
    // before it can find the target item's phase card in the DOM.
    applyOpenItemSignal();
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

  // Issue #487 — the priority select + Resources/Review chips + tag row (all
  // built above) used to render inline as two stacked `.toolbar` rows; they
  // now live inside a single filter panel opened from one "Filter" button,
  // reusing itemPanel.js's own `.panel-overlay`/`.item-panel`/`.panel-*`
  // classes rather than inventing a parallel overlay component — that gets
  // the existing side-slide-on-desktop/bottom-sheet-on-phone behavior (the
  // `.item-panel` ≤480px override, `.claude/rules/ui-styling.md`) for free,
  // plus `handleGlobalKeydown`'s existing `.item-panel` check that already
  // suppresses the j/k row-navigation shortcuts while any such panel is open.
  const filterPanelSummary = el('p', { className: 'filter-panel-summary' });
  const filterPanelFooter = el('div', { className: 'panel-footer filter-panel-footer' }, [
    filterPanelSummary,
    clearFiltersBtn
  ]);
  const filterPanelOverlay = el('div', {
    className: 'panel-overlay',
    onClick: e => { if (e.target === filterPanelOverlay) closeFilterPanel(); }
  });
  const filterPanelCard = el('aside', {
    className: 'item-panel filter-panel',
    role: 'dialog',
    'aria-modal': 'true',
    'aria-label': 'Filter topics'
  }, [
    el('div', { className: 'panel-header' }, [
      el('div', {}, [
        el('span', { className: 'panel-kicker', text: 'Filter' }),
        el('h2', { className: 'panel-title', text: 'Filter topics' })
      ]),
      el('button', {
        type: 'button',
        className: 'btn btn-ghost btn-icon',
        'aria-label': 'Close filter panel',
        onClick: () => closeFilterPanel()
      }, [createIcon('close', { size: 'sm' })])
    ]),
    el('div', { className: 'panel-body' }, [
      el('div', { className: 'filter-panel-section' }, [
        el('span', { className: 'toolbar-label', text: 'Priority' }),
        el('span', { className: 'priority-legend', text: 'Must do > Should do > Later' }),
        el('div', { className: 'priority-filter-row' }, [prioritySelectContainer, filterContainer])
      ]),
      el('div', { className: 'filter-panel-section' }, [
        el('span', { className: 'toolbar-label', text: 'Tags' }),
        tagFilterContainer
      ])
    ]),
    filterPanelFooter
  ]);
  filterPanelOverlay.append(filterPanelCard);

  let filterPanelOpen = false;
  let detachFilterPanelTrap = null;

  function openFilterPanel() {
    if (filterPanelOpen) return;
    filterPanelOpen = true;
    document.body.append(filterPanelOverlay);
    detachFilterPanelTrap = attachFocusTrap(filterPanelCard, { onEscape: closeFilterPanel });
    requestAnimationFrame(() => {
      filterPanelOverlay.classList.add('show');
      filterPanelCard.classList.add('show');
      filterPanelCard.querySelector('button, [href], input, select, textarea, [tabindex]')?.focus();
    });
  }

  function closeFilterPanel() {
    if (!filterPanelOpen) return;
    filterPanelOpen = false;
    detachFilterPanelTrap?.();
    detachFilterPanelTrap = null;
    filterPanelOverlay.classList.remove('show');
    filterPanelCard.classList.remove('show');
    setTimeout(() => filterPanelOverlay.remove(), 240);
    filterBtn.focus();
  }

  const filterBtnBadge = el('span', { className: 'filter-btn-badge', hidden: true });
  const filterBtn = el('button', {
    type: 'button',
    className: 'btn btn-secondary filter-toggle-btn',
    'aria-haspopup': 'dialog',
    onClick: () => openFilterPanel()
  }, ['Filter', filterBtnBadge]);

  const verificationBanner = createVerificationBanner(user);
  const guestBanner = createGuestBanner(user);
  const backupReminderBanner = createBackupReminderBanner({ user, store });
  const progressDigestBanner = activityLogStore ? createProgressDigestBanner({ user, store, activityLogStore }) : null;

  // Issue #490 (B5) — moved here from onboarding.js's "all roadmaps" picker
  // (`.claude/rules/roadmap-store.md`'s "Placement" note, now updated). The
  // store itself is still user-global, not per-roadmap — only where it's
  // rendered changed. `store` (the active roadmap) is threaded through the
  // same way it was on onboarding.js, so a todo linked to a roadmap topic
  // can resolve the linked roadmap's display name and mark that topic
  // done/not-done on completion.
  const dailyTodoPanel = dailyTodoStore ? createDailyTodoPanel(dailyTodoStore, store) : null;

  // Small header notification badge (not a per-roadmap feature — Daily Todos
  // are intentionally global, see onboarding.js) surfacing the soonest active
  // todo's countdown no matter which roadmap is currently open. Links to
  // /onboarding, the only page the actual todo list/editor lives on.
  // Issue #488 — no longer rendered in the topbar (crowding it out was the
  // whole point of that issue); kept computed/updated here, unattached,
  // since issue #489 (the single summary-card/progress-bar redesign) is
  // expected to give this a new home rather than dropping it outright.
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
  // Issue #488 — same "unattached, awaiting #489" note as dailyTodoNavBadge
  // above applies here too.
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
      // Issue #487 — the REVIEW chip now lives inside the filter panel, not
      // inline, so "jump straight to the REVIEW filter" has to open the
      // panel too, or the badge would silently change state the user can't
      // see without a second click.
      openFilterPanel();
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

  // Issue #491 — "Next up": up to three suggested topics, resumed from
  // wherever the user last worked (selectNextUpTopics(), pure). Rebuilt via
  // replaceChildren on every render()/patchDoneStates() pass rather than
  // patched in place — three rows is cheap enough that a full rebuild here
  // never needed the fine-grained DOM-patching treatment the (up to 484-row)
  // phase list gets.
  function updateNextUpCard(snapshot) {
    const { topics, complete } = selectNextUpTopics(snapshot.items, snapshot.phases, { excludeIds: nextUpExcludedIds });
    if (complete) {
      nextUpCard.hidden = false;
      nextUpCard.replaceChildren(
        el('div', { className: 'next-up-complete' }, [
          createIcon('sparkle', { size: 'sm' }),
          el('span', { text: "You've completed every topic in this roadmap." })
        ])
      );
      return;
    }
    if (!topics.length) {
      nextUpCard.hidden = true;
      nextUpCard.replaceChildren();
      return;
    }
    nextUpCard.hidden = false;
    nextUpCard.replaceChildren(
      el('div', { className: 'next-up-card-head' }, [
        el('span', { className: 'eyebrow' }, ['Next up']),
        el('button', {
          type: 'button',
          className: 'btn btn-ghost btn-sm',
          text: 'Not today',
          onClick: () => {
            topics.forEach(item => nextUpExcludedIds.add(item.id));
            updateNextUpCard(store.getSnapshot());
          }
        })
      ]),
      el('div', { className: 'next-up-rows' }, topics.map(item => el('div', {
        className: 'next-up-row',
        onClick: e => toggleDone(item, e.currentTarget.querySelector('.check-box'))
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
          el('span', { className: 'check-meta', text: `${priorityLabel(item.priority)} · ${item.phase}` })
        ])
      ])))
    );
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
  async function runFeatureTour() {
    activeTourCleanup?.();
    const { startTour } = await import('../components/featureTour.js');
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
  const onDeleteAccount = user.isAnonymous ? null : () => import('../components/deleteAccountModal.js').then(({ openDeleteAccountModal }) => openDeleteAccountModal());
  // Issue #17 — only the dashboard's own sidebar/topbar instances offer this
  // (progress.js/settings.js/onboarding.js don't pass it) since every
  // spotlight target above only exists on this page.
  const onStartTour = () => {
    store.resetTour();
    runFeatureTour();
  };
  const sidebar = createSidebar({
    activeRoute: '/app',
    user,
    store,
    dailyTodoStore,
    onDeleteAccount,
    onStartTour
  });
  // Issue #488 — rebuilt clean: page title, search, one avatar button (the
  // bell/theme/create-account/review-due/daily-todo/sync-pill controls that
  // used to crowd this row are gone, see the comments on those elements
  // above and guestBanner.js/sidebar.js for their new homes).
  const topbar = createTopbar({
    breadcrumb: `Roadmaps / ${currentTemplate.name}`,
    user,
    store,
    dailyTodoStore,
    onDeleteAccount,
    onStartTour
  });
  const bottomNav = createBottomNav({ activeRoute: '/app' });

  const shell = el('div', { className: 'app-shell-2 dashboard fade-in' }, [
    sidebar,
    el('div', { className: 'app-shell-main' }, [
      topbar,
      el('div', { className: 'app-content' }, [
        verificationBanner,
        guestBanner,
        backupReminderBanner,
        progressDigestBanner,
        offlineBanner,
        el('header', { className: 'dashboard-header' }, [
          // Issue #489 — replaces #460's two-stat-tile layout (an icon+count
          // tile plus a 64px `.stat-tile-ring`) with one block: identity
          // name + save state on top, a large "N / M topics done" figure
          // with a right-aligned percentage below it, then a 12px full-width
          // bar. `.current-roadmap-badge` keeps its existing class name —
          // several E2E specs assert on its text directly.
          el('div', { className: 'card roadmap-summary-card' }, [
            el('div', { className: 'roadmap-summary-top' }, [
              el('div', { className: 'current-roadmap-badge' }, [
                roadmapBadgeIconSlot,
                roadmapBadgeNameEl
              ]),
              roadmapMetaRow
            ]),
            el('div', { className: 'roadmap-summary-progress' }, [
              el('div', { className: 'roadmap-summary-progress-row' }, [
                el('div', { className: 'roadmap-summary-count' }, [
                  doneStat,
                  doneStatTotal,
                  el('span', { className: 'roadmap-summary-count-label', text: ' topics done' })
                ]),
                el('span', { className: 'roadmap-summary-percent' }, [percentStat, el('span', { text: '%' })])
              ]),
              el('div', { className: 'roadmap-summary-bar-track' }, [roadmapSummaryBarFill])
            ])
          ]),
          nextUpCard,
          // Issue #487 — the old two-row `.roadmap-filters-card` (a priority
          // select + Resources/Review chips row, plus a separate tag row —
          // up to nine controls before reaching a single topic) collapses to
          // one row of three: search (flex), Filter (opens the panel built
          // above, holding the real priority/chip/tag filter model
          // unchanged), and Expand all.
          el('div', { className: 'card roadmap-filters-card' }, [
            el('div', { className: 'filter-toolbar' }, [
              searchInput,
              filterBtn,
              toggleAllBtn
            ])
          ]),
          reviewTagGroupBanner
        ]),
        dailyTodoPanel,
        content,
        saveBadge
      ])
    ]),
    bottomNav
  ]);

  app.replaceChildren(shell);

  const unsubStore = store.subscribe(handleSnapshot);
  lastStructuralVersion = store.getSnapshot().structuralVersion;
  render(store.getSnapshot());
  applyScrollToPhaseSignal();
  applyOpenItemSignal();
  maybeShowGuestDataRiskNudge({ user, store });

  // Same-page case for the cross-roadmap search signal above: if the search result
  // belongs to the roadmap that's already active, store.switchRoadmap() is a no-op
  // (roadmapStore.js — no notify(), no structural bump), so neither the mount-time
  // call above nor handleSnapshot() would ever run this. topbar.js dispatches this
  // event immediately after writing the sessionStorage signal whenever the palette
  // was opened from a page that's already /app, so it's picked up with no
  // navigation/remount at all.
  function onOpenItemEvent() {
    applyOpenItemSignal();
  }
  window.addEventListener('ascent:open-item', onOpenItemEvent);

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

  // Issue #254/#262 — a native browser/OS print action (Ctrl/Cmd+P, mobile
  // Chrome's own "Print…" menu item — bypassing this app's own "Print
  // roadmap…" menu item entirely) used to print the live dashboard as-is
  // with just a chrome-hiding CSS pass (app.css's `body:not(.print-mode)`
  // fallback rules), which left interactive controls (checkboxes, Edit
  // buttons, "Add a custom topic…" inputs) visible in the output and had no
  // watermark/footer, since those only ever existed in printRoadmap.js's own
  // `.print-mode` flow. Mounting that exact same clean snapshot here — via
  // `mountPrintSnapshot()`/`attachPrintCleanup()`, the same helpers
  // `printRoadmap.js`'s own "Print roadmap…" menu item uses — makes any
  // print trigger produce identical, fully-branded output regardless of how
  // it was invoked or which device it's on, and also builds full content
  // from the store directly (not the visible DOM), so a collapsed
  // `.phase-card` no longer needs a temporary force-open/restore workaround.
  //
  // Issue #292 — `beforeprint` alone still missed a real mobile print path:
  // iOS Safari's Share Sheet "Print" (AirPrint) doesn't reliably dispatch
  // `beforeprint` on the page at all, since it's a different WebKit code path
  // than a page-triggered `window.print()`/Ctrl+P. `matchMedia('print')`
  // reflects actual print-media state rather than an event a given trigger
  // may or may not fire, and `attachPrintCleanup()` already uses it for
  // teardown — this adds the matching mount-side listener so *entering*
  // print media is enough to mount the snapshot, independent of whether
  // `beforeprint` ever fires for a given trigger. `alreadyMounted` guards
  // against mounting twice when both `beforeprint` and this listener fire
  // for the same print (the common desktop/Android case).
  let unmountPrintSnapshot = null;
  function mountForPrint() {
    if (unmountPrintSnapshot) return;
    unmountPrintSnapshot = mountPrintSnapshot(store, false);
    attachPrintCleanup(() => {
      unmountPrintSnapshot?.();
      unmountPrintSnapshot = null;
    });
  }
  function handleBeforePrint() {
    mountForPrint();
  }
  const printMediaQuery = window.matchMedia('print');
  function handlePrintMediaChange(e) {
    if (e.matches) mountForPrint();
  }
  window.addEventListener('beforeprint', handleBeforePrint);
  printMediaQuery.addEventListener('change', handlePrintMediaChange);

  // Issue #379 — keyboard-only navigation for the checklist: `j`/`k` move a
  // purely-visual `.check-item-focused` ring between currently-visible rows
  // (only rows inside an *open* .phase-card — a collapsed phase's rows are
  // still in the DOM per renderPhaseCard() above, just not something a
  // keyboard user should be able to "arrive at"), Enter/Space toggles the
  // focused row's done state, and `?` opens a shortcuts-reference overlay.
  // This extends, not duplicates, the command palette (issue #283's
  // Cmd/Ctrl+K) — that's for jumping to a page/topic by search; this is for
  // moving through the list already on screen without leaving the keyboard.
  function isTypingTarget(target) {
    if (!target) return false;
    const tag = target.tagName;
    return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || target.isContentEditable;
  }

  function getVisibleRows() {
    return Array.from(content.querySelectorAll('.phase-card.open .check-item'));
  }

  function setRowFocus(id) {
    if (focusedRowId != null) {
      content.querySelector(`.check-item[data-id="${CSS.escape(focusedRowId)}"]`)?.classList.remove('check-item-focused');
    }
    focusedRowId = id;
    if (focusedRowId != null) {
      const rowEl = content.querySelector(`.check-item[data-id="${CSS.escape(focusedRowId)}"]`);
      rowEl?.classList.add('check-item-focused');
      rowEl?.scrollIntoView({ block: 'nearest' });
    }
  }

  function moveRowFocus(delta) {
    const rows = getVisibleRows();
    if (!rows.length) return;
    const currentIndex = rows.findIndex(r => r.dataset.id === focusedRowId);
    // Clamps at the list's ends rather than wrapping — moving past the last
    // row and landing back at the first (or vice versa) read as more
    // disorienting than just stopping, once actually tried against a long
    // roadmap.
    const nextIndex = currentIndex === -1
      ? (delta > 0 ? 0 : rows.length - 1)
      : Math.min(Math.max(currentIndex + delta, 0), rows.length - 1);
    setRowFocus(rows[nextIndex].dataset.id);
  }

  function toggleFocusedRow() {
    if (focusedRowId == null) return;
    const rowEl = content.querySelector(`.check-item[data-id="${CSS.escape(focusedRowId)}"]`);
    // Dispatches a real click on the row's own checkbox rather than calling
    // toggleDone() directly — this is the same code path a mouse click on
    // the checkbox already goes through (data-action click-guard convention,
    // root CLAUDE.md), so there's no parallel toggle implementation to drift.
    rowEl?.querySelector('.check-box')?.click();
  }

  function openShortcutsOverlay() {
    if (shortcutsOverlay) return;
    const rows = [
      ['?', 'Show this shortcuts overlay'],
      ['j', 'Move focus to the next topic'],
      ['k', 'Move focus to the previous topic'],
      ['Enter / Space', 'Toggle the focused topic']
    ];
    shortcutsOverlay = openModal({
      ariaLabel: 'Keyboard shortcuts',
      className: 'shortcuts-modal-card',
      content: [
        el('h2', { className: 'shortcuts-modal-title', text: 'Keyboard shortcuts' }),
        el('div', { className: 'shortcuts-modal-list' }, rows.map(([key, desc]) => el('div', { className: 'shortcuts-modal-row' }, [
          el('kbd', { className: 'shortcuts-modal-key', text: key }),
          el('span', { className: 'shortcuts-modal-desc', text: desc })
        ]))),
        el('button', {
          type: 'button',
          className: 'btn btn-secondary',
          text: 'Got it',
          onClick: () => closeShortcutsOverlay()
        })
      ]
    });
  }

  function closeShortcutsOverlay() {
    shortcutsOverlay?.close();
    shortcutsOverlay = null;
  }

  function handleGlobalKeydown(e) {
    if (isTypingTarget(e.target) || document.querySelector('.modal-overlay') || document.querySelector('.item-panel')) return;
    if (e.key === '?') {
      e.preventDefault();
      openShortcutsOverlay();
    } else if (e.key === 'j') {
      e.preventDefault();
      moveRowFocus(1);
    } else if (e.key === 'k') {
      e.preventDefault();
      moveRowFocus(-1);
    } else if (e.key === 'Enter' || e.key === ' ') {
      if (focusedRowId == null) return;
      e.preventDefault();
      toggleFocusedRow();
    }
  }
  window.addEventListener('keydown', handleGlobalKeydown);

  // issue #433 — the only two events that can bring a previously-pruned row
  // back into the buffer window, or move a currently-mounted one out of it;
  // `{ passive: true }` on scroll since virtualizeOpenSections() never calls
  // preventDefault() and has no reason to block the browser's own scroll
  // optimizations.
  window.addEventListener('scroll', scheduleVirtualizeRows, { passive: true });
  window.addEventListener('resize', scheduleVirtualizeRows);

  return () => {
    activeTourCleanup?.();
    prioritySelectContainer.firstElementChild?._cleanup?.();
    sidebar._cleanup?.();
    topbar._cleanup?.();
    bottomNav._cleanup?.();
    unsubStore();
    unsubDailyTodo?.();
    if (dailyTodoTickTimer) clearInterval(dailyTodoTickTimer);
    dailyTodoPanel?._cleanup?.();
    window.removeEventListener('online', setOnlineState);
    window.removeEventListener('offline', setOnlineState);
    window.removeEventListener('beforeprint', handleBeforePrint);
    window.removeEventListener('ascent:open-item', onOpenItemEvent);
    printMediaQuery.removeEventListener('change', handlePrintMediaChange);
    unmountPrintSnapshot?.();
    clearTimeout(saveBadgeTimer);
    window.removeEventListener('keydown', handleGlobalKeydown);
    window.removeEventListener('scroll', scheduleVirtualizeRows);
    window.removeEventListener('resize', scheduleVirtualizeRows);
    if (virtualizeRaf != null) cancelAnimationFrame(virtualizeRaf);
    closeShortcutsOverlay();
    detachFilterPanelTrap?.();
    filterPanelOverlay.remove();
  };
}
