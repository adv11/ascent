import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

vi.mock('../../src/ui/components/shareCard.js', () => ({
  generateShareCard: vi.fn(async () => {
    const canvas = document.createElement('canvas');
    canvas.width = 1200;
    canvas.height = 630;
    canvas.toBlob = cb => cb(new Blob(['fake-png'], { type: 'image/png' }));
    return canvas;
  })
}));

function fakeAnalytics() {
  return {
    overview: { total: 340, done: 128, pct: 38 },
    streaks: { current: 14, longest: 21 },
    velocity: 4.2
  };
}

let originalClipboard;
let originalShare;
let originalCanShare;
let originalClipboardItem;

beforeEach(() => {
  vi.resetModules();
  document.body.innerHTML = '';
  originalClipboard = navigator.clipboard;
  originalShare = navigator.share;
  originalCanShare = navigator.canShare;
  originalClipboardItem = window.ClipboardItem;
});

afterEach(() => {
  Object.defineProperty(navigator, 'clipboard', { value: originalClipboard, configurable: true });
  Object.defineProperty(navigator, 'share', { value: originalShare, configurable: true });
  Object.defineProperty(navigator, 'canShare', { value: originalCanShare, configurable: true });
  window.ClipboardItem = originalClipboardItem;
});

describe('openShareModal', () => {
  it('renders the preview canvas and a pre-filled, editable caption', async () => {
    const { openShareModal } = await import('../../src/ui/components/shareModal.js');
    await openShareModal(fakeAnalytics(), {});
    const canvas = document.querySelector('.share-card-preview');
    expect(canvas).not.toBeNull();
    const caption = document.querySelector('.share-caption-input');
    expect(caption.value).toMatch(/14-day streak/);
    expect(caption.value).toMatch(/128\/340/);
    caption.value = 'edited caption';
    expect(caption.value).toBe('edited caption');
  });

  it('Download PNG triggers a download of ascent-progress.png', async () => {
    Object.defineProperty(navigator, 'clipboard', { value: undefined, configurable: true });
    Object.defineProperty(navigator, 'share', { value: undefined, configurable: true });
    const { openShareModal } = await import('../../src/ui/components/shareModal.js');
    await openShareModal(fakeAnalytics(), {});

    const clickSpy = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});
    const createObjectURLSpy = vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:fake');
    const revokeSpy = vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {});

    const downloadBtn = Array.from(document.querySelectorAll('button')).find(b => b.textContent === 'Download PNG');
    downloadBtn.click();
    await vi.waitFor(() => expect(clickSpy).toHaveBeenCalled());
    expect(createObjectURLSpy).toHaveBeenCalled();
    expect(revokeSpy).toHaveBeenCalled();

    clickSpy.mockRestore();
    createObjectURLSpy.mockRestore();
    revokeSpy.mockRestore();
  });

  it('hides the Copy image button when the Clipboard API is unsupported', async () => {
    Object.defineProperty(navigator, 'clipboard', { value: undefined, configurable: true });
    Object.defineProperty(navigator, 'share', { value: undefined, configurable: true });
    const { openShareModal } = await import('../../src/ui/components/shareModal.js');
    await openShareModal(fakeAnalytics(), {});
    const copyBtn = Array.from(document.querySelectorAll('button')).find(b => b.textContent === 'Copy image');
    expect(copyBtn.hidden).toBe(true);
  });

  it('shows Copy image and calls clipboard.write when supported', async () => {
    window.ClipboardItem = class ClipboardItem {};
    Object.defineProperty(navigator, 'clipboard', { value: { write: vi.fn(() => Promise.resolve()) }, configurable: true });
    Object.defineProperty(navigator, 'share', { value: undefined, configurable: true });
    const { openShareModal } = await import('../../src/ui/components/shareModal.js');
    await openShareModal(fakeAnalytics(), {});
    const copyBtn = Array.from(document.querySelectorAll('button')).find(b => b.textContent === 'Copy image');
    expect(copyBtn.hidden).toBe(false);
    copyBtn.click();
    await vi.waitFor(() => expect(navigator.clipboard.write).toHaveBeenCalled());
  });

  it('hides the Share button when the Web Share API is unsupported', async () => {
    Object.defineProperty(navigator, 'clipboard', { value: undefined, configurable: true });
    Object.defineProperty(navigator, 'share', { value: undefined, configurable: true });
    const { openShareModal } = await import('../../src/ui/components/shareModal.js');
    await openShareModal(fakeAnalytics(), {});
    const shareBtn = Array.from(document.querySelectorAll('button')).find(b => b.textContent === 'Share…');
    expect(shareBtn.hidden).toBe(true);
  });

  it('calls navigator.share with the file and caption when supported', async () => {
    Object.defineProperty(navigator, 'clipboard', { value: undefined, configurable: true });
    Object.defineProperty(navigator, 'share', { value: vi.fn(() => Promise.resolve()), configurable: true });
    Object.defineProperty(navigator, 'canShare', { value: () => true, configurable: true });
    const { openShareModal } = await import('../../src/ui/components/shareModal.js');
    await openShareModal(fakeAnalytics(), {});
    const shareBtn = Array.from(document.querySelectorAll('button')).find(b => b.textContent === 'Share…');
    expect(shareBtn.hidden).toBe(false);
    shareBtn.click();
    await vi.waitFor(() => expect(navigator.share).toHaveBeenCalled());
    const callArg = navigator.share.mock.calls[0][0];
    expect(callArg.files[0].name).toBe('ascent-progress.png');
  });

  it('closing the modal removes it from the DOM', async () => {
    Object.defineProperty(navigator, 'clipboard', { value: undefined, configurable: true });
    Object.defineProperty(navigator, 'share', { value: undefined, configurable: true });
    const { openShareModal } = await import('../../src/ui/components/shareModal.js');
    const modal = await openShareModal(fakeAnalytics(), {});
    expect(document.querySelector('.modal-overlay')).not.toBeNull();
    modal.close();
    expect(document.querySelector('.modal-overlay')).toBeNull();
  });
});
