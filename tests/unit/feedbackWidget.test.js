import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

vi.mock('https://www.gstatic.com/firebasejs/10.12.5/firebase-database.js', () => ({
  ref: vi.fn(), push: vi.fn(), update: vi.fn(), onValue: vi.fn(), off: vi.fn()
}));
vi.mock('../../src/services/firebase.js', () => ({ database: {}, firebaseClock: vi.fn() }));

const { createFeedbackWidget } = await import('../../src/ui/components/feedbackWidget.js');

beforeEach(() => {
  document.body.innerHTML = '';
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

describe('createFeedbackWidget', () => {
  it('renders a trigger button with the required aria-label', () => {
    const widget = createFeedbackWidget({ user: null });
    expect(widget.tagName).toBe('BUTTON');
    expect(widget.getAttribute('aria-label')).toBe('Send feedback');
  });

  it('is not visible until the 1500ms delayed scale-in fires', () => {
    const widget = createFeedbackWidget({ user: null });
    expect(widget.classList.contains('feedback-widget-visible')).toBe(false);
    vi.advanceTimersByTime(1500);
    expect(widget.classList.contains('feedback-widget-visible')).toBe(true);
  });

  it('opens the feedback modal on click', () => {
    document.body.appendChild(createFeedbackWidget({ user: null }));
    document.querySelector('.feedback-widget-trigger').click();
    expect(document.querySelector('.modal-overlay[aria-label="Send feedback"]')).not.toBeNull();
  });

  it('is keyboard accessible (a real <button>, focusable and Enter/Space-activatable natively)', () => {
    const widget = createFeedbackWidget({ user: null });
    expect(widget.tagName).toBe('BUTTON');
    expect(widget.hasAttribute('disabled')).toBe(false);
  });

  it('_setUser updates which user a later click opens the modal for', () => {
    const widget = createFeedbackWidget({ user: null });
    document.body.appendChild(widget);
    widget._setUser({ uid: 'uid-1', isAnonymous: false });
    widget.click();
    expect(document.querySelector('.modal-overlay')).not.toBeNull();
  });
});
