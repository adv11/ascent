import { ref, push, update, onValue, off } from 'https://www.gstatic.com/firebasejs/10.12.5/firebase-database.js';
import { database, firebaseClock } from './firebase.js';
import { withTimeout } from './storage/withTimeout.js';
import { buildReportPayload } from '../core/feedback/reportSchema.js';

// Thin, stateless wrapper around the two Firebase calls the feedback widget
// needs — deliberately not a fifth `create*Store()` in the roadmapStore.js/
// dailyTodoStore.js/activityLogStore.js family. See ".claude/rules/roadmap-store.md"'s
// "In-app feedback & bug reporting" section for why a report is a
// fire-and-forget write, not bidirectional synced account state.

const FIREBASE_TIMEOUT_MS = 15000;

// Submits a report to both `reports/{reportId}` (developer-only) and
// `users/{uid}/reports/{reportId}` (the user's own "My reports" history) in
// one multi-path update — since issue #348 removed the screenshot feature,
// both paths get the identical payload (see reportSchema.js's
// buildReportPayload). Returns the generated reportId.
export async function submitReport({ type, form, metadata, userId, isAnonymous }) {
  const reportId = push(ref(database, 'reports')).key;
  const payload = buildReportPayload({
    type,
    form,
    metadata,
    userId,
    isAnonymous,
    now: firebaseClock()
  });

  const updates = {
    [`reports/${reportId}`]: payload,
    ...(userId ? { [`users/${userId}/reports/${reportId}`]: payload } : {})
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
