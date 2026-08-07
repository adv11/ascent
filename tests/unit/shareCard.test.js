import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { generateShareCard, generateBadgeCard, getCardStyleNames, shareSiteUrl } from '../../src/ui/components/shareCard.js';
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
    lineTo: vi.fn(), closePath: vi.fn(), fill: vi.fn(), rect: vi.fn(),
    stroke: vi.fn(), strokeRect: vi.fn(),
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

function fakeCardData(overrides = {}) {
  return {
    style: 'light',
    headlinePct: 26,
    headlineLabel: 'of my Java Backend Engineer roadmap',
    stats: [{ value: '128/484', label: 'topics done' }, { value: '4-day', label: 'current streak' }, { value: '3.2', label: 'topics a day' }],
    activityCells: null,
    phaseNames: ['Core Java', 'Concurrency'],
    dateLabel: '2 August 2026',
    link: 'localhost:8931',
    ...overrides
  };
}

describe('generateShareCard', () => {
  it('returns a 1200x630 canvas', async () => {
    const canvas = await generateShareCard(fakeCardData());
    expect(canvas.width).toBe(1200);
    expect(canvas.height).toBe(630);
  });

  it('draws the brand name uppercase', async () => {
    await generateShareCard(fakeCardData());
    const texts = calls.fillTextArgs.map(args => args[0]);
    expect(texts.some(t => t.includes(BRAND_NAME.toUpperCase()))).toBe(true);
  });

  it('draws the headline percentage and label', async () => {
    await generateShareCard(fakeCardData());
    const texts = calls.fillTextArgs.map(args => args[0]);
    expect(texts.some(t => t.includes('26%'))).toBe(true);
    expect(texts.some(t => t.includes('of my Java Backend Engineer roadmap'))).toBe(true);
  });

  it('draws every stat value and label', async () => {
    await generateShareCard(fakeCardData());
    const texts = calls.fillTextArgs.map(args => args[0]);
    expect(texts).toContain('128/484');
    expect(texts).toContain('4-day');
    expect(texts).toContain('current streak');
  });

  it('draws phase names when provided', async () => {
    await generateShareCard(fakeCardData());
    const texts = calls.fillTextArgs.map(args => args[0]);
    expect(texts.some(t => t.includes('Core Java') && t.includes('Concurrency'))).toBe(true);
  });

  it('omits phase names, date, and link when their toggle data is null', async () => {
    await generateShareCard(fakeCardData({ phaseNames: null, dateLabel: null, link: null }));
    const texts = calls.fillTextArgs.map(args => args[0]);
    expect(texts.some(t => t.includes('Core Java'))).toBe(false);
    expect(texts).not.toContain('2 August 2026');
    expect(texts).not.toContain('localhost:8931');
  });

  it('does not throw with an empty stats array', async () => {
    await expect(generateShareCard(fakeCardData({ stats: [] }))).resolves.toBeTruthy();
  });

  it('falls back to the light style for an unknown style name', async () => {
    await expect(generateShareCard(fakeCardData({ style: 'not-a-style' }))).resolves.toBeTruthy();
  });

  it('renders each of the three named card styles without throwing', async () => {
    for (const style of getCardStyleNames()) {
      await expect(generateShareCard(fakeCardData({ style }))).resolves.toBeTruthy();
    }
  });
});

describe('shareSiteUrl', () => {
  it('returns window.location.host', () => {
    expect(shareSiteUrl()).toBe(window.location.host);
  });

  it('strips a leading www.', () => {
    const original = window.location;
    delete window.location;
    window.location = { ...original, host: 'www.example.com' };
    expect(shareSiteUrl()).toBe('example.com');
    window.location = original;
  });
});

describe('generateBadgeCard', () => {
  it('returns a 1200x630 canvas and draws the headline', async () => {
    const canvas = await generateBadgeCard('roadmap', 'Java Backend Engineer');
    expect(canvas.width).toBe(1200);
    expect(canvas.height).toBe(630);
    const texts = calls.fillTextArgs.map(args => args[0]);
    expect(texts).toContain('Roadmap complete!');
    expect(texts).toContain('Java Backend Engineer');
  });
});
