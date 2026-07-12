import { el } from '../dom.js';
import { attachFocusTrap } from './modal.js';
import { createSelect } from './select.js';
import { MAX_TODO_TITLE_LENGTH, DURATION_PRESETS, MIN_DURATION_MS, MAX_DURATION_MS } from '../../core/dailyTodo/limits.js';

const CUSTOM_VALUE = 'custom';
const DEFAULT_PRESET_MS = DURATION_PRESETS.find(p => p.label === '24 hours')?.ms || DURATION_PRESETS[0].ms;

// "Add this topic to Today's Todos" (issue #56 follow-up) — reachable from a
// button on every roadmap checklist row (see dashboard.js's renderItemRow).
// Same `.modal-overlay`/`.modal-card` chrome and promise-based contract as
// openCreateRoadmapModal()/confirmDialog() — collects only the one thing not
// already known (how long you have), with the topic's own title editable in
// case you want the todo phrased differently. Resolves
// `{ title, durationMs } | null` (null on cancel/Escape/outside-click).
export function openAddToDailyTodoModal({ topicTitle }) {
  return new Promise(resolve => {
    function close(result) {
      detachTrap();
      durationSelect._cleanup?.();
      overlay.remove();
      resolve(result);
    }

    const message = el('p', { className: 'form-message', text: '' });
    const titleInput = el('input', {
      className: 'field-input',
      value: topicTitle,
      maxlength: String(MAX_TODO_TITLE_LENGTH)
    });

    const durationSelect = createSelect(
      [...DURATION_PRESETS.map(p => ({ value: String(p.ms), label: p.label })), { value: CUSTOM_VALUE, label: 'Custom…' }],
      { value: String(DEFAULT_PRESET_MS), ariaLabel: 'Due in', className: 'todo-duration-select' }
    );

    const customHoursInput = el('input', {
      className: 'field-input todo-custom-hours',
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
        return Number.isFinite(hours) ? hours * 3600000 : null;
      }
      return parseInt(durationSelect.value, 10);
    }

    function handleSubmit(e) {
      e.preventDefault();
      const title = titleInput.value.trim();
      if (!title) {
        message.textContent = 'Give this todo a title.';
        message.className = 'form-message error';
        titleInput.focus();
        return;
      }
      if (title.length > MAX_TODO_TITLE_LENGTH) {
        message.textContent = `Title must be ${MAX_TODO_TITLE_LENGTH} characters or fewer.`;
        message.className = 'form-message error';
        return;
      }
      const durationMs = selectedDurationMs();
      if (durationMs === null) {
        message.textContent = 'Enter a valid number of hours.';
        message.className = 'form-message error';
        return;
      }
      close({ title, durationMs });
    }

    const form = el('form', { className: 'auth-form', onSubmit: handleSubmit }, [
      el('label', { className: 'field' }, [
        el('span', { className: 'field-label', text: 'Todo title' }),
        titleInput
      ]),
      el('label', { className: 'field' }, [
        el('span', { className: 'field-label', text: 'Due in' }),
        durationSelect
      ]),
      customHoursInput,
      message,
      el('button', { type: 'submit', className: 'btn btn-primary btn-block', text: "Add to Today's Todos" }),
      el('button', {
        type: 'button',
        className: 'btn btn-secondary btn-block',
        text: 'Cancel',
        onClick: () => close(null)
      })
    ]);

    const card = el('div', { className: 'modal-card' }, [
      el('h2', { className: 'modal-title', text: "Add to Today's Todos" }),
      form
    ]);

    const overlay = el('div', {
      className: 'modal-overlay',
      role: 'dialog',
      'aria-modal': 'true',
      'aria-label': "Add to Today's Todos",
      onClick: e => { if (e.target === overlay) close(null); }
    }, [card]);

    const detachTrap = attachFocusTrap(card, { onEscape: () => close(null) });
    document.body.appendChild(overlay);
    titleInput.focus();
    titleInput.select();
  });
}
