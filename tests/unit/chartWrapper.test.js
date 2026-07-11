import { describe, it, expect, vi, beforeEach } from 'vitest';

const registerSpy = vi.fn();

class FakeChart {
  constructor(ctx, config) {
    this.ctx = ctx;
    this.config = config;
    this.destroyed = false;
  }
  destroy() {
    this.destroyed = true;
  }
  static register(...args) {
    registerSpy(...args);
  }
}

vi.mock('https://cdn.jsdelivr.net/npm/chart.js@4.4.4/+esm', () => ({
  Chart: FakeChart,
  registerables: ['fake-registerable'],
}));

function fakeCanvas() {
  const canvas = document.createElement('canvas');
  canvas.getContext = () => ({ createLinearGradient: () => ({ addColorStop: vi.fn() }) });
  return canvas;
}

beforeEach(() => {
  vi.clearAllMocks();
  // chartWrapper.js caches its dynamic import in a module-level promise —
  // reset the module registry each test so "registers on first use" can
  // actually observe a first use, not a cache hit from an earlier test.
  vi.resetModules();
});

describe('createLineChart', () => {
  it('creates a Chart.js line chart with the given labels/totals', async () => {
    const { createLineChart } = await import('../../src/ui/components/chartWrapper.js');
    const chart = await createLineChart(fakeCanvas(), { labels: ['Jul 1', 'Jul 2'], totals: [1, 3] });
    expect(chart).toBeInstanceOf(FakeChart);
    expect(chart.config.type).toBe('line');
    expect(chart.config.data.labels).toEqual(['Jul 1', 'Jul 2']);
    expect(chart.config.data.datasets[0].data).toEqual([1, 3]);
    expect(chart.config.options.maintainAspectRatio).toBe(false);
  });

  it('registers Chart.js components on first use', async () => {
    const { createLineChart } = await import('../../src/ui/components/chartWrapper.js');
    await createLineChart(fakeCanvas(), { labels: [], totals: [] });
    expect(registerSpy).toHaveBeenCalledWith('fake-registerable');
  });

  it('reads axis tick/grid colors from the live theme tokens, not a hardcoded literal (issue #116)', async () => {
    document.documentElement.style.setProperty('--muted', 'rgb(1, 2, 3)');
    document.documentElement.style.setProperty('--line', 'rgb(4, 5, 6)');
    const { createLineChart } = await import('../../src/ui/components/chartWrapper.js');
    const chart = await createLineChart(fakeCanvas(), { labels: [], totals: [] });
    expect(chart.config.options.scales.x.ticks.color).toBe('rgb(1, 2, 3)');
    expect(chart.config.options.scales.y.ticks.color).toBe('rgb(1, 2, 3)');
    expect(chart.config.options.scales.x.grid.color).toBe('rgb(4, 5, 6)');
    expect(chart.config.options.scales.y.grid.color).toBe('rgb(4, 5, 6)');
    document.documentElement.style.removeProperty('--muted');
    document.documentElement.style.removeProperty('--line');
  });
});

describe('createBarChart', () => {
  it('creates a mixed bar+line chart with counts and a rolling average overlay', async () => {
    const { createBarChart } = await import('../../src/ui/components/chartWrapper.js');
    const chart = await createBarChart(fakeCanvas(), { labels: ['Jul 1'], counts: [4], rollingAverage: [2.5] });
    expect(chart.config.data.datasets[0].type).toBe('bar');
    expect(chart.config.data.datasets[0].data).toEqual([4]);
    expect(chart.config.data.datasets[1].type).toBe('line');
    expect(chart.config.data.datasets[1].data).toEqual([2.5]);
  });

  it('the returned chart instance can be destroyed', async () => {
    const { createBarChart } = await import('../../src/ui/components/chartWrapper.js');
    const chart = await createBarChart(fakeCanvas(), { labels: [], counts: [], rollingAverage: [] });
    chart.destroy();
    expect(chart.destroyed).toBe(true);
  });

  it('falls back to the light-theme default colors when a token is unset', async () => {
    const { createBarChart } = await import('../../src/ui/components/chartWrapper.js');
    const chart = await createBarChart(fakeCanvas(), { labels: [], counts: [], rollingAverage: [] });
    expect(chart.config.data.datasets[0].backgroundColor).toBe('#0f766e');
    expect(chart.config.options.scales.y.ticks.color).toBe('#5f6e84');
  });
});
