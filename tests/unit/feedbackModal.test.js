import { describe, it, expect, vi, beforeEach } from 'vitest';
import { KEYS } from '../../src/services/localStorageKeys.js';

const submitReport = vi.fn();
const listenMyReports = vi.fn(() => () => {});

vi.mock('../../src/services/feedbackStore.js', () => ({ submitReport: (...a) => submitReport(...a), listenMyReports: (...a) => listenMyReports(...a) }));

const { openFeedbackModal } = await import('../../src/ui/components/feedbackModal.js');

const USER = { uid: 'uid-1', isAnonymous: false };

beforeEach(() => {
  document.body.innerHTML = '';
  localStorage.clear();
  vi.resetAllMocks();
  listenMyReports.mockImplementation(() => () => {});
  submitReport.mockResolvedValue('report-abc12');
});

function clickKind(label) {
  const buttons = [...document.querySelectorAll('.feedback-kind-chip')];
  buttons.find(b => b.textContent.includes(label)).click();
}

function bodyTextarea() {
  return document.querySelector('textarea.feedback-field-input');
}

describe('openFeedbackModal — single screen (issue #505)', () => {
  it('opens with a "Send feedback" title, three kind chips, and "Something is broken" active by default', () => {
    openFeedbackModal({ user: USER });
    expect(document.querySelector('.modal-title').textContent).toBe('Send feedback');
    const chips = [...document.querySelectorAll('.feedback-kind-chip')];
    expect(chips).toHaveLength(3);
    expect(chips.map(c => c.textContent)).toEqual(['Something is broken', 'An idea', 'Something else']);
    expect(chips[0].classList.contains('active')).toBe(true);
  });

  it('switches the active chip on click without leaving the screen', () => {
    openFeedbackModal({ user: USER });
    clickKind('An idea');
    const chips = [...document.querySelectorAll('.feedback-kind-chip')];
    expect(chips.find(c => c.textContent === 'An idea').classList.contains('active')).toBe(true);
    expect(chips.find(c => c.textContent === 'Something is broken').classList.contains('active')).toBe(false);
    expect(document.querySelector('.feedback-form')).not.toBeNull();
  });

  it('has one textarea, no screenshot control, and a "See my past reports" link', () => {
    openFeedbackModal({ user: USER });
    expect(document.querySelectorAll('textarea.feedback-field-input')).toHaveLength(1);
    expect(document.querySelector('.feedback-screenshot')).toBeNull();
    expect(document.querySelector('.feedback-my-reports-link').textContent).toBe('See my past reports');
  });

  it('does not submit and shows an error when the textarea is empty', async () => {
    openFeedbackModal({ user: USER });
    document.querySelector('.feedback-form').requestSubmit();
    await Promise.resolve();
    expect(submitReport).not.toHaveBeenCalled();
    expect(document.querySelector('.form-message.error')).not.toBeNull();
  });

  it('submits a "Something is broken" report with a title derived from the body text', async () => {
    openFeedbackModal({ user: USER });
    bodyTextarea().value = 'Dashboard flickers when checking an item.';

    document.querySelector('.feedback-form').requestSubmit();
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();

    expect(submitReport).toHaveBeenCalledTimes(1);
    const args = submitReport.mock.calls[0][0];
    expect(args.type).toBe('bug');
    expect(args.userId).toBe('uid-1');
    expect(args.form.title).toBe('Dashboard flickers when checking an item.');
    expect(args.form.whatHappened).toBe('Dashboard flickers when checking an item.');
    expect(args.form.severity).toBeNull();
    expect(document.querySelector('.feedback-reference').textContent).toBe('Reference: #REPOR');
  });

  it('submits an "An idea" report into the description field, not whatHappened', async () => {
    openFeedbackModal({ user: USER });
    clickKind('An idea');
    bodyTextarea().value = 'Add a dark mode for the print export.';
    document.querySelector('.feedback-form').requestSubmit();
    await Promise.resolve(); await Promise.resolve(); await Promise.resolve();

    const args = submitReport.mock.calls[0][0];
    expect(args.type).toBe('feature');
    expect(args.form.description).toBe('Add a dark mode for the print export.');
    expect(args.form.whatHappened).toBeNull();
  });

  it('unchecking "Include system info" submits metadata: null', async () => {
    openFeedbackModal({ user: USER });
    bodyTextarea().value = 'Something went wrong.';
    document.querySelector('.feedback-system-info-checkbox input[type="checkbox"]').click();

    document.querySelector('.feedback-form').requestSubmit();
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();

    expect(submitReport.mock.calls[0][0].metadata).toBeNull();
  });
});

describe('draft autosave', () => {
  it('persists a half-filled report to localStorage and restores it on reopen', async () => {
    openFeedbackModal({ user: USER });
    bodyTextarea().value = 'Partial description';
    bodyTextarea().dispatchEvent(new Event('input'));
    await vi.waitFor(() => {
      expect(localStorage.getItem(KEYS.FEEDBACK_DRAFT)).not.toBeNull();
    });
    const draft = JSON.parse(localStorage.getItem(KEYS.FEEDBACK_DRAFT));
    expect(draft.type).toBe('bug');
    expect(draft.form.whatHappened).toBe('Partial description');
  });

  it('clears the draft after a successful submit', async () => {
    localStorage.setItem(KEYS.FEEDBACK_DRAFT, JSON.stringify({ type: 'bug', form: { whatHappened: 'x' } }));
    openFeedbackModal({ user: USER });
    bodyTextarea().value = 'Something went wrong.';
    document.querySelector('.feedback-form').requestSubmit();
    await Promise.resolve(); await Promise.resolve(); await Promise.resolve();
    expect(localStorage.getItem(KEYS.FEEDBACK_DRAFT)).toBeNull();
  });
});

describe('rate limit UI', () => {
  it('disables the submit button and shows a cooldown message after 3 recent submits', () => {
    localStorage.setItem(KEYS.FEEDBACK_RATE, JSON.stringify([Date.now(), Date.now(), Date.now()]));
    openFeedbackModal({ user: USER });
    clickKind('Something else');
    const submitBtn = document.querySelector('.feedback-form button[type="submit"]');
    expect(submitBtn.disabled).toBe(true);
    expect(document.querySelector('.feedback-cooldown-message').hidden).toBe(false);
  });
});

describe('guest (anonymous) submission', () => {
  it('submits with isAnonymous true for a guest user', async () => {
    openFeedbackModal({ user: { uid: 'guest-1', isAnonymous: true } });
    clickKind('Something else');
    bodyTextarea().value = 'Body text';
    document.querySelector('.feedback-form').requestSubmit();
    await Promise.resolve(); await Promise.resolve(); await Promise.resolve();
    expect(submitReport.mock.calls[0][0].isAnonymous).toBe(true);
  });
});

describe('"See my past reports" navigation', () => {
  it('opens the My reports screen and returns to the main screen via Back', () => {
    openFeedbackModal({ user: USER });
    document.querySelector('.feedback-my-reports-link').click();
    expect(document.querySelector('.modal-title').textContent).toBe('My reports');
    document.querySelector('.feedback-type-header button').click();
    expect(document.querySelector('.modal-title').textContent).toBe('Send feedback');
  });
});
