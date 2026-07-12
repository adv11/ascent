import { describe, it, expect, vi, beforeEach } from 'vitest';
import { openCreateRoadmapModal } from '../../src/ui/components/importRoadmapModal.js';

function getOverlay() {
  return document.querySelector('.modal-overlay');
}

function findButton(overlay, text) {
  return [...overlay.querySelectorAll('button')].find(b => b.textContent === text);
}

function setTopic(overlay, text) {
  const topicInput = overlay.querySelector('textarea.field-input');
  topicInput.value = text;
  topicInput.dispatchEvent(new Event('input'));
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

describe('openCreateRoadmapModal — two-column layout (issue #100)', () => {
  it('renders both the build column and the paste column together on open, with no tabs or hidden panels', () => {
    openCreateRoadmapModal();
    const overlay = getOverlay();

    expect(overlay.querySelector('.import-tab-btn')).toBeNull();
    expect(overlay.querySelector('.import-column-build')).not.toBeNull();
    expect(overlay.querySelector('.import-column-paste')).not.toBeNull();
    expect(overlay.querySelector('.import-prompt-block').textContent).toContain('Generate a roadmap for:');
    expect(overlay.querySelector('.import-paste-area')).not.toBeNull();
  });

  it('the Import/Cancel actions live in a shared footer outside either column', () => {
    openCreateRoadmapModal();
    const overlay = getOverlay();
    const footer = overlay.querySelector('.import-modal-footer');
    expect(footer).not.toBeNull();
    expect(footer.contains(findButton(overlay, 'Import roadmap'))).toBe(true);
    expect(footer.contains(findButton(overlay, 'Cancel'))).toBe(true);
  });
});

describe('openCreateRoadmapModal — build-your-prompt column', () => {
  it('typing a topic updates the copyable prompt', () => {
    vi.useFakeTimers();
    openCreateRoadmapModal();
    const overlay = getOverlay();
    setTopic(overlay, 'Rust for backend engineers');
    vi.advanceTimersByTime(150);
    expect(overlay.querySelector('.import-prompt-block').textContent).toContain('Rust for backend engineers');
    vi.useRealTimers();
  });

  it('selecting an experience level chip updates the prompt and toggles off on a second click', () => {
    openCreateRoadmapModal();
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
    openCreateRoadmapModal();
    const overlay = getOverlay();
    const oneMonthChip = [...overlay.querySelectorAll('.import-option-chips button')].find(b => b.textContent === '1 month');
    oneMonthChip.click();
    expect(overlay.querySelector('.import-prompt-block').textContent).toContain('Target timeframe: 1 month');

    // issue #136 Phase 3 — goalSelect is now a custom-styled listbox
    // (select.js), not a native <select>.
    const goalSelect = overlay.querySelector('.custom-select');
    goalSelect.value = 'Interview prep';
    goalSelect.dispatchEvent(new Event('change'));
    expect(overlay.querySelector('.import-prompt-block').textContent).toContain('Goal / context: Interview prep');
  });

  it('typing "already know" text updates the prompt', () => {
    vi.useFakeTimers();
    openCreateRoadmapModal();
    const overlay = getOverlay();
    const alreadyKnowInput = overlay.querySelectorAll('input.field-input')[0];
    alreadyKnowInput.value = 'already comfortable with Docker';
    alreadyKnowInput.dispatchEvent(new Event('input'));
    vi.advanceTimersByTime(150);
    expect(overlay.querySelector('.import-prompt-block').textContent).toContain('Already know: already comfortable with Docker');
    vi.useRealTimers();
  });

  it('"Copy prompt" is disabled when the topic is empty or whitespace-only', () => {
    vi.useFakeTimers();
    openCreateRoadmapModal();
    const overlay = getOverlay();
    const copyBtn = findButton(overlay, 'Copy prompt');
    expect(copyBtn.disabled).toBe(true);

    setTopic(overlay, '   ');
    vi.advanceTimersByTime(150);
    expect(copyBtn.disabled).toBe(true);
    vi.useRealTimers();
  });

  it('"Copy prompt" enables once the topic is non-empty', () => {
    vi.useFakeTimers();
    openCreateRoadmapModal();
    const overlay = getOverlay();
    setTopic(overlay, 'Kubernetes for backend engineers');
    vi.advanceTimersByTime(150);
    expect(findButton(overlay, 'Copy prompt').disabled).toBe(false);
    vi.useRealTimers();
  });

  it('selecting a weekly time commitment chip updates the prompt', () => {
    openCreateRoadmapModal();
    const overlay = getOverlay();
    const chip = [...overlay.querySelectorAll('.import-option-chips button')].find(b => b.textContent === '2–5 hrs/week');
    chip.click();
    expect(overlay.querySelector('.import-prompt-block').textContent).toContain('Weekly time commitment: 2–5 hrs/week');
  });

  it('selecting multiple "Preferred resource types" chips keeps them all active and lists them together', () => {
    openCreateRoadmapModal();
    const overlay = getOverlay();
    const youtube = [...overlay.querySelectorAll('.import-option-chips button')].find(b => b.textContent === 'YouTube videos');
    const docs = [...overlay.querySelectorAll('.import-option-chips button')].find(b => b.textContent === 'Official docs');

    youtube.click();
    docs.click();
    expect(youtube.classList.contains('active')).toBe(true);
    expect(docs.classList.contains('active')).toBe(true);
    expect(overlay.querySelector('.import-prompt-block').textContent).toContain('Preferred resource types: YouTube videos, Official docs');

    youtube.click();
    expect(youtube.classList.contains('active')).toBe(false);
    expect(docs.classList.contains('active')).toBe(true);
    expect(overlay.querySelector('.import-prompt-block').textContent).toContain('Preferred resource types: Official docs');
    expect(overlay.querySelector('.import-prompt-block').textContent).not.toContain('YouTube videos');
  });

  it('the "Copy prompt" button copies the current prompt text via navigator.clipboard once enabled', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.assign(navigator, { clipboard: { writeText } });
    vi.useFakeTimers();

    openCreateRoadmapModal();
    const overlay = getOverlay();
    setTopic(overlay, 'Kubernetes for backend engineers');
    vi.advanceTimersByTime(150);
    vi.useRealTimers();

    const copyBtn = findButton(overlay, 'Copy prompt');
    copyBtn.click();
    await Promise.resolve();

    expect(writeText).toHaveBeenCalledWith(overlay.querySelector('.import-prompt-block').textContent);
  });
});

describe('openCreateRoadmapModal — always-visible "Copy it" step (issue #100 revamp)', () => {
  it('the copy step (heading + button + hint) renders outside the scrollable prompt/filters area', () => {
    openCreateRoadmapModal();
    const overlay = getOverlay();
    const scrollArea = overlay.querySelector('.import-column-scroll');
    const stickyBlock = overlay.querySelector('.import-copy-sticky');
    expect(stickyBlock).not.toBeNull();
    expect(scrollArea.contains(stickyBlock)).toBe(false);
    expect(stickyBlock.contains(findButton(overlay, 'Copy prompt'))).toBe(true);
  });

  it('every step heading carries a numbered badge', () => {
    openCreateRoadmapModal();
    const overlay = getOverlay();
    const headings = [...overlay.querySelectorAll('.import-step-heading')];
    expect(headings.length).toBeGreaterThanOrEqual(6);
    const badgeNumbers = headings.map(h => h.querySelector('.import-step-badge')?.textContent);
    expect(badgeNumbers).toEqual(['1', '2', '3', '4', '5', '6']);
  });
});

describe('openCreateRoadmapModal — paste-and-import column', () => {
  it('the "Import roadmap" button starts disabled and stays disabled while the pasted text is empty', () => {
    openCreateRoadmapModal();
    const overlay = getOverlay();
    const importBtn = findButton(overlay, 'Import roadmap');
    expect(importBtn.disabled).toBe(true);
  });

  it('pasting invalid JSON shows a plain-language summary, a collapsed technical list, and a fix-it button; keeps import disabled', async () => {
    vi.useFakeTimers();
    openCreateRoadmapModal();
    const overlay = getOverlay();
    const pasteArea = overlay.querySelector('.import-paste-area');
    const importBtn = findButton(overlay, 'Import roadmap');

    pasteArea.value = '{not valid json';
    pasteArea.dispatchEvent(new Event('input'));
    vi.advanceTimersByTime(300);

    expect(overlay.querySelector('.form-message.error').textContent).toMatch(/need.*fixing/i);
    expect(overlay.querySelector('.import-errors').hidden).toBe(true);
    expect(overlay.querySelector('.import-errors').textContent).toContain('Invalid JSON');
    expect(findButton(overlay, 'Show technical details')).not.toBeNull();
    expect(findButton(overlay, "Copy fix-it message for your AI")).not.toBeNull();
    expect(importBtn.disabled).toBe(true);
    vi.useRealTimers();
  });

  it('pasting a corrupted (markdown-linkified) payload shows the ChatGPT-specific copy-button hint (issue #121 item 1)', async () => {
    vi.useFakeTimers();
    openCreateRoadmapModal();
    const overlay = getOverlay();
    const pasteArea = overlay.querySelector('.import-paste-area');

    const { CHATGPT_CORRUPTED_PAYLOAD } = await import('./fixtures/chatgptCorruptedPayload.js');
    pasteArea.value = CHATGPT_CORRUPTED_PAYLOAD;
    pasteArea.dispatchEvent(new Event('input'));
    vi.advanceTimersByTime(300);

    const hint = overlay.querySelector('.import-corruption-hint');
    expect(hint.hidden).toBe(false);
    expect(hint.textContent).toContain('copy-code button');
    vi.useRealTimers();
  });

  it('pasting ordinary invalid JSON (not a corruption case) does not show the ChatGPT-specific hint', () => {
    vi.useFakeTimers();
    openCreateRoadmapModal();
    const overlay = getOverlay();
    const pasteArea = overlay.querySelector('.import-paste-area');
    pasteArea.value = '{not valid json';
    pasteArea.dispatchEvent(new Event('input'));
    vi.advanceTimersByTime(300);

    expect(overlay.querySelector('.import-corruption-hint').hidden).toBe(true);
    vi.useRealTimers();
  });

  it('"Show technical details" reveals the technical error list', () => {
    vi.useFakeTimers();
    openCreateRoadmapModal();
    const overlay = getOverlay();
    const pasteArea = overlay.querySelector('.import-paste-area');
    pasteArea.value = '{not valid json';
    pasteArea.dispatchEvent(new Event('input'));
    vi.advanceTimersByTime(300);

    findButton(overlay, 'Show technical details').click();
    expect(overlay.querySelector('.import-errors').hidden).toBe(false);
    vi.useRealTimers();
  });

  it('"Copy fix-it message for your AI" copies a non-empty fix-it prompt to the clipboard', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.assign(navigator, { clipboard: { writeText } });
    vi.useFakeTimers();

    openCreateRoadmapModal();
    const overlay = getOverlay();
    const pasteArea = overlay.querySelector('.import-paste-area');
    pasteArea.value = '{not valid json';
    pasteArea.dispatchEvent(new Event('input'));
    vi.advanceTimersByTime(300);
    vi.useRealTimers();

    findButton(overlay, "Copy fix-it message for your AI").click();
    await Promise.resolve();

    expect(writeText).toHaveBeenCalled();
    expect(writeText.mock.calls[0][0].length).toBeGreaterThan(0);
  });

  it('pasting valid JSON shows a success message and enables the import button', () => {
    vi.useFakeTimers();
    openCreateRoadmapModal();
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

  it('pasting a fenced-code-block-wrapped valid payload still imports successfully', () => {
    vi.useFakeTimers();
    openCreateRoadmapModal();
    const overlay = getOverlay();
    const pasteArea = overlay.querySelector('.import-paste-area');
    const importBtn = findButton(overlay, 'Import roadmap');

    pasteArea.value = '```json\n' + validJsonText() + '\n```';
    pasteArea.dispatchEvent(new Event('input'));
    vi.advanceTimersByTime(300);

    expect(importBtn.disabled).toBe(false);
    vi.useRealTimers();
  });

  it('clicking "Import roadmap" after a valid paste resolves { title, phases, items } and closes the modal', async () => {
    vi.useFakeTimers();
    const promise = openCreateRoadmapModal();
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
    const promise = openCreateRoadmapModal();
    const overlay = getOverlay();
    findButton(overlay, 'Cancel').click();
    await expect(promise).resolves.toBeNull();
    expect(getOverlay()).toBeNull();
  });

  it('resolves null on Escape', async () => {
    const promise = openCreateRoadmapModal();
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    await expect(promise).resolves.toBeNull();
  });

  it('resolves null on outside click', async () => {
    const promise = openCreateRoadmapModal();
    getOverlay().click();
    await expect(promise).resolves.toBeNull();
  });
});
