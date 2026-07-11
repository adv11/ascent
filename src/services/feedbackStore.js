import { ref, push, update, onValue, off } from 'https://www.gstatic.com/firebasejs/10.12.5/firebase-database.js';
import { database, firebaseClock } from './firebase.js';
import { withTimeout } from './storage/withTimeout.js';
import { buildReportPayload, buildReportSummary } from '../core/feedback/reportSchema.js';

// Thin, stateless wrapper around the two Firebase calls the feedback widget
// needs — deliberately not a fifth `create*Store()` in the roadmapStore.js/
// dailyTodoStore.js/activityLogStore.js family. See ".claude/rules/roadmap-store.md"'s
// "In-app feedback & bug reporting" section for why a report is a
// fire-and-forget write, not bidirectional synced account state.

const FIREBASE_TIMEOUT_MS = 15000;

// Submits a report to both `reports/{reportId}` (full payload, developer-only)
// and `users/{uid}/reports/{reportId}` (summary, no screenshot) in one
// multi-path update — see reportSchema.js's buildReportPayload/buildReportSummary
// for the exact shapes. Returns the generated reportId.
export async function submitReport({ type, form, metadata, userId, isAnonymous, screenshotB64, screenshotOmitted }) {
  const reportId = push(ref(database, 'reports')).key;
  const fullPayload = buildReportPayload({
    type,
    form,
    metadata,
    userId,
    isAnonymous,
    screenshotB64,
    screenshotOmitted,
    now: firebaseClock()
  });
  const summaryPayload = buildReportSummary(fullPayload);

  const updates = {
    [`reports/${reportId}`]: fullPayload,
    ...(userId ? { [`users/${userId}/reports/${reportId}`]: summaryPayload } : {})
  };

  await withTimeout(update(ref(database), updates), FIREBASE_TIMEOUT_MS, 'Timed out submitting your report');
  return reportId;
}

// Live subscription to a signed-in user's own report history ("My reports").
// Returns an unsubscribe function — same subscription-cleanup contract every
// other listener in this app follows (root CLAUDE.md's "Component subscription
// cleanup").
export function listenMyReports(uid, callback, onError) {
  const reportsRef = ref(database, `users/${uid}/reports`);
  onValue(reportsRef, snapshot => {
    const value = snapshot.exists() ? snapshot.val() : {};
    const reports = Object.entries(value)
      .map(([id, report]) => ({ id, ...report }))
      .sort((a, b) => (b.submittedAt || 0) - (a.submittedAt || 0));
    callback(reports);
  }, onError);
  return () => off(reportsRef);
}
