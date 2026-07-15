import { BRAND_NAME } from './brand.js';
import { computeHeatmap } from '../../core/analytics/heatmapData.js';

// Canvas-generated social share card (issue #8, Part C). Entirely
// client-side — no server, no third-party image service. 1200x630 (the
// universal 1.91:1 og:image ratio, correct for Twitter/X, LinkedIn,
// WhatsApp preview).
const CARD_WIDTH = 1200;
const CARD_HEIGHT = 630;
const CONDENSED_WEEKS = 16;

function cssVar(name, fallback) {
  const value = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  return value || fallback;
}

// Plus Jakarta Sans is already loaded for the DOM (index.html's Google Fonts
// link), but a <canvas> only picks up a font once the Font Loading API
// confirms it's ready — `ctx.fillText()` silently falls back to the default
// UI font otherwise, with no error. Safe to call every time: `fonts.load()`
// resolves immediately from cache once the font's already loaded.
async function ensureFontLoaded() {
  try {
    await document.fonts.load('700 40px "Plus Jakarta Sans"');
    await document.fonts.load('600 24px "Plus Jakarta Sans"');
  } catch {
    // Font Loading API unsupported or the font failed to load — canvas text
    // still renders, just in a fallback font. Not worth failing the whole
    // card generation over.
  }
}

function roundedRect(ctx, { x, y, width, height, radius }) {
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.arcTo(x + width, y, x + width, y + height, radius);
  ctx.arcTo(x + width, y + height, x, y + height, radius);
  ctx.arcTo(x, y + height, x, y, radius);
  ctx.arcTo(x, y, x + width, y, radius);
  ctx.closePath();
}

function drawBackground(ctx) {
  const gradient = ctx.createLinearGradient(0, 0, CARD_WIDTH, CARD_HEIGHT);
  gradient.addColorStop(0, cssVar('--brand-700', '#0d5c56'));
  gradient.addColorStop(0.55, cssVar('--brand-600', '#0f766e'));
  gradient.addColorStop(1, cssVar('--brand-500', '#14b8a6'));
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, CARD_WIDTH, CARD_HEIGHT);
}

function drawWordmark(ctx) {
  ctx.fillStyle = '#ffffff';
  ctx.beginPath();
  ctx.moveTo(64, 76);
  ctx.lineTo(84, 108);
  ctx.lineTo(44, 108);
  ctx.closePath();
  ctx.fill();
  ctx.font = '700 30px "Plus Jakarta Sans", sans-serif';
  ctx.textBaseline = 'middle';
  ctx.fillText(BRAND_NAME, 100, 92);
}

function drawDate(ctx, now) {
  const label = new Date(now).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  ctx.font = '600 22px "Plus Jakarta Sans", sans-serif';
  ctx.fillStyle = 'rgba(255,255,255,0.85)';
  ctx.textAlign = 'right';
  ctx.fillText(label, CARD_WIDTH - 64, 92);
  ctx.textAlign = 'left';
}

function drawStats(ctx, analytics) {
  const { overview, streaks } = analytics;
  ctx.font = '700 48px "Plus Jakarta Sans", sans-serif';
  ctx.fillStyle = '#ffffff';
  ctx.fillText(`${overview.done} items complete · ${overview.pct}%`, 64, 200);

  ctx.font = '700 32px "Plus Jakarta Sans", sans-serif';
  ctx.fillStyle = '#fbbf7a';
  ctx.textAlign = 'right';
  ctx.fillText(`🔥 ${streaks.current}-day streak`, CARD_WIDTH - 64, 200);
  ctx.textAlign = 'left';
}

function drawProgressBar(ctx, pct) {
  const x = 64;
  const y = 236;
  const width = CARD_WIDTH - 128;
  const height = 22;
  ctx.fillStyle = 'rgba(255,255,255,0.25)';
  roundedRect(ctx, { x, y, width, height, radius: height / 2 });
  ctx.fill();
  const fillWidth = Math.max(height, (Math.max(0, Math.min(100, pct)) / 100) * width);
  ctx.fillStyle = '#ffffff';
  roundedRect(ctx, { x, y, width: fillWidth, height, radius: height / 2 });
  ctx.fill();
}

// Last 16 weeks x 7 days, condensed to ~48px tall total (per spec) —
// derived from the same heatmapData shape the full page's heatmap uses,
// just sliced to the most recent 112 cells instead of the full 364.
function drawCondensedHeatmap(ctx, activityLog, now) {
  const fullYear = computeHeatmap(activityLog, now);
  const cells = fullYear.slice(-CONDENSED_WEEKS * 7);
  const cellSize = 6;
  const gap = 2;
  const startX = 64;
  const startY = 292;
  const levelColors = ['rgba(255,255,255,0.15)', 'rgba(255,255,255,0.4)', 'rgba(255,255,255,0.6)', 'rgba(255,255,255,0.8)', '#ffffff'];

  cells.forEach((cell, i) => {
    const col = Math.floor(i / 7);
    const row = i % 7;
    ctx.fillStyle = levelColors[cell.level];
    roundedRect(ctx, { x: startX + col * (cellSize + gap), y: startY + row * (cellSize + gap), width: cellSize, height: cellSize, radius: 1 });
    ctx.fill();
  });
}

function drawPhaseTags(ctx, phaseBreakdown) {
  const tags = phaseBreakdown.slice(0, 4).map(p => p.phase).filter(Boolean).join('  ·  ');
  if (!tags) return;
  ctx.font = '600 20px "Plus Jakarta Sans", sans-serif';
  ctx.fillStyle = 'rgba(255,255,255,0.8)';
  ctx.fillText(tags, 64, CARD_HEIGHT - 56);
}

function drawAttribution(ctx) {
  ctx.font = '600 20px "Plus Jakarta Sans", sans-serif';
  ctx.fillStyle = 'rgba(255,255,255,0.85)';
  ctx.textAlign = 'right';
  ctx.fillText(`${BRAND_NAME.toLowerCase()}.dev`, CARD_WIDTH - 64, CARD_HEIGHT - 56);
  ctx.textAlign = 'left';
}

// generateShareCard(analytics, activityLog, now?) -> Promise<HTMLCanvasElement>
// `analytics` is computeAnalytics()'s output; `activityLog` is the same
// effective (backfilled) log the Progress page's own heatmap renders from.
export async function generateShareCard(analytics, activityLog, now = Date.now()) {
  await ensureFontLoaded();
  const canvas = document.createElement('canvas');
  canvas.width = CARD_WIDTH;
  canvas.height = CARD_HEIGHT;
  const ctx = canvas.getContext('2d');

  drawBackground(ctx);
  drawWordmark(ctx);
  drawDate(ctx, now);
  drawStats(ctx, analytics);
  drawProgressBar(ctx, analytics.overview.pct);
  drawCondensedHeatmap(ctx, activityLog, now);
  drawPhaseTags(ctx, analytics.phaseBreakdown);
  drawAttribution(ctx);

  return canvas;
}

function drawBadgeGlyph(ctx) {
  ctx.font = '700 96px "Plus Jakarta Sans", sans-serif';
  ctx.textAlign = 'center';
  ctx.fillStyle = '#ffffff';
  ctx.fillText('🏆', CARD_WIDTH / 2, 220);
  ctx.textAlign = 'left';
}

function drawBadgeHeadline(ctx, kind) {
  const headline = kind === 'roadmap' ? 'Roadmap complete!' : 'Phase complete!';
  ctx.font = '700 56px "Plus Jakarta Sans", sans-serif';
  ctx.fillStyle = '#ffffff';
  ctx.textAlign = 'center';
  ctx.fillText(headline, CARD_WIDTH / 2, 340);
  ctx.textAlign = 'left';
}

function drawBadgeLabel(ctx, label) {
  ctx.font = '600 32px "Plus Jakarta Sans", sans-serif';
  ctx.fillStyle = 'rgba(255,255,255,0.9)';
  ctx.textAlign = 'center';
  ctx.fillText(label, CARD_WIDTH / 2, 400);
  ctx.textAlign = 'left';
}

// generateBadgeCard(kind, label, now?) -> Promise<HTMLCanvasElement>
// `kind` is 'roadmap' or 'phase'; `label` is the roadmap title or phase
// title being celebrated. A distinct "finish line" variant of
// generateShareCard, reusing the same background/wordmark/attribution draw
// path (issue #181) rather than a parallel canvas implementation.
export async function generateBadgeCard(kind, label, now = Date.now()) {
  await ensureFontLoaded();
  const canvas = document.createElement('canvas');
  canvas.width = CARD_WIDTH;
  canvas.height = CARD_HEIGHT;
  const ctx = canvas.getContext('2d');

  drawBackground(ctx);
  drawWordmark(ctx);
  drawDate(ctx, now);
  drawBadgeGlyph(ctx);
  drawBadgeHeadline(ctx, kind);
  drawBadgeLabel(ctx, label);
  drawAttribution(ctx);

  return canvas;
}
