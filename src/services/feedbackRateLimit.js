import { KEYS } from './localStorageKeys.js';

// Client-side, good-faith rate limiting for the feedback widget (issue #9
// §7) — no server enforcement, since Firebase Realtime Database rules can't
// express "count writes in the last N seconds." Max 3 reports per 24h
// rolling window, max 1 per 60s burst window.
const DAY_MS = 86_400_000;
const BURST_MS = 60_000;
const MAX_PER_DAY = 3;
const MAX_PER_BURST = 1;

function getSubmitLog() {
  try {
    const raw = JSON.parse(localStorage.getItem(KEYS.FEEDBACK_RATE) || '[]');
    return Array.isArray(raw) ? raw.filter(t => typeof t === 'number') : [];
  } catch {
    return [];
  }
}

export function canSubmit(now = Date.now()) {
  const log = getSubmitLog();
  const last24h = log.filter(t => now - t < DAY_MS);
  const lastMinute = log.filter(t => now - t < BURST_MS);
  return lastMinute.length < MAX_PER_BURST && last24h.length < MAX_PER_DAY;
}

// Milliseconds until canSubmit() would return true again, or 0 if it
// already would — the countdown the submit button's cooldown message needs.
export function msUntilNextSubmit(now = Date.now()) {
  if (canSubmit(now)) return 0;
  const log = getSubmitLog();
  const lastMinute = log.filter(t => now - t < BURST_MS);
  const last24h = log.filter(t => now - t < DAY_MS);
  const waits = [];
  if (lastMinute.length >= MAX_PER_BURST) waits.push(BURST_MS - (now - Math.max(...lastMinute)));
  if (last24h.length >= MAX_PER_DAY) {
    const oldest = Math.min(...last24h);
    waits.push(DAY_MS - (now - oldest));
  }
  return Math.max(0, ...waits);
}

export function recordSubmit(now = Date.now()) {
  const log = getSubmitLog().filter(t => now - t < DAY_MS);
  log.push(now);
  localStorage.setItem(KEYS.FEEDBACK_RATE, JSON.stringify(log));
}
