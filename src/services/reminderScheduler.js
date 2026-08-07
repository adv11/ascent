import { KEYS } from './localStorageKeys.js';
import { computeReminderFireAt, shouldScheduleReminder } from '../core/dailyTodo/reminderScheduling.js';

// Local, single-device "Remind me" notifications for Daily Todo deadlines
// (issue #132, Phase A — see .claude/rules/roadmap-store.md for the
// scoping/deferred-Phase-B rationale). No FCM/device tokens, no backend —
// just registration.showNotification() fired from a plain setTimeout, so a
// todo added in one tab reschedules correctly once dailyTodoStore's own
// subscribe/notify fires here too.

const timers = new Map(); // todoId -> setTimeout id

export function remindersEnabled() {
  return localStorage.getItem(KEYS.DAILY_TODO_REMINDERS_ENABLED) === 'true';
}

// Requests Notification permission (the opt-in gesture must come from a
// real user action — a click on the "Remind me" toggle, never called on
// page load, see the issue's dark-pattern warning). Returns whether
// reminders ended up enabled.
export async function enableReminders() {
  if (!('Notification' in window)) return false;
  const permission = await Notification.requestPermission();
  const granted = permission === 'granted';
  localStorage.setItem(KEYS.DAILY_TODO_REMINDERS_ENABLED, String(granted));
  return granted;
}

export function disableReminders() {
  localStorage.setItem(KEYS.DAILY_TODO_REMINDERS_ENABLED, 'false');
  clearAllTimers();
}

function clearAllTimers() {
  timers.forEach(id => clearTimeout(id));
  timers.clear();
}

function cancelTimer(todoId) {
  const id = timers.get(todoId);
  if (id === undefined) return;
  clearTimeout(id);
  timers.delete(todoId);
}

async function fireNotification(todo) {
  timers.delete(todo.id);
  if (!('serviceWorker' in navigator)) return;
  const registration = await navigator.serviceWorker.ready;
  registration.showNotification(`"${todo.title}" is due soon`, {
    body: 'Less than 15 minutes left on this todo.',
    tag: `daily-todo-${todo.id}`,
    data: { todoId: todo.id }
  });
}

function scheduleTimer(todo, now) {
  if (timers.has(todo.id) || !shouldScheduleReminder(todo, now)) return;
  const delay = computeReminderFireAt(todo) - now;
  timers.set(todo.id, setTimeout(() => fireNotification(todo), delay));
}

// Subscribes to dailyTodoStore and keeps one live setTimeout per active,
// not-yet-due todo — reconciled on every store change (add/done/delete all
// notify the same way), so completing or deleting a todo before its
// reminder fires cancels the pending timer rather than letting a stale
// notification arrive for something already done. Returns an unsubscribe
// function; call once at app startup (main.js) — app-lifetime, no per-route
// cleanup.
export function initReminderScheduler(store) {
  return store.subscribe(snapshot => {
    if (!remindersEnabled()) {
      clearAllTimers();
      return;
    }
    const now = Date.now();
    const activeIds = new Set(snapshot.todos.map(t => t.id));
    timers.forEach((_, id) => {
      if (!activeIds.has(id)) cancelTimer(id);
    });
    snapshot.todos.forEach(todo => {
      if (todo.done || !shouldScheduleReminder(todo, now)) {
        cancelTimer(todo.id);
      } else {
        scheduleTimer(todo, now);
      }
    });
  });
}
