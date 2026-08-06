import { el } from '../dom.js';
import { navigate } from '../router.js';
import { createSidebar } from '../components/sidebar.js';
import { createTopbar } from '../components/topbar.js';
import { createGuestBanner } from '../components/guestBanner.js';
import { createBottomNav } from '../components/bottomNav.js';
import { openDeleteAccountModal } from '../components/deleteAccountModal.js';
import { createHeatmap } from '../components/heatmap.js';
import { createLineChart, createBarChart } from '../components/chartWrapper.js';
import { createSkeletonCard } from '../components/skeleton.js';
import { openShareModal } from '../components/shareModal.js';
import { openRoadmapComparisonModal } from '../components/roadmapComparisonModal.js';
import { showToast } from '../components/toast.js';
import { createIcon } from '../components/icons.js';
import { attachTooltip } from '../components/tooltip.js';
import { svgEl } from '../utils/svg.js';
import { animateCountUp } from '../../utils/countUp.js';
import { computeAnalytics, buildEffectiveActivityLog } from '../../core/analytics/analyticsEngine.js';
import { dateKey, previousDateKey, parseDateKey, MONTH_ABBR } from '../../core/analytics/dateKey.js';
import { KEYS } from '../../services/localStorageKeys.js';
import { formatTimeSpent } from '../../core/time/timeTracking.js';
import { priorityLabel } from '../utils/priorityLabels.js';

const RANGE_OPTIONS = [
  { value: 'week', label: 'This Week', days: 7 },
  { value: 'month', label: 'This Month', days: 30 },
  { value: 'all', label: 'All Time', days: 364 }
];

const PRIORITIES = ['P0', 'P1', 'P2', 'P3'];

function lastNDateKeys(days, now) {
  const dates = [];
  let cursor = dateKey(now);
  for (let i = 0; i < days; i += 1) {
    dates.unshift(cursor);
    cursor = previousDateKey(cursor);
  }
  return dates;
}

function formatShortDate(dateKeyStr) {
  const d = parseDateKey(dateKeyStr);
  return `${MONTH_ABBR[d.getMonth()]} ${d.getDate()}`;
}

function formatLongDate(timestamp) {
  const d = new Date(timestamp);
  return `${MONTH_ABBR[d.getMonth()]} ${d.getDate()}, ${d.getFullYear()}`;
}

// B4's cumulative progress line — one point per day in the window, running
// total as of that day (including days before the window's start, so the
// line doesn't restart from zero every time the range toggle changes).
export function buildCumulativeSeries(effectiveLog, days, now = Date.now()) {
  const dates = lastNDateKeys(days, now);
  let running = Object.entries(effectiveLog).reduce((sum, [date, count]) => (date < dates[0] ? sum + count : sum), 0);
  const labels = [];
  const totals = [];
  dates.forEach(date => {
    running += effectiveLog[date] || 0;
    labels.push(formatShortDate(date));
    totals.push(running);
  });
  return { labels, totals };
}

// B5's daily velocity bars + a 7-day rolling average overlay.
export function buildVelocitySeries(effectiveLog, days, now = Date.now()) {
  const dates = lastNDateKeys(days, now);
  const counts = dates.map(date => effectiveLog[date] || 0);
  const rollingAverage = counts.map((_, i) => {
    const start = Math.max(0, i - 6);
    const slice = counts.slice(start, i + 1);
    return slice.reduce((a, b) => a + b, 0) / slice.length;
  });
  return { labels: dates.map(formatShortDate), counts, rollingAverage };
}

// The priority most items in a given phase carry — computePhaseBreakdown()
// doesn't itself track priority (it only knows done/total per phase), so
// this derives one from the already-computed priorityBreakdown instead of
// widening the pure engine's contract for a purely presentational dot.
function dominantPriorityFor(phaseTitle, priorityBreakdown) {
  const row = priorityBreakdown.find(r => r.phase === phaseTitle);
  if (!row) return 'P2';
  let best = 'P2';
  let bestTotal = -1;
  PRIORITIES.forEach(priority => {
    const total = row.priorities[priority]?.total || 0;
    if (total > bestTotal) {
      bestTotal = total;
      best = priority;
    }
  });
  return best;
}

// A generic 0-100% linear bar — an inline SVG `<rect>` with its `width`
// *attribute* set to the percentage (never inline `style`, per the CSP
// rule), same pattern progressRing.js already uses for its own dynamic
// stroke-dashoffset. Reused by the "Items complete" stat tile and every
// phase-breakdown row.
function renderMiniBar(pct) {
  const clamped = Math.max(0, Math.min(100, pct));
  const svg = svgEl('svg', { class: 'mini-bar', viewBox: '0 0 100 8', preserveAspectRatio: 'none', 'aria-hidden': 'true' });
  svg.append(
    svgEl('rect', { class: 'mini-bar-track', x: '0', y: '0', width: '100', height: '8', rx: '4' }),
    svgEl('rect', { class: 'mini-bar-fill', x: '0', y: '0', width: String(clamped), height: '8', rx: '4' })
  );
  return svg;
}

// C2 (issue #494) scope item 1 — one derived display line replacing the old
// static subtitle + chip row, e.g. "Four days running, and 26% of the way
// up." Never fabricated: both clauses come straight from computeAnalytics()'s
// own streaks.current/overview.pct, just phrased as a sentence instead of two
// separate stat numbers (`.claude/rules/content-style.md`'s plain-language
// rule). A zero-streak/zero-progress account gets an inviting opener instead
// of "Zero days running" reading like a failure state.
const ORDINAL_DAY_WORDS = ['Zero', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven'];
function streakClause(currentStreak) {
  if (currentStreak === 0) return "Let's get moving";
  const word = currentStreak < ORDINAL_DAY_WORDS.length ? ORDINAL_DAY_WORDS[currentStreak] : String(currentStreak);
  return `${word} day${currentStreak === 1 ? '' : 's'} running`;
}
export function buildHeroStatement({ streaks, overview }) {
  const streak = streakClause(streaks.current);
  if (overview.total === 0) return `${streak} — add your first topic to get started.`;
  return `${streak}, and ${overview.pct}% of the way up.`;
}

function renderRangeChips(active, onChange) {
  return el('div', { className: 'progress-range-toggle', role: 'group', 'aria-label': 'Time range' },
    RANGE_OPTIONS.map(opt => el('button', {
      type: 'button',
      className: `filter-chip ${active === opt.value ? 'active' : ''}`,
      'aria-pressed': String(active === opt.value),
      text: opt.label,
      onClick: () => onChange(opt.value)
    })));
}

// issue #155 v2 Phase D1 — Progress page's stat strip moved from `.stat-tile` (the
// horizontal icon-left/number-right row, issue #6 Phase 4.1, still used by dashboard.js
// and left alone there) to Phase B's `.kpi-tile` (the v2 reference's vertical KPI
// card). `hero: true` marks the single solid-filled tile per the reference's "exactly
// one hero-highlighted tile" pattern — "Topics complete" is the one that matters most
// on this page, mirroring the reasoning the issue itself asked for. No fabricated
// "+N% vs last month" delta caption is added — this app doesn't track a comparable
// prior-period figure for any of these four stats, and inventing one would violate the
// "no fabricated data" discipline this codebase otherwise holds to (see AI-import's
// own error-message conventions in .claude/rules/content-style.md for the same
// principle applied to copy). `bar`, where present, renders below the number instead.
// issue #206 §6 — `zero: true` de-emphasizes a stat that's still at its starting
// value (0 topics done, 0-day streak, 0.0 velocity): the number renders muted
// instead of the tile's normal bold/accent color, so a fresh roadmap doesn't read
// as a wall of loud "0"s. Pair with an action-oriented `caption` (see call sites
// below) rather than leaving the zero to speak for itself.
function renderStatTile({ icon, value, total, label, bar, hero, caption, zero }) {
  return el('div', { className: `kpi-tile${hero ? ' kpi-tile-hero' : ''}` }, [
    el('div', { className: 'kpi-tile-head' }, [
      el('span', { className: 'kpi-tile-label', text: label }),
      el('span', { className: 'card-arrow-badge' }, [createIcon(icon, { size: 'xs' })])
    ]),
    el('div', { className: `kpi-tile-number${zero ? ' kpi-tile-number-zero' : ''}` }, [value, total].filter(Boolean)),
    bar ? el('div', { className: 'kpi-tile-bar' }, [bar]) : null,
    caption ? el('p', { className: 'kpi-tile-delta', text: caption }) : null
  ].filter(Boolean));
}

// `animate` is only true on this page's very first render — CountUp resumes
// from an element's *current* textContent, so animating again on every
// store-driven re-render would restart the count from wherever it last
// landed instead of just holding steady, same "animate once" guard
// dashboard.js's own stat strip already uses.
function renderStatCards(analytics, animate, timeSpentSeconds) {
  const { overview, streaks, velocity, streakFreezesAvailable } = analytics;

  const doneValue = el('span', { text: '0' });
  const currentValue = el('span', { text: '0' });
  const longestValue = el('span', { text: '0' });
  const velocityValue = el('span', { text: velocity.toFixed(1) });

  if (animate) {
    animateCountUp(doneValue, overview.done);
    animateCountUp(currentValue, streaks.current);
    animateCountUp(longestValue, streaks.longest);
  } else {
    doneValue.textContent = String(overview.done);
    currentValue.textContent = String(streaks.current);
    longestValue.textContent = String(streaks.longest);
  }

  // C2 (issue #494) scope item 2 — one large hero tile (topics complete,
  // with its own bar) beside a 2x2 grid of four supporting tiles, rather
  // than five identical tiles in a row (which "reads as a report," per the
  // issue). `.kpi-layout`/`.kpi-grid-secondary` collapse to one column below
  // 760px (app.css).
  return el('div', { className: 'kpi-layout' }, [
    renderStatTile({
      icon: 'check',
      value: doneValue,
      total: el('span', { className: 'kpi-tile-total', text: `/ ${overview.total}` }),
      label: 'Topics complete',
      bar: renderMiniBar(overview.pct),
      hero: true,
      zero: overview.done === 0,
      caption: overview.done === 0 ? 'Check off your first topic to get started.' : undefined
    }),
    el('div', { className: 'kpi-grid-secondary' }, [
      renderStatTile({
        icon: 'flame',
        value: currentValue,
        total: el('span', { className: 'kpi-tile-total', text: streaks.current === 1 ? 'day' : 'days' }),
        label: 'Current streak',
        zero: streaks.current === 0,
        caption: streaks.current === 0
          ? 'Complete a topic today to start your streak.'
          : streakFreezesAvailable > 0
            ? `${streakFreezesAvailable} missed-day cover${streakFreezesAvailable === 1 ? '' : 's'} available.`
            : 'No missed-day cover available.'
      }),
      renderStatTile({
        icon: 'sparkle',
        value: longestValue,
        total: el('span', { className: 'kpi-tile-total', text: streaks.longest === 1 ? 'day' : 'days' }),
        label: 'Longest streak',
        zero: streaks.longest === 0
      }),
      renderStatTile({
        icon: 'trendingUp',
        value: velocityValue,
        total: el('span', { className: 'kpi-tile-total', text: '/ day' }),
        label: 'Per day',
        zero: velocity === 0,
        caption: velocity === 0 ? 'Complete topics daily to build up your average.' : undefined
      }),
      renderStatTile({
        icon: 'timer',
        value: el('span', { text: formatTimeSpent(timeSpentSeconds) }),
        label: 'Time tracked'
      })
    ])
  ]);
}

// C2 (issue #494) scope item 5 — merges the old separate "Phase breakdown"
// and "Priority × phase" cards into one card of tappable rows (name, bar,
// percentage, count) — the priority table didn't survive 360px and was the
// least-read block on the page (per the issue). Each row's dot still carries
// its dominant priority (dominantPriorityFor() below), so the priority
// signal isn't lost, just folded into the existing row instead of a second
// wide table. Threaded with a left-hand spine (`.phase-breakdown-spine`), a
// lighter flow-positioned cousin of the dashboard's own JS-pixel-measured
// `.phase-spine` (issue #492, `.claude/rules/ui-styling.md`) — these rows
// are uniform-height flex items, so a simple CSS `::before` rule + one dot
// per row is enough to read as "the same spine," without needing that
// component's `getBoundingClientRect()` machinery.
//
// B6 — clicking a row writes the target phase's title to a one-shot
// sessionStorage signal and navigates to the dashboard; dashboard.js reads
// and clears it on mount to open + scroll to that phase (see
// applyScrollToPhaseSignal() there, and KEYS.SCROLL_TO_PHASE's own comment).
function renderPhaseBreakdownList(phaseBreakdown, priorityBreakdown) {
  if (!phaseBreakdown.length) {
    return el('p', { className: 'progress-empty', text: 'No topics yet — add some to your roadmap to see a breakdown here.' });
  }
  return el('div', { className: 'phase-breakdown-list' },
    phaseBreakdown.map(row => {
      const priority = dominantPriorityFor(row.phase, priorityBreakdown);
      const complete = row.total > 0 && row.done === row.total;
      const button = el('button', {
        type: 'button',
        className: `phase-breakdown-row${complete ? ' phase-breakdown-row-complete' : ''}`,
        onClick: () => {
          sessionStorage.setItem(KEYS.SCROLL_TO_PHASE, row.phase);
          navigate('/app');
        }
      }, [
        el('span', { className: 'phase-breakdown-spine-dot', dataset: { priority, complete: String(complete) } }),
        el('span', { className: 'phase-breakdown-main' }, [
          el('span', { className: 'phase-breakdown-name', text: row.phase || 'Untitled phase' }),
          renderMiniBar(row.pct)
        ]),
        el('span', { className: 'phase-breakdown-count', text: `${row.pct}% · ${row.done}/${row.total}` })
      ]);
      attachTooltip(button, `${row.done}/${row.total} completed · ${priorityLabel(priority)}`);
      return button;
    }));
}

function renderProjectionCard(projection) {
  if (projection.complete) {
    return el('p', { className: 'projection-empty', text: "You've completed every topic in this roadmap. Nice work." });
  }
  if (projection.noRecentActivity) {
    return el('p', { className: 'projection-empty', text: 'No recent activity. Check off 3 topics today to get back on track.' });
  }
  // C2 (issue #494) scope item 6 — the page's closing statement: a large
  // date, a supporting pace line, and the "speed up" note in an
  // accent-tinted strip (`.projection-boost-strip`) rather than a full
  // accent block — the hero KPI tile already carries this page's one
  // full-accent surface (§9's "exactly one full-accent surface per
  // viewport" review rule), so this is a tint, not a second solid fill.
  return el('div', { className: 'projection-card-body' }, [
    el('p', { className: 'projection-headline', text: formatLongDate(projection.projectedDate) }),
    el('p', { className: 'projection-pace', text: `~${projection.daysToComplete} days to go at your current pace (${projection.velocity.toFixed(1)} topics/day).` }),
    el('p', { className: 'projection-boost-strip', text: `Speed up by 2 topics/day → done by ${formatLongDate(projection.boostedProjectedDate)}.` })
  ]);
}

export function renderProgress(app, { user, store, activityLogStore, dailyTodoStore }) {
  if (!user) {
    navigate('/signin', true);
    return undefined;
  }
  if (!store.getSnapshot().onboardingDone) {
    navigate('/onboarding', true);
    return undefined;
  }

  let selectedRange = 'all';
  let hasAnimatedStats = false;
  let lineChart = null;
  let barChart = null;
  let chartCallId = 0;
  // Serializes every renderCharts() call through one promise chain — both
  // store subscriptions below fire their first callback synchronously on
  // mount, so renderAll() (and therefore renderCharts()) runs twice back to
  // back before either call's own chart-creation promise has resolved.
  // Without this, two concurrent createLineChart()/createBarChart() calls
  // race to attach a Chart.js instance to the same <canvas>, and Chart.js
  // throws ("Canvas is already in use") on whichever one loses the race —
  // found live via a real browser check, not caught by any unit test (jsdom
  // has no real <canvas> rendering to race on). Chaining ensures each call
  // fully destroys the previous chart and creates its own before the next
  // queued call starts.
  let chartQueue = Promise.resolve();

  const onDeleteAccount = user.isAnonymous ? null : () => openDeleteAccountModal();
  const sidebar = createSidebar({
    activeRoute: '/progress',
    user,
    store,
    dailyTodoStore,
    onDeleteAccount
  });
  const topbar = createTopbar({
    breadcrumb: 'Progress',
    user,
    store,
    dailyTodoStore,
    onDeleteAccount
  });
  const guestBanner = createGuestBanner(user);
  const bottomNav = createBottomNav({ activeRoute: '/progress' });

  const heroStatementSlot = el('h1', { className: 'progress-hero-statement' });
  const statStripSlot = el('div', {});
  const heatmapSlot = el('div', {});
  const phaseBreakdownSlot = el('div', {});
  const projectionSlot = el('div', {});
  const rangeToggleSlot = el('div', {});
  const velocityEmptySlot = el('div', {});
  const lineHeadlineSlot = el('p', { className: 'chart-headline-figure' });
  const lineCanvas = el('canvas', { className: 'chart-canvas-loading' });
  const barCanvas = el('canvas', { className: 'chart-canvas-loading' });
  const lineSkeleton = createSkeletonCard();
  const barSkeleton = createSkeletonCard();
  let chartsReady = false;

  let latestAnalytics = null;
  let latestEffectiveLog = null;

  const shareBtn = el('button', {
    type: 'button',
    className: 'btn btn-secondary btn-sm',
    onClick: async () => {
      if (!latestAnalytics) return;
      try {
        await openShareModal(latestAnalytics, latestEffectiveLog);
      } catch (error) {
        console.error('Failed to generate share card', error);
        showToast('Could not generate the share card. Try again.', 'error');
      }
    }
  }, [createIcon('share', { size: 'xs' }), ' Share progress']);

  const compareBtn = el('button', {
    type: 'button',
    className: 'btn btn-secondary btn-sm',
    onClick: () => openRoadmapComparisonModal({ store })
  }, [createIcon('roadmaps', { size: 'xs' }), ' Compare roadmaps']);

  const content = el('div', { className: 'app-content progress-content', id: 'main-content', tabindex: '-1' }, [
    guestBanner,
    el('header', { className: 'progress-header' }, [
      heroStatementSlot,
      el('div', { className: 'progress-header-actions' }, [rangeToggleSlot, compareBtn, shareBtn])
    ]),
    statStripSlot,
    el('div', { className: 'progress-card' }, [el('h2', { className: 'progress-card-title', text: 'Activity' }), heatmapSlot]),
    el('div', { className: 'progress-card' }, [
      el('div', { className: 'progress-card-title-row' }, [
        el('h2', { className: 'progress-card-title', text: 'Cumulative progress' }),
        lineHeadlineSlot
      ]),
      el('div', { className: 'chart-container' }, [lineSkeleton, lineCanvas])
    ]),
    el('div', { className: 'progress-card' }, [
      el('h2', { className: 'progress-card-title', text: 'Per day' }),
      velocityEmptySlot,
      el('div', { className: 'chart-container' }, [barSkeleton, barCanvas])
    ]),
    el('div', { className: 'progress-card' }, [
      el('div', { className: 'progress-card-title-row' }, [
        el('h2', { className: 'progress-card-title', text: 'By phase' }),
        el('p', { className: 'progress-card-title-hint', text: 'Tap a phase to open it' })
      ]),
      phaseBreakdownSlot
    ]),
    el('div', { className: 'progress-card' }, [el('h2', { className: 'progress-card-title', text: 'Finishing date' }), projectionSlot])
  ]);

  const shell = el('div', { className: 'app-shell-2 progress-page fade-in' }, [
    sidebar,
    el('div', { className: 'app-shell-main' }, [topbar, content]),
    bottomNav
  ]);

  app.replaceChildren(shell);

  function currentRangeDays() {
    return RANGE_OPTIONS.find(opt => opt.value === selectedRange).days;
  }

  // Superseded-call guard (same reasoning as roadmapStore's stateCallId) —
  // if a newer call has already queued behind this one by the time it
  // finishes loading, this call's result is discarded instead of
  // momentarily flashing stale data over the newer selection. Always
  // queued via chartQueue (below), never called directly — see its comment.
  async function renderChartsNow(effectiveLog) {
    const callId = (chartCallId += 1);
    // Chart.js refuses to attach a second chart to a canvas that already
    // has one live on it — the previous chart must be destroyed *before*
    // creating the next one, not after (destroying after would just be too
    // late: createLineChart/createBarChart below would already have thrown).
    lineChart?.destroy();
    barChart?.destroy();
    lineChart = null;
    barChart = null;
    const days = currentRangeDays();
    const cumulative = buildCumulativeSeries(effectiveLog, days);
    const velocitySeries = buildVelocitySeries(effectiveLog, days);
    // C2 (issue #494) scope item 4 — "+N this week" headline figure above
    // the cumulative-progress line, independent of the range toggle (always
    // the last 7 real days, matching what "this week" means everywhere else
    // on this page).
    const thisWeekTotal = lastNDateKeys(7, Date.now()).reduce((sum, date) => sum + (effectiveLog[date] || 0), 0);
    lineHeadlineSlot.textContent = `+${thisWeekTotal} this week`;
    // issue #206 §6 — a flat-zero velocity chart (no completions anywhere in the
    // selected range) reads as an error/loading state rather than "nothing to show
    // yet" without a caption. Small solid gold dot, not a full illustration.
    if (velocitySeries.counts.every(count => count === 0)) {
      velocityEmptySlot.replaceChildren(el('p', { className: 'chart-empty-note' }, [
        el('span', { className: 'chart-empty-dot', 'aria-hidden': 'true' }),
        el('span', { text: 'No activity in this range yet. Check off a topic to start your trend.' })
      ]));
    } else {
      velocityEmptySlot.replaceChildren();
    }
    const [nextLineChart, nextBarChart] = await Promise.all([
      createLineChart(lineCanvas, cumulative),
      createBarChart(barCanvas, velocitySeries)
    ]);
    if (callId !== chartCallId) {
      nextLineChart.destroy();
      nextBarChart.destroy();
      return;
    }
    lineChart = nextLineChart;
    barChart = nextBarChart;
    if (!chartsReady) {
      chartsReady = true;
      lineSkeleton.hidden = true;
      barSkeleton.hidden = true;
      lineCanvas.classList.remove('chart-canvas-loading');
      barCanvas.classList.remove('chart-canvas-loading');
    }
  }

  function renderCharts(effectiveLog) {
    chartQueue = chartQueue.then(() => renderChartsNow(effectiveLog));
    return chartQueue;
  }

  function renderAll() {
    const items = store.getSnapshot().items;
    const activityLogSnapshot = activityLogStore.getSnapshot();
    const entries = activityLogSnapshot.entries;
    const analytics = computeAnalytics(items, entries, Date.now(), activityLogSnapshot.streakFreezes);
    latestAnalytics = analytics;
    latestEffectiveLog = buildEffectiveActivityLog(items, entries);

    // Issue #180 — total time tracked on this roadmap's topics plus every
    // Daily Todo (Daily Todos are user-global, not per-roadmap, but there's
    // no separate "Daily Todos progress" page for a second total to live
    // on). Summed fresh on every render rather than cached — cheap even at
    // the item-count cap (800) and the daily-todo cap (20 active).
    const roadmapSeconds = Object.values(items).reduce((sum, item) => sum + (item.timeSpentSeconds || 0), 0);
    const todoSeconds = (dailyTodoStore?.getSnapshot().todos || []).reduce((sum, todo) => sum + (todo.timeSpentSeconds || 0), 0);
    heroStatementSlot.textContent = buildHeroStatement(analytics);
    statStripSlot.replaceChildren(renderStatCards(analytics, !hasAnimatedStats, roadmapSeconds + todoSeconds));
    hasAnimatedStats = true;
    heatmapSlot.replaceChildren(createHeatmap(analytics.heatmapData));
    phaseBreakdownSlot.replaceChildren(renderPhaseBreakdownList(analytics.phaseBreakdown, analytics.priorityBreakdown));
    projectionSlot.replaceChildren(renderProjectionCard(analytics.projection));
    rangeToggleSlot.replaceChildren(renderRangeChips(selectedRange, value => {
      selectedRange = value;
      renderAll();
    }));

    renderCharts(latestEffectiveLog);
  }

  const unsubStore = store.subscribe(renderAll);
  const unsubActivityLog = activityLogStore.subscribe(renderAll);

  // One-shot: activityLogStore.setUser() may have just auto-spent a streak
  // freeze (see maybeAutoApplyStreakFreeze, src/core/analytics/streaks.js) —
  // consumeJustAppliedFreeze() returns the frozen date at most once, so this
  // toast only ever shows the one time it actually happened, never again on
  // a later render or reload.
  const justAppliedFreezeDate = activityLogStore.consumeJustAppliedFreeze?.();
  if (justAppliedFreezeDate) {
    showToast('Missed-day cover kept your streak alive after a missed day.', 'success');
  }

  return () => {
    sidebar._cleanup?.();
    topbar._cleanup?.();
    bottomNav._cleanup?.();
    unsubStore();
    unsubActivityLog();
    lineChart?.destroy();
    barChart?.destroy();
  };
}
