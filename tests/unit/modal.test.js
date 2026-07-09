import { describe, it, expect, beforeEach } from 'vitest';
import { openModal } from '../../src/ui/components/modal.js';

beforeEach(() => {
  document.body.innerHTML = '';
});

function makeContent() {
  const heading = document.createElement('h2');
  heading.textContent = 'Title';
  const firstBtn = document.createElement('button');
  firstBtn.textContent = 'First';
  const lastBtn = document.createElement('button');
  lastBtn.textContent = 'Last';
  return [heading, firstBtn, lastBtn];
}

describe('openModal', () => {
  it('renders content inside .modal-overlay > .modal-card and locks body scroll', () => {
    const { close } = openModal({ content: makeContent(), ariaLabel: 'Test modal' });

    const overlay = document.querySelector('.modal-overlay');
    expect(overlay).not.toBeNull();
    expect(overlay.getAttribute('aria-label')).toBe('Test modal');
    expect(overlay.querySelector('.modal-card h2').textContent).toBe('Title');
    expect(document.body.classList.contains('scroll-locked')).toBe(true);

    close();
  });

  it('close() removes the overlay and unlocks body scroll', () => {
    const { close } = openModal({ content: makeContent() });
    close();

    expect(document.querySelector('.modal-overlay')).toBeNull();
    expect(document.body.classList.contains('scroll-locked')).toBe(false);
  });

  it('closes on Escape', () => {
    openModal({ content: makeContent() });
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));

    expect(document.querySelector('.modal-overlay')).toBeNull();
  });

  it('closes on overlay click but not on card click', () => {
    openModal({ content: makeContent() });
    const overlay = document.querySelector('.modal-overlay');
    const card = overlay.querySelector('.modal-card');

    card.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    expect(document.querySelector('.modal-overlay')).not.toBeNull();

    overlay.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    expect(document.querySelector('.modal-overlay')).toBeNull();
  });

  it('does not close on overlay click when closeOnOverlayClick is false', () => {
    openModal({ content: makeContent(), closeOnOverlayClick: false });
    const overlay = document.querySelector('.modal-overlay');
    overlay.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    expect(document.querySelector('.modal-overlay')).not.toBeNull();
  });

  it('focuses the first focusable element on open', () => {
    openModal({ content: makeContent() });
    expect(document.activeElement.textContent).toBe('First');
  });

  it('Tab from the last focusable element wraps to the first (focus trap)', () => {
    openModal({ content: makeContent() });
    const buttons = document.querySelectorAll('.modal-card button');
    buttons[buttons.length - 1].focus();

    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab' }));
    expect(document.activeElement).toBe(buttons[0]);
  });

  it('Shift+Tab from the first focusable element wraps to the last (focus trap)', () => {
    openModal({ content: makeContent() });
    const buttons = document.querySelectorAll('.modal-card button');
    buttons[0].focus();

    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab', shiftKey: true }));
    expect(document.activeElement).toBe(buttons[buttons.length - 1]);
  });
});
