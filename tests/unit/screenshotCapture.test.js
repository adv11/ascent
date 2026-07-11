import { describe, it, expect, vi, beforeEach } from 'vitest';
import { resizeUntilUnderLimit, readUploadedImage, MAX_UPLOAD_BYTES, SENSITIVE_SELECTORS, blurSensitiveRegions } from '../../src/ui/components/screenshotCapture.js';

// A fake canvas whose toDataURL() shrinks in half each time it's asked,
// simulating a real canvas's output shrinking as width/height halve —
// jsdom has no real 2D rendering backend to drive this for real.
function fakeCanvas(initialLength) {
  let length = initialLength;
  return {
    width: 1000,
    height: 1000,
    getContext: () => ({ drawImage: vi.fn() }),
    toDataURL: () => 'x'.repeat(length),
    get _shrink() { length = Math.round(length / 2); return length; }
  };
}

function createShrinkingCanvasFactory(startLength) {
  let length = startLength;
  return () => {
    length = Math.round(length / 2);
    const len = length;
    return {
      width: 500,
      height: 500,
      getContext: () => ({ drawImage: vi.fn() }),
      toDataURL: () => 'x'.repeat(len)
    };
  };
}

describe('resizeUntilUnderLimit', () => {
  it('returns the original data URL unchanged when already under the limit', () => {
    const canvas = fakeCanvas(100);
    const result = resizeUntilUnderLimit(canvas, 1000);
    expect(result).toBe('x'.repeat(100));
  });

  it('resizes an oversized canvas until the output fits under the byte cap', () => {
    // 800,000 chars * 0.75 ≈ 600,000 bytes, over a 500KB (512,000 byte) cap.
    const oversized = fakeCanvas(800_000);
    const createCanvas = createShrinkingCanvasFactory(800_000);
    const result = resizeUntilUnderLimit(oversized, 500 * 1024, createCanvas);
    expect(result.length * 0.75).toBeLessThanOrEqual(500 * 1024);
  });

  it('gives up after 5 attempts rather than looping forever', () => {
    const neverShrinksEnough = fakeCanvas(10_000_000);
    const createCanvas = () => ({
      width: 10, height: 10,
      getContext: () => ({ drawImage: vi.fn() }),
      toDataURL: () => 'x'.repeat(10_000_000)
    });
    const result = resizeUntilUnderLimit(neverShrinksEnough, 1, createCanvas);
    expect(result.length).toBe(10_000_000);
  });
});

// Regression coverage for a real bug (issue #9 follow-up): an earlier
// version of SENSITIVE_SELECTORS included the literal `.auth-*`, which is
// not valid CSS class selector syntax — `querySelectorAll()` throws a
// SyntaxError on an invalid selector, which made every single screenshot
// capture attempt fail. `document.querySelectorAll` is the same call
// blurSensitiveRegions() makes against the real DOM; asserting it doesn't
// throw here would have caught that regression before it shipped.
describe('SENSITIVE_SELECTORS', () => {
  it('is valid CSS — querySelectorAll does not throw', () => {
    expect(() => document.body.querySelectorAll(SENSITIVE_SELECTORS)).not.toThrow();
  });
});

describe('blurSensitiveRegions', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
  });

  it('does not throw when scanning a real DOM tree', () => {
    document.body.innerHTML = '<div class="auth-page"><span class="app-sidebar-user-email">jane@example.com</span></div>';
    const canvas = { width: 100, height: 100, getContext: () => ({ save: vi.fn(), restore: vi.fn(), drawImage: vi.fn(), fillRect: vi.fn(), set filter(_v) {}, set fillStyle(_v) {} }) };
    document.body.getBoundingClientRect = () => ({ left: 0, top: 0, width: 100, height: 100 });
    Element.prototype.getBoundingClientRect = function () {
      return this.classList.contains('app-sidebar-user-email')
        ? { left: 10, top: 10, width: 30, height: 10 }
        : { left: 0, top: 0, width: 100, height: 100 };
    };
    expect(() => blurSensitiveRegions(canvas, document.body)).not.toThrow();
  });

  it('never matches a broad auth-* layout container — only real PII-bearing elements', () => {
    document.body.innerHTML = '<div class="auth-page auth-marketing auth-card-body"><span class="app-sidebar-user-email">jane@example.com</span></div>';
    const matched = [...document.body.querySelectorAll(SENSITIVE_SELECTORS)];
    expect(matched).toHaveLength(1);
    expect(matched[0].className).toBe('app-sidebar-user-email');
  });
});

describe('readUploadedImage', () => {
  it('rejects a non-image file', async () => {
    const file = new File(['data'], 'notes.txt', { type: 'text/plain' });
    const result = await readUploadedImage(file);
    expect(result.error).toBeTruthy();
  });

  it('rejects a file over MAX_UPLOAD_BYTES', async () => {
    const bytes = new Uint8Array(MAX_UPLOAD_BYTES + 1);
    const file = new File([bytes], 'big.png', { type: 'image/png' });
    const result = await readUploadedImage(file);
    expect(result.error).toBe('Image must be 2 MB or smaller.');
  });

  it('reads a valid small image into a data URL', async () => {
    const file = new File([new Uint8Array([1, 2, 3])], 'small.png', { type: 'image/png' });
    const result = await readUploadedImage(file);
    expect(result.error).toBeUndefined();
    expect(result.dataUrl).toMatch(/^data:/);
  });
});
