import { describe, it, expect, beforeEach, vi } from 'vitest';
import { openItemPanel } from '../../src/ui/components/itemPanel.js';

const baseItem = {
  id: 'seed-0-0-0',
  title: 'Virtual Threads',
  phase: 'Java Core',
  section: 'Concurrency',
  priority: 'P1',
  resources: [],
  notes: ''
};

function getPanel() {
  return document.querySelector('.item-panel');
}

beforeEach(() => {
  document.body.innerHTML = '';
});

describe('itemPanel — notes field (issue #15)', () => {
  it('renders the notes textarea pre-filled with the item\'s existing notes', () => {
    openItemPanel({ item: { ...baseItem, notes: 'Existing note' } });
    expect(getPanel().querySelector('.notes-textarea').value).toBe('Existing note');
  });

  it('reads a missing notes field as empty string with no crash', () => {
    const itemWithoutNotes = { ...baseItem };
    delete itemWithoutNotes.notes;
    expect(() => openItemPanel({ item: itemWithoutNotes })).not.toThrow();
    expect(getPanel().querySelector('.notes-textarea').value).toBe('');
  });

  it('caps input at 5000 chars via the textarea\'s native maxlength', () => {
    openItemPanel({ item: baseItem });
    const textarea = getPanel().querySelector('.notes-textarea');
    expect(textarea.getAttribute('maxlength')).toBe('5000');
  });

  it('shows the character counter only once past 80% of the 5000 char limit', () => {
    openItemPanel({ item: baseItem });
    const textarea = getPanel().querySelector('.notes-textarea');
    const counter = getPanel().querySelector('.notes-counter');

    textarea.value = 'a'.repeat(100);
    textarea.dispatchEvent(new Event('input'));
    expect(counter.textContent).toBe('');

    textarea.value = 'a'.repeat(4001);
    textarea.dispatchEvent(new Event('input'));
    expect(counter.textContent).toBe('4001 / 5000');
  });

  it('debounces a 800ms autosave and calls onSave with only { notes }', () => {
    vi.useFakeTimers();
    const onSave = vi.fn();
    openItemPanel({ item: baseItem, onSave });
    const textarea = getPanel().querySelector('.notes-textarea');

    textarea.value = 'New note content';
    textarea.dispatchEvent(new Event('input'));
    expect(onSave).not.toHaveBeenCalled();

    vi.advanceTimersByTime(799);
    expect(onSave).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1);
    expect(onSave).toHaveBeenCalledWith({ notes: 'New note content' });
    vi.useRealTimers();
  });

  it('shows "Autosaved" (with a checkmark icon) after the debounced save, then fades it out after 1.5s', () => {
    vi.useFakeTimers();
    openItemPanel({ item: baseItem, onSave: vi.fn() });
    const textarea = getPanel().querySelector('.notes-textarea');
    const status = getPanel().querySelector('.notes-status');

    textarea.value = 'Saved soon';
    textarea.dispatchEvent(new Event('input'));
    vi.advanceTimersByTime(800);

    // issue #136 Phase 2 follow-up — the checkmark is now a createIcon() svg
    // sibling, not part of the text string.
    expect(status.textContent.trim()).toBe('Autosaved');
    expect(status.querySelector('svg')).not.toBeNull();
    expect(status.classList.contains('show')).toBe(true);

    vi.advanceTimersByTime(1500);
    expect(status.classList.contains('show')).toBe(false);
    vi.useRealTimers();
  });

  it('shows an amber failure message when the autosave callback throws', () => {
    vi.useFakeTimers();
    const onSave = vi.fn(() => { throw new Error('offline'); });
    openItemPanel({ item: baseItem, onSave });
    const textarea = getPanel().querySelector('.notes-textarea');
    const status = getPanel().querySelector('.notes-status');

    textarea.value = 'Will fail';
    textarea.dispatchEvent(new Event('input'));
    vi.advanceTimersByTime(800);

    expect(status.textContent).toBe('Failed to save — check connection');
    expect(status.classList.contains('error')).toBe(true);
    vi.useRealTimers();
  });

  it('flushes a pending notes edit immediately on close instead of losing it to the debounce window', () => {
    vi.useFakeTimers();
    const onSave = vi.fn();
    openItemPanel({ item: baseItem, onSave });
    const textarea = getPanel().querySelector('.notes-textarea');

    textarea.value = 'Closed before debounce fired';
    textarea.dispatchEvent(new Event('input'));
    getPanel().querySelector('.panel-footer-right button').click(); // Cancel

    expect(onSave).toHaveBeenCalledWith({ notes: 'Closed before debounce fired' });
    vi.useRealTimers();
  });

  it('focuses the title input by default, and the notes textarea when focusField is "notes"', async () => {
    openItemPanel({ item: baseItem, focusField: 'notes' });
    await new Promise(resolve => requestAnimationFrame(resolve));
    expect(document.activeElement).toBe(getPanel().querySelector('.notes-textarea'));
  });
});

describe('itemPanel — resource card UI (issue #12B Phase 2/4)', () => {
  it('renders a link-type badge per resource, detected from its URL', () => {
    openItemPanel({
      item: {
        ...baseItem,
        resources: [
          { label: 'Tutorial', url: 'https://www.youtube.com/watch?v=abc' },
          { label: 'Repo', url: 'https://github.com/adv11/SwitchPrep' }
        ]
      }
    });
    const badges = getPanel().querySelectorAll('.resource-card .link-badge');
    expect(badges).toHaveLength(2);
    expect(badges[0].textContent).toContain('YouTube');
    expect(badges[0].classList.contains('link-badge-youtube')).toBe(true);
    expect(badges[1].textContent).toContain('GitHub');
    expect(badges[1].classList.contains('link-badge-github')).toBe(true);
  });

  it('shows an inline warning when an existing resource URL is edited to something invalid, on blur', () => {
    openItemPanel({
      item: { ...baseItem, resources: [{ label: 'Docs', url: 'https://example.com' }] }
    });
    const urlInput = getPanel().querySelector('.resource-card input[aria-label="Docs URL"]');
    const warning = getPanel().querySelector('.resource-url-warning');
    expect(warning.textContent).toBe('');

    urlInput.value = 'javascript:alert(1)';
    urlInput.dispatchEvent(new Event('input'));
    urlInput.dispatchEvent(new Event('blur'));
    expect(warning.textContent).toBe('Enter a valid http or https URL.');
  });

  it('clears the inline warning once the URL is edited back to something valid', () => {
    openItemPanel({
      item: { ...baseItem, resources: [{ label: 'Docs', url: 'https://example.com' }] }
    });
    const urlInput = getPanel().querySelector('.resource-card input[aria-label="Docs URL"]');
    urlInput.value = 'not-a-url';
    urlInput.dispatchEvent(new Event('input'));
    urlInput.dispatchEvent(new Event('blur'));
    expect(getPanel().querySelector('.resource-url-warning').textContent).not.toBe('');

    urlInput.value = 'https://valid-again.com';
    urlInput.dispatchEvent(new Event('input'));
    urlInput.dispatchEvent(new Event('blur'));
    expect(getPanel().querySelector('.resource-url-warning').textContent).toBe('');
  });
});

describe('itemPanel — unique resource aria-labels (issue #124)', () => {
  it('gives each resource row a distinct URL and label aria-label, incorporating the resource\'s own label', () => {
    openItemPanel({
      item: {
        ...baseItem,
        resources: [
          { label: 'Docs', url: 'https://example.com' },
          { label: 'Tutorial', url: 'https://example.com/2' }
        ]
      }
    });
    const urlInputs = getPanel().querySelectorAll('.resource-card input.compact:not(.resource-label-input)');
    const labelInputs = getPanel().querySelectorAll('.resource-label-input');

    expect(urlInputs[0].getAttribute('aria-label')).toBe('Docs URL');
    expect(urlInputs[1].getAttribute('aria-label')).toBe('Tutorial URL');
    expect(urlInputs[0].getAttribute('aria-label')).not.toBe(urlInputs[1].getAttribute('aria-label'));

    expect(labelInputs[0].getAttribute('aria-label')).toBe('Resource 1 label');
    expect(labelInputs[1].getAttribute('aria-label')).toBe('Resource 2 label');
  });

  it('falls back to a positional aria-label for a resource with no label text yet', () => {
    openItemPanel({
      item: { ...baseItem, resources: [{ label: '', url: 'https://example.com' }] }
    });
    const urlInput = getPanel().querySelector('.resource-card input.compact:not(.resource-label-input)');
    expect(urlInput.getAttribute('aria-label')).toBe('Resource 1 URL');
  });
});

describe('itemPanel — time tracking (issue #180)', () => {
  beforeEach(() => {
    vi.useRealTimers();
  });

  it('shows "0s" for an item with no timeSpentSeconds yet', () => {
    openItemPanel({ item: baseItem });
    expect(getPanel().querySelector('.timer-display').textContent).toBe('0s');
  });

  it('shows the formatted existing total', () => {
    openItemPanel({ item: { ...baseItem, timeSpentSeconds: 125 } });
    expect(getPanel().querySelector('.timer-display').textContent).toBe('2m');
  });

  it('starting the timer swaps the button to a "Pause" state', () => {
    openItemPanel({ item: baseItem });
    const btn = getPanel().querySelector('.timer-toggle-btn');
    btn.click();
    expect(btn.classList.contains('active')).toBe(true);
    expect(btn.getAttribute('aria-label')).toBe('Pause timer');
  });

  it('start -> pause calls onSave with the accumulated timeSpentSeconds', () => {
    vi.useFakeTimers();
    vi.setSystemTime(0);
    const onSave = vi.fn();
    openItemPanel({ item: baseItem, onSave });
    const btn = getPanel().querySelector('.timer-toggle-btn');

    btn.click();
    vi.setSystemTime(30000);
    btn.click();

    expect(onSave).toHaveBeenCalledWith({ timeSpentSeconds: 30 });
    expect(btn.classList.contains('active')).toBe(false);
    vi.useRealTimers();
  });

  it('a second start/pause session adds to the running total instead of overwriting it', () => {
    vi.useFakeTimers();
    vi.setSystemTime(0);
    const onSave = vi.fn();
    openItemPanel({ item: baseItem, onSave });
    const btn = getPanel().querySelector('.timer-toggle-btn');

    btn.click();
    vi.setSystemTime(20000);
    btn.click();
    vi.setSystemTime(50000);
    btn.click();
    vi.setSystemTime(70000);
    btn.click();

    expect(onSave).toHaveBeenLastCalledWith({ timeSpentSeconds: 40 });
    vi.useRealTimers();
  });

  it('closing the panel while the timer is running flushes the elapsed session', () => {
    vi.useFakeTimers();
    vi.setSystemTime(0);
    const onSave = vi.fn();
    openItemPanel({ item: baseItem, onSave });
    getPanel().querySelector('.timer-toggle-btn').click();
    vi.setSystemTime(15000);

    document.querySelector('.item-panel .panel-footer button.btn-ghost').click();

    expect(onSave).toHaveBeenCalledWith({ timeSpentSeconds: 15 });
    vi.useRealTimers();
  });
});

describe('itemPanel — reset time tracked (issue #203)', () => {
  beforeEach(() => {
    vi.useRealTimers();
  });

  it('resets a stopped timer to 0s after confirming', async () => {
    const onSave = vi.fn();
    openItemPanel({ item: { ...baseItem, timeSpentSeconds: 125 }, onSave });
    expect(getPanel().querySelector('.timer-display').textContent).toBe('2m');

    getPanel().querySelector('.timer-reset-btn').click();
    document.querySelector('.modal-overlay [data-action="confirm"]').click();
    await Promise.resolve();

    expect(getPanel().querySelector('.timer-display').textContent).toBe('0s');
    expect(onSave).toHaveBeenCalledWith({ timeSpentSeconds: 0 });
  });

  it('stops a running timer and zeroes the total, not the pre-reset accumulated value', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(0);
    const onSave = vi.fn();
    openItemPanel({ item: baseItem, onSave });
    const toggleBtn = getPanel().querySelector('.timer-toggle-btn');

    toggleBtn.click();
    vi.setSystemTime(30000);

    getPanel().querySelector('.timer-reset-btn').click();
    document.querySelector('.modal-overlay [data-action="confirm"]').click();
    await vi.runAllTimersAsync();

    expect(getPanel().querySelector('.timer-display').textContent).toBe('0s');
    expect(toggleBtn.classList.contains('active')).toBe(false);
    expect(toggleBtn.getAttribute('aria-label')).toBe('Start timer');
    expect(onSave).toHaveBeenLastCalledWith({ timeSpentSeconds: 0 });
    vi.useRealTimers();
  });

  it('cancelling the confirm dialog leaves the total untouched', async () => {
    const onSave = vi.fn();
    openItemPanel({ item: { ...baseItem, timeSpentSeconds: 125 }, onSave });

    getPanel().querySelector('.timer-reset-btn').click();
    document.querySelector('.modal-overlay [data-action="cancel"]').click();
    await Promise.resolve();

    expect(getPanel().querySelector('.timer-display').textContent).toBe('2m');
    expect(onSave).not.toHaveBeenCalled();
  });
});
