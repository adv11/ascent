import { describe, it, expect, vi, beforeEach } from 'vitest';
import { openImportRoadmapModal } from '../../src/ui/components/importRoadmapModal.js';

function getOverlay() {
  return document.querySelector('.modal-overlay');
}

function findButton(overlay, text) {
  return [...overlay.querySelectorAll('button')].find(b => b.textContent === text);
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

describe('openImportRoadmapModal (issue #4, collapsed to one flow in issue #64)', () => {
  it('renders the generate controls and the paste textarea together on open, with no tabs or hidden panels', () => {
    openImportRoadmapModal();
    const overlay = getOverlay();

    expect(overlay.querySelector('.import-tab-btn')).toBeNull();
    expect(overlay.querySelector('.import-prompt-block').textContent).toContain('Generate a roadmap for:');
    expect(overlay.querySelector('.import-paste-area')).not.toBeNull();

    const panels = overlay.querySelectorAll('.import-tab-panel');
    panels.forEach(panel => expect(panel.style.display).not.toBe('none'));
  });

  it('typing a topic updates the copyable prompt', () => {
    vi.useFakeTimers();
    openImportRoadmapModal();
    const overlay = getOverlay();
    const topicInput = overlay.querySelector('textarea.field-input');
    topicInput.value = 'Rust for backend engineers';
    topicInput.dispatchEvent(new Event('input'));
    vi.advanceTimersByTime(150);
    expect(overlay.querySelector('.import-prompt-block').textContent).toContain('Rust for backend engineers');
    vi.useRealTimers();
  });

  it('selecting an experience level chip updates the prompt and toggles off on a second click', () => {
    openImportRoadmapModal();
    const overlay = getOverlay();
    const beginnerChip = [...overlay.querySelectorAll('.import-option-chips button')].find(b => b.textContent === 'Beginner');

    beginnerChip.click();
    expect(overlay.querySelector('.import-prompt-block').textContent).toContain('Experience level: Beginner');
    expect(beginnerChip.classList.contains('active')).toBe(true);

    beginnerChip.click();
    expect(overlay.querySelector('.import-prompt-block').textContent).not.toContain('Experience level:');
    expect(beginnerChip.classList.contains('active')).toBe(false);
  });

  it('selecting a timeframe chip and a goal updates the prompt', () => {
    openImportRoadmapModal();
    const overlay = getOverlay();
    const oneMonthChip = [...overlay.querySelectorAll('.import-option-chips button')].find(b => b.textContent === '1 month');
    oneMonthChip.click();
    expect(overlay.querySelector('.import-prompt-block').textContent).toContain('Target timeframe: 1 month');

    const goalSelect = overlay.querySelector('select.field-input');
    goalSelect.value = 'Interview prep';
    goalSelect.dispatchEvent(new Event('change'));
    expect(overlay.querySelector('.import-prompt-block').textContent).toContain('Goal / context: Interview prep');
  });

  it('typing "already know" text updates the prompt', () => {
    vi.useFakeTimers();
    openImportRoadmapModal();
    const overlay = getOverlay();
    const alreadyKnowInput = overlay.querySelectorAll('input.field-input')[0];
    alreadyKnowInput.value = 'already comfortable with Docker';
    alreadyKnowInput.dispatchEvent(new Event('input'));
    vi.advanceTimersByTime(150);
    expect(overlay.querySelector('.import-prompt-block').textContent).toContain('Already know: already comfortable with Docker');
    vi.useRealTimers();
  });

  it('the "Import roadmap" button starts disabled and stays disabled while the pasted text is empty', () => {
    openImportRoadmapModal();
    const overlay = getOverlay();
    const importBtn = findButton(overlay, 'Import roadmap');
    expect(importBtn.disabled).toBe(true);
  });

  it('pasting invalid JSON shows error messages and keeps the import button disabled', async () => {
    vi.useFakeTimers();
    openImportRoadmapModal();
    const overlay = getOverlay();
    const pasteArea = overlay.querySelector('.import-paste-area');
    const importBtn = findButton(overlay, 'Import roadmap');

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
    const importBtn = findButton(overlay, 'Import roadmap');

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
    const importBtn = findButton(overlay, 'Import roadmap');

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
    findButton(overlay, 'Cancel').click();
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
    const copyBtn = findButton(overlay, 'Copy prompt');
    copyBtn.click();
    await Promise.resolve();

    expect(writeText).toHaveBeenCalledWith(overlay.querySelector('.import-prompt-block').textContent);
  });
});
