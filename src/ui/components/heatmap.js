import { el } from '../dom.js';
import { attachTooltip } from './tooltip.js';
import { parseDateKey, MONTH_ABBR } from '../../core/analytics/dateKey.js';

// GitHub-style activity heatmap (issue #8, B3). The issue spec sketches this
// as "pure SVG" — built here as plain HTML/CSS Grid instead, deliberately:
// `attachTooltip()` (the existing hover-bubble component every other
// tooltip in this app already uses) appends an HTML child to its trigger,
// which an SVG `<rect>` cannot hold (SVG shape elements aren't valid HTML
// containers), and per-cell positioning can't use inline `style` at all
// (index.html's CSP has no `unsafe-inline` for style-src — see
// .claude/rules/ui-styling.md). CSS Grid with `grid-auto-flow: column` lays
// out an arbitrary (52 or 53, depending on today's weekday) column count
// with zero per-cell inline positioning: cells are emitted in strict
// chronological — and therefore strict (column, row) — order, so the
// browser's own column-major auto-placement does the rest; only each cell's
// row (a fixed 0-6) needs an explicit class, capped at 7 values, same
// "discrete class, never inline style" pattern the rest of the codebase uses
// (e.g. `.entering-delay-0..6`).

const DAY_ABBR = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
// Only these three rows get a visible day-of-week label, matching GitHub's
// own contribution graph convention (issue #8's mock: "Mon / Wed / Fri
// only").
const LABELED_ROWS = { 1: 'Mon', 3: 'Wed', 5: 'Fri' };

// Assigns each cell a (col, row) grid position such that columns are real
// calendar weeks (row 0 = Sunday .. row 6 = Saturday) — not just "every 7
// cells is a column," which would misalign the Mon/Wed/Fri row labels
// against the actual weekday whenever today isn't a Saturday. `cells[0]`
// (the oldest cell) may land mid-column if its weekday isn't Sunday; that
// column is simply partially filled, same as a real GitHub graph's first
// column.
function layoutCells(cells) {
  if (!cells.length) return { columns: 0, positioned: [] };
  const firstDow = parseDateKey(cells[0].date).getDay();
  let columns = 0;
  const positioned = cells.map((cell, i) => {
    const offset = i + firstDow;
    const col = Math.floor(offset / 7);
    const row = offset % 7;
    if (col + 1 > columns) columns = col + 1;
    return { ...cell, col, row };
  });
  return { columns, positioned };
}

// One label per column, only at the column where the month actually
// changes — `positioned` is already in strict chronological (and thus
// column-ascending) order, so the first cell found for each column is
// always that column's earliest (lowest-row) date.
function monthLabelsFor(positioned, columns) {
  const labels = new Array(columns).fill('');
  let lastMonth = null;
  for (let col = 0; col < columns; col += 1) {
    const firstCellInCol = positioned.find(c => c.col === col);
    if (!firstCellInCol) continue;
    const month = parseDateKey(firstCellInCol.date).getMonth();
    if (month !== lastMonth) {
      labels[col] = MONTH_ABBR[month];
      lastMonth = month;
    }
  }
  return labels;
}

function formatCellDate(dateKeyStr) {
  const d = parseDateKey(dateKeyStr);
  return `${DAY_ABBR[d.getDay()]}, ${MONTH_ABBR[d.getMonth()]} ${d.getDate()}`;
}

function cellTooltipText(cell) {
  const dateLabel = formatCellDate(cell.date);
  if (cell.count === 0) return `${dateLabel} · No activity`;
  return `${dateLabel} · ${cell.count} item${cell.count === 1 ? '' : 's'} completed`;
}

// createHeatmap(heatmapData) — heatmapData is computeHeatmap()'s output
// (src/core/analytics/heatmapData.js): always exactly 364 cells, oldest
// first, each { date, count, level, isToday }.
export function createHeatmap(heatmapData = []) {
  const { columns, positioned } = layoutCells(heatmapData);
  const totalCompleted = heatmapData.reduce((sum, cell) => sum + cell.count, 0);
  const monthLabels = monthLabelsFor(positioned, columns);

  const monthRow = el('div', { className: 'heatmap-months', 'aria-hidden': 'true' },
    monthLabels.map(label => el('span', { className: 'heatmap-month-label', text: label })));

  const dayLabelColumn = el('div', { className: 'heatmap-day-labels', 'aria-hidden': 'true' },
    [0, 1, 2, 3, 4, 5, 6].map(row => el('span', { className: `heatmap-day-label gr-${row + 1}`, text: LABELED_ROWS[row] || '' })));

  const cellGrid = el('div', { className: 'heatmap-grid' },
    positioned.map(cell => {
      // Each cell is a mouse-hover-only affordance, not a keyboard tab stop —
      // 364 individually-focusable controls would be unusable to navigate,
      // and the parent .heatmap's role="img"/aria-label already gives
      // assistive tech a full text summary. Issue #124: a `<button
      // tabindex="-1" aria-hidden="true">` still tripped axe's
      // focusable-content/focusable-element/nested-interactive rules — axe
      // flags a `tabindex="-1"` + `aria-hidden="true"` interactive element as
      // "serious" regardless, since some assistive tech can still focus it.
      // The actual fix is a plain, non-interactive `<span>` (matching
      // monthRow/dayLabelColumn's existing decorative-label pattern above)
      // instead of a `<button>` — there's no native interactive semantics to
      // suppress once the element was never a real button to begin with.
      // No native `title` attribute here — attachTooltip() below already
      // renders a tooltip; adding both showed two overlapping tooltips at
      // once (the browser's native one, plus the custom bubble), found live
      // via a screenshot report.
      const button = el('span', {
        'aria-hidden': 'true',
        className: `heatmap-cell gr-${cell.row + 1}`,
        dataset: { level: String(cell.level), today: cell.isToday ? 'true' : 'false' }
      });
      attachTooltip(button, cellTooltipText(cell));
      return button;
    }));

  const legend = el('div', { className: 'heatmap-legend' }, [
    el('span', { text: 'Less' }),
    ...[0, 1, 2, 3, 4].map(level => el('span', { className: 'heatmap-legend-swatch', dataset: { level: String(level) } })),
    el('span', { text: 'More' })
  ]);

  // Day labels stay fixed; month row + cell grid scroll together
  // horizontally as one unit on a narrow viewport (52-53 columns at 15px
  // each is ~780-795px wide, wider than most phones) — same "let the wide
  // thing scroll inside its own container, don't shrink it" approach used
  // for wide tables/code blocks elsewhere.
  // Issue #124 — a horizontally-overflowing region needs its own tab stop
  // (WCAG 2.1.1 "scrollable-region-focusable") so a keyboard-only user can
  // reach and scroll it via arrow keys; this became a real gap (not just an
  // axe false positive) the moment the cells inside it stopped being
  // individually focusable (see the `<span>` change above) — before that,
  // the 364 cell buttons incidentally satisfied the same requirement.
  const scrollRegion = el('div', {
    className: 'heatmap-scroll',
    tabindex: '0',
    role: 'group',
    'aria-label': 'Activity heatmap, scrollable'
  }, [monthRow, cellGrid]);

  return el('div', {
    className: 'heatmap',
    role: 'img',
    'aria-label': `Activity heatmap: ${totalCompleted} item${totalCompleted === 1 ? '' : 's'} completed in the last year`
  }, [
    el('div', { className: 'heatmap-body' }, [dayLabelColumn, scrollRegion]),
    legend
  ]);
}
