import { chromium } from '@playwright/test';
import { spawn } from 'node:child_process';
import { mkdtempSync, mkdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// Dev-only tool (issue #397) — generates a fully-automated feature-walkthrough .mp4 for
// LinkedIn/Instagram/GitHub Releases/README, mirroring generate-brand-assets.mjs's pattern:
// Playwright-driven, run on demand, not part of `npm test`/CI. No manual screen recording
// or narration — a synthetic cursor, accent-colored spotlight brackets, and caption cards
// are all injected DOM overlays driven by page.evaluate(), so capture is deterministic and
// works headless.
//
// Structure: a branded intro slide (real triangle-in-square mark + wordmark, not a
// placeholder), ~16 real feature stops across the app (each a real navigation/click/
// interaction — checking a topic, expanding a phase, filtering by priority/resources,
// opening the edit panel, opening global search, opening the share modal, toggling theme —
// not a static screenshot), and a branded outro/CTA slide. Every animation (cursor glide,
// spotlight grow, caption fade, resulting UI motion like a phase FLIP-expand or panel
// slide-in) is captured DURING its CSS transition, not after — frames are taken on a fixed
// interval starting the instant a transition begins, so the output video actually shows
// motion instead of a sequence of static end-states. Runs ~60-90s total.
//
// Audio: a soft ambient chord-progression pad, mixed in under the video by default —
// synthesized entirely from sine-wave math via ffmpeg's own audio filters at render time
// (see CHORD_PROGRESSION_HZ below), never a downloaded or embedded audio file, so there is
// no licensing question to resolve. Pass --no-music for the original fully-silent output.
//
// Requires `ffmpeg` on PATH (not an npm dependency — shells out to the system binary).
// Starts its own dev-server.mjs instance on port 4173 and tears it down when done, so it
// won't collide with a `npm run dev` you already have running elsewhere.
//
// Usage: node scripts/generate-demo-video.mjs [--theme=light|dark] [--out=dist/demo-video.mp4] [--no-music]

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');

const PORT = 4173;
const BASE_URL = `http://localhost:${PORT}`;
const WIDTH = 1920;
const HEIGHT = 1080;
const FPS = 30;
const FRAME_INTERVAL_MS = 1000 / FPS;

const args = Object.fromEntries(
  process.argv.slice(2).map((arg) => {
    const [key, value] = arg.replace(/^--/, '').split('=');
    return [key, value ?? true];
  })
);
const theme = args.theme === 'dark' ? 'dark' : 'light';
const outPath = path.resolve(root, args.out || 'dist/demo-video.mp4');
const includeMusic = !args['no-music'];

// ---------------------------------------------------------------------------
// Slides: full-bleed branded title cards, no page element involved. Runs before
// the first feature stop (intro) and after the last (outro/CTA) — the one place
// design-system.md's "accent as a full field" poster pattern is used, matching
// the landing page's own closing CTA banner.
// ---------------------------------------------------------------------------
const SLIDES = {
  intro: {
    kicker: 'INTRODUCING',
    title: 'ASCENT',
    subtitle: 'Engineer your next move.',
    body: 'Turn any goal into a step-by-step roadmap — pick a template, track every topic, and watch your progress add up.',
    durationMs: 5000,
  },
  outro: {
    kicker: 'GET STARTED',
    title: 'Start today',
    subtitle: 'Pick a template. Track every topic. Ship the plan.',
    body: 'Free to try — sign in as a guest, no account required.',
    durationMs: 4600,
  },
};

// ---------------------------------------------------------------------------
// Feature stops. Each has a `before(page)` that navigates/sets up state, a
// `selector` to spotlight, a `caption`, and an optional `action(page)` — a real
// interaction (click/type) fired once the spotlight has locked onto the target,
// whose resulting animation is captured live. `after(page)` (optional) tidies up
// (closing a panel/modal/menu) before the next stop.
// ---------------------------------------------------------------------------
const STOPS = [
  {
    // 'same', not 'crossfade' — the intro slide's own fade-out already reveals
    // this exact page (readDesignTokens/goto happened right before the slide
    // played), so a second crossfade veil here would be a jarring double-fade.
    name: 'landing-hero',
    route: 'same',
    caption: { title: 'Engineer your next move.', body: 'Track your roadmap toward any goal — no matter where you start.' },
    durationMs: 3400,
    async before(page) {
      await page.goto(`${BASE_URL}/#/`);
      await page.waitForSelector('a.btn.btn-primary.btn-lg');
    },
    selector: 'a.btn.btn-primary.btn-lg',
  },
  {
    name: 'guest-sign-in',
    route: 'crossfade',
    caption: { title: 'Start in seconds', body: 'No account required — try it instantly as a guest.' },
    durationMs: 3000,
    async before(page) {
      await page.goto(`${BASE_URL}/#/signin`);
      await page.waitForSelector('text=Continue as guest');
    },
    selector: 'text=Continue as guest',
  },
  {
    name: 'template-picker',
    route: 'same',
    caption: { title: 'Pick a starter template', body: 'Java Backend, Frontend, Data Science, or start from a blank slate.' },
    durationMs: 3400,
    async before(page) {
      await page.click('text=Continue as guest');
      await page.waitForSelector('.template-card-pick:has-text("Java Backend Engineer")');
    },
    selector: '.template-card-pick:has-text("Java Backend Engineer")',
  },
  {
    name: 'dashboard-overview',
    route: 'same',
    caption: { title: 'Your whole roadmap, one screen', body: 'Every phase, section, and topic laid out and ready to track.' },
    durationMs: 3200,
    async before(page) {
      await page.click('.template-card-pick:has-text("Java Backend Engineer")');
      await page.waitForSelector('.check-item');
      // A first-time guest triggers the feature tour's welcome overlay, which
      // blocks every click underneath it — dismiss it (Escape → its own
      // attachFocusTrap onEscape/end()) before any dashboard interaction.
      if (await page.locator('.tour-welcome-overlay').count()) {
        await page.keyboard.press('Escape');
        await page.waitForSelector('.tour-welcome-overlay', { state: 'detached' });
      }
    },
    selector: '.roadmap-header, .current-roadmap-badge',
  },
  {
    name: 'check-off-topic',
    route: 'same',
    caption: { title: 'Check off topics as you learn', body: 'One click marks progress — your streak and stats update instantly.' },
    durationMs: 3200,
    selector: '.check-item .check-box >> nth=0',
    async action(page) {
      await page.click('.check-item .check-box >> nth=0');
    },
  },
  {
    name: 'expand-phase',
    route: 'same',
    caption: { title: 'Organized into phases', body: 'Expand any phase to see its sections and topics in detail.' },
    durationMs: 3200,
    selector: '.phase-card[data-phase="1"] .phase-head',
    async action(page) {
      await page.click('.phase-card[data-phase="1"] .phase-head');
    },
  },
  {
    // Issue #487 folded the priority/resources/review filters into a
    // dedicated "Filter" panel, and issue #477 replaced the P0-P3 chip row
    // with a custom-select dropdown (`.priority-select-wrap`) — this stop
    // used to click a `.filter-chip[data-p="P0"]` directly on the page,
    // which no longer exists anywhere in the DOM. Opening the panel is
    // enough to show the feature; actually driving the portaled
    // custom-select listbox here was flaky (its option nodes get replaced
    // out from under an in-flight click whenever the surrounding filter
    // state re-renders, per select.js's own "every floating element is a
    // portal, rebuilt on state change" pattern) — the "Every resource"
    // chip below already demonstrates a real filter interaction, so this
    // stop just showcases the panel opening.
    name: 'priority-filter',
    route: 'same',
    caption: { title: 'Filter by priority, links, and tags', body: 'Zero in on what matters most, right now.' },
    durationMs: 3200,
    triggerSelector: '.filter-toggle-btn',
    selector: '.filter-panel',
    async action(page) {
      await page.click('.filter-toggle-btn');
      await page.waitForSelector('.filter-panel.show');
    },
    async after(page) {
      await page.click('.filter-panel .filter-chip[data-p="RESOURCES"]');
      await page.waitForTimeout(200);
    },
  },
  {
    name: 'resources-filter',
    route: 'same',
    caption: { title: 'Every resource, one filter away', body: 'Jump straight to every topic that has a link attached.' },
    durationMs: 2800,
    selector: '.filter-panel .filter-chip[data-p="RESOURCES"].active',
    async after(page) {
      await page.click('.filter-panel .filter-chip[data-p="RESOURCES"]');
      await page.click('.filter-panel [aria-label="Close filter panel"]');
    },
  },
  {
    name: 'edit-panel',
    route: 'same',
    caption: { title: 'Resources and notes, per topic', body: 'Attach links, jot notes, and track time — all in one place.' },
    durationMs: 3600,
    // Issue #486 (B1) collapsed the row's always-visible Edit button (and
    // everything else — Add to today, Mark reviewed, Add a link, Delete)
    // into one ⋮ overflow menu (`.check-item-overflow-btn`); the item panel
    // now opens via that menu's "Open" item, not a direct `[data-action="edit"]`
    // click. The panel doesn't exist until the menu item is clicked —
    // spotlight starts on the trigger, then glides to the freshly-opened panel.
    triggerSelector: '.check-item-overflow-btn >> nth=0',
    selector: '.item-panel',
    async action(page) {
      await page.click('.check-item-overflow-btn >> nth=0');
      // .dropdown-menu is portaled straight to document.body on open (see
      // dropdown.js's own comment on why), never a descendant of
      // .check-item-overflow — the wrapper class only decorates the
      // un-portaled trigger.
      await page.click('.dropdown-menu .dropdown-item:has-text("Open")');
      await page.waitForSelector('.item-panel.show');
    },
    async after(page) {
      await page.keyboard.press('Escape');
      await page.waitForTimeout(260);
    },
  },
  {
    name: 'global-search',
    route: 'same',
    caption: { title: 'Find anything, instantly', body: 'Search every topic across every roadmap you’ve started.' },
    durationMs: 3400,
    triggerSelector: '.app-topbar-command-btn',
    selector: '.command-palette-input',
    async action(page) {
      await page.click('.app-topbar-command-btn');
      await page.waitForSelector('.command-palette-input');
      await page.fill('.command-palette-input', 'Spring Boot');
    },
    async after(page) {
      await page.keyboard.press('Escape');
    },
  },
  {
    // Issue #490 (B5) moved Daily Todos from the onboarding "all roadmaps"
    // picker onto the dashboard itself — `.daily-todo-panel` no longer
    // renders on `/#/onboarding` at all, which used to hang this stop until
    // its own timeout.
    name: 'daily-todos',
    route: 'crossfade',
    caption: { title: "Plan today's focus", body: "Pull topics into Today's Todos with a rolling deadline." },
    durationMs: 3200,
    async before(page) {
      await page.goto(`${BASE_URL}/#/app`);
      await page.waitForSelector('.daily-todo-panel');
    },
    selector: '.daily-todo-panel',
  },
  {
    name: 'progress-heatmap',
    route: 'crossfade',
    caption: { title: 'See your progress', body: 'A full activity heatmap of every day you showed up.' },
    durationMs: 3400,
    async before(page) {
      await page.goto(`${BASE_URL}/#/progress`);
      await page.waitForSelector('.heatmap');
    },
    selector: '.heatmap',
  },
  {
    name: 'progress-stats',
    route: 'same',
    caption: { title: 'Streaks and stats that motivate', body: 'Track velocity, completion, and how far you’ve come.' },
    durationMs: 3200,
    selector: '.kpi-tile-hero, .stat-tile, .progress-card',
  },
  {
    name: 'share-roadmap',
    route: 'crossfade',
    caption: { title: 'Share your roadmap', body: 'Publish a read-only link — no sign-up required to view it.' },
    durationMs: 3400,
    async before(page) {
      await page.goto(`${BASE_URL}/#/app`);
      await page.waitForSelector('.app-sidebar-identity');
    },
    triggerSelector: '.app-sidebar-identity',
    selector: '.share-roadmap-modal-card',
    async action(page) {
      await page.click('.app-sidebar-identity');
      await page.click('.dropdown-menu .dropdown-item:has-text("Share this roadmap")');
      await page.waitForSelector('.share-roadmap-modal-card');
    },
    async after(page) {
      await page.keyboard.press('Escape');
    },
  },
  {
    // Theme lives in the sidebar footer (`.claude/rules/ui-styling.md`'s
    // topbar-contract note), not the topbar — `.app-topbar .theme-toggle`
    // never matched anything and hung this stop until timeout.
    name: 'theme-toggle',
    route: 'same',
    caption: { title: 'Beautiful in light or dark', body: 'Switch themes anytime — it remembers your choice.' },
    durationMs: 2800,
    selector: '.app-sidebar .theme-toggle',
    async action(page) {
      await page.click('.app-sidebar .theme-toggle');
    },
  },
  {
    name: 'settings',
    route: 'crossfade',
    caption: { title: 'Make it yours', body: 'Preferences, account, and data — all in one settings page.' },
    durationMs: 3000,
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
    setTimeout(() => resolve(server), 2000);
  });
}

// Reads the app's own live design tokens instead of hardcoding hex values, so the
// overlay always matches whatever the current theme actually renders — see
// .claude/rules/design-system.md for the token sheet these names come from.
async function readDesignTokens(page) {
  return page.evaluate(() => {
    const style = getComputedStyle(document.documentElement);
    const v = (name) => style.getPropertyValue(name).trim();
    return {
      bg: v('--color-bg'),
      surface: v('--color-surface'),
      surfaceRaised: v('--color-surface-raised'),
      text: v('--color-text'),
      textMuted: v('--color-text-muted'),
      accent: v('--color-accent'),
      accent600: v('--color-accent-600'),
      accent700: v('--color-accent-700'),
      divider: v('--color-divider'),
    };
  });
}

// Injected once per page load — a fixed overlay layer (cursor, spotlight-corner
// brackets, caption card, top progress bar) positioned via inline styles computed
// from Node-side bounding-box math. No real OS mouse movement, so this stays
// deterministic under headless Chromium.
async function installOverlay(page, tokens) {
  await page.evaluate((t) => {
    const layer = document.createElement('div');
    layer.id = '__demo_overlay';
    layer.style.cssText = 'position:fixed;inset:0;z-index:2147483647;pointer-events:none;font-family:Archivo,-apple-system,BlinkMacSystemFont,sans-serif;';

    const progressTrack = document.createElement('div');
    progressTrack.id = '__demo_progress_track';
    progressTrack.style.cssText = `position:absolute;top:0;left:0;right:0;height:4px;background:${t.divider};`;
    const progressFill = document.createElement('div');
    progressFill.id = '__demo_progress_fill';
    progressFill.style.cssText = `height:100%;width:0%;background:${t.accent};transition:width 80ms linear;`;
    progressTrack.appendChild(progressFill);

    const cursor = document.createElement('div');
    cursor.id = '__demo_cursor';
    cursor.style.cssText = `
      position:absolute;width:20px;height:20px;border-radius:50%;
      background:${t.accent};box-shadow:0 0 0 7px color-mix(in srgb, ${t.accent} 22%, transparent), 0 2px 10px rgba(0,0,0,0.35);
      transition:left 550ms cubic-bezier(0.22,1,0.36,1), top 550ms cubic-bezier(0.22,1,0.36,1), opacity 200ms;
      left:-40px;top:-40px;opacity:0;
    `;

    const ripple = document.createElement('div');
    ripple.id = '__demo_ripple';
    ripple.style.cssText = `
      position:absolute;width:20px;height:20px;border-radius:50%;
      border:2px solid ${t.accent};opacity:0;transform:scale(1);
      transition:transform 480ms ease-out, opacity 480ms ease-out;
    `;

    // Spotlight = four corner brackets rather than a full rectangle outline — a
    // camera-focus/callout style, reads as more "product demo" than a plain box.
    const spotlight = document.createElement('div');
    spotlight.id = '__demo_spotlight';
    spotlight.style.cssText = 'position:absolute;transition:left 550ms cubic-bezier(0.22,1,0.36,1),top 550ms cubic-bezier(0.22,1,0.36,1),width 550ms cubic-bezier(0.22,1,0.36,1),height 550ms cubic-bezier(0.22,1,0.36,1),opacity 250ms;opacity:0;';
    const cornerSpec = [
      ['top', 'left', 'border-top', 'border-left'],
      ['top', 'right', 'border-top', 'border-right'],
      ['bottom', 'left', 'border-bottom', 'border-left'],
      ['bottom', 'right', 'border-bottom', 'border-right'],
    ];
    cornerSpec.forEach(([vSide, hSide, bA, bB]) => {
      const c = document.createElement('div');
      c.className = '__demo_corner';
      c.style.cssText = `position:absolute;width:22px;height:22px;${vSide}:-6px;${hSide}:-6px;${bA}:3px solid ${t.accent};${bB}:3px solid ${t.accent};`;
      spotlight.appendChild(c);
    });

    const caption = document.createElement('div');
    caption.id = '__demo_caption';
    caption.style.cssText = `
      position:absolute;left:56px;bottom:72px;max-width:620px;
      background:${t.text};color:${t.bg};padding:22px 28px;
      opacity:0;transform:translateY(14px);transition:opacity 320ms ease-out, transform 320ms ease-out;
    `;
    const rule = document.createElement('div');
    rule.style.cssText = `width:36px;height:3px;background:${t.accent};margin-bottom:12px;`;
    const title = document.createElement('div');
    title.id = '__demo_caption_title';
    title.style.cssText = 'font-weight:800;font-size:26px;letter-spacing:-0.01em;line-height:1.15;margin-bottom:8px;';
    const body = document.createElement('div');
    body.id = '__demo_caption_body';
    body.style.cssText = 'font-weight:400;font-size:16px;line-height:1.5;opacity:0.82;';
    caption.append(rule, title, body);

    layer.append(progressTrack, spotlight, cursor, ripple, caption);
    document.body.appendChild(layer);
  }, tokens);
}

async function removeOverlay(page) {
  await page.evaluate(() => document.getElementById('__demo_overlay')?.remove());
}

async function updateProgress(page, fraction) {
  await page.evaluate((pct) => {
    const fill = document.getElementById('__demo_progress_fill');
    if (fill) fill.style.width = `${Math.min(100, Math.max(0, pct * 100))}%`;
  }, fraction);
}

async function moveSpotlightTo(page, selector) {
  const target = page.locator(selector).first();
  // NOT target.scrollIntoViewIfNeeded() — this app sets `html { scroll-behavior:
  // smooth }` globally (.claude/rules/ui-styling.md documents this exact hazard
  // elsewhere), so Playwright's built-in scroll can return before the animated
  // scroll actually settles, leaving boundingBox() below reflecting a
  // mid-transition position that then never gets corrected — the spotlight
  // ends up baked in at a stale offset for the element's entire on-screen
  // window. `behavior: 'instant'` on a real scrollIntoView() call overrides
  // the page's own CSS scroll-behavior for this one programmatic call, so the
  // scroll is guaranteed to have already fully settled before the next line
  // measures anything.
  await target.evaluate((el) => el.scrollIntoView({ behavior: 'instant', block: 'center', inline: 'nearest' }));
  const box = await target.boundingBox();
  if (!box) throw new Error(`Could not locate element (selector: ${selector})`);
  await page.evaluate((b) => {
    const cursor = document.getElementById('__demo_cursor');
    const spotlight = document.getElementById('__demo_spotlight');
    cursor.style.opacity = '1';
    cursor.style.left = `${b.x + b.width / 2 - 10}px`;
    cursor.style.top = `${b.y + b.height / 2 - 10}px`;
    spotlight.style.left = `${b.x}px`;
    spotlight.style.top = `${b.y}px`;
    spotlight.style.width = `${b.width}px`;
    spotlight.style.height = `${b.height}px`;
    spotlight.style.opacity = '1';
  }, box);
  return box;
}

async function showCaption(page, caption) {
  await page.evaluate((c) => {
    document.getElementById('__demo_caption_title').textContent = c.title;
    document.getElementById('__demo_caption_body').textContent = c.body;
    const el = document.getElementById('__demo_caption');
    el.style.opacity = '1';
    el.style.transform = 'translateY(0)';
  }, caption);
}

async function playClickRipple(page) {
  await page.evaluate(() => {
    const cursor = document.getElementById('__demo_cursor');
    const ripple = document.getElementById('__demo_ripple');
    ripple.style.left = cursor.style.left;
    ripple.style.top = cursor.style.top;
    ripple.style.transition = 'none';
    ripple.style.opacity = '0.9';
    ripple.style.transform = 'scale(1)';
    // Force reflow so the next transition actually restarts.
    void ripple.offsetWidth;
    ripple.style.transition = 'transform 480ms ease-out, opacity 480ms ease-out';
    ripple.style.transform = 'scale(3.2)';
    ripple.style.opacity = '0';
  });
}

// Headless Chromium's page.screenshot() can occasionally return a stale/blank
// compositor buffer if called before the browser has actually produced a new
// painted frame — most likely under continuous style mutation (a CSS
// transition ticking every ~33ms, exactly what this script drives). A
// double-rAF round trip guarantees at least one real paint has happened
// since the last DOM/style write, before every screenshot in this script.
async function waitForPaint(page) {
  await page.evaluate(() => new Promise((resolve) => {
    requestAnimationFrame(() => requestAnimationFrame(resolve));
  }));
}

// Captures frames on a fixed-interval loop for `durationMs`, calling `onStart()`
// once at the very first frame — this is what makes the CSS transitions (cursor
// glide, spotlight grow, caption fade) and any real UI animation triggered by
// `onStart` actually show up as motion in the output, instead of only ever
// capturing the settled end-state.
async function captureAnimatedFrames(page, framesDir, frameCounterRef, durationMs, onStart, progressRef) {
  const frameCount = Math.max(1, Math.round(durationMs / FRAME_INTERVAL_MS));
  for (let i = 0; i < frameCount; i++) {
    if (i === 0 && onStart) await onStart();
    const frameNumber = frameCounterRef.value++;
    const filePath = path.join(framesDir, `frame-${String(frameNumber).padStart(7, '0')}.png`);
    await waitForPaint(page);
    await page.screenshot({ path: filePath });
    if (progressRef) await updateProgress(page, progressRef.value());
    await page.waitForTimeout(FRAME_INTERVAL_MS);
  }
}

// A short crossfade veil painted over the CURRENT page, right before a stop's
// before() navigates away — reads as an intentional transition rather than a
// jarring cut between routes. Uses a plain full-viewport div (not the overlay
// layer, which gets torn down/rebuilt per page load) painted with the
// outgoing page's own --color-bg.
async function fadeOutCurrentPage(page, framesDir, frameCounterRef, progressRef) {
  const bg = await page.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue('--color-bg').trim());
  await page.evaluate((color) => {
    const veil = document.createElement('div');
    veil.id = '__demo_veil';
    veil.style.cssText = `position:fixed;inset:0;z-index:2147483647;background:${color};opacity:0;transition:opacity 220ms ease-in;pointer-events:none;`;
    document.body.appendChild(veil);
    requestAnimationFrame(() => { veil.style.opacity = '1'; });
  }, bg);
  const fadeOutFrames = Math.round(220 / FRAME_INTERVAL_MS);
  for (let i = 0; i < fadeOutFrames; i++) {
    const frameNumber = frameCounterRef.value++;
    await waitForPaint(page);
    await page.screenshot({ path: path.join(framesDir, `frame-${String(frameNumber).padStart(7, '0')}.png`) });
    if (progressRef) await updateProgress(page, progressRef.value());
    await page.waitForTimeout(FRAME_INTERVAL_MS);
  }
}

function buildStepList() {
  const totalStopMs = STOPS.reduce((sum, s) => sum + s.durationMs, 0);
  const totalMs = SLIDES.intro.durationMs + totalStopMs + SLIDES.outro.durationMs;
  return { totalMs };
}

async function playSlide(page, tokens, slide, framesDir, frameCounterRef, progressRef) {
  await page.evaluate((s) => {
    const wrap = document.createElement('div');
    wrap.id = '__demo_slide';
    wrap.style.cssText = `
      position:fixed;inset:0;z-index:2147483647;background:${s.accent};
      display:flex;flex-direction:column;align-items:flex-start;justify-content:center;
      padding:0 10%;font-family:Archivo,-apple-system,BlinkMacSystemFont,sans-serif;
      opacity:0;transition:opacity 420ms ease-out;
    `;
    // Brand lockup (the real triangle-in-square mark, not a placeholder —
    // matches public/favicon.svg / brand.js's createBrandMark()) sits above
    // the kicker on both the intro and outro slide, so the mark and name are
    // reinforced at the very start AND the very end of the video, not just
    // once — repetition is what actually drives logo/name recall.
    const brandRow = document.createElement('div');
    brandRow.style.cssText = 'display:flex;align-items:center;gap:12px;margin-bottom:28px;';
    const brandIcon = document.createElement('div');
    brandIcon.style.cssText = `width:34px;height:34px;background:${s.bg};display:flex;align-items:center;justify-content:center;flex-shrink:0;`;
    const brandTriangle = document.createElement('div');
    brandTriangle.style.cssText = `width:0;height:0;border-left:9px solid transparent;border-right:9px solid transparent;border-bottom:15px solid ${s.accent};`;
    brandIcon.appendChild(brandTriangle);
    const brandWordmark = document.createElement('div');
    brandWordmark.textContent = 'ASCENT';
    brandWordmark.style.cssText = `color:${s.bg};font-weight:800;font-size:22px;letter-spacing:0.05em;`;
    brandRow.append(brandIcon, brandWordmark);

    const kicker = document.createElement('div');
    kicker.style.cssText = `color:${s.bg};opacity:0.85;font-weight:600;font-size:15px;letter-spacing:0.14em;text-transform:uppercase;margin-bottom:18px;`;
    kicker.textContent = s.kicker;
    const title = document.createElement('div');
    title.style.cssText = `color:${s.bg};font-weight:800;font-size:96px;letter-spacing:-0.02em;line-height:1;margin-bottom:20px;`;
    title.textContent = s.title;
    const subtitle = document.createElement('div');
    subtitle.style.cssText = `color:${s.bg};font-weight:800;font-size:34px;letter-spacing:-0.01em;margin-bottom:16px;`;
    subtitle.textContent = s.subtitle;
    const body = document.createElement('div');
    body.style.cssText = `color:${s.bg};opacity:0.85;font-weight:400;font-size:19px;max-width:640px;line-height:1.5;`;
    body.textContent = s.body;
    wrap.append(brandRow, kicker, title, subtitle, body);
    document.body.appendChild(wrap);
    requestAnimationFrame(() => { wrap.style.opacity = '1'; });
  }, { ...slide, accent: tokens.accent, bg: tokens.bg });

  await captureAnimatedFrames(page, framesDir, frameCounterRef, slide.durationMs, null, progressRef);

  await page.evaluate(() => {
    const el = document.getElementById('__demo_slide');
    if (el) el.style.opacity = '0';
  });
  const fadeFrames = Math.round(320 / FRAME_INTERVAL_MS);
  for (let i = 0; i < fadeFrames; i++) {
    const frameNumber = frameCounterRef.value++;
    await waitForPaint(page);
    await page.screenshot({ path: path.join(framesDir, `frame-${String(frameNumber).padStart(7, '0')}.png`) });
    if (progressRef) await updateProgress(page, progressRef.value());
    await page.waitForTimeout(FRAME_INTERVAL_MS);
  }
  await page.evaluate(() => document.getElementById('__demo_slide')?.remove());
}

async function runStop(page, stop, framesDir, frameCounterRef, progressRef) {
  if (stop.before) {
    if (stop.route === 'crossfade' && frameCounterRef.value > 0) {
      await fadeOutCurrentPage(page, framesDir, frameCounterRef, progressRef);
    }
    await stop.before(page);
    // This app is a client-side hash-router SPA — a hash-only navigation
    // never reloads the page, so the veil (appended directly to
    // document.body, outside the SPA's own #app root the router
    // tears down/rebuilds on route change) would otherwise sit at full
    // opacity over everything, forever, from this point on in the script.
    await page.evaluate(() => document.getElementById('__demo_veil')?.remove());
  }

  const tokens = await readDesignTokens(page);
  await installOverlay(page, tokens);

  // If the caption's real target only exists after `action` runs (a panel/
  // modal/palette that the click itself opens), spotlight the trigger first —
  // `action` glides the spotlight to the real target once it appears.
  await moveSpotlightTo(page, stop.triggerSelector || stop.selector);
  await showCaption(page, stop.caption);

  await captureAnimatedFrames(
    page,
    framesDir,
    frameCounterRef,
    stop.durationMs,
    stop.action
      ? async () => {
          await playClickRipple(page);
          await stop.action(page);
          // Always re-measure and re-sync after the action, even when
          // triggerSelector === selector (a plain filter-chip click, say) —
          // the action can shift the target's own layout (e.g. clicking a
          // priority/resources filter chip reveals a new "Clear all
          // filters" link above the chip row, pushing the whole row down),
          // so the pre-click box this stop started with can go stale the
          // instant the click lands, not just when the target is a
          // freshly-created element (a panel/modal/palette).
          await moveSpotlightTo(page, stop.selector);
        }
      : null,
    progressRef
  );

  if (stop.after) await stop.after(page);
  await removeOverlay(page);
}

// Ambient background music, synthesized entirely by ffmpeg's own audio filters —
// not a downloaded/embedded audio file. No third-party track is bundled with this
// script or the repo, so there's no licensing question to resolve: every waveform
// here is generated at render time from nothing but sine-wave math. A real chord
// progression (I-IV-vi-V7 in C, a common, pleasant "corporate/inspirational" move)
// cycling every CHORD_SEGMENT_SEC gives it actual harmonic movement — a single
// sustained chord for the whole video reads as a flat drone, not music. Mixed in
// quietly under the video (`volume=0.14`) with a 2.5s fade in/out.
const CHORD_PROGRESSION_HZ = [
  [130.81, 164.81, 196.0, 246.94], // Cmaj7 — C3 E3 G3 B3
  [174.61, 220.0, 261.63, 329.63], // Fmaj7 — F3 A3 C4 E4
  [110.0, 130.81, 164.81, 196.0], // Am7 — A2 C3 E3 G3
  [98.0, 123.47, 146.83, 174.61], // G7 — G2 B2 D3 F3
];
const CHORD_SEGMENT_SEC = 8;

function buildFfmpegArgs(framesDir, out, durationSec, includeMusic) {
  const args = ['-y', '-framerate', String(FPS), '-pattern_type', 'glob', '-i', path.join(framesDir, 'frame-*.png')];

  if (!includeMusic) {
    args.push('-an', '-c:v', 'libx264', '-pix_fmt', 'yuv420p', out);
    return args;
  }

  // Each chord is its own short segment (its 4 tones mixed, then faded 0.3s at
  // both edges so concatenating segments never produces an audible click at the
  // boundary), and the segments are concatenated end to end, cycling through the
  // progression for as long as the video runs.
  const segmentCount = Math.max(1, Math.ceil(durationSec / CHORD_SEGMENT_SEC));
  let inputIndex = 1; // input 0 is the video frame sequence
  const segmentLabels = [];
  const filterParts = [];
  for (let seg = 0; seg < segmentCount; seg++) {
    const chord = CHORD_PROGRESSION_HZ[seg % CHORD_PROGRESSION_HZ.length];
    const toneLabels = [];
    for (const freq of chord) {
      args.push('-f', 'lavfi', '-i', `sine=frequency=${freq}:duration=${CHORD_SEGMENT_SEC}`);
      toneLabels.push(`[${inputIndex}:a]`);
      inputIndex += 1;
    }
    const segLabel = `seg${seg}`;
    filterParts.push(
      `${toneLabels.join('')}amix=inputs=${chord.length}:duration=first,` +
        `afade=t=in:d=0.3,afade=t=out:st=${CHORD_SEGMENT_SEC - 0.3}:d=0.3[${segLabel}]`
    );
    segmentLabels.push(`[${segLabel}]`);
  }

  const fadeOutStart = Math.max(0, durationSec - 2.5);
  filterParts.push(`${segmentLabels.join('')}concat=n=${segmentCount}:v=0:a=1[chords]`);
  filterParts.push(
    `[chords]tremolo=f=0.15:d=0.2,volume=0.14,afade=t=in:d=2.5,afade=t=out:st=${fadeOutStart}:d=2.5[aout]`
  );

  args.push(
    '-filter_complex', filterParts.join(';'),
    '-map', '0:v', '-map', '[aout]',
    '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-c:a', 'aac', '-shortest',
    out
  );
  return args;
}

function runFfmpeg(framesDir, out, durationSec, includeMusic) {
  return new Promise((resolve, reject) => {
    mkdirSync(path.dirname(out), { recursive: true });
    const ffmpeg = spawn('ffmpeg', buildFfmpegArgs(framesDir, out, durationSec, includeMusic));
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

  const { totalMs } = buildStepList();
  let elapsedMs = 0;
  const frameCounterRef = { value: 0 };
  const progressRef = { value: () => elapsedMs / totalMs };

  const server = await startDevServer();
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: WIDTH, height: HEIGHT } });
  await page.addInitScript((t) => localStorage.setItem('ascent-theme', t), theme);

  try {
    await page.goto(`${BASE_URL}/#/`);
    await page.waitForSelector('a.btn.btn-primary.btn-lg');
    const introTokens = await readDesignTokens(page);
    console.log('Intro slide');
    await playSlide(page, introTokens, SLIDES.intro, framesDir, frameCounterRef, progressRef);
    elapsedMs += SLIDES.intro.durationMs + 320;

    for (let i = 0; i < STOPS.length; i++) {
      const stop = STOPS[i];
      console.log(`Stop ${i + 1}/${STOPS.length}: ${stop.name}`);
      await runStop(page, stop, framesDir, frameCounterRef, progressRef);
      elapsedMs += stop.durationMs + (stop.route === 'crossfade' ? 220 : 0);
    }

    const outroTokens = await readDesignTokens(page);
    console.log('Outro slide');
    await playSlide(page, outroTokens, SLIDES.outro, framesDir, frameCounterRef, progressRef);

    console.log(`Assembling frames into video via ffmpeg${includeMusic ? ' (with ambient background pad)' : ' (silent)'}...`);
    const durationSec = frameCounterRef.value / FPS;
    await runFfmpeg(framesDir, outPath, durationSec, includeMusic);
    console.log(`Wrote ${path.relative(root, outPath)} (${frameCounterRef.value} frames, ~${Math.round(durationSec)}s)`);
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
