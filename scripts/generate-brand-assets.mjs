import { chromium } from '@playwright/test';
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

// Dev-only tool — rasterizes public/favicon.svg into the PNG sizes referenced
// by index.html and public/manifest.json, and builds the Open Graph preview
// image, so every generated asset stays pixel-consistent with the actual
// brand mark instead of being redrawn by hand. Re-run after editing favicon.svg.

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

  // Rebuilt in issue #301 (Phase 5) as a red "poster statement" — the one
  // pattern design-system.md §2 permits a full-bleed solid accent fill,
  // matching landing.js's closing CTA banner (--color-accent bg,
  // --color-ink-on-accent text). Archivo 800 uppercase wordmark, no gradient,
  // no dark-navy background — those were the pre-v2 Alpenglow/ZeBeyond look.
  await page.setViewportSize({ width: 1200, height: 630 });
  await page.setContent(`<!doctype html><html><head>
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link href="https://fonts.googleapis.com/css2?family=Archivo:wght@400;600;800&display=swap" rel="stylesheet">
    <style>
    html, body { margin: 0; padding: 0; }
    body {
      width: 1200px; height: 630px; background: #EC3013;
      display: flex; align-items: center; justify-content: center; gap: 32px;
      font-family: 'Archivo', -apple-system, BlinkMacSystemFont, sans-serif;
    }
    .name { color: #F3F2F2; font-weight: 800; font-size: 72px; letter-spacing: 0.02em; text-transform: uppercase; }
    .tagline { color: #F3F2F2; opacity: 0.85; font-weight: 600; font-size: 26px; margin-top: 6px; }
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
