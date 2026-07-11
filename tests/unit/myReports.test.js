import { describe, it, expect, vi, beforeEach } from 'vitest';

const listenMyReports = vi.fn();
vi.mock('../../src/services/feedbackStore.js', () => ({ listenMyReports: (...a) => listenMyReports(...a), submitReport: vi.fn() }));

const { buildMyReportsView, openMyReports } = await import('../../src/ui/components/myReports.js');

beforeEach(() => {
  document.body.innerHTML = '';
  vi.resetAllMocks();
});

describe('buildMyReportsView', () => {
  it('shows a sign-in prompt for a signed-out user', () => {
    const view = buildMyReportsView({ user: null });
    expect(view.textContent).toContain('Sign in to see your report history');
    expect(listenMyReports).not.toHaveBeenCalled();
  });

  it('shows an empty state when there are no reports', () => {
    listenMyReports.mockImplementation((uid, cb) => { cb([]); return () => {}; });
    const view = buildMyReportsView({ user: { uid: 'uid-1' } });
    expect(view.textContent).toContain("haven't submitted any reports yet");
  });

  it('renders reports newest-first with type/status', () => {
    listenMyReports.mockImplementation((uid, cb) => {
      cb([
        { id: 'r1', type: 'bug', title: 'Flicker bug', severity: 'high', status: 'under_review', submittedAt: Date.now() },
        { id: 'r2', type: 'feature', title: 'Export PDF', status: 'new', submittedAt: Date.now() - 1000 }
      ]);
      return () => {};
    });
    const view = buildMyReportsView({ user: { uid: 'uid-1' } });
    const rows = view.querySelectorAll('.my-report-row');
    expect(rows).toHaveLength(2);
    expect(rows[0].textContent).toContain('Flicker bug');
    expect(rows[0].textContent).toContain('Under review');
  });

  it('expands a row to show its details on click', () => {
    listenMyReports.mockImplementation((uid, cb) => {
      cb([{ id: 'r1', type: 'feedback', title: 'Dark mode contrast', description: 'Text is hard to read.', status: 'resolved', submittedAt: Date.now() }]);
      return () => {};
    });
    const view = buildMyReportsView({ user: { uid: 'uid-1' } });
    document.body.appendChild(view);
    const summaryBtn = view.querySelector('.my-report-summary');
    expect(view.querySelector('.my-report-details').hidden).toBe(true);
    summaryBtn.click();
    expect(view.querySelector('.my-report-details').hidden).toBe(false);
    expect(view.querySelector('.my-report-details').textContent).toContain('Text is hard to read.');
  });

  it('_cleanup unsubscribes the Firebase listener', () => {
    const unsubscribe = vi.fn();
    listenMyReports.mockImplementation((uid, cb) => { cb([]); return unsubscribe; });
    const view = buildMyReportsView({ user: { uid: 'uid-1' } });
    view._cleanup();
    expect(unsubscribe).toHaveBeenCalled();
  });
});

describe('openMyReports', () => {
  it('opens a standalone modal with focus trap and closes on the close button', () => {
    listenMyReports.mockImplementation((uid, cb) => { cb([]); return () => {}; });
    openMyReports({ user: { uid: 'uid-1' } });
    expect(document.querySelector('.modal-overlay[aria-label="My reports"]')).not.toBeNull();
    document.querySelector('.feedback-modal-close').click();
    expect(document.querySelector('.modal-overlay')).toBeNull();
  });
});
