import { describe, it, expect, vi, beforeEach } from 'vitest';
import { openImportRoadmapModal } from '../../src/ui/components/importRoadmapModal.js';

function getOverlay() {
  return document.querySelector('.modal-overlay');
}

function validJsonText() {
  return JSON.stringify({
    schemaVersion: 1,
    title: 'My Roadmap',
    phases: [{
      title: 'Phase One',
      priority: 'P1',
      sections: [{ title: 'Section One', items: ['Topic A', ['Topic B', 'P0']] }]
    }]
  });
}

beforeEach(() => {
  document.body.innerHTML = '';
  vi.useRealTimers();
});

describe('openImportRoadmapModal (issue #4)', () => {
  it('opens on the "Generate with AI" tab by default, with a prompt reflecting the typed topic', () => {
    vi.useFakeTimers();
    openImportRoadmapModal();
    const overlay = getOverlay();
    expect(overlay.querySelector('.import-tab-btn.active').textContent).toBe('Generate with AI');
    expect(overlay.querySelector('.import-prompt-block').textContent).toContain('Generate a roadmap for:');

    const topicInput = overlay.querySelector('textarea');
    topicInput.value = 'Rust for backend engineers';
    topicInput.dispatchEvent(new Event('input'));
    vi.advanceTimersByTime(150);
    expect(overlay.querySelector('.import-prompt-block').textContent).toContain('Rust for backend engineers');
    vi.useRealTimers();
  });

  it('switching to "Paste & Import" hides the generate panel and shows the paste panel', () => {
    openImportRoadmapModal();
    const overlay = getOverlay();
    const [generateBtn, pasteBtn] = overlay.querySelectorAll('.import-tab-btn');

    pasteBtn.click();
    expect(pasteBtn.classList.contains('active')).toBe(true);
    expect(generateBtn.classList.contains('active')).toBe(false);
    expect(overlay.querySelectorAll('.import-tab-panel')[0].style.display).toBe('none');
    expect(overlay.querySelectorAll('.import-tab-panel')[1].style.display).toBe('');
  });

  it('the "Import roadmap" button starts disabled and stays disabled while the pasted text is empty', () => {
    openImportRoadmapModal();
    const overlay = getOverlay();
    const importBtn = [...overlay.querySelectorAll('button')].find(b => b.textContent === 'Import roadmap');
    expect(importBtn.disabled).toBe(true);
  });

  it('pasting invalid JSON shows error messages and keeps the import button disabled', async () => {
    vi.useFakeTimers();
    openImportRoadmapModal();
    const overlay = getOverlay();
    const pasteArea = overlay.querySelector('.import-paste-area');
    const importBtn = [...overlay.querySelectorAll('button')].find(b => b.textContent === 'Import roadmap');

    pasteArea.value = '{not valid json';
    pasteArea.dispatchEvent(new Event('input'));
    vi.advanceTimersByTime(300);

    expect(overlay.querySelector('.import-errors').textContent).toContain('Invalid JSON');
    expect(importBtn.disabled).toBe(true);
    vi.useRealTimers();
  });

  it('pasting valid JSON shows a success message and enables the import button', () => {
    vi.useFakeTimers();
    openImportRoadmapModal();
    const overlay = getOverlay();
    const pasteArea = overlay.querySelector('.import-paste-area');
    const importBtn = [...overlay.querySelectorAll('button')].find(b => b.textContent === 'Import roadmap');

    pasteArea.value = validJsonText();
    pasteArea.dispatchEvent(new Event('input'));
    vi.advanceTimersByTime(300);

    expect(overlay.querySelector('.form-message.success').textContent).toContain('2 topics found');
    expect(importBtn.disabled).toBe(false);
    vi.useRealTimers();
  });

  it('clicking "Import roadmap" after a valid paste resolves { title, phases, items } and closes the modal', async () => {
    vi.useFakeTimers();
    const promise = openImportRoadmapModal();
    const overlay = getOverlay();
    const pasteArea = overlay.querySelector('.import-paste-area');
    const importBtn = [...overlay.querySelectorAll('button')].find(b => b.textContent === 'Import roadmap');

    pasteArea.value = validJsonText();
    pasteArea.dispatchEvent(new Event('input'));
    vi.advanceTimersByTime(300);
    vi.useRealTimers();

    importBtn.click();
    const result = await promise;

    expect(result.title).toBe('My Roadmap');
    expect(result.phases).toHaveLength(1);
    expect(Object.keys(result.items)).toHaveLength(2);
    expect(getOverlay()).toBeNull();
  });

  it('resolves null when Cancel is clicked', async () => {
    const promise = openImportRoadmapModal();
    const overlay = getOverlay();
    [...overlay.querySelectorAll('button')].find(b => b.textContent === 'Cancel').click();
    await expect(promise).resolves.toBeNull();
    expect(getOverlay()).toBeNull();
  });

  it('resolves null on Escape', async () => {
    const promise = openImportRoadmapModal();
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    await expect(promise).resolves.toBeNull();
  });

  it('resolves null on outside click', async () => {
    const promise = openImportRoadmapModal();
    getOverlay().click();
    await expect(promise).resolves.toBeNull();
  });

  it('the "Copy prompt" button copies the current prompt text via navigator.clipboard', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.assign(navigator, { clipboard: { writeText } });

    openImportRoadmapModal();
    const overlay = getOverlay();
    const copyBtn = [...overlay.querySelectorAll('button')].find(b => b.textContent.includes('Copy prompt'));
    copyBtn.click();
    await Promise.resolve();

    expect(writeText).toHaveBeenCalledWith(overlay.querySelector('.import-prompt-block').textContent);
  });
});
