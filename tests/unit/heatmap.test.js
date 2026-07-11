import { describe, it, expect } from 'vitest';
import { createHeatmap } from '../../src/ui/components/heatmap.js';
import { computeHeatmap } from '../../src/core/analytics/heatmapData.js';

const NOW = new Date(2026, 6, 10).getTime(); // 2026-07-10

describe('createHeatmap', () => {
  it('renders role=img with an aria-label summarizing total completions', () => {
    const data = computeHeatmap({ '2026-07-10': 3, '2026-07-09': 2 }, NOW);
    const node = createHeatmap(data);
    expect(node.getAttribute('role')).toBe('img');
    expect(node.getAttribute('aria-label')).toBe('Activity heatmap: 5 items completed in the last year');
  });

  it('renders exactly one cell per computeHeatmap entry (364)', () => {
    const data = computeHeatmap({}, NOW);
    const node = createHeatmap(data);
    expect(node.querySelectorAll('.heatmap-cell')).toHaveLength(364);
  });

  it('marks exactly one cell as today', () => {
    const data = computeHeatmap({}, NOW);
    const node = createHeatmap(data);
    expect(node.querySelectorAll('.heatmap-cell[data-today="true"]')).toHaveLength(1);
  });

  it('sets data-level on each cell matching its bucket', () => {
    const data = computeHeatmap({ '2026-07-10': 7 }, NOW);
    const node = createHeatmap(data);
    const todayCell = node.querySelector('.heatmap-cell[data-today="true"]');
    expect(todayCell.dataset.level).toBe('4');
  });

  it('renders day-of-week labels only for Mon/Wed/Fri', () => {
    const data = computeHeatmap({}, NOW);
    const node = createHeatmap(data);
    const labels = Array.from(node.querySelectorAll('.heatmap-day-label')).map(l => l.textContent);
    expect(labels.filter(Boolean).sort()).toEqual(['Fri', 'Mon', 'Wed']);
  });

  it('gives each cell an accessible title with the date and count', () => {
    const data = computeHeatmap({ '2026-07-10': 2 }, NOW);
    const node = createHeatmap(data);
    const todayCell = node.querySelector('.heatmap-cell[data-today="true"]');
    expect(todayCell.getAttribute('title')).toMatch(/Jul 10 · 2 items completed/);
  });

  it('handles a single-count day with singular wording', () => {
    const data = computeHeatmap({ '2026-07-10': 1 }, NOW);
    const node = createHeatmap(data);
    const todayCell = node.querySelector('.heatmap-cell[data-today="true"]');
    expect(todayCell.getAttribute('title')).toMatch(/1 item completed/);
  });

  it('renders a 5-swatch legend', () => {
    const node = createHeatmap(computeHeatmap({}, NOW));
    expect(node.querySelectorAll('.heatmap-legend-swatch')).toHaveLength(5);
  });
});
