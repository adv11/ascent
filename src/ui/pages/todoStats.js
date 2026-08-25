import { el } from '../dom.js';
import { navigate } from '../router.js';
import { createSidebar } from '../components/sidebar.js';
import { createTopbar } from '../components/topbar.js';
import { createGuestBanner } from '../components/guestBanner.js';
import { createBottomNav } from '../components/bottomNav.js';
import { openDeleteAccountModal } from '../components/deleteAccountModal.js';
import { createBarChart } from '../components/chartWrapper.js';
import { createSkeletonCard } from '../components/skeleton.js';
import { createEmptyState } from '../components/emptyState.js';
import { createIcon } from '../components/icons.js';
import { computeDailyTodoStats } from '../../core/analytics/dailyTodoAnalytics.js';
import { MONTH_ABBR, parseDateKey } from '../../core/analytics/dateKey.js';
import { formatTimeSpent } from '../../core/time/timeTracking.js';

// Same short-date formatter progress.js's own formatShortDate() uses —
// duplicated locally rather than imported cross-page, matching how this
// codebase already treats small page-local presentational formatters (e.g.
// progress.js's own formatLongDate/formatShortDate aren't shared either).
function formatShortDate(dateKeyStr) {
  const d = parseDateKey(dateKeyStr);
  return `${MONTH_ABBR[d.getMonth()]} ${d.getDate()}`;
}

// Same 7-day trailing-average math as progress.js's buildVelocitySeries().
export function buildRollingAverage(counts) {
  return counts.map((_, i) => {
    const start = Math.max(0, i - 6);
    const slice = counts.slice(start, i + 1);
    return slice.reduce((a, b) => a + b, 0) / slice.length;
  });
}

// A plain-language sentence instead of a bare number, per
// .claude/rules/content-style.md's plain-language rule — same "no fabricated
// data, null means say so honestly" discipline progress.js's own stat tiles
// already follow for a not-yet-computable rate.
export function buildTurnaroundSentence(avgTurnaroundMs) {
  if (avgTurnaroundMs === null) return "Complete a todo to see how long it usually takes you, start to finish.";
  const totalMinutes = Math.round(avgTurnaroundMs / 60000);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  const duration = hours > 0 ? `${hours}h ${minutes}m` : `${minutes}m`;
  return `On average, a completed todo takes ${duration} from when you set it to when you finish it.`;
}

// Same kpi-tile/card-arrow-badge structure progress.js's own renderStatTile()
// builds — a smaller, page-local variant (no `bar`/`total` slots, this page
// has no linear-progress or "N / M" figures to show) rather than exporting
// and sharing one function across two unrelated pages for a handful of
// shared class names.
function renderStatTile({ icon, value, label, hero, zero, caption }) {
  return el('div', { className: `kpi-tile${hero ? ' kpi-tile-hero' : ''}` }, [
    el('div', { className: 'kpi-tile-head' }, [
      el('span', { className: 'kpi-tile-label', text: label }),
      el('span', { className: 'card-arrow-badge' }, [createIcon(icon, { size: 'xs' })])
    ]),
    el('div', { className: `kpi-tile-number${zero ? ' kpi-tile-number-zero' : ''}`, text: value }),
    caption ? el('p', { className: 'kpi-tile-delta', text: caption }) : null
  ].filter(Boolean));
}

function renderStatCards(stats) {
  const { doneCount, missedCount, activeCount, completionRatePct, avgTimeSpentSeconds } = stats;
  return el('div', { className: 'kpi-layout' }, [
    renderStatTile({
      icon: 'check',
      value: String(doneCount),
      label: 'Completed',
      hero: true,
      zero: doneCount === 0,
      caption: doneCount === 0 ? 'Complete a todo to see it counted here.' : undefined
    }),
    el('div', { className: 'kpi-grid-secondary' }, [
      renderStatTile({ icon: 'warning', value: String(missedCount), label: 'Missed', zero: missedCount === 0 }),
      renderStatTile({ icon: 'timer', value: String(activeCount), label: 'Active now', zero: activeCount === 0 }),
      renderStatTile({
        icon: 'trendingUp',
        value: completionRatePct === null ? '—' : `${completionRatePct}%`,
        label: 'Completion rate',
        zero: completionRatePct === null || completionRatePct === 0,
        caption: completionRatePct === null ? 'Complete or miss a todo to see a rate.' : undefined
      }),
      renderStatTile({
        icon: 'save',
        value: avgTimeSpentSeconds === null ? '—' : formatTimeSpent(Math.round(avgTimeSpentSeconds)),
        label: 'Avg. time tracked',
        zero: avgTimeSpentSeconds === null
      })
    ])
  ]);
}

// Route: /todo-stats (issue #555). Reachable from sidebar.js's account
// dropdown and a small icon-button on dailyTodoPanel.js's heading row —
// deliberately not added to bottomNav.js's fixed four-tab set, same tier as
// "My reports"/"Take a tour" (account-menu-only, no bottom-nav tab). Stats
// are computed live from dailyTodoStore.getSnapshot().todos on every render
// — see dailyTodoAnalytics.js's own doc comment for why this stays accurate
// without a separate persisted counter, and its one honestly-labeled limit
// (a manually deleted todo stops counting).
export function renderTodoStats(app, { user, store, dailyTodoStore }) {
  if (!user) {
    navigate('/signin', true);
    return undefined;
  }
  if (!store.getSnapshot().onboardingDone) {
    navigate('/onboarding', true);
    return undefined;
  }

  let doneChart = null;
  let missedChart = null;
  // Same "serialize concurrent chart-creation calls" guard progress.js uses
  // — both store subscriptions below can fire their first callback
  // synchronously on mount, which would otherwise race two Chart.js
  // attachments onto the same <canvas> (see progress.js's own chartQueue
  // comment for the full reasoning).
  let chartCallId = 0;
  let chartQueue = Promise.resolve();
  let chartsReady = false;

  const onDeleteAccount = user.isAnonymous ? null : () => openDeleteAccountModal();
  const sidebar = createSidebar({ activeRoute: '/todo-stats', user, store, dailyTodoStore, onDeleteAccount });
  const topbar = createTopbar({ breadcrumb: 'Todo stats', user, store, dailyTodoStore, onDeleteAccount });
  const guestBanner = createGuestBanner(user);
  const bottomNav = createBottomNav({ activeRoute: '/todo-stats' });

  // Persistent slots/elements, built once — renderAll() below only ever
  // updates their contents (replaceChildren/textContent/hidden), never
  // recreates the canvas elements themselves. Recreating a fresh <canvas>
  // per store update (and re-attaching Chart.js to it) is exactly the
  // "canvas already in use"/detached-instance churn progress.js's own
  // chartQueue comment warns about — this avoids it by construction instead
  // of relying on destroy() ordering to paper over it.
  const emptySlot = el('div', {});
  const statsBody = el('div', { className: 'todo-stats-body', hidden: true });
  const statStripSlot = el('div', {});
  const turnaroundSlot = el('p', { className: 'todo-stats-turnaround' });
  const doneCanvas = el('canvas', { className: 'chart-canvas-loading' });
  const missedCanvas = el('canvas', { className: 'chart-canvas-loading' });
  const doneSkeleton = createSkeletonCard();
  const missedSkeleton = createSkeletonCard();

  const content = el('div', { className: 'app-content todo-stats-content', id: 'main-content', tabindex: '-1' }, [
    guestBanner,
    el('header', { className: 'todo-stats-header' }, [
      el('h1', { className: 'todo-stats-title', text: 'Todo stats' }),
      el('p', { className: 'todo-stats-subtitle', text: "How your Today's Todos have gone, across every roadmap." })
    ]),
    emptySlot,
    statsBody
  ]);
  statsBody.append(
    statStripSlot,
    turnaroundSlot,
    el('div', { className: 'progress-card' }, [
      el('h2', { className: 'progress-card-title', text: 'Completed per day' }),
      el('div', { className: 'chart-container' }, [doneSkeleton, doneCanvas])
    ]),
    el('div', { className: 'progress-card' }, [
      el('h2', { className: 'progress-card-title', text: 'Missed per day' }),
      el('div', { className: 'chart-container' }, [missedSkeleton, missedCanvas])
    ])
  );

  const shell = el('div', { className: 'app-shell-2 todo-stats-page fade-in' }, [
    sidebar,
    el('div', { className: 'app-shell-main' }, [topbar, content]),
    bottomNav
  ]);

  app.replaceChildren(shell);

  async function renderChartsNow(dailyBuckets) {
    const callId = (chartCallId += 1);
    doneChart?.destroy();
    missedChart?.destroy();
    doneChart = null;
    missedChart = null;
    const labels = dailyBuckets.map(bucket => formatShortDate(bucket.date));
    const doneCounts = dailyBuckets.map(bucket => bucket.done);
    const missedCounts = dailyBuckets.map(bucket => bucket.missed);
    const [nextDoneChart, nextMissedChart] = await Promise.all([
      createBarChart(doneCanvas, {
        labels,
        counts: doneCounts,
        rollingAverage: buildRollingAverage(doneCounts),
        label: 'Completed',
        averageLabel: '7-day avg'
      }),
      createBarChart(missedCanvas, {
        labels,
        counts: missedCounts,
        rollingAverage: buildRollingAverage(missedCounts),
        label: 'Missed',
        averageLabel: '7-day avg'
      })
    ]);
    if (callId !== chartCallId) {
      nextDoneChart.destroy();
      nextMissedChart.destroy();
      return;
    }
    doneChart = nextDoneChart;
    missedChart = nextMissedChart;
    if (!chartsReady) {
      chartsReady = true;
      doneSkeleton.hidden = true;
      missedSkeleton.hidden = true;
      doneCanvas.classList.remove('chart-canvas-loading');
      missedCanvas.classList.remove('chart-canvas-loading');
    }
  }

  function renderCharts(dailyBuckets) {
    chartQueue = chartQueue.then(() => renderChartsNow(dailyBuckets));
    return chartQueue;
  }

  function renderAll() {
    const todos = dailyTodoStore?.getSnapshot().todos || [];
    if (!todos.length) {
      statsBody.hidden = true;
      emptySlot.replaceChildren(createEmptyState({
        icon: 'timer',
        title: 'No todos yet.',
        message: "Set your first Today's Todo to start building a history here.",
        actionText: 'Go to your roadmaps',
        onAction: () => navigate('/onboarding')
      }));
      return;
    }

    emptySlot.replaceChildren();
    statsBody.hidden = false;
    const stats = computeDailyTodoStats(todos, Date.now());
    statStripSlot.replaceChildren(renderStatCards(stats));
    turnaroundSlot.textContent = buildTurnaroundSentence(stats.avgTurnaroundMs);
    renderCharts(stats.dailyBuckets);
  }

  const unsubStore = store.subscribe(renderAll);
  const unsubDailyTodo = dailyTodoStore ? dailyTodoStore.subscribe(renderAll) : () => {};

  return () => {
    sidebar._cleanup?.();
    topbar._cleanup?.();
    bottomNav._cleanup?.();
    unsubStore();
    unsubDailyTodo();
    doneChart?.destroy();
    missedChart?.destroy();
  };
}
