import { BRAND_NAME } from './brand.js';

// Canvas-generated social share card generator (issue #501 — rebuild of the
// original issue #8 Part C card). Entirely client-side — no server, no
// third-party image service. 1200x630 (the universal 1.91:1 og:image ratio,
// correct for Twitter/X, LinkedIn, WhatsApp preview).
const CARD_WIDTH = 1200;
const CARD_HEIGHT = 630;
const CONDENSED_WEEKS = 16;
const PAD = 64;

// Three **explicit, literal** palettes — deliberately not `cssVar()` reads
// off the live DOM. A canvas has no CSS cascade, so if this card read theme
// custom properties it would silently follow whatever theme the user
// happens to have active on the page instead of the style the user actually
// picked in the generator's own "Card style" control (issue #501's own
// scope line: "a canvas has no CSS cascade, so the card must not silently
// follow the site theme"). Values are lifted straight from app.css's own
// light/dark `--color-*` tokens (and the dark theme's `--color-ink-on-accent`
// for "green"'s text-on-solid-accent-fill role) so the three styles still
// read as genuinely "this app's palette," just pinned rather than live.
const STYLES = {
  light: {
    bg: '#F3F2F2', text: '#201E1D', muted: 'rgba(32,30,29,0.64)',
    divider: 'rgba(32,30,29,0.4)', accent: '#0CB656', accentText: '#034E24',
    heat: ['#EAE9E9', '#D4F7E3', '#ABEDC8', '#70DB9F', '#0CB656']
  },
  dark: {
    bg: '#141312', text: '#F1EFED', muted: 'rgba(241,239,237,0.6)',
    divider: 'rgba(241,239,237,0.32)', accent: '#23F67B', accentText: '#23F67B',
    heat: ['#252221', '#1D3327', '#1E4A32', '#1F6B3E', '#23F67B']
  },
  // "Full-accent" — the whole card is a solid accent fill, dark ink text
  // (reusing --color-ink-on-accent's dark-theme value, #141312, the same
  // "text hosted directly on solid accent fill" pairing .btn-primary already
  // uses app-wide) rather than white-on-accent, which this app's own accent
  // green can't host at readable contrast (see design-system.md §2).
  green: {
    bg: '#0CB656', text: '#141312', muted: 'rgba(20,19,18,0.65)',
    divider: 'rgba(20,19,18,0.25)', accent: '#141312', accentText: '#141312',
    heat: ['rgba(20,19,18,0.12)', 'rgba(20,19,18,0.3)', 'rgba(20,19,18,0.5)', 'rgba(20,19,18,0.72)', '#141312']
  }
};

export function getCardStyleNames() {
  return Object.keys(STYLES);
}

// window.location.host, stripped of a leading "www." — issue #501's own
// explicit requirement ("URL from window.location.host, never a literal.
// Strip www."). Read live, not hardcoded, same reasoning
// printRoadmap.js's printSiteUrl() documents for the identical
// dev/PR-preview/production drift problem — neither existing precedent
// (printSiteUrl(), shareRoadmapModal.js's origin+pathname link builder)
// strips "www." themselves, so this is new.
export function shareSiteUrl() {
  return window.location.host.replace(/^www\./, '');
}

// Archivo is the app's own body/heading font (--font-body/--font-heading) —
// see design-system.md §3's note that a direct product-owner decision
// (issue #435) kept the base tokens on Archivo despite the v3 spec's
// Sora/Outfit rollout, so this card matches every other Archivo-rendered
// surface in the app. `document.fonts.load()` resolves immediately from
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

function roundedRect(ctx, { x, y, width, height, radius }) {
  ctx.beginPath();
  if (typeof ctx.roundRect === 'function') {
    ctx.roundRect(x, y, width, height, radius);
  } else {
    ctx.rect(x, y, width, height);
  }
  ctx.closePath();
}

function drawBackground(ctx, palette) {
  ctx.fillStyle = palette.bg;
  ctx.fillRect(0, 0, CARD_WIDTH, CARD_HEIGHT);
  ctx.strokeStyle = palette.divider;
  ctx.lineWidth = 2;
  ctx.strokeRect(1, 1, CARD_WIDTH - 2, CARD_HEIGHT - 2);
}

function drawWordmark(ctx, palette) {
  ctx.fillStyle = palette.accent;
  ctx.beginPath();
  ctx.moveTo(PAD, 76);
  ctx.lineTo(PAD + 20, 108);
  ctx.lineTo(PAD - 20, 108);
  ctx.closePath();
  ctx.fill();
  ctx.font = '800 30px "Archivo", sans-serif';
  ctx.fillStyle = palette.text;
  ctx.textBaseline = 'middle';
  ctx.fillText(BRAND_NAME.toUpperCase(), PAD + 36, 92);
}

function drawDate(ctx, palette, dateLabel) {
  if (!dateLabel) return;
  ctx.font = '600 22px "Archivo", sans-serif';
  ctx.fillStyle = palette.muted;
  ctx.textAlign = 'right';
  ctx.fillText(dateLabel, CARD_WIDTH - PAD, 92);
  ctx.textAlign = 'left';
}

function drawHeaderRule(ctx, palette) {
  ctx.strokeStyle = palette.divider;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(PAD, 132);
  ctx.lineTo(CARD_WIDTH - PAD, 132);
  ctx.stroke();
}

function drawHeadline(ctx, palette, { headlinePct, headlineLabel }) {
  ctx.font = '800 96px "Archivo", sans-serif';
  ctx.fillStyle = palette.text;
  ctx.textBaseline = 'alphabetic';
  ctx.fillText(`${headlinePct}%`, PAD, 300);

  if (headlineLabel) {
    ctx.font = '600 26px "Archivo", sans-serif';
    ctx.fillStyle = palette.muted;
    ctx.fillText(headlineLabel, PAD, 340);
  }
}

// Up to 3 stacked, right-aligned stat blocks (value + label) — whichever
// `stats` the caller (shareModal.js) decided belong on the card for the
// current scope/toggle combination. The "Streak" toggle is applied by the
// caller simply omitting a streak entry from `stats`, not by this function
// knowing anything about what a "streak" stat is — keeps this renderer a
// dumb layout function, same separation this app's analytics/UI split
// already follows everywhere else (computeAnalytics() vs. progress.js).
function drawStats(ctx, palette, stats) {
  let y = 170;
  stats.slice(0, 3).forEach(stat => {
    ctx.font = '700 30px "Archivo", sans-serif';
    ctx.fillStyle = palette.text;
    ctx.textAlign = 'right';
    ctx.fillText(stat.value, CARD_WIDTH - PAD, y);
    ctx.font = '600 18px "Archivo", sans-serif';
    ctx.fillStyle = palette.muted;
    ctx.fillText(stat.label, CARD_WIDTH - PAD, y + 24);
    ctx.textAlign = 'left';
    y += 62;
  });
}

// Last 16 weeks x 7 days, condensed to a small grid — derived from the same
// heatmapData shape the full Progress page's own heatmap renders from, just
// sliced to the most recent 112 cells instead of the full year.
function drawActivitySquares(ctx, palette, activityCells) {
  if (!activityCells) return;
  const cells = activityCells.slice(-CONDENSED_WEEKS * 7);
  const cellSize = 6;
  const cellRadius = 1.5;
  const gap = 2;
  const startX = PAD;
  const startY = 292;

  cells.forEach((cell, i) => {
    const col = Math.floor(i / 7);
    const row = i % 7;
    ctx.fillStyle = palette.heat[cell.level];
    roundedRect(ctx, { x: startX + col * (cellSize + gap), y: startY + row * (cellSize + gap), width: cellSize, height: cellSize, radius: cellRadius });
    ctx.fill();
  });
}

function drawPhaseNames(ctx, palette, phaseNames) {
  if (!phaseNames?.length) return;
  const tags = phaseNames.slice(0, 4).join('  ·  ');
  ctx.font = '600 20px "Archivo", sans-serif';
  ctx.fillStyle = palette.muted;
  ctx.fillText(tags, PAD, CARD_HEIGHT - 56);
}

function drawLink(ctx, palette, link) {
  if (!link) return;
  ctx.font = '700 20px "Archivo", sans-serif';
  ctx.fillStyle = palette.accentText;
  ctx.textAlign = 'right';
  ctx.fillText(link, CARD_WIDTH - PAD, CARD_HEIGHT - 56);
  ctx.textAlign = 'left';
}

// generateShareCard(cardData) -> Promise<HTMLCanvasElement>
//
// `cardData` is a plain, pre-computed shape shareModal.js builds per scope
// (this roadmap / all roadmaps / today's todos / a single phase) — this
// function is a dumb renderer with no knowledge of roadmaps/todos/phases at
// all, matching this codebase's usual pure-computation/renderer split:
//   {
//     style: 'light' | 'dark' | 'green',
//     headlinePct: number,           // 0-100
//     headlineLabel: string | null,  // e.g. "of my Java Backend Engineer roadmap"
//     stats: Array<{ value, label }>, // up to 3, already filtered for toggles
//     activityCells: heatmapData cell array | null,  // null = toggle off
//     phaseNames: string[] | null,                    // null = toggle off
//     dateLabel: string | null,                        // null = toggle off
//     link: string | null                               // null = toggle off
//   }
export async function generateShareCard(cardData) {
  const palette = STYLES[cardData.style] || STYLES.light;
  await ensureFontLoaded();
  const canvas = document.createElement('canvas');
  canvas.width = CARD_WIDTH;
  canvas.height = CARD_HEIGHT;
  const ctx = canvas.getContext('2d');

  drawBackground(ctx, palette);
  drawWordmark(ctx, palette);
  drawDate(ctx, palette, cardData.dateLabel);
  drawHeaderRule(ctx, palette);
  drawHeadline(ctx, palette, cardData);
  drawStats(ctx, palette, cardData.stats || []);
  drawActivitySquares(ctx, palette, cardData.activityCells);
  drawPhaseNames(ctx, palette, cardData.phaseNames);
  drawLink(ctx, palette, cardData.link);

  return canvas;
}

function drawBadgeGlyph(ctx) {
  ctx.font = '700 96px "Archivo", sans-serif';
  ctx.textAlign = 'center';
  ctx.fillStyle = STYLES.light.accent;
  ctx.fillText('🏆', CARD_WIDTH / 2, 220);
  ctx.textAlign = 'left';
}

function drawBadgeHeadline(ctx, kind) {
  const headline = kind === 'roadmap' ? 'Roadmap complete!' : 'Phase complete!';
  ctx.font = '800 56px "Archivo", sans-serif';
  ctx.fillStyle = STYLES.light.text;
  ctx.textAlign = 'center';
  ctx.fillText(headline, CARD_WIDTH / 2, 340);
  ctx.textAlign = 'left';
}

function drawBadgeLabel(ctx, label) {
  ctx.font = '600 32px "Archivo", sans-serif';
  ctx.fillStyle = STYLES.light.muted;
  ctx.textAlign = 'center';
  ctx.fillText(label, CARD_WIDTH / 2, 400);
  ctx.textAlign = 'left';
}

// generateBadgeCard(kind, label, now?) -> Promise<HTMLCanvasElement>
// `kind` is 'roadmap' or 'phase'; `label` is the roadmap title or phase
// title being celebrated. A distinct "finish line" variant used by the
// phase/roadmap-completion celebration flow (issue #181, dashboard.js) —
// out of scope for issue #501's generator rebuild, so this keeps the
// original fixed light-style rendering rather than taking a style/toggle
// param. Reuses the same background/wordmark/header-rule draw path as
// generateShareCard() above.
export async function generateBadgeCard(kind, label, now = Date.now()) {
  const palette = STYLES.light;
  await ensureFontLoaded();
  const canvas = document.createElement('canvas');
  canvas.width = CARD_WIDTH;
  canvas.height = CARD_HEIGHT;
  const ctx = canvas.getContext('2d');

  drawBackground(ctx, palette);
  drawWordmark(ctx, palette);
  drawDate(ctx, palette, new Date(now).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }));
  drawHeaderRule(ctx, palette);
  drawBadgeGlyph(ctx);
  drawBadgeHeadline(ctx, kind);
  drawBadgeLabel(ctx, label);
  drawLink(ctx, palette, shareSiteUrl());

  return canvas;
}
