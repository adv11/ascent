import { el } from '../dom.js';
import { createIcon } from './icons.js';
import { showToast } from './toast.js';
import { confirmDialog } from './confirmDialog.js';
import { openDailyTodoGuide } from './dailyTodoGuide.js';
import { createSelect } from './select.js';
import { isExpired, remainingMs, formatRemaining, remainingBand } from '../utils/dailyTodo.js';
import { MAX_TODO_TITLE_LENGTH, MAX_ACTIVE_TODOS, DURATION_PRESETS, MIN_DURATION_MS, MAX_DURATION_MS } from '../../core/dailyTodo/limits.js';
import { getTemplate } from '../../data/templates/index.js';
import { KEYS } from '../../services/localStorageKeys.js';
import { remindersEnabled, enableReminders, disableReminders } from '../../services/reminderScheduler.js';
import { computeElapsedSeconds, formatTimeSpent } from '../../core/time/timeTracking.js';
import { createFeatureBadge } from './featureBadge.js';

const CUSTOM_VALUE = 'custom';
const DEFAULT_PRESET_MS = DURATION_PRESETS.find(p => p.label === '24 hours')?.ms || DURATION_PRESETS[0].ms;
// 30s resolution is enough for hour/minute-granularity countdown text.
const TICK_MS = 30000;
// 1s resolution for a running per-todo timer's live display (issue #180).
const TIMER_TICK_MS = 1000;

// Resolves a templateId to a display name for the confirm dialog/toast/row
// label — built-in templates come from the registry, a custom roadmap's
// name lives in roadmapStore's own customRoadmaps meta (issue #4). Returns
// null if roadmapStore wasn't provided or the roadmap can no longer be
// found (e.g. a custom roadmap the user has since deleted).
function resolveRoadmapName(roadmapStore, templateId) {
  if (!roadmapStore || !templateId) return null;
  if (roadmapStore.isCustomRoadmapId(templateId)) {
    const custom = roadmapStore.getSnapshot().customRoadmaps.find(r => r.id === templateId);
    return custom ? custom.title : null;
  }
  return getTemplate(templateId)?.name || null;
}

// A new instance of the exact hazard CLAUDE.md's "Component subscription
// cleanup" rule already covers for store subscriptions — a setInterval left
// running after this panel's DOM node is removed leaks just like an
// unremoved subscription. Returns the panel node with `_cleanup` set
// (matching createThemeToggle's convention), wired into dashboard.js's route
// cleanup. `roadmapStore` (issue #56 follow-up) is optional — a todo can
// exist standalone (no linkedTemplateId/linkedItemId) and never needs it;
// it's only consulted when completing/reverting a todo that was created via
// a roadmap topic's "add to Today's Todos" button (dashboard.js).
export function createDailyTodoPanel(store, roadmapStore) {
  // Issue #6 Phase 9 — axe-core flagged both fields as missing an accessible
  // name; a placeholder alone doesn't count as one (it vanishes on input and
  // most screen readers don't reliably announce it as a label anyway).
  const titleInput = el('input', {
    className: 'field-input compact inline-add',
    placeholder: 'Add a todo, due in…',
    'aria-label': 'New todo title',
    maxlength: String(MAX_TODO_TITLE_LENGTH)
  });

  const durationSelect = createSelect(
    [...DURATION_PRESETS.map(p => ({ value: String(p.ms), label: p.label })), { value: CUSTOM_VALUE, label: 'Custom…' }],
    { value: String(DEFAULT_PRESET_MS), ariaLabel: 'Due in', className: 'compact todo-duration-select' }
  );

  const customHoursInput = el('input', {
    className: 'field-input compact todo-custom-hours',
    type: 'number',
    min: String(MIN_DURATION_MS / 3600000),
    max: String(MAX_DURATION_MS / 3600000),
    step: '0.25',
    placeholder: 'Hours',
    'aria-label': 'Custom duration in hours'
  });
  customHoursInput.hidden = true;

  durationSelect.addEventListener('change', () => {
    customHoursInput.hidden = durationSelect.value !== CUSTOM_VALUE;
    if (!customHoursInput.hidden) customHoursInput.focus();
  });

  function selectedDurationMs() {
    if (durationSelect.value === CUSTOM_VALUE) {
      const hours = parseFloat(customHoursInput.value);
      if (!Number.isFinite(hours)) return null;
      return hours * 3600000;
    }
    return parseInt(durationSelect.value, 10);
  }

  function handleAdd() {
    const title = titleInput.value.trim();
    if (!title) return;
    if (title.length > MAX_TODO_TITLE_LENGTH) {
      showToast(`Todo title must be ${MAX_TODO_TITLE_LENGTH} characters or fewer.`, 'error');
      return;
    }
    const durationMs = selectedDurationMs();
    if (durationMs === null) {
      showToast('Enter a valid number of hours.', 'error');
      return;
    }
    const added = store.addTodo({ title, durationMs });
    if (!added) {
      showToast(`You can have at most ${MAX_ACTIVE_TODOS} active todos at once.`, 'error');
      return;
    }
    titleInput.value = '';
    durationSelect.value = String(DEFAULT_PRESET_MS);
    customHoursInput.hidden = true;
    customHoursInput.value = '';
    showToast(`Added "${title}".`, 'success');
  }

  titleInput.addEventListener('keydown', e => {
    if (e.key === 'Enter') handleAdd();
  });

  const addForm = el('div', { className: 'daily-todo-add-row' }, [
    titleInput,
    durationSelect,
    customHoursInput,
    el('button', { type: 'button', className: 'btn btn-secondary btn-sm', text: 'Add', onClick: handleAdd })
  ]);

  const activeList = el('div', { className: 'daily-todo-list' });
  const missedToggle = el('button', {
    type: 'button',
    className: 'daily-todo-missed-toggle',
    text: 'Missed (0)'
  });
  const missedList = el('div', { className: 'daily-todo-missed-list' });
  missedList.hidden = true;

  let missedOpen = false;
  missedToggle.addEventListener('click', () => {
    missedOpen = !missedOpen;
    missedList.hidden = !missedOpen;
    missedToggle.classList.toggle('open', missedOpen);
  });

  // Every todo gets a delete button, active or not (issue #56 follow-up) —
  // originally restricted to done/missed only, but a todo linked to a
  // roadmap topic (dashboard.js's ⏱ row button) needs an "undo" for the
  // case where it was added by mistake, and there's no reason to make the
  // user wait for it to finish or expire first just to remove it. Deleting
  // an active linked todo never touches the roadmap — it's still active
  // precisely because it was never confirmed done, so there's nothing to
  // revert on that side; the confirm message says so explicitly to make
  // that reassurance visible, not just true.
  async function handleDelete(todo) {
    const isLinked = !!(todo.linkedTemplateId && todo.linkedItemId);
    const message = isLinked && !todo.done && !isExpired(todo)
      ? 'This removes it for good. This cannot be undone. The linked roadmap topic is untouched either way.'
      : 'This removes it for good. This cannot be undone.';
    if (!await confirmDialog({
      title: `Delete "${todo.title}"?`,
      message,
      confirmText: 'Delete',
      danger: true
    })) return;
    store.removeTodo(todo.id);
  }

  // Checking a todo linked to a roadmap topic (issue #56 follow-up) also
  // marks that topic done in its own roadmap — which can be a roadmap the
  // user isn't even looking at right now (roadmapStore.setItemDoneInTemplate
  // handles that regardless of which template is currently active). Since
  // this is a cross-cutting side effect the user might not expect, checking
  // (never unchecking — that direction is the safe, reversible one) is
  // gated behind an explicit confirmation naming the target roadmap, same
  // convention as any other consequential action in this app
  // (confirmDialog, not a native confirm()). Cancelling resets the
  // checkbox's visual state, since the browser already flipped it before
  // this handler ran and the store was never actually updated.
  async function handleToggleDone(todo, checkboxEl) {
    const nextDone = !todo.done;
    const isLinked = !!(todo.linkedTemplateId && todo.linkedItemId);

    if (isLinked && nextDone) {
      const roadmapName = resolveRoadmapName(roadmapStore, todo.linkedTemplateId) || 'that roadmap';
      if (!await confirmDialog({
        title: `Complete "${todo.title}"?`,
        message: `This will also mark this topic done in ${roadmapName}.`,
        confirmText: 'Complete',
        danger: false
      })) {
        checkboxEl.checked = todo.done;
        return;
      }
    }

    store.setDone(todo.id, nextDone);

    if (isLinked && roadmapStore) {
      const roadmapName = resolveRoadmapName(roadmapStore, todo.linkedTemplateId) || 'that roadmap';
      const result = await roadmapStore.setItemDoneInTemplate(todo.linkedTemplateId, todo.linkedItemId, nextDone);
      if (result.ok) {
        showToast(
          nextDone ? `Marked "${result.title}" done in ${roadmapName}.` : `Reverted "${result.title}" in ${roadmapName}.`,
          'success'
        );
      } else {
        showToast(`Couldn't find that topic in ${roadmapName} anymore — the todo itself is still updated.`, 'error');
      }
    }
  }

  // Issue #180 — per-todo lightweight timer. Local-only UI state (id ->
  // session startedAt, epoch ms), same "never synced across devices, only
  // the stopped result is" reasoning as itemPanel.js's own timer. A single
  // shared 1s tick only runs while at least one timer is active, and it
  // updates each running row's display span directly (by id) rather than
  // re-running the full render() — the countdown tick above already handles
  // periodic full re-renders every 30s.
  const runningTimers = {};
  let timerTickTimer = null;

  function ensureTimerTick() {
    const anyRunning = Object.keys(runningTimers).length > 0;
    if (anyRunning && !timerTickTimer) {
      timerTickTimer = setInterval(updateRunningDisplays, TIMER_TICK_MS);
    } else if (!anyRunning && timerTickTimer) {
      clearInterval(timerTickTimer);
      timerTickTimer = null;
    }
  }

  function updateRunningDisplays() {
    const todos = store.getSnapshot().todos;
    Object.entries(runningTimers).forEach(([id, startedAt]) => {
      const todo = todos.find(t => t.id === id);
      const display = activeList.querySelector(`[data-timer-display="${id}"]`);
      if (!todo || !display) return;
      const total = (todo.timeSpentSeconds || 0) + computeElapsedSeconds(startedAt);
      display.textContent = formatTimeSpent(total);
    });
  }

  function handleToggleTimer(todo) {
    if (runningTimers[todo.id] != null) {
      const elapsed = computeElapsedSeconds(runningTimers[todo.id]);
      delete runningTimers[todo.id];
      ensureTimerTick();
      store.addTimeSpent(todo.id, elapsed);
      return;
    }
    runningTimers[todo.id] = Date.now();
    ensureTimerTick();
    render();
  }

  function renderRow(todo, now) {
    const ms = remainingMs(todo, now);
    const band = todo.done ? null : remainingBand(ms);
    const isLinked = !!(todo.linkedTemplateId && todo.linkedItemId);
    const roadmapName = isLinked ? resolveRoadmapName(roadmapStore, todo.linkedTemplateId) : null;
    const checkboxInput = el('input', {
      type: 'checkbox',
      checked: todo.done ? 'checked' : null,
      'aria-label': `Mark "${todo.title}" ${todo.done ? 'not done' : 'done'}`
    });
    checkboxInput.addEventListener('change', () => handleToggleDone(todo, checkboxInput));
    return el('div', {
      className: `daily-todo-item ${todo.done ? 'done' : ''}`,
      dataset: { id: todo.id }
    }, [
      el('label', { className: 'daily-todo-checkbox' }, [
        checkboxInput,
        el('span', { className: 'daily-todo-title', text: todo.title }),
        roadmapName ? el('span', { className: 'daily-todo-linked-badge', title: `Linked to a topic in ${roadmapName}`, text: `via ${roadmapName}` }) : null
      ].filter(Boolean)),
      // Always rendered (never conditional on todo.done) and given a fixed
      // width in CSS — this used to be a `!todo.done ? ... : null` node,
      // which meant a done row had two flex children instead of three and
      // `justify-content: space-between` floated the countdown at a
      // different horizontal position on every row depending on how long
      // the title text was. A fixed-width, right-aligned column keeps every
      // row's status text flush against the same edge regardless of title
      // length or done state.
      el('span', { className: `daily-todo-remaining ${todo.done ? 'done' : band}`, text: todo.done ? 'Done' : formatRemaining(ms) }),
      // Time tracking (issue #180) — Start/pause only makes sense for a
      // still-active, not-yet-done todo; a done or missed row shows its
      // accumulated total read-only, matching itemPanel.js's "total always
      // visible" treatment.
      el('span', { className: 'daily-todo-time-spent', 'data-timer-display': todo.id, text: formatTimeSpent(todo.timeSpentSeconds || 0) }),
      !todo.done ? el('button', {
        type: 'button',
        className: `daily-todo-timer-btn ${runningTimers[todo.id] != null ? 'active' : ''}`,
        'data-action': 'timer',
        'aria-label': runningTimers[todo.id] != null ? `Pause timer for "${todo.title}"` : `Start timer for "${todo.title}"`,
        title: runningTimers[todo.id] != null ? 'Pause timer' : 'Start timer',
        onClick: () => handleToggleTimer(todo)
      }, [createIcon(runningTimers[todo.id] != null ? 'pause' : 'play', { size: 'xs' })]) : null,
      el('button', {
        type: 'button',
        className: 'daily-todo-delete',
        'data-action': 'delete',
        'aria-label': `Delete "${todo.title}"`,
        title: 'Delete',
        onClick: () => handleDelete(todo)
      }, [createIcon('close', { size: 'xs' })])
    ].filter(Boolean));
  }

  // Purely cosmetic, device-level preference — see the KEYS.DAILY_TODOS_COLLAPSED
  // comment in localStorageKeys.js for why this reads/writes localStorage
  // directly (THEME's pattern) instead of going through roadmapStore's
  // per-account getUiState/setUiState. Absent key (a brand-new browser, or a
  // returning user's first visit on a new device) reads as `false` —
  // expanded — so first sign-in always shows the full panel, never
  // pre-collapsed.
  let collapsed = localStorage.getItem(KEYS.DAILY_TODOS_COLLAPSED) === 'true';

  // Opt-in local reminder toggle (issue #132) — off by default, never
  // requested on page load. requestPermission() must come from a real click.
  const reminderBtn = el('button', {
    type: 'button',
    className: 'daily-todo-reminder-btn',
    onClick: async () => {
      if (remindersEnabled()) {
        disableReminders();
        applyReminderState();
        showToast('Reminders turned off.', 'success');
        return;
      }
      const granted = await enableReminders();
      applyReminderState();
      showToast(
        granted ? 'Reminders on — you\'ll get a notification 15 minutes before a todo is due.' : 'Notifications were blocked — enable them in your browser settings to use reminders.',
        granted ? 'success' : 'error'
      );
    }
  }, [createIcon('bell', { size: 'sm' })]);

  function applyReminderState() {
    const enabled = remindersEnabled();
    reminderBtn.classList.toggle('active', enabled);
    reminderBtn.setAttribute('aria-pressed', String(enabled));
    reminderBtn.setAttribute('aria-label', enabled ? 'Turn off due-soon reminders' : 'Turn on due-soon reminders');
    reminderBtn.title = enabled ? 'Reminders on' : 'Remind me';
  }

  const countBadge = el('span', { className: 'daily-todo-count-badge' });
  const collapseBtn = el('button', {
    type: 'button',
    className: 'daily-todo-collapse-btn',
    onClick: () => {
      collapsed = !collapsed;
      localStorage.setItem(KEYS.DAILY_TODOS_COLLAPSED, String(collapsed));
      applyCollapsedState();
    }
  }, [el('span', { className: 'chevron' }, [createIcon('chevron', { size: 'sm' })])]);

  function applyCollapsedState() {
    node.classList.toggle('collapsed', collapsed);
    collapseBtn.setAttribute('aria-expanded', String(!collapsed));
    collapseBtn.setAttribute('aria-label', collapsed ? 'Expand Today\'s Todos' : 'Collapse Today\'s Todos');
    collapseBtn.title = collapsed ? 'Expand' : 'Collapse';
  }

  function render() {
    const now = Date.now();
    const todos = store.getSnapshot().todos;
    const active = todos.filter(t => !isExpired(t, now)).sort((a, b) => a.expiresAt - b.expiresAt);
    const missed = todos.filter(t => isExpired(t, now)).sort((a, b) => b.expiresAt - a.expiresAt);

    activeList.replaceChildren();
    if (!active.length) {
      activeList.append(el('p', { className: 'daily-todo-empty', text: 'Nothing due in the next while — add one above.' }));
    } else {
      active.forEach(todo => activeList.append(renderRow(todo, now)));
    }

    missedToggle.textContent = `▸ Missed (${missed.length})`;
    missedToggle.hidden = missed.length === 0;
    missedList.replaceChildren();
    missed.forEach(todo => missedList.append(renderRow(todo, now)));
    if (!missed.length) missedList.hidden = true;

    // Only rendered while collapsed (see CSS) — shown so shrinking the panel
    // never fully hides whether there's anything to come back for.
    countBadge.textContent = active.length === 1 ? '1 active' : `${active.length} active`;
  }

  const unsubStore = store.subscribe(render);
  const tickTimer = setInterval(render, TICK_MS);

  const node = el('section', { className: 'daily-todo-panel' }, [
    el('div', { className: 'daily-todo-heading-row' }, [
      el('span', { className: 'daily-todo-icon' }, [createIcon('timer', { size: 'sm' })]),
      el('h2', { className: 'daily-todo-heading', text: "Today's Todos" }),
      countBadge,
      createFeatureBadge('daily-todo-reminders'),
      reminderBtn,
      el('button', {
        type: 'button',
        className: 'daily-todo-info-btn',
        'aria-label': "About Today's Todos",
        title: "About Today's Todos",
        onClick: () => openDailyTodoGuide()
      }, [createIcon('info', { size: 'sm' })]),
      collapseBtn
    ]),
    addForm,
    activeList,
    missedToggle,
    missedList
  ]);

  applyCollapsedState();
  applyReminderState();

  node._cleanup = () => {
    // A running timer must never keep ticking against an unmounted panel —
    // flush each one's elapsed session before tearing down, same reasoning
    // as itemPanel.js's own close()-time flush.
    Object.entries(runningTimers).forEach(([id, startedAt]) => {
      store.addTimeSpent(id, computeElapsedSeconds(startedAt));
    });
    unsubStore();
    clearInterval(tickTimer);
    clearInterval(timerTickTimer);
    durationSelect._cleanup?.();
  };

  return node;
}
