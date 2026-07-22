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

// Archivo is index.html's only loaded webfont as of the v2 "Modernist"
// redesign (issue #297) — `ensureFontLoaded()` used to load "Plus Jakarta
// Sans", a font this app stopped fetching from Google Fonts entirely back in
// that same phase, silently falling back to the canvas default font ever
// since (no error surfaced anywhere — the same "stale asset nobody noticed"
// bug class #307's chartWrapper.js fix and this file's own background
// rewrite below both hit). `document.fonts.load()` resolves immediately from
// cache once the font's already loaded, so this is safe to call every time.
async function ensureFontLoaded() {
  try {
    await document.fonts.load('800 40px "Archivo"');
    await document.fonts.load('600 24px "Archivo"');
  } catch {
    // Font Loading API unsupported or the font failed to load — canvas text
    // still renders, just in a fallback font. Not worth failing the whole
    // card generation over.
  }
}

function rect(ctx, { x, y, width, height }) {
  ctx.beginPath();
  ctx.rect(x, y, width, height);
  ctx.closePath();
}

// Rewritten in issue #301 (Phase 5) — this card had kept its own Alpenglow
// gold->rose gradient background (`--color-brand-gold-ink`/
// `--color-brand-rose-ink`) long after both tokens were removed in Phase 1
// (#297)'s token migration; `cssVar()`'s fallback meant it had silently kept
// rendering the old hardcoded gold/rose hex literals ever since, unnoticed
// because nothing ever throws when a custom property resolves to an empty
// string. Per design-system.md's explicit "no gradients anywhere" rule and
// issue #301's own scope ("shareCard.js/printRoadmap.js: same tokens on
// white... accent only for the triangle and priority tags"), the card is now
// a flat light-theme surface (`--color-bg`, literal — a canvas has no CSS
// cascade to inherit dark-theme values from, so this always renders the same
// regardless of the user's active site theme, matching `printRoadmap.js`'s
// own "always assumed-light-background" precedent) with dark ink text and
// the accent reserved for the triangle glyph and the streak figure — never a
// full-bleed color fill.
function drawBackground(ctx) {
  ctx.fillStyle = cssVar('--color-bg', '#F3F2F2');
  ctx.fillRect(0, 0, CARD_WIDTH, CARD_HEIGHT);
  ctx.strokeStyle = cssVar('--color-divider', 'rgba(32,30,29,0.4)');
  ctx.lineWidth = 2;
  ctx.strokeRect(1, 1, CARD_WIDTH - 2, CARD_HEIGHT - 2);
}

function drawWordmark(ctx) {
  ctx.fillStyle = cssVar('--color-accent', '#EC3013');
  ctx.beginPath();
  ctx.moveTo(64, 76);
  ctx.lineTo(84, 108);
  ctx.lineTo(44, 108);
  ctx.closePath();
  ctx.fill();
  ctx.font = '800 30px "Archivo", sans-serif';
  ctx.fillStyle = cssVar('--color-text', '#201E1D');
  ctx.textBaseline = 'middle';
  ctx.fillText(BRAND_NAME.toUpperCase(), 100, 92);
}

function drawDate(ctx, now) {
  const label = new Date(now).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  ctx.font = '600 22px "Archivo", sans-serif';
  ctx.fillStyle = cssVar('--color-text-muted', 'rgba(32,30,29,0.6)');
  ctx.textAlign = 'right';
  ctx.fillText(label, CARD_WIDTH - 64, 92);
  ctx.textAlign = 'left';
}

function drawHeaderRule(ctx) {
  ctx.strokeStyle = cssVar('--color-divider', 'rgba(32,30,29,0.4)');
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(64, 132);
  ctx.lineTo(CARD_WIDTH - 64, 132);
  ctx.stroke();
}

function drawStats(ctx, analytics) {
  const { overview, streaks } = analytics;
  ctx.font = '800 48px "Archivo", sans-serif';
  ctx.fillStyle = cssVar('--color-text', '#201E1D');
  ctx.fillText(`${overview.done} items complete · ${overview.pct}%`, 64, 200);

  // Streak figure is the one other accent-colored element besides the
  // triangle — paragraph-size accent text must read --color-accent-700 for
  // contrast (design-system.md §2), not the raw --color-accent this card's
  // triangle/heatmap use for icon/large-numeral-scale content.
  ctx.font = '700 32px "Archivo", sans-serif';
  ctx.fillStyle = cssVar('--color-accent-700', '#AE1800');
  ctx.textAlign = 'right';
  ctx.fillText(`🔥 ${streaks.current}-day streak`, CARD_WIDTH - 64, 200);
  ctx.textAlign = 'left';
}

function drawProgressBar(ctx, pct) {
  const x = 64;
  const y = 236;
  const width = CARD_WIDTH - 128;
  const height = 8; // design-system.md §5 — "flat bars (6-8px)", not a pill
  ctx.fillStyle = cssVar('--color-neutral-200', '#EAE7E7');
  rect(ctx, { x, y, width, height });
  ctx.fill();
  const fillWidth = Math.max(0, (Math.max(0, Math.min(100, pct)) / 100) * width);
  ctx.fillStyle = cssVar('--color-accent', '#EC3013');
  rect(ctx, { x, y, width: fillWidth, height });
  ctx.fill();
}

// Last 16 weeks x 7 days, condensed to ~48px tall total (per spec) —
// derived from the same heatmapData shape the full page's heatmap uses,
// just sliced to the most recent 112 cells instead of the full 364. Hard-
// edged squares (radius 0) using the app's real 5-step heat ramp
// (design-system.md §5), not an opacity scale over white — this card has no
// dark background left to scale opacity against.
function drawCondensedHeatmap(ctx, activityLog, now) {
  const fullYear = computeHeatmap(activityLog, now);
  const cells = fullYear.slice(-CONDENSED_WEEKS * 7);
  const cellSize = 6;
  const gap = 2;
  const startX = 64;
  const startY = 292;
  const levelColors = [
    cssVar('--heat-0', '#EAE7E7'),
    cssVar('--heat-1', '#FFC4B8'),
    cssVar('--heat-2', '#FF9783'),
    cssVar('--heat-3', '#FF563C'),
    cssVar('--heat-4', '#DD2B0F')
  ];

  cells.forEach((cell, i) => {
    const col = Math.floor(i / 7);
    const row = i % 7;
    ctx.fillStyle = levelColors[cell.level];
    rect(ctx, { x: startX + col * (cellSize + gap), y: startY + row * (cellSize + gap), width: cellSize, height: cellSize });
    ctx.fill();
  });
}

function drawPhaseTags(ctx, phaseBreakdown) {
  const tags = phaseBreakdown.slice(0, 4).map(p => p.phase).filter(Boolean).join('  ·  ');
  if (!tags) return;
  ctx.font = '600 20px "Archivo", sans-serif';
  ctx.fillStyle = cssVar('--color-text-muted', 'rgba(32,30,29,0.6)');
  ctx.fillText(tags, 64, CARD_HEIGHT - 56);
}

function drawAttribution(ctx) {
  ctx.font = '600 20px "Archivo", sans-serif';
  ctx.fillStyle = cssVar('--color-text-muted', 'rgba(32,30,29,0.6)');
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
  drawHeaderRule(ctx);
  drawStats(ctx, analytics);
  drawProgressBar(ctx, analytics.overview.pct);
  drawCondensedHeatmap(ctx, activityLog, now);
  drawPhaseTags(ctx, analytics.phaseBreakdown);
  drawAttribution(ctx);

  return canvas;
}

function drawBadgeGlyph(ctx) {
  ctx.font = '700 96px "Archivo", sans-serif';
  ctx.textAlign = 'center';
  ctx.fillStyle = cssVar('--color-accent', '#EC3013');
  ctx.fillText('🏆', CARD_WIDTH / 2, 220);
  ctx.textAlign = 'left';
}

function drawBadgeHeadline(ctx, kind) {
  const headline = kind === 'roadmap' ? 'Roadmap complete!' : 'Phase complete!';
  ctx.font = '800 56px "Archivo", sans-serif';
  ctx.fillStyle = cssVar('--color-text', '#201E1D');
  ctx.textAlign = 'center';
  ctx.fillText(headline, CARD_WIDTH / 2, 340);
  ctx.textAlign = 'left';
}

function drawBadgeLabel(ctx, label) {
  ctx.font = '600 32px "Archivo", sans-serif';
  ctx.fillStyle = cssVar('--color-text-muted', 'rgba(32,30,29,0.6)');
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
  drawHeaderRule(ctx);
  drawBadgeGlyph(ctx);
  drawBadgeHeadline(ctx, kind);
  drawBadgeLabel(ctx, label);
  drawAttribution(ctx);

  return canvas;
}
