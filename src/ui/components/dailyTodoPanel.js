import { el } from '../dom.js';
import { showToast } from './toast.js';
import { isExpired, remainingMs, formatRemaining, remainingBand } from '../utils/dailyTodo.js';
import { MAX_TODO_TITLE_LENGTH, MAX_ACTIVE_TODOS, DURATION_PRESETS, MIN_DURATION_MS, MAX_DURATION_MS } from '../../core/dailyTodo/limits.js';

const CUSTOM_VALUE = 'custom';
const DEFAULT_PRESET_MS = DURATION_PRESETS.find(p => p.label === '24 hours')?.ms || DURATION_PRESETS[0].ms;
// 30s resolution is enough for hour/minute-granularity countdown text.
const TICK_MS = 30000;

// A new instance of the exact hazard CLAUDE.md's "Component subscription
// cleanup" rule already covers for store subscriptions — a setInterval left
// running after this panel's DOM node is removed leaks just like an
// unremoved subscription. Returns the panel node with `_cleanup` set
// (matching createThemeToggle's convention), wired into dashboard.js's route
// cleanup.
export function createDailyTodoPanel(store) {
  const titleInput = el('input', {
    className: 'field-input compact inline-add',
    placeholder: 'Add a todo, due in…',
    maxlength: String(MAX_TODO_TITLE_LENGTH)
  });

  const durationSelect = el('select', { className: 'field-input compact todo-duration-select' }, [
    ...DURATION_PRESETS.map(p => el('option', { value: String(p.ms), text: p.label })),
    el('option', { value: CUSTOM_VALUE, text: 'Custom…' })
  ]);
  durationSelect.value = String(DEFAULT_PRESET_MS);

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
      showToast(`Todo title must be ${MAX_TODO_TITLE_LENGTH} characters or fewer`, 'error');
      return;
    }
    const durationMs = selectedDurationMs();
    if (durationMs === null) {
      showToast('Enter a valid number of hours', 'error');
      return;
    }
    const added = store.addTodo({ title, durationMs });
    if (!added) {
      showToast(`You can have at most ${MAX_ACTIVE_TODOS} active todos at once`, 'error');
      return;
    }
    titleInput.value = '';
    durationSelect.value = String(DEFAULT_PRESET_MS);
    customHoursInput.hidden = true;
    customHoursInput.value = '';
    showToast(`Added "${title}"`, 'success');
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

  function renderRow(todo, now) {
    const ms = remainingMs(todo, now);
    const band = todo.done ? null : remainingBand(ms);
    return el('div', {
      className: `daily-todo-item ${todo.done ? 'done' : ''}`,
      dataset: { id: todo.id }
    }, [
      el('label', { className: 'daily-todo-checkbox' }, [
        el('input', {
          type: 'checkbox',
          checked: todo.done ? 'checked' : null,
          'aria-label': `Mark "${todo.title}" ${todo.done ? 'not done' : 'done'}`,
          onChange: () => store.setDone(todo.id, !todo.done)
        }),
        el('span', { className: 'daily-todo-title', text: todo.title })
      ]),
      !todo.done ? el('span', { className: `daily-todo-remaining ${band}`, text: formatRemaining(ms) }) : null
    ].filter(Boolean));
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
  }

  const unsubStore = store.subscribe(render);
  const tickTimer = setInterval(render, TICK_MS);

  const node = el('section', { className: 'daily-todo-panel' }, [
    el('h2', { className: 'daily-todo-heading', text: "Today's Todos" }),
    addForm,
    activeList,
    missedToggle,
    missedList
  ]);

  node._cleanup = () => {
    unsubStore();
    clearInterval(tickTimer);
  };

  return node;
}
