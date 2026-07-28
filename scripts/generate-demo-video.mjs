import { chromium } from '@playwright/test';
import { spawn } from 'node:child_process';
import { mkdtempSync, mkdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// Dev-only tool (issue #397) — generates a silent, fully-automated
// feature-walkthrough .mp4 for LinkedIn/Instagram/GitHub Releases/README,
// mirroring generate-brand-assets.mjs's pattern: Playwright-driven, run on
// demand, not part of `npm test`/CI. No manual recording or narration —
// a synthetic cursor, an accent-colored highlight box, and a caption text
// box are all injected DOM overlays driven by page.evaluate(), so capture
// is deterministic and works headless.
//
// Requires `ffmpeg` on PATH (not an npm dependency — shells out to the
// system binary). Assumes `npm run dev` is NOT already running on port 4173;
// this script starts its own dev-server.mjs instance and tears it down when
// done, so it won't collide with a server you already have up elsewhere.
//
// Usage: node scripts/generate-demo-video.mjs [--theme=light|dark] [--out=dist/demo-video.mp4]
//
//   node scripts/generate-demo-video.mjs
//   node scripts/generate-demo-video.mjs --theme=dark --out=dist/demo-video-dark.mp4

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');

const PORT = 4173;
const BASE_URL = `http://localhost:${PORT}`;
const WIDTH = 1920;
const HEIGHT = 1080;
const FPS = 30;

const args = Object.fromEntries(
  process.argv.slice(2).map((arg) => {
    const [key, value] = arg.replace(/^--/, '').split('=');
    return [key, value ?? true];
  })
);
const theme = args.theme === 'dark' ? 'dark' : 'light';
const outPath = path.resolve(root, args.out || 'dist/demo-video.mp4');

// Each stop: selector to highlight, caption copy, and how long (ms) to hold
// the caption once the cursor/highlight animation settles. `before` runs
// arbitrary page interaction (navigation, clicks) needed to reach that stop.
const STOPS = [
  {
    name: 'landing',
    caption: { title: 'Engineer your next move.', body: 'Track your roadmap toward any goal.' },
    duration: 2200,
    async before(page) {
      await page.goto(`${BASE_URL}/#/`);
      await page.waitForSelector('a.btn.btn-primary.btn-lg');
    },
    selector: 'a.btn.btn-primary.btn-lg',
  },
  {
    name: 'guest-sign-in',
    caption: { title: 'Try it instantly', body: 'No account required — start as a guest.' },
    duration: 2000,
    async before(page) {
      await page.goto(`${BASE_URL}/#/signin`);
      await page.waitForSelector('text=Continue as guest');
    },
    selector: 'text=Continue as guest',
  },
  {
    name: 'template-picker',
    caption: { title: 'Pick a starter template', body: 'Java Backend, Frontend, Data Science, or start blank.' },
    duration: 2400,
    async before(page) {
      await page.click('text=Continue as guest');
      await page.waitForSelector('.template-card-pick:has-text("Java Backend Engineer")');
    },
    selector: '.template-card-pick:has-text("Java Backend Engineer")',
  },
  {
    name: 'dashboard-checklist',
    caption: { title: 'Track every topic', body: 'Check off items as you learn them.' },
    duration: 2400,
    async before(page) {
      await page.click('.template-card-pick:has-text("Java Backend Engineer")');
      await page.waitForSelector('.check-item');
    },
    selector: '.check-item >> nth=0',
  },
  {
    name: 'daily-todos',
    caption: { title: "Today's Todos", body: 'Pull topics into a focused daily plan.' },
    duration: 2200,
    async before(page) {
      await page.goto(`${BASE_URL}/#/onboarding`);
      await page.waitForSelector('.daily-todo-panel');
    },
    selector: '.daily-todo-panel',
  },
  {
    name: 'progress-heatmap',
    caption: { title: 'See your progress', body: 'Streaks, velocity, and an activity heatmap.' },
    duration: 2400,
    async before(page) {
      await page.goto(`${BASE_URL}/#/progress`);
      await page.waitForSelector('.heatmap');
    },
    selector: '.heatmap',
  },
  {
    name: 'settings',
    caption: { title: 'Make it yours', body: 'Theme, preferences, and account settings.' },
    duration: 2000,
    async before(page) {
      await page.goto(`${BASE_URL}/#/settings`);
      await page.waitForSelector('.settings-page');
    },
    selector: '.settings-page',
  },
];

function startDevServer() {
  return new Promise((resolve, reject) => {
    const server = spawn(process.execPath, ['scripts/dev-server.mjs'], {
      cwd: root,
      env: { ...process.env, PORT: String(PORT) },
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    const onData = (data) => {
      if (data.toString().includes(String(PORT))) {
        server.stdout.off('data', onData);
        resolve(server);
      }
    };
    server.stdout.on('data', onData);
    server.once('error', reject);
    // Fallback in case the server doesn't print the expected line.
    setTimeout(() => resolve(server), 2000);
  });
}

// Injected once per page load. Builds a fixed overlay layer (cursor dot,
// highlight box, caption card) positioned via inline styles set from
// Node-side bounding-box math — no real OS mouse movement, so this stays
// deterministic under Playwright's headless Chromium.
async function installOverlay(page) {
  await page.evaluate(() => {
    const layer = document.createElement('div');
    layer.id = '__demo_overlay';
    layer.style.cssText = 'position:fixed;inset:0;z-index:2147483647;pointer-events:none;';

    const cursor = document.createElement('div');
    cursor.id = '__demo_cursor';
    cursor.style.cssText = `
      position:absolute;width:18px;height:18px;border-radius:50%;
      background:#EC3013;box-shadow:0 0 0 6px rgba(236,48,19,0.25);
      transition:left 500ms ease-out, top 500ms ease-out;
      left:-40px;top:-40px;
    `;

    const highlight = document.createElement('div');
    highlight.id = '__demo_highlight';
    highlight.style.cssText = `
      position:absolute;border:3px solid #EC3013;box-sizing:border-box;
      transition:left 500ms ease-out, top 500ms ease-out, width 500ms ease-out, height 500ms ease-out, opacity 200ms;
      opacity:0;
    `;

    const caption = document.createElement('div');
    caption.id = '__demo_caption';
    caption.style.cssText = `
      position:absolute;left:48px;bottom:64px;max-width:560px;
      background:#201E1D;color:#F1EFED;padding:20px 24px;
      font-family:Archivo,-apple-system,BlinkMacSystemFont,sans-serif;
      opacity:0;transition:opacity 300ms;
    `;
    const title = document.createElement('div');
    title.id = '__demo_caption_title';
    title.style.cssText = 'font-weight:800;font-size:22px;margin-bottom:6px;';
    const body = document.createElement('div');
    body.id = '__demo_caption_body';
    body.style.cssText = 'font-weight:400;font-size:15px;opacity:0.85;';
    caption.append(title, body);

    layer.append(cursor, highlight, caption);
    document.body.appendChild(layer);
  });
}

async function animateStopOverlay(page, stop) {
  const target = page.locator(stop.selector).first();
  await target.scrollIntoViewIfNeeded();
  const box = await target.boundingBox();
  if (!box) throw new Error(`Could not locate element for stop "${stop.name}" (selector: ${stop.selector})`);

  await page.evaluate(
    ({ box, caption }) => {
      const cursor = document.getElementById('__demo_cursor');
      const highlight = document.getElementById('__demo_highlight');
      const captionEl = document.getElementById('__demo_caption');
      const titleEl = document.getElementById('__demo_caption_title');
      const bodyEl = document.getElementById('__demo_caption_body');

      cursor.style.left = `${box.x + box.width / 2 - 9}px`;
      cursor.style.top = `${box.y + box.height / 2 - 9}px`;

      highlight.style.left = `${box.x - 8}px`;
      highlight.style.top = `${box.y - 8}px`;
      highlight.style.width = `${box.width + 16}px`;
      highlight.style.height = `${box.height + 16}px`;
      highlight.style.opacity = '1';

      titleEl.textContent = caption.title;
      bodyEl.textContent = caption.body;
      captionEl.style.opacity = '1';
    },
    { box, caption: stop.caption }
  );
  // Let the CSS transitions (cursor glide, highlight box, caption fade) settle.
  await page.waitForTimeout(650);
}

async function captureStopFrames(page, framesDir, stopIndex, durationMs) {
  const frameIntervalMs = 1000 / FPS;
  const frameCount = Math.round(durationMs / frameIntervalMs);
  for (let i = 0; i < frameCount; i++) {
    const frameNumber = stopIndex * 10000 + i; // stable ordering across stops
    const filePath = path.join(framesDir, `frame-${String(frameNumber).padStart(7, '0')}.png`);
    await page.screenshot({ path: filePath });
    await page.waitForTimeout(frameIntervalMs);
  }
}

function runFfmpeg(framesDir, out) {
  return new Promise((resolve, reject) => {
    mkdirSync(path.dirname(out), { recursive: true });
    const ffmpeg = spawn('ffmpeg', [
      '-y',
      '-framerate', String(FPS),
      '-pattern_type', 'glob',
      '-i', path.join(framesDir, 'frame-*.png'),
      '-an', // no audio track — silent by design
      '-c:v', 'libx264',
      '-pix_fmt', 'yuv420p',
      out,
    ]);
    ffmpeg.stderr.on('data', () => {}); // ffmpeg logs progress to stderr; suppress noise
    ffmpeg.on('error', (err) => reject(new Error(`ffmpeg not found on PATH — install it first. (${err.message})`)));
    ffmpeg.on('close', (code) => {
      if (code === 0) resolve();
      else reject(new Error(`ffmpeg exited with code ${code}`));
    });
  });
}

async function main() {
  const framesDir = mkdtempSync(path.join(tmpdir(), 'ascent-demo-frames-'));
  console.log(`Capturing frames to ${framesDir}`);

  const server = await startDevServer();

  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: WIDTH, height: HEIGHT } });

  // Match themeBootstrap.js's key so the demo opens in the requested theme.
  await page.addInitScript((t) => localStorage.setItem('ascent-theme', t), theme);

  try {
    for (let i = 0; i < STOPS.length; i++) {
      const stop = STOPS[i];
      console.log(`Stop ${i + 1}/${STOPS.length}: ${stop.name}`);
      await stop.before(page);
      await installOverlay(page);
      await animateStopOverlay(page, stop);
      await captureStopFrames(page, framesDir, i, stop.duration);
    }

    console.log('Assembling frames into video via ffmpeg...');
    await runFfmpeg(framesDir, outPath);
    console.log(`Wrote ${path.relative(root, outPath)}`);
  } finally {
    await browser.close();
    server.kill();
    rmSync(framesDir, { recursive: true, force: true });
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
