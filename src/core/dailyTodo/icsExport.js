// Pure — no DOM, no store. Builds a valid RFC 5545 ICS (VCALENDAR/VEVENT)
// string for a user's active Daily Todos (issue #133 Part 1). Only active
// todos are exported (not done, not expired) — same definition
// MAX_ACTIVE_TODOS already uses (isExpired() in ../../ui/utils/dailyTodo.js)
// — since a done/missed todo has no forward-looking calendar meaning.

// A todo has a deadline (`expiresAt`) but no start time, so it's represented
// as a short block ending at the deadline rather than a zero-duration event
// (some calendar apps render zero-duration VEVENTs poorly/invisibly on a
// day grid) — 15 minutes, matching REMINDER_LEAD_MS's existing "how long
// before the deadline matters" precedent in limits.js.
const EVENT_DURATION_MS = 15 * 60 * 1000;

// Fixed, stable per-install domain suffix for UID — combined with the todo's
// own `id` (already unique) so re-exporting and re-importing the same todo
// into the same calendar app updates rather than duplicates the event, per
// RFC 5545's UID contract.
const UID_DOMAIN = 'ascent-app.local';

function pad(n) {
  return String(n).padStart(2, '0');
}

// ICS datetimes are UTC when suffixed with Z — avoids any timezone
// (VTIMEZONE) component entirely, which is by far the simplest valid form.
function formatIcsDate(ms) {
  const d = new Date(ms);
  return (
    `${d.getUTCFullYear()}${pad(d.getUTCMonth() + 1)}${pad(d.getUTCDate())}` +
    `T${pad(d.getUTCHours())}${pad(d.getUTCMinutes())}${pad(d.getUTCSeconds())}Z`
  );
}

// RFC 5545 requires folding any content line longer than 75 octets: insert
// a CRLF followed by a single leading space before the 76th octet, and
// repeat for the remainder of the line.
function foldLine(line) {
  if (line.length <= 75) return line;
  const parts = [];
  let rest = line;
  while (rest.length > 75) {
    parts.push(rest.slice(0, 75));
    rest = rest.slice(75);
  }
  parts.push(rest);
  return parts.join('\r\n ');
}

// Escapes the characters ICS TEXT values must escape (RFC 5545 §3.3.11).
function escapeIcsText(str) {
  return String(str ?? '')
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
    .replace(/\n/g, '\\n');
}

function buildEvent(todo, nowStamp) {
  const start = todo.expiresAt - EVENT_DURATION_MS;
  const lines = [
    'BEGIN:VEVENT',
    `UID:${todo.id}@${UID_DOMAIN}`,
    `DTSTAMP:${nowStamp}`,
    `DTSTART:${formatIcsDate(start)}`,
    `DTEND:${formatIcsDate(todo.expiresAt)}`,
    `SUMMARY:${escapeIcsText(todo.title)}`,
    'END:VEVENT'
  ];
  return lines.map(foldLine).join('\r\n');
}

// `todos` is a dailyTodoStore getSnapshot().todos array (or any array of
// todo-shaped objects). Excludes done/expired todos — same "active"
// definition addTodo() uses for MAX_ACTIVE_TODOS.
export function buildTodosIcs(todos, now = Date.now()) {
  const nowStamp = formatIcsDate(now);
  const activeTodos = (todos || []).filter(todo => !todo.done && todo.expiresAt > now);
  const events = activeTodos.map(todo => buildEvent(todo, nowStamp));
  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Ascent//Daily Todos//EN',
    'CALSCALE:GREGORIAN',
    ...events,
    'END:VCALENDAR'
  ];
  return lines.join('\r\n') + '\r\n';
}
