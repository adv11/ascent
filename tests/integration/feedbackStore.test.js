import { describe, it, expect, vi, beforeEach } from 'vitest';

// Same CDN-stub pattern tests/unit/storage/adapterFactory.test.js already
// established — the default ESM loader can't resolve a bare https:// import,
// so both the SDK module and firebase.js are mocked identically.
const push = vi.fn();
const update = vi.fn();
const onValue = vi.fn();
const off = vi.fn();
const ref = vi.fn((_db, path) => ({ path }));

vi.mock('https://www.gstatic.com/firebasejs/10.12.5/firebase-database.js', () => ({
  ref: (...args) => ref(...args),
  push: (...args) => push(...args),
  update: (...args) => update(...args),
  onValue: (...args) => onValue(...args),
  off: (...args) => off(...args)
}));
vi.mock('../../src/services/firebase.js', () => ({
  database: {},
  firebaseClock: vi.fn(() => 1_700_000_000_000)
}));

const { submitReport, listenMyReports } = await import('../../src/services/feedbackStore.js');

beforeEach(() => {
  vi.resetAllMocks();
  ref.mockImplementation((_db, path) => ({ path }));
  push.mockReturnValue({ key: 'report-abc123' });
  update.mockResolvedValue(undefined);
});

describe('submitReport', () => {
  const baseArgs = {
    type: 'bug',
    form: { title: 'Crashes', severity: 'high', whatHappened: 'Clicked save and it crashed.' },
    metadata: { browser: 'Chrome 126' },
    userId: 'uid-1',
    isAnonymous: false
  };

  it('writes reports/{id} and users/{uid}/reports/{id} in one multi-path update', async () => {
    const reportId = await submitReport(baseArgs);
    expect(reportId).toBe('report-abc123');
    expect(update).toHaveBeenCalledTimes(1);
    const [, updates] = update.mock.calls[0];
    expect(Object.keys(updates).sort()).toEqual(['reports/report-abc123', 'users/uid-1/reports/report-abc123'].sort());
  });

  it('never has a screenshotB64/screenshotOmitted field on either path — removed in issue #348', async () => {
    await submitReport(baseArgs);
    const [, updates] = update.mock.calls[0];
    expect('screenshotB64' in updates['reports/report-abc123']).toBe(false);
    expect('screenshotOmitted' in updates['reports/report-abc123']).toBe(false);
    expect('screenshotB64' in updates['users/uid-1/reports/report-abc123']).toBe(false);
  });

  it('submits an anonymous (guest) report with isAnonymous true and its own uid', async () => {
    await submitReport({ ...baseArgs, userId: 'guest-uid-1', isAnonymous: true });
    const [, updates] = update.mock.calls[0];
    const full = updates['reports/report-abc123'];
    expect(full.isAnonymous).toBe(true);
    expect(full.userId).toBe('guest-uid-1');
    expect(Object.keys(updates)).toContain('users/guest-uid-1/reports/report-abc123');
  });

  it('omits the users/{uid} write entirely when there is no userId', async () => {
    await submitReport({ ...baseArgs, userId: null });
    const [, updates] = update.mock.calls[0];
    expect(Object.keys(updates)).toEqual(['reports/report-abc123']);
  });
});

describe('listenMyReports', () => {
  it('sorts reports newest-first and unwraps the snapshot', () => {
    let capturedCallback;
    onValue.mockImplementation((_ref, cb) => { capturedCallback = cb; return () => {}; });

    const results = [];
    listenMyReports('uid-1', reports => results.push(reports));

    capturedCallback({
      exists: () => true,
      val: () => ({
        'r-old': { title: 'Old', submittedAt: 100 },
        'r-new': { title: 'New', submittedAt: 200 }
      })
    });

    expect(results[0].map(r => r.id)).toEqual(['r-new', 'r-old']);
  });

  it('returns an empty array when no reports exist', () => {
    let capturedCallback;
    onValue.mockImplementation((_ref, cb) => { capturedCallback = cb; return () => {}; });

    const results = [];
    listenMyReports('uid-1', reports => results.push(reports));
    capturedCallback({ exists: () => false });

    expect(results[0]).toEqual([]);
  });

  it('returns an unsubscribe function that calls off()', () => {
    onValue.mockImplementation(() => {});
    const unsubscribe = listenMyReports('uid-1', () => {});
    unsubscribe();
    expect(off).toHaveBeenCalled();
  });
});
