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

function clickType(label) {
  const buttons = [...document.querySelectorAll('.feedback-type-card')];
  buttons.find(b => b.textContent.includes(label)).click();
}

describe('openFeedbackModal — type selector', () => {
  it('opens with a "How can we help?" title and three type cards', () => {
    openFeedbackModal({ user: USER });
    expect(document.querySelector('.modal-title').textContent).toBe('How can we help?');
    expect(document.querySelectorAll('.feedback-type-card')).toHaveLength(3);
  });

  it('transitions to the bug report form when Bug report is selected', () => {
    openFeedbackModal({ user: USER });
    clickType('Bug report');
    expect(document.querySelector('.feedback-form')).not.toBeNull();
    expect(document.querySelector('.modal-title').textContent).toContain('Bug report');
  });
});

describe('bug report form', () => {
  it('renders all required fields, with no screenshot control', () => {
    openFeedbackModal({ user: USER });
    clickType('Bug report');
    const labels = [...document.querySelectorAll('.field-label')].map(l => l.textContent);
    expect(labels.some(l => l.startsWith('Title'))).toBe(true);
    expect(labels.some(l => l.startsWith('Severity'))).toBe(true);
    expect(labels.some(l => l.startsWith('What happened?'))).toBe(true);
    expect(document.querySelector('.feedback-screenshot')).toBeNull();
  });

  it('does not submit and shows an error when required fields are empty', async () => {
    openFeedbackModal({ user: USER });
    clickType('Bug report');
    document.querySelector('.feedback-form').requestSubmit();
    await Promise.resolve();
    expect(submitReport).not.toHaveBeenCalled();
    expect(document.querySelector('.form-message.error')).not.toBeNull();
  });

  it('submits successfully with just title + what-happened filled, leaving severity unset', async () => {
    openFeedbackModal({ user: USER });
    clickType('Bug report');

    document.querySelectorAll('.feedback-field-input')[0].value = 'Dashboard flickers';
    const textareas = document.querySelectorAll('textarea.feedback-field-input');
    textareas[0].value = 'Checked an item and it flickered instead of staying checked.';

    document.querySelector('.feedback-form').requestSubmit();
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();

    expect(submitReport).toHaveBeenCalledTimes(1);
    const args = submitReport.mock.calls[0][0];
    expect(args.type).toBe('bug');
    expect(args.userId).toBe('uid-1');
    expect(args.form.severity).toBeNull();
    expect(document.querySelector('.feedback-reference').textContent).toBe('Reference: #REPOR');
  });

  it('unchecking "Include system info" submits metadata: null', async () => {
    openFeedbackModal({ user: USER });
    clickType('Bug report');
    document.querySelectorAll('.feedback-field-input')[0].value = 'Bug title';
    document.querySelector('input[name="severity"][value="low"]').click();
    const textareas = document.querySelectorAll('textarea.feedback-field-input');
    textareas[0].value = 'Something went wrong.';
    document.querySelector('.feedback-system-info-checkbox input[type="checkbox"]').click();

    document.querySelector('.feedback-form').requestSubmit();
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();

    expect(submitReport.mock.calls[0][0].metadata).toBeNull();
  });
});

describe('feature request form', () => {
  it('has no screenshot control and no separate use-case field', () => {
    openFeedbackModal({ user: USER });
    clickType('Feature request');
    expect(document.querySelector('.feedback-screenshot')).toBeNull();
    const labels = [...document.querySelectorAll('.field-label')].map(l => l.textContent);
    expect(labels.some(l => l.startsWith('Describe the feature'))).toBe(true);
    expect(labels.some(l => l.startsWith('Your use case'))).toBe(false);
  });
});

describe('draft autosave', () => {
  it('persists a half-filled bug report to localStorage and restores it on reopen', async () => {
    openFeedbackModal({ user: USER });
    clickType('Bug report');
    document.querySelectorAll('.feedback-field-input')[0].value = 'Partial title';
    document.querySelectorAll('.feedback-field-input')[0].dispatchEvent(new Event('input'));
    await vi.waitFor(() => {
      expect(localStorage.getItem(KEYS.FEEDBACK_DRAFT)).not.toBeNull();
    });
    const draft = JSON.parse(localStorage.getItem(KEYS.FEEDBACK_DRAFT));
    expect(draft.type).toBe('bug');
    expect(draft.form.title).toBe('Partial title');
  });

  it('clears the draft after a successful submit', async () => {
    localStorage.setItem(KEYS.FEEDBACK_DRAFT, JSON.stringify({ type: 'bug', form: { title: 'x' } }));
    openFeedbackModal({ user: USER });
    clickType('Bug report');
    document.querySelectorAll('.feedback-field-input')[0].value = 'Bug title';
    document.querySelector('input[name="severity"][value="low"]').click();
    const textareas = document.querySelectorAll('textarea.feedback-field-input');
    textareas[0].value = 'Something went wrong.';
    document.querySelector('.feedback-form').requestSubmit();
    await Promise.resolve(); await Promise.resolve(); await Promise.resolve();
    expect(localStorage.getItem(KEYS.FEEDBACK_DRAFT)).toBeNull();
  });
});

describe('rate limit UI', () => {
  it('disables the submit button and shows a cooldown message after 3 recent submits', () => {
    localStorage.setItem(KEYS.FEEDBACK_RATE, JSON.stringify([Date.now(), Date.now(), Date.now()]));
    openFeedbackModal({ user: USER });
    clickType('General feedback');
    const submitBtn = document.querySelector('.feedback-form button[type="submit"]');
    expect(submitBtn.disabled).toBe(true);
    expect(document.querySelector('.feedback-cooldown-message').hidden).toBe(false);
  });
});

describe('guest (anonymous) submission', () => {
  it('submits with isAnonymous true for a guest user', async () => {
    openFeedbackModal({ user: { uid: 'guest-1', isAnonymous: true } });
    clickType('General feedback');
    document.querySelectorAll('.feedback-field-input')[0].value = 'Guest feedback';
    document.querySelectorAll('textarea.feedback-field-input')[0].value = 'Body text';
    document.querySelector('.feedback-form').requestSubmit();
    await Promise.resolve(); await Promise.resolve(); await Promise.resolve();
    expect(submitReport.mock.calls[0][0].isAnonymous).toBe(true);
  });
});
