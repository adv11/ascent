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

// issue #155 — the gradient fill under the line chart needs an actual
// rgba() string (Canvas gradients can't read a CSS custom property
// directly), but it should still track --brand-deep's live per-theme value
// rather than a hardcoded literal that never changes with theme — same
// "no hardcoded literal that can drift from the token" discipline
// `axisOptions()` below already follows. `hex` is #rrggbb-only (every
// --brand-deep value in app.css is), which is all this needs.
function hexToRgba(hex, alpha) {
  const clean = hex.replace('#', '');
  const r = parseInt(clean.slice(0, 2), 16);
  const g = parseInt(clean.slice(2, 4), 16);
  const b = parseInt(clean.slice(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

function axisOptions() {
  const tickColor = cssVar('--muted', '#5f6e84');
  const gridColor = cssVar('--line', '#dbe3ee');
  return {
    x: { ticks: { color: tickColor }, grid: { color: gridColor } },
    y: { ticks: { color: tickColor }, grid: { color: gridColor } }
  };
}

// createLineChart(canvas, { labels, totals }) — B4's cumulative progress
// line. `totals[i]` is the running total as of `labels[i]`.
export async function createLineChart(canvas, { labels, totals }) {
  const Chart = await loadChartModule();
  const ctx = canvas.getContext('2d');
  // issue #155 — dedicated data-viz teal (--brand-deep) instead of --brand,
  // same token gauges/rings now use for the same reason (a measurably
  // darker/more-saturated teal reads better as a data-ink color than the
  // brighter --brand hue, per the reference's pixel-sampled gauge stroke).
  const brandColor = cssVar('--brand-deep', '#0f766e');
  const gradient = ctx.createLinearGradient(0, 0, 0, canvas.height || 260);
  gradient.addColorStop(0, hexToRgba(brandColor, 0.3));
  gradient.addColorStop(1, hexToRgba(brandColor, 0));

  const { x, y } = axisOptions();
  return new Chart(ctx, {
    type: 'line',
    data: {
      labels,
      datasets: [{
        label: 'Total completed',
        data: totals,
        borderColor: brandColor,
        backgroundColor: gradient,
        fill: true,
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
// velocity bars plus a 7-day rolling-average overlay line.
export async function createBarChart(canvas, { labels, counts, rollingAverage }) {
  const Chart = await loadChartModule();
  // issue #155 — same --brand-deep data-viz teal as the line chart above.
  const brandColor = cssVar('--brand-deep', '#0f766e');
  // Was a hardcoded '#f97316' literal that never tracked theme — now reads
  // the live --accent token (already the app's existing "secondary/
  // comparison" semantic color, e.g. priority P1), which already correctly
  // differs per theme (#f97316 light / #fb923c dark) the same way every
  // other chart color here does.
  const averageLineColor = cssVar('--accent', '#f97316');
  const { x, y } = axisOptions();
  return new Chart(canvas.getContext('2d'), {
    data: {
      labels,
      datasets: [
        {
          type: 'bar',
          label: 'Items completed',
          data: counts,
          backgroundColor: brandColor,
          borderRadius: 3
        },
        {
          type: 'line',
          label: '7-day avg',
          data: rollingAverage,
          borderColor: averageLineColor,
          backgroundColor: averageLineColor,
          borderWidth: 2,
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
