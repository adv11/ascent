import { el } from '../dom.js';
import { navigate } from '../router.js';
import { createThemeToggle } from '../components/themeToggle.js';
import { createChangelogBell } from '../components/notificationBell.js';
import { createSidebar } from '../components/sidebar.js';
import { createTopbar } from '../components/topbar.js';
import { openDeleteAccountModal } from '../components/deleteAccountModal.js';
import { createHeatmap } from '../components/heatmap.js';
import { createLineChart, createBarChart } from '../components/chartWrapper.js';
import { createSkeletonCard } from '../components/skeleton.js';
import { openShareModal } from '../components/shareModal.js';
import { showToast } from '../components/toast.js';
import { createIcon } from '../components/icons.js';
import { attachTooltip } from '../components/tooltip.js';
import { svgEl } from '../utils/svg.js';
import { animateCountUp } from '../../utils/countUp.js';
import { computeAnalytics, buildEffectiveActivityLog } from '../../core/analytics/analyticsEngine.js';
import { dateKey, previousDateKey, parseDateKey, MONTH_ABBR } from '../../core/analytics/dateKey.js';
import { KEYS } from '../../services/localStorageKeys.js';

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

// B7's cell-shading bands — green (>=67%) / amber (>=34%) / red (<34%) /
// empty (no topics of that priority in that phase at all).
export function priorityBand(done, total) {
  if (total === 0) return 'empty';
  const pct = (done / total) * 100;
  if (pct >= 67) return 'high';
  if (pct >= 34) return 'mid';
  return 'low';
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
// one hero-highlighted tile" pattern — "Items complete" is the one that matters most
// on this page, mirroring the reasoning the issue itself asked for. No fabricated
// "+N% vs last month" delta caption is added — this app doesn't track a comparable
// prior-period figure for any of these four stats, and inventing one would violate the
// "no fabricated data" discipline this codebase otherwise holds to (see AI-import's
// own error-message conventions in .claude/rules/content-style.md for the same
// principle applied to copy). `bar`, where present, renders below the number instead.
function renderStatTile({ icon, value, total, label, bar, hero, caption }) {
  return el('div', { className: `kpi-tile${hero ? ' kpi-tile-hero' : ''}` }, [
    el('div', { className: 'kpi-tile-head' }, [
      el('span', { className: 'kpi-tile-label', text: label }),
      el('span', { className: 'card-arrow-badge' }, [createIcon(icon, { size: 'xs' })])
    ]),
    el('div', { className: 'kpi-tile-number' }, [value, total].filter(Boolean)),
    bar ? el('div', { className: 'kpi-tile-bar' }, [bar]) : null,
    caption ? el('p', { className: 'kpi-tile-delta', text: caption }) : null
  ].filter(Boolean));
}

// `animate` is only true on this page's very first render — CountUp resumes
// from an element's *current* textContent, so animating again on every
// store-driven re-render would restart the count from wherever it last
// landed instead of just holding steady, same "animate once" guard
// dashboard.js's own stat strip already uses.
function renderStatCards(analytics, animate) {
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

  return el('div', { className: 'stat-strip' }, [
    renderStatTile({
      icon: 'check',
      value: doneValue,
      total: el('span', { className: 'kpi-tile-total', text: `/ ${overview.total}` }),
      label: 'Items complete',
      bar: renderMiniBar(overview.pct),
      hero: true
    }),
    renderStatTile({
      icon: 'flame',
      value: currentValue,
      total: el('span', { className: 'kpi-tile-total', text: streaks.current === 1 ? 'day' : 'days' }),
      label: 'Current streak',
      caption: streakFreezesAvailable > 0
        ? `${streakFreezesAvailable} streak freeze${streakFreezesAvailable === 1 ? '' : 's'} available`
        : 'No streak freezes available'
    }),
    renderStatTile({
      icon: 'sparkle',
      value: longestValue,
      total: el('span', { className: 'kpi-tile-total', text: streaks.longest === 1 ? 'day' : 'days' }),
      label: 'Longest streak'
    }),
    renderStatTile({
      icon: 'trendingUp',
      value: velocityValue,
      total: el('span', { className: 'kpi-tile-total', text: '/ day' }),
      label: '7-day velocity'
    })
  ]);
}

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
      const button = el('button', {
        type: 'button',
        className: 'phase-breakdown-row',
        onClick: () => {
          sessionStorage.setItem(KEYS.SCROLL_TO_PHASE, row.phase);
          navigate('/app');
        }
      }, [
        el('span', { className: 'phase-breakdown-dot', dataset: { priority } }),
        el('span', { className: 'phase-breakdown-main' }, [
          el('span', { className: 'phase-breakdown-name', text: row.phase || 'Untitled phase' }),
          renderMiniBar(row.pct)
        ]),
        el('span', { className: 'phase-breakdown-count', text: `${row.pct}% · ${row.done}/${row.total}` })
      ]);
      attachTooltip(button, `${row.done}/${row.total} completed · ${priority}`);
      return button;
    }));
}

function renderPriorityTable(priorityBreakdown) {
  if (!priorityBreakdown.length) {
    return el('p', { className: 'progress-empty', text: 'No topics yet — add some to your roadmap to see this table.' });
  }
  return el('div', { className: 'priority-table-wrap' }, [
    el('table', { className: 'priority-table' }, [
      el('thead', {}, [
        el('tr', {}, [el('th', { text: 'Phase' }), ...PRIORITIES.map(p => el('th', { text: p }))])
      ]),
      el('tbody', {},
        priorityBreakdown.map(row => el('tr', {}, [
          el('td', { text: row.phase || 'Untitled phase' }),
          ...PRIORITIES.map(p => {
            const { done, total } = row.priorities[p];
            return el('td', {
              className: 'priority-cell',
              dataset: { band: priorityBand(done, total) },
              text: total ? `${done}/${total}` : '—'
            });
          })
        ])))
    ])
  ]);
}

function renderProjectionCard(projection) {
  if (projection.complete) {
    return el('p', { className: 'projection-empty', text: "You've completed every topic in this roadmap. Nice work." });
  }
  if (projection.noRecentActivity) {
    return el('p', { className: 'projection-empty', text: 'No recent activity — pick up 3 items today to get back on track.' });
  }
  return el('div', { className: 'projection-card-body' }, [
    el('p', { className: 'projection-pace', text: `At your current pace (${projection.velocity.toFixed(1)} items/day)` }),
    el('p', { className: 'projection-headline', text: `~${projection.daysToComplete} days · ${formatLongDate(projection.projectedDate)}` }),
    el('p', { className: 'projection-boost', text: `Speed up by 2 items/day → done by ${formatLongDate(projection.boostedProjectedDate)}.` })
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

  const themeToggleBtn = createThemeToggle();
  const sidebar = createSidebar({
    activeRoute: '/progress',
    user,
    store,
    dailyTodoStore,
    onDeleteAccount: user.isAnonymous ? null : () => openDeleteAccountModal()
  });
  const topbar = createTopbar({
    breadcrumb: 'Progress',
    user,
    syncPill: null,
    themeToggleBtn,
    dailyTodoNavBadge: null,
    notificationBell: createChangelogBell(),
    onToggleMobileSidebar: () => sidebar._toggleMobile()
  });

  const statStripSlot = el('div', {});
  const heatmapSlot = el('div', {});
  const phaseBreakdownSlot = el('div', {});
  const priorityTableSlot = el('div', {});
  const projectionSlot = el('div', {});
  const rangeToggleSlot = el('div', {});
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

  const content = el('div', { className: 'app-content progress-content', id: 'main-content', tabindex: '-1' }, [
    el('header', { className: 'progress-header' }, [
      el('div', {}, [
        el('h1', { text: 'Progress' }),
        el('p', { className: 'progress-header-subtitle', text: 'Your preparation journey at a glance.' })
      ]),
      el('div', { className: 'progress-header-actions' }, [rangeToggleSlot, shareBtn])
    ]),
    statStripSlot,
    el('div', { className: 'progress-card' }, [el('h2', { className: 'progress-card-title', text: 'Activity' }), heatmapSlot]),
    el('div', { className: 'progress-card' }, [
      el('h2', { className: 'progress-card-title', text: 'Cumulative progress' }),
      el('div', { className: 'chart-container' }, [lineSkeleton, lineCanvas])
    ]),
    el('div', { className: 'progress-card' }, [
      el('h2', { className: 'progress-card-title', text: 'Daily velocity' }),
      el('div', { className: 'chart-container' }, [barSkeleton, barCanvas])
    ]),
    el('div', { className: 'progress-card' }, [el('h2', { className: 'progress-card-title', text: 'Phase breakdown' }), phaseBreakdownSlot]),
    el('div', { className: 'progress-card' }, [el('h2', { className: 'progress-card-title', text: 'Priority × phase' }), priorityTableSlot]),
    el('div', { className: 'progress-card' }, [el('h2', { className: 'progress-card-title', text: 'Projected completion' }), projectionSlot])
  ]);

  const shell = el('div', { className: 'app-shell-2 progress-page fade-in' }, [
    sidebar,
    sidebar._backdrop,
    el('div', { className: 'app-shell-main' }, [topbar, content])
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

    statStripSlot.replaceChildren(renderStatCards(analytics, !hasAnimatedStats));
    hasAnimatedStats = true;
    heatmapSlot.replaceChildren(createHeatmap(analytics.heatmapData));
    phaseBreakdownSlot.replaceChildren(renderPhaseBreakdownList(analytics.phaseBreakdown, analytics.priorityBreakdown));
    priorityTableSlot.replaceChildren(renderPriorityTable(analytics.priorityBreakdown));
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
    showToast('A streak freeze kept your streak alive after a missed day.', 'success');
  }

  return () => {
    themeToggleBtn._cleanup?.();
    sidebar._cleanup?.();
    topbar._cleanup?.();
    unsubStore();
    unsubActivityLog();
    lineChart?.destroy();
    barChart?.destroy();
  };
}
