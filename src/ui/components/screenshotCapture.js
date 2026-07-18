// html2canvas lazy-load wrapper + privacy blur + size cap (issue #9 §4) —
// same lazy dynamic-import-from-pinned-jsdelivr-version pattern
// chartWrapper.js established for Chart.js (issue #8); see
// docs/adr/ADR-002-csp-sri-security.md's "CDN loading exceptions" section for
// why a dynamic import can't carry SRI and why a pinned version is the
// accepted mitigation.
const HTML2CANVAS_VERSION = '1.4.1';
const HTML2CANVAS_URL = `https://cdn.jsdelivr.net/npm/html2canvas@${HTML2CANVAS_VERSION}/dist/html2canvas.esm.js`;

export const MAX_SCREENSHOT_BYTES = 500 * 1024;
export const MAX_UPLOAD_BYTES = 2 * 1024 * 1024;

// Elements that can show a user's email or other identity info anywhere in
// the app — scanned and blurred before the canvas is exported, per the
// in-widget privacy notice (issue #9 §4.1). Not just `.user-chip` (the
// issue's own example selector, which doesn't exist in this codebase) —
// `.app-sidebar-user-email`/`.app-sidebar-identity` are the real elements
// that render a signed-in user's email today.
//
// Deliberately NOT a broad `auth-*` prefix match: an earlier version used
// the literal (invalid CSS) `.auth-*`, which made `querySelectorAll()`
// throw a SyntaxError on every single capture attempt — silently swallowed
// by the generic catch in feedbackForm.js's capture handler as "Could not
// capture the screen" (reported live, issue #9 follow-up). The tempting
// "fix" of `[class*="auth-"]` is valid CSS but far too broad: every class in
// `authShell.js`/`authMarketingPanel.js` is prefixed `auth-` for layout/
// branding (`.auth-page`, `.auth-marketing`, `.auth-card-body`, ...), none
// of which render an email — matching that prefix blurred+grayed out
// essentially the entire sign-in/sign-up page, not just PII. If a real
// email-in-an-auth-page-context element is ever added, give it its own
// specific class and add that class here — don't reach for a prefix match.
export const SENSITIVE_SELECTORS = '.user-chip, .app-sidebar-user-email, .app-sidebar-identity, [data-sensitive]';

let html2canvasPromise = null;

function loadHtml2Canvas() {
  if (!html2canvasPromise) {
    html2canvasPromise = import(HTML2CANVAS_URL).then(mod => mod.default || mod);
  }
  return html2canvasPromise;
}

export function blurSensitiveRegions(canvas, sourceEl) {
  const ctx = canvas.getContext('2d');
  const sourceRect = sourceEl.getBoundingClientRect();
  const scaleX = canvas.width / sourceRect.width;
  const scaleY = canvas.height / sourceRect.height;
  sourceEl.querySelectorAll(SENSITIVE_SELECTORS).forEach(node => {
    const rect = node.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) return;
    const x = (rect.left - sourceRect.left) * scaleX;
    const y = (rect.top - sourceRect.top) * scaleY;
    const w = rect.width * scaleX;
    const h = rect.height * scaleY;
    ctx.save();
    ctx.filter = 'blur(8px)';
    ctx.drawImage(canvas, x, y, w, h, x, y, w, h);
    ctx.restore();
    // A blurred copy of itself still leaks a legible edge — an opaque fill on
    // top is the only way to fully obscure the region, not just soften it.
    ctx.fillStyle = 'rgba(120, 120, 120, 0.85)';
    ctx.fillRect(x, y, w, h);
  });
}

// Downscales a canvas by half repeatedly until its PNG data URL fits under
// `MAX_SCREENSHOT_BYTES`, or gives up after a few attempts (returns the last,
// still-oversized result — the caller sets screenshotOmitted in that case).
// `createCanvas` is injectable so this is unit-testable without a real
// <canvas> 2D rendering backend (jsdom has none by default) — tests pass a
// fake canvas-like object exposing width/height/getContext/toDataURL.
export function resizeUntilUnderLimit(canvas, maxBytes, createCanvas = () => document.createElement('canvas')) {
  let current = canvas;
  let dataUrl = current.toDataURL('image/png');
  let attempts = 0;
  while (dataUrl.length * 0.75 > maxBytes && attempts < 5) {
    const scaled = createCanvas();
    scaled.width = Math.max(1, Math.round(current.width / 2));
    scaled.height = Math.max(1, Math.round(current.height / 2));
    const ctx = scaled.getContext('2d');
    ctx.drawImage(current, 0, 0, scaled.width, scaled.height);
    current = scaled;
    dataUrl = current.toDataURL('image/png');
    attempts += 1;
  }
  return dataUrl;
}

// Captured screenshots must exclude the feedback UI itself — the trigger
// button (`.feedback-widget-trigger`) *and* the open modal it's called from
// (`.modal-overlay`), or the report screenshot just shows the reporting
// widget covering whatever the user was actually trying to capture. The
// original default, a single literal `.feedback-widget` class, never
// matched anything real (the trigger's actual class is
// `.feedback-widget-trigger`; the modal's is `.modal-overlay`/
// `.feedback-modal-card`) — reported live (issue #9 follow-up), the capture
// silently included the modal every time.
export const DEFAULT_EXCLUDE_SELECTOR = '.feedback-widget-trigger, .modal-overlay';

// Captures the current page as a base64 PNG, blurring sensitive UI regions
// first, then resizing until it fits under MAX_SCREENSHOT_BYTES. Returns
// `{ dataUrl, omitted }` — `omitted: true` means the capture is still over
// the cap after resizing attempts and should not be attached.
export async function captureScreenshot({ excludeSelector = DEFAULT_EXCLUDE_SELECTOR } = {}) {
  const html2canvas = await loadHtml2Canvas();
  const canvas = await html2canvas(document.body, {
    useCORS: true,
    scale: Math.min(window.devicePixelRatio || 1, 2),
    // html2canvas's default cloning strategy copies each cloned node's
    // computed styles onto its own inline `style` attribute so the clone
    // renders identically once detached from the live page — this app's CSP
    // has no `unsafe-inline` for `style-src` (see .claude/rules/
    // auth-security.md), so every one of those inline styles is silently
    // dropped by the browser, breaking the capture. foreignObjectRendering
    // draws the live DOM directly via an SVG <foreignObject> using the
    // browser's own rendering engine instead of a clone-and-restyle pass,
    // which needs no inline styles at all and is unaffected by the CSP.
    foreignObjectRendering: true,
    // el.matches() supports the full multi-selector string above — the
    // previous classList.contains(single-class-only) hack couldn't.
    ignoreElements: el => el.matches?.(excludeSelector) ?? false
  });
  blurSensitiveRegions(canvas, document.body);
  const dataUrl = resizeUntilUnderLimit(canvas, MAX_SCREENSHOT_BYTES);
  const byteLength = dataUrl.length * 0.75;
  return { dataUrl: byteLength <= MAX_SCREENSHOT_BYTES ? dataUrl : null, omitted: byteLength > MAX_SCREENSHOT_BYTES };
}

// Reads a manually uploaded file into a base64 data URL. Rejects (does not
// throw) with `{ error }` if over MAX_UPLOAD_BYTES — callers surface that as
// a form error rather than a thrown exception, matching every other
// validate-then-show-error pattern in this app.
export function readUploadedImage(file) {
  return new Promise(resolve => {
    if (!file || !file.type?.startsWith('image/')) {
      resolve({ error: 'Choose an image file.' });
      return;
    }
    if (file.size > MAX_UPLOAD_BYTES) {
      resolve({ error: 'Image must be 2 MB or smaller.' });
      return;
    }
    const reader = new FileReader();
    reader.onload = () => resolve({ dataUrl: reader.result });
    reader.onerror = () => resolve({ error: 'Could not read that image. Try again.' });
    reader.readAsDataURL(file);
  });
}
