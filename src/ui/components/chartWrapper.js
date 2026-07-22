import { el } from '../dom.js';

// Lazy Chart.js loader + thin wrapper (issue #8, B4/B5) — Chart.js is not an
// npm dependency (this repo has no build step/bundler — see root CLAUDE.md);
// it's dynamically imported from a pinned-version jsdelivr URL, and only the
// very first time a line/bar chart is actually created (i.e. the first time
// a user visits `#/progress`), not on every app load.
//
// SRI note (see docs/adr/ADR-002-csp-sri-security.md, "CDN loading" section
// added alongside this file): a dynamic `import()` cannot carry an
// `integrity` attribute the way a `<script>`/`<link rel="modulepreload">`
// tag can — there is currently no browser mechanism to subresource-integrity
// check a dynamically-imported ES module. The mitigation here is pinning an
// *exact* released version (jsdelivr serves a given `@version` path
// immutably — the content at this URL cannot change without publishing a
// new Chart.js version) rather than a `@latest`/unpinned tag, plus the same
// `index.html` `script-src` CSP allowlist that already gates which hosts can
// serve executable script at all. This is a real, deliberate gap versus the
// Firebase SDK's modulepreload+SRI pattern, not an oversight.
const CHART_JS_VERSION = '4.4.4';
const CHART_JS_URL = `https://cdn.jsdelivr.net/npm/chart.js@${CHART_JS_VERSION}/+esm`;

let chartModulePromise = null;

function loadChartModule() {
  if (!chartModulePromise) {
    chartModulePromise = import(CHART_JS_URL).then(mod => {
      const Chart = mod.Chart || mod.default;
      Chart.register(...(mod.registerables || []));
      return Chart;
    });
  }
  return chartModulePromise;
}

// Reads the live theme token instead of a hardcoded literal, the same
// pattern shareCard.js already uses — so these charts can never silently
// drift from the real theme (or go low-contrast on the dark --panel
// background) if those tokens change (issue #116).
function cssVar(name, fallback) {
  const value = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  return value || fallback;
}

// issue #300 — `--color-brand-gold` no longer exists as a CSS custom property
// (removed in Phase 1's #297 token migration; design-system.md's mapping
// table repoints every old "primary accent" token, this one included, to
// --color-accent). cssVar() silently returned its hardcoded fallback for
// every call once the real property stopped resolving, which meant every
// Progress-page chart had been rendering in the pre-#297 Alpenglow gold
// (#d9a441) since Phase 1 merged — a real, live regression, not just a
// stale reference. Now reads --color-accent directly. The area-fill
// gradient is also removed per design-system.md §5: "single accent line...
// no area fills, no gradients."
function axisOptions() {
  const tickColor = cssVar('--color-text-muted', '#6b6156');
  const gridColor = cssVar('--color-divider', '#e4dfd8');
  return {
    x: { ticks: { color: tickColor }, grid: { color: gridColor, lineWidth: 0.5 } },
    y: { ticks: { color: tickColor }, grid: { color: gridColor, lineWidth: 0.5 } }
  };
}

// createLineChart(canvas, { labels, totals }) — B4's cumulative progress
// line. `totals[i]` is the running total as of `labels[i]`.
export async function createLineChart(canvas, { labels, totals }) {
  const Chart = await loadChartModule();
  const ctx = canvas.getContext('2d');
  const accentColor = cssVar('--color-accent', '#EC3013');

  const { x, y } = axisOptions();
  return new Chart(ctx, {
    type: 'line',
    data: {
      labels,
      datasets: [{
        label: 'Total completed',
        data: totals,
        borderColor: accentColor,
        fill: false,
        tension: 0.35,
        pointRadius: 0,
        pointHoverRadius: 4
      }]
    },
    options: {
      maintainAspectRatio: false,
      responsive: true,
      scales: { x, y: { ...y, beginAtZero: true } },
      plugins: { legend: { display: false } }
    }
  });
}

// createBarChart(canvas, { labels, counts, rollingAverage }) — B5's daily
// velocity bars plus a 7-day rolling-average overlay line. The overlay is a
// dashed accent line (design-system.md §5's "dashed accent projection"),
// distinguishing it visually from the solid-accent bars beneath it.
export async function createBarChart(canvas, { labels, counts, rollingAverage }) {
  const Chart = await loadChartModule();
  const accentColor = cssVar('--color-accent', '#EC3013');
  const accent700Color = cssVar('--color-accent-700', '#AE1800');
  const { x, y } = axisOptions();
  return new Chart(canvas.getContext('2d'), {
    data: {
      labels,
      datasets: [
        {
          type: 'bar',
          label: 'Items completed',
          data: counts,
          backgroundColor: accentColor
        },
        {
          type: 'line',
          label: '7-day avg',
          data: rollingAverage,
          borderColor: accent700Color,
          backgroundColor: accent700Color,
          borderWidth: 2,
          borderDash: [6, 4],
          pointRadius: 0,
          tension: 0.3
        }
      ]
    },
    options: {
      maintainAspectRatio: false,
      responsive: true,
      scales: { x, y: { ...y, beginAtZero: true, ticks: { ...y.ticks, precision: 0 } } },
      plugins: { legend: { display: false } }
    }
  });
}

// issue #155 v2 Phase B — the reference's value-bucketed multi-color bar series +
// floating custom tooltip (a small white rounded-rect card, dark text, pointing down
// at the hovered bar) + legend row (dot + label). Built and visually verified in
// isolation this phase; no page calls this yet — Phase C/D wires it into a real chart.
// issue #300 — --color-brand-gold no longer exists (see createLineChart's
// own comment above); repointed to --color-accent, same as the live charts.
const BUCKET_TOKENS = { high: '--color-accent', medium: '--color-text-faint', low: '--color-border-strong' };
const BUCKET_FALLBACKS = { high: '#EC3013', medium: '#9c9184', low: '#d3ccc0' };
export const BUCKET_LEGEND = [
  { bucket: 'high', label: 'High' },
  { bucket: 'medium', label: 'Medium' },
  { bucket: 'low', label: 'Low' }
];

function bucketColor(bucket) {
  return cssVar(BUCKET_TOKENS[bucket], BUCKET_FALLBACKS[bucket]);
}

// Default tercile split when the caller has no domain-specific thresholds of their own
// — the lowest third of sorted values is "low", the middle third "medium", the rest
// "high". Callers with real bucket semantics (e.g. a fixed count threshold) should
// pass their own `bucketOf(value)` instead of relying on this.
function defaultBucketOf(values) {
  const sorted = [...values].sort((a, b) => a - b);
  const lowMax = sorted[Math.floor(sorted.length / 3)] ?? 0;
  const midMax = sorted[Math.floor((sorted.length * 2) / 3)] ?? 0;
  return (value) => (value <= lowMax ? 'low' : value <= midMax ? 'medium' : 'high');
}

function positionTooltip(tooltipEl, canvas, context) {
  const tooltip = context.tooltip;
  if (!tooltip || tooltip.opacity === 0) {
    tooltipEl.classList.remove('visible');
    return;
  }
  const rect = canvas.getBoundingClientRect();
  const point = tooltip.dataPoints?.[0];
  tooltipEl.replaceChildren(
    el('span', { className: 'chart-tooltip-date', text: point?.label ?? '' }),
    el('span', { className: 'chart-tooltip-value', text: String(point?.formattedValue ?? '') })
  );
  tooltipEl.style.left = `${rect.left + window.scrollX + tooltip.caretX}px`;
  tooltipEl.style.top = `${rect.top + window.scrollY + tooltip.caretY}px`;
  tooltipEl.classList.add('visible');
}

// createBucketedBarChart(canvas, { labels, values, bucketOf }) — `bucketOf` is an
// optional `(value) => 'high' | 'medium' | 'low'` classifier; defaults to a tercile
// split over `values` when omitted. The floating tooltip is portaled to
// `document.body` (not appended near `canvas`) and positioned from
// `getBoundingClientRect()`, the same "every floating/positioned element is a portal"
// convention `select.js`/`dropdown.js` already use in this app (`.claude/rules/
// ui-styling.md`) — a canvas nested inside an animated/transformed or merely
// non-positioned ancestor would otherwise misposition a sibling-appended tooltip
// (caught live in this phase's own isolated visual verification: an earlier version
// appended the tooltip next to the canvas and measured document-root coordinates
// against a `position: relative`-scoped one, landing it far from the actual bar).
export async function createBucketedBarChart(canvas, { labels, values, bucketOf }) {
  const Chart = await loadChartModule();
  const resolvedBucketOf = bucketOf || defaultBucketOf(values);
  const colors = values.map((value) => bucketColor(resolvedBucketOf(value)));
  const { x, y } = axisOptions();

  const tooltipEl = el('div', { className: 'chart-tooltip' });
  document.body.appendChild(tooltipEl);

  const chart = new Chart(canvas.getContext('2d'), {
    type: 'bar',
    data: { labels, datasets: [{ label: 'Value', data: values, backgroundColor: colors, borderRadius: 4 }] },
    options: {
      maintainAspectRatio: false,
      responsive: true,
      scales: { x, y: { ...y, beginAtZero: true, ticks: { ...y.ticks, precision: 0 } } },
      plugins: {
        legend: { display: false },
        tooltip: {
          enabled: false,
          external: (context) => positionTooltip(tooltipEl, canvas, context)
        }
      }
    }
  });

  // Every caller in this app destroys a chart with a plain `chart?.destroy()` on
  // re-render/unmount (see progress.js) — wrapping `destroy()` to also remove the
  // portaled tooltip node keeps that exact call site working with no new cleanup step
  // for callers to remember, matching this app's "always pair a subscription/portal
  // with teardown" convention (`.claude/rules/ui-styling.md`).
  const originalDestroy = chart.destroy.bind(chart);
  chart.destroy = () => {
    tooltipEl.remove();
    originalDestroy();
  };

  return chart;
}

// createChartLegend([{ bucket, label }]) — the reference's "dot + label" row below a
// bucketed bar chart. Defaults to BUCKET_LEGEND (high/medium/low) when called with no
// argument; pass a custom list for a chart with different bucket semantics.
export function createChartLegend(items = BUCKET_LEGEND) {
  return el('div', { className: 'chart-legend' }, items.map(({ bucket, label }) =>
    el('span', { className: 'chart-legend-item' }, [
      el('span', { className: `chart-legend-dot chart-legend-dot-${bucket}` }),
      label
    ])
  ));
}
