import { describe, it, expect, beforeEach } from 'vitest';
import { openDailyTodoGuide } from '../../src/ui/components/dailyTodoGuide.js';
import { MAX_ACTIVE_TODOS } from '../../src/core/dailyTodo/limits.js';

beforeEach(() => {
  document.body.innerHTML = '';
});

describe('openDailyTodoGuide', () => {
  it('renders an overlay covering the deadline model, delete-anytime, and linking behavior', () => {
    openDailyTodoGuide();
    const overlay = document.querySelector('.modal-overlay[aria-label*="Today\'s Todos"]');
    expect(overlay).toBeTruthy();
    expect(overlay.textContent).toContain('amber');
    expect(overlay.textContent).toContain(String(MAX_ACTIVE_TODOS));
    expect(overlay.textContent).toContain('undo one added by mistake');
    expect(overlay.textContent).toContain('via <Roadmap>');
    expect(overlay.textContent).toContain('asks you to confirm');
    expect(overlay.textContent).toContain('never touches the roadmap');
  });

  it('"Got it" closes the modal', () => {
    openDailyTodoGuide();
    document.querySelector('.modal-overlay .btn-primary').click();
    expect(document.querySelector('.modal-overlay')).toBeNull();
  });

  it('Escape closes the modal', () => {
    openDailyTodoGuide();
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    expect(document.querySelector('.modal-overlay')).toBeNull();
  });

  it('clicking outside the card closes the modal', () => {
    openDailyTodoGuide();
    document.querySelector('.modal-overlay').click();
    expect(document.querySelector('.modal-overlay')).toBeNull();
  });
});
