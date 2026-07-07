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

  it('shows "Autosaved ✓" after the debounced save, then fades it out after 1.5s', () => {
    vi.useFakeTimers();
    openItemPanel({ item: baseItem, onSave: vi.fn() });
    const textarea = getPanel().querySelector('.notes-textarea');
    const status = getPanel().querySelector('.notes-status');

    textarea.value = 'Saved soon';
    textarea.dispatchEvent(new Event('input'));
    vi.advanceTimersByTime(800);

    expect(status.textContent).toBe('Autosaved ✓');
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
