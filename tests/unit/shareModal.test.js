import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

vi.mock('../../src/ui/components/shareCard.js', () => ({
  generateShareCard: vi.fn(async () => {
    const canvas = document.createElement('canvas');
    canvas.width = 1200;
    canvas.height = 630;
    canvas.toBlob = cb => cb(new Blob(['fake-png'], { type: 'image/png' }));
    return canvas;
  }),
  generateBadgeCard: vi.fn(async () => {
    const canvas = document.createElement('canvas');
    canvas.width = 1200;
    canvas.height = 630;
    canvas.toBlob = cb => cb(new Blob(['fake-png'], { type: 'image/png' }));
    return canvas;
  }),
  shareSiteUrl: () => 'localhost:4173'
}));

function fakeAnalytics() {
  return {
    overview: { total: 340, done: 128, pct: 38 },
    streaks: { current: 14, longest: 21 },
    velocity: 4.2,
    phaseBreakdown: [{ phase: 'Java', done: 1, total: 2, pct: 50 }, { phase: 'Spring', done: 0, total: 1, pct: 0 }]
  };
}

function fakeStore(overrides = {}) {
  return {
    getSnapshot: () => ({ activeTemplateId: 'java-backend', customRoadmaps: [] }),
    getAllRoadmapsSummary: vi.fn(async () => ({ roadmaps: [{ id: 'java-backend', title: 'Java Backend Engineer', done: 128, total: 340 }], done: 128, total: 340 })),
    ...overrides
  };
}

function fakeDailyTodoStore(overrides = {}) {
  return {
    getSnapshot: () => ({ todos: [{ id: '1', done: true }, { id: '2', done: false }] }),
    ...overrides
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
  it('renders the true-size preview canvas and a pre-filled, editable caption', async () => {
    const { openShareModal } = await import('../../src/ui/components/shareModal.js');
    await openShareModal({ store: fakeStore(), dailyTodoStore: fakeDailyTodoStore(), analytics: fakeAnalytics(), activityLog: {} });
    const canvas = document.querySelector('.share-card-preview');
    expect(canvas).not.toBeNull();
    expect(canvas.width).toBe(1200);
    expect(canvas.height).toBe(630);
    const caption = document.querySelector('.share-caption-input');
    expect(caption.value).toMatch(/38% done/);
    caption.value = 'edited caption';
    expect(caption.value).toBe('edited caption');
  });

  it('defaults to the "This roadmap" scope with four scope options rendered', async () => {
    const { openShareModal } = await import('../../src/ui/components/shareModal.js');
    await openShareModal({ store: fakeStore(), dailyTodoStore: fakeDailyTodoStore(), analytics: fakeAnalytics(), activityLog: {} });
    const options = document.querySelectorAll('.share-scope-option');
    expect(options.length).toBe(4);
    const checked = document.querySelector('.share-scope-input:checked');
    expect(checked.value).toBe('roadmap');
  });

  it('switching to "All my roadmaps together" calls getAllRoadmapsSummary and regenerates the card', async () => {
    const store = fakeStore();
    const { openShareModal } = await import('../../src/ui/components/shareModal.js');
    await openShareModal({ store, dailyTodoStore: fakeDailyTodoStore(), analytics: fakeAnalytics(), activityLog: {} });
    const allInput = Array.from(document.querySelectorAll('.share-scope-input')).find(i => i.value === 'all');
    allInput.checked = true;
    allInput.dispatchEvent(new Event('change'));
    await vi.waitFor(() => expect(store.getAllRoadmapsSummary).toHaveBeenCalled());
  });

  it('switching to "A single phase" reveals a phase picker', async () => {
    const { openShareModal } = await import('../../src/ui/components/shareModal.js');
    await openShareModal({ store: fakeStore(), dailyTodoStore: fakeDailyTodoStore(), analytics: fakeAnalytics(), activityLog: {} });
    expect(document.querySelector('.share-phase-select-slot').children.length).toBe(0);
    const phaseInput = Array.from(document.querySelectorAll('.share-scope-input')).find(i => i.value === 'phase');
    phaseInput.checked = true;
    phaseInput.dispatchEvent(new Event('change'));
    await vi.waitFor(() => expect(document.querySelector('.share-phase-select-slot').children.length).toBeGreaterThan(0));
  });

  it('renders five "Show on the card" toggles, all on by default', async () => {
    const { openShareModal } = await import('../../src/ui/components/shareModal.js');
    await openShareModal({ store: fakeStore(), dailyTodoStore: fakeDailyTodoStore(), analytics: fakeAnalytics(), activityLog: {} });
    const toggles = document.querySelectorAll('.switch-input[role="switch"]');
    expect(toggles.length).toBe(5);
    toggles.forEach(t => expect(t.checked).toBe(true));
  });

  it('renders a light/dark/green card-style control', async () => {
    const { openShareModal } = await import('../../src/ui/components/shareModal.js');
    await openShareModal({ store: fakeStore(), dailyTodoStore: fakeDailyTodoStore(), analytics: fakeAnalytics(), activityLog: {} });
    const segItems = Array.from(document.querySelectorAll('.seg-item')).map(b => b.textContent);
    expect(segItems).toEqual(['Light', 'Dark', 'Green']);
  });

  it('renders 8 "Post it" share targets', async () => {
    const { openShareModal } = await import('../../src/ui/components/shareModal.js');
    await openShareModal({ store: fakeStore(), dailyTodoStore: fakeDailyTodoStore(), analytics: fakeAnalytics(), activityLog: {} });
    const targets = document.querySelectorAll('.share-target-btn');
    expect(targets.length).toBe(8);
    const names = Array.from(targets).map(a => a.textContent.trim());
    ['X', 'LinkedIn', 'WhatsApp', 'Threads', 'Reddit', 'Telegram', 'Facebook', 'Email'].forEach(name => {
      expect(names.some(n => n.includes(name))).toBe(true);
    });
  });

  it('clicking a hashtag chip appends it to the caption', async () => {
    const { openShareModal } = await import('../../src/ui/components/shareModal.js');
    await openShareModal({ store: fakeStore(), dailyTodoStore: fakeDailyTodoStore(), analytics: fakeAnalytics(), activityLog: {} });
    const caption = document.querySelector('.share-caption-input');
    const before = caption.value;
    const chip = document.querySelector('.share-hashtag-row .tag-chip');
    chip.click();
    expect(caption.value).toContain(chip.textContent);
    expect(caption.value.length).toBeGreaterThanOrEqual(before.length);
  });

  it('"Suggest another" cycles the caption preset', async () => {
    const { openShareModal } = await import('../../src/ui/components/shareModal.js');
    await openShareModal({ store: fakeStore(), dailyTodoStore: fakeDailyTodoStore(), analytics: fakeAnalytics(), activityLog: {} });
    const caption = document.querySelector('.share-caption-input');
    const before = caption.value;
    const suggestBtn = Array.from(document.querySelectorAll('button')).find(b => b.textContent === 'Suggest another');
    suggestBtn.click();
    expect(caption.value).not.toBe(before);
  });

  it('Download the image triggers a download of ascent-progress.png', async () => {
    Object.defineProperty(navigator, 'clipboard', { value: undefined, configurable: true });
    Object.defineProperty(navigator, 'share', { value: undefined, configurable: true });
    const { openShareModal } = await import('../../src/ui/components/shareModal.js');
    await openShareModal({ store: fakeStore(), dailyTodoStore: fakeDailyTodoStore(), analytics: fakeAnalytics(), activityLog: {} });

    const clickSpy = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});
    const createObjectURLSpy = vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:fake');
    const revokeSpy = vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {});

    const downloadBtn = Array.from(document.querySelectorAll('button')).find(b => b.textContent.includes('Download the image'));
    downloadBtn.click();
    await vi.waitFor(() => expect(clickSpy).toHaveBeenCalled());
    expect(createObjectURLSpy).toHaveBeenCalled();
    expect(revokeSpy).toHaveBeenCalled();

    clickSpy.mockRestore();
    createObjectURLSpy.mockRestore();
    revokeSpy.mockRestore();
  });

  it('hides Copy image when the Clipboard image API is unsupported', async () => {
    Object.defineProperty(navigator, 'clipboard', { value: undefined, configurable: true });
    const { openShareModal } = await import('../../src/ui/components/shareModal.js');
    await openShareModal({ store: fakeStore(), dailyTodoStore: fakeDailyTodoStore(), analytics: fakeAnalytics(), activityLog: {} });
    const copyBtn = Array.from(document.querySelectorAll('button')).find(b => b.textContent === 'Copy image');
    expect(copyBtn.hidden).toBe(true);
  });

  it('shows Copy image and calls clipboard.write when supported', async () => {
    window.ClipboardItem = class ClipboardItem {};
    Object.defineProperty(navigator, 'clipboard', { value: { write: vi.fn(() => Promise.resolve()), writeText: vi.fn(() => Promise.resolve()) }, configurable: true });
    const { openShareModal } = await import('../../src/ui/components/shareModal.js');
    await openShareModal({ store: fakeStore(), dailyTodoStore: fakeDailyTodoStore(), analytics: fakeAnalytics(), activityLog: {} });
    const copyBtn = Array.from(document.querySelectorAll('button')).find(b => b.textContent === 'Copy image');
    expect(copyBtn.hidden).toBe(false);
    copyBtn.click();
    await vi.waitFor(() => expect(navigator.clipboard.write).toHaveBeenCalled());
  });

  it('Copy link copies the stripped host link when supported', async () => {
    Object.defineProperty(navigator, 'clipboard', { value: { writeText: vi.fn(() => Promise.resolve()) }, configurable: true });
    const { openShareModal } = await import('../../src/ui/components/shareModal.js');
    await openShareModal({ store: fakeStore(), dailyTodoStore: fakeDailyTodoStore(), analytics: fakeAnalytics(), activityLog: {} });
    const copyLinkBtn = Array.from(document.querySelectorAll('button')).find(b => b.textContent === 'Copy link');
    copyLinkBtn.click();
    await vi.waitFor(() => expect(navigator.clipboard.writeText).toHaveBeenCalledWith('https://localhost:4173'));
  });

  it('closing the modal removes it from the DOM', async () => {
    Object.defineProperty(navigator, 'clipboard', { value: undefined, configurable: true });
    const { openShareModal } = await import('../../src/ui/components/shareModal.js');
    const modal = await openShareModal({ store: fakeStore(), dailyTodoStore: fakeDailyTodoStore(), analytics: fakeAnalytics(), activityLog: {} });
    expect(document.querySelector('.modal-overlay')).not.toBeNull();
    modal.close();
    expect(document.querySelector('.modal-overlay')).toBeNull();
  });
});

describe('openBadgeShareModal', () => {
  it('renders the canvas and a pre-filled caption', async () => {
    Object.defineProperty(navigator, 'clipboard', { value: undefined, configurable: true });
    Object.defineProperty(navigator, 'share', { value: undefined, configurable: true });
    const { openBadgeShareModal } = await import('../../src/ui/components/shareModal.js');
    await openBadgeShareModal('roadmap', 'Java Backend Engineer');
    const canvas = document.querySelector('.share-card-preview');
    expect(canvas).not.toBeNull();
    const caption = document.querySelector('.share-caption-input');
    expect(caption.value).toMatch(/Java Backend Engineer/);
  });
});
