import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { generateShareCard } from '../../src/ui/components/shareCard.js';
import { BRAND_NAME } from '../../src/ui/components/brand.js';

// jsdom's canvas getContext('2d') returns null without the optional `canvas`
// npm package (not installed here — this repo has no build step/native
// deps). Stub a minimal fake 2D context that just records every call, so
// generateShareCard()'s drawing logic can run and be asserted on without a
// real rasterizer.
let calls;
let originalGetContext;

function fakeCtx() {
  const ctx = {
    fillRect: vi.fn(), fillText: vi.fn(), beginPath: vi.fn(), moveTo: vi.fn(),
    lineTo: vi.fn(), closePath: vi.fn(), fill: vi.fn(), arcTo: vi.fn(),
    rect: vi.fn(), stroke: vi.fn(), strokeRect: vi.fn(),
    createLinearGradient: vi.fn(() => ({ addColorStop: vi.fn() })),
    set fillStyle(v) { calls.fillStyle.push(v); },
    get fillStyle() { return calls.fillStyle[calls.fillStyle.length - 1]; },
    set strokeStyle(v) { calls.strokeStyle = v; },
    get strokeStyle() { return calls.strokeStyle; },
    set lineWidth(v) { calls.lineWidth = v; },
    get lineWidth() { return calls.lineWidth; },
    set font(v) { calls.font.push(v); },
    get font() { return calls.font[calls.font.length - 1]; },
    set textAlign(v) { calls.textAlign = v; },
    get textAlign() { return calls.textAlign; },
    set textBaseline(v) { calls.textBaseline = v; },
    get textBaseline() { return calls.textBaseline; }
  };
  // Record fillText calls with a plain wrapper so assertions can read args.
  const realFillText = ctx.fillText;
  ctx.fillText = (...args) => { calls.fillTextArgs.push(args); return realFillText(...args); };
  return ctx;
}

beforeEach(() => {
  calls = { fillStyle: [], font: [], fillTextArgs: [] };
  originalGetContext = HTMLCanvasElement.prototype.getContext;
  HTMLCanvasElement.prototype.getContext = function stubGetContext() { return fakeCtx(); };
  if (!document.fonts) {
    Object.defineProperty(document, 'fonts', { configurable: true, value: { load: vi.fn(() => Promise.resolve()) } });
  }
});

afterEach(() => {
  HTMLCanvasElement.prototype.getContext = originalGetContext;
});

function fakeAnalytics(overrides = {}) {
  return {
    overview: { total: 340, done: 128, pct: 38 },
    streaks: { current: 14, longest: 21 },
    velocity: 4.2,
    phaseBreakdown: [{ phase: 'Java', done: 1, total: 2, pct: 50 }, { phase: 'Spring', done: 0, total: 1, pct: 0 }],
    priorityBreakdown: [],
    heatmapData: [],
    projection: { remainingItems: 212, velocity: 4.2, daysToComplete: 50 },
    ...overrides
  };
}

describe('generateShareCard', () => {
  it('returns a 1200x630 canvas', async () => {
    const canvas = await generateShareCard(fakeAnalytics(), {}, Date.now());
    expect(canvas.width).toBe(1200);
    expect(canvas.height).toBe(630);
  });

  it('draws the brand name (never a hardcoded literal elsewhere) — uppercase per design-system.md\'s wordmark rule', async () => {
    await generateShareCard(fakeAnalytics(), {}, Date.now());
    const texts = calls.fillTextArgs.map(args => args[0]);
    expect(texts.some(t => t.includes(BRAND_NAME.toUpperCase()))).toBe(true);
  });

  it('draws the completion stats and streak', async () => {
    await generateShareCard(fakeAnalytics(), {}, Date.now());
    const texts = calls.fillTextArgs.map(args => args[0]);
    expect(texts.some(t => t.includes('128 items complete · 38%'))).toBe(true);
    expect(texts.some(t => t.includes('14-day streak'))).toBe(true);
  });

  it('draws phase tags from the phase breakdown', async () => {
    await generateShareCard(fakeAnalytics(), {}, Date.now());
    const texts = calls.fillTextArgs.map(args => args[0]);
    expect(texts.some(t => t.includes('Java') && t.includes('Spring'))).toBe(true);
  });

  it('does not throw when phaseBreakdown is empty', async () => {
    await expect(generateShareCard(fakeAnalytics({ phaseBreakdown: [] }), {}, Date.now())).resolves.toBeTruthy();
  });
});
