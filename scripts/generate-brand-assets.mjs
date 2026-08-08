import { chromium } from '@playwright/test';
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

// Dev-only tool — rasterizes public/favicon.svg into the PNG sizes referenced
// by index.html and public/manifest.json, and builds the Open Graph preview
// image, so every generated asset stays pixel-consistent with the actual
// brand mark instead of being redrawn by hand. Re-run after editing favicon.svg.
//
// IMPORTANT (issue #346): if you re-run this script for a brand color/mark change,
// bump the `?v=N` cache-busting query string on every icon URL in index.html's
// <link rel="icon"|"alternate icon"|"apple-touch-icon"> tags AND public/manifest.json's
// icons[].src values, in the same PR. Mobile browsers/OSes cache a home-screen icon at
// install time and never re-fetch it just because the file at the same URL changed —
// without a new URL, this bug recurs on every future rebrand.

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');
const publicDir = path.join(root, 'public');
const faviconSvg = readFileSync(path.join(publicDir, 'favicon.svg'), 'utf8');

const ICONS = [
  { file: 'favicon-32.png', size: 32 },
  { file: 'apple-touch-icon.png', size: 180 },
  { file: 'icon-192.png', size: 192 },
  { file: 'icon-512.png', size: 512 }
];

function sizedSvg(size) {
  return faviconSvg.replace('<svg xmlns', `<svg width="${size}" height="${size}" xmlns`);
}

async function main() {
  const browser = await chromium.launch();
  const page = await browser.newPage();

  for (const { file, size } of ICONS) {
    await page.setViewportSize({ width: size, height: size });
    await page.setContent(`<!doctype html><html><head><style>html,body{margin:0;padding:0}</style></head><body>${sizedSvg(size)}</body></html>`);
    const buffer = await page.screenshot({ omitBackground: true });
    writeFileSync(path.join(publicDir, file), buffer);
    console.log(`wrote public/${file}`);
  }

  // Rebuilt in issue #542 (pre-publish audit) to match the current v3
  // "portfolio-synced" glass/green identity (design-system.md) — the red
  // "poster statement" fill (#EC3013, issue #301 Phase 5) was a leftover
  // from the retired v2 "Modernist" red-accent system and no longer matches
  // any surface in the live app. Colors are pulled from the actual computed
  // dark-theme tokens (`--color-bg`/`--color-accent`/`--color-ink-on-accent`
  // in `app.css`), not eyeballed, so this stays in sync if those are retuned.
  await page.setViewportSize({ width: 1200, height: 630 });
  await page.setContent(`<!doctype html><html><head>
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link href="https://fonts.googleapis.com/css2?family=Archivo:wght@400;600;800&display=swap" rel="stylesheet">
    <style>
    html, body { margin: 0; padding: 0; }
    body {
      width: 1200px; height: 630px; background: #141312;
      display: flex; align-items: center; justify-content: center; gap: 32px;
      font-family: 'Archivo', -apple-system, BlinkMacSystemFont, sans-serif;
    }
    .name { color: #F3F2F2; font-weight: 800; font-size: 72px; letter-spacing: 0.02em; text-transform: uppercase; }
    .tagline { color: #23F67B; opacity: 0.9; font-weight: 600; font-size: 26px; margin-top: 6px; }
  </style></head><body>
    ${sizedSvg(120)}
    <div>
      <div class="name">Ascent</div>
      <div class="tagline">Engineer your next move.</div>
    </div>
  </body></html>`);
  await page.waitForTimeout(200); // let the webfont finish loading before the screenshot
  const ogBuffer = await page.screenshot();
  writeFileSync(path.join(publicDir, 'og-image.png'), ogBuffer);
  console.log('wrote public/og-image.png');

  await browser.close();
}

main();
