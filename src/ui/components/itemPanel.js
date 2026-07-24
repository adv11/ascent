import { el, isValidUrl } from '../dom.js';
import { confirmDialog } from './confirmDialog.js';
import { createIcon } from './icons.js';
import { createDecorativeIcon } from './decorativeIcon.js';
import { createSelect } from './select.js';
import { MAX_TITLE_LENGTH, MAX_RESOURCE_LABEL_LENGTH, MAX_RESOURCE_URL_LENGTH, MAX_TAG_LENGTH, MAX_TAGS_PER_ITEM } from '../../core/roadmap/limits.js';
import { detectLinkType, LINK_TYPE_META } from '../utils/linkDetector.js';
import { computeElapsedSeconds, formatTimeSpent } from '../../core/time/timeTracking.js';
import { createFeatureBadge } from './featureBadge.js';

// Issue #15 — plain-string notes field, capped at 5000 chars (enforced both
// here via the textarea's native maxlength and in roadmapStore/schema docs).
const NOTES_MAX_LENGTH = 5000;
const NOTES_AUTOSAVE_DEBOUNCE_MS = 800;
const NOTES_SAVED_INDICATOR_MS = 1500;
// Issue #180 — live elapsed-time display tick while a timer is running.
const TIMER_TICK_MS = 1000;

// Issue #329 — manually-triggered, best-effort resource link check. A browser
// `fetch(url, { mode: 'no-cors' })` cannot see a cross-origin response's real
// HTTP status (no CORS grant means the response comes back opaque), so this
// can only ever answer "did the network request itself fail outright
// (DNS/connection-level), or not" — never "does this page actually exist."
// A real network-level failure (DNS error, connection refused, offline) *does*
// reject the fetch promise even under `no-cors`, since CORS only restricts
// reading the response, not making the request — that's the one signal this
// can reliably surface. See `.claude/rules/roadmap-store.md` for the same
// caveat documented alongside the store's other resource-URL rules, so a
// future contributor doesn't "fix" the common could-not-verify result by
// weakening the messaging below into a false claim of certainty.
const LINK_CHECK_STATUS = { REACHABLE: 'reachable', UNVERIFIED: 'unverified', OFFLINE: 'offline' };
const LINK_CHECK_MESSAGES = {
  [LINK_CHECK_STATUS.REACHABLE]: 'Likely reachable — your browser got a response.',
  [LINK_CHECK_STATUS.UNVERIFIED]: 'Could not verify this link from your browser — open it to check.',
  [LINK_CHECK_STATUS.OFFLINE]: 'Can\'t check links while you\'re offline.'
};

// Exported for unit testing (mocking `fetch` for each outcome branch) — not
// used anywhere outside this module otherwise.
export async function checkResourceLink(url) {
  if (typeof navigator !== 'undefined' && navigator.onLine === false) return LINK_CHECK_STATUS.OFFLINE;
  if (typeof fetch !== 'function') return LINK_CHECK_STATUS.OFFLINE;
  try {
    await fetch(url, { method: 'HEAD', mode: 'no-cors' });
    return LINK_CHECK_STATUS.REACHABLE;
  } catch {
    return LINK_CHECK_STATUS.UNVERIFIED;
  }
}

export function openItemPanel({ item, allItems, onSave, onDelete, onClose, focusField }) {
  const overlay = el('div', { className: 'panel-overlay', onClick: e => { if (e.target === overlay) close(); } });
  const panel = el('aside', { className: 'item-panel', role: 'dialog', 'aria-modal': 'true', 'aria-label': 'Edit topic' });

  const titleInput = el('input', { className: 'field-input', value: item.title, placeholder: 'Topic title' });
  const prioritySelect = createSelect(
    ['P0', 'P1', 'P2', 'P3'].map(p => ({ value: p, label: p })),
    { value: item.priority, ariaLabel: 'Priority' }
  );

  // Issue #381 — optional single prerequisite, picked from every other
  // non-deleted topic in the same roadmap. A missing/empty value means "no
  // prerequisite," same backward-compat convention as notes/tags. The store
  // (updateItem()) rejects a patch that would create a cycle — this select
  // only excludes the topic itself, it doesn't try to pre-filter the option
  // list for a would-be cycle.
  const prerequisiteOptions = [{ value: '', label: 'None' }].concat(
    (allItems || [])
      .filter(other => other.id !== item.id && !other.deleted)
      .map(other => ({ value: other.id, label: other.title }))
  );
  const prerequisiteSelect = createSelect(
    prerequisiteOptions,
    { value: item.prerequisiteItemId || '', ariaLabel: 'Blocked by' }
  );
  const resourceList = el('div', { className: 'resource-list' });
  const labelInput = el('input', { className: 'field-input', placeholder: 'Resource label (e.g. YouTube tutorial)' });
  const urlInput = el('input', { className: 'field-input', placeholder: 'https://...', type: 'url' });
  const formError = el('p', { className: 'form-error', text: '' });

  // Issue #182 — freeform pattern/concept tags, comma-separated in one text
  // input (same lightweight shape as the resource form's plain inputs,
  // rather than a bespoke chip-entry widget). Cleaned/capped on Save, same
  // convention as `cleanResources` below.
  const tagsInput = el('input', {
    className: 'field-input',
    placeholder: 'e.g. two-pointer, sliding-window',
    value: (item.tags || []).join(', ')
  });
  const tagsHint = el('span', { className: 'small muted', text: `Comma-separated, up to ${MAX_TAGS_PER_ITEM} tags.` });

  const notesTextarea = el('textarea', {
    className: 'field-input notes-textarea',
    placeholder: 'Your personal notes, tips, examples…',
    rows: '4',
    maxlength: String(NOTES_MAX_LENGTH)
  });
  notesTextarea.value = item.notes || '';
  const notesCounter = el('span', { className: 'notes-counter small muted', text: '' });
  const notesStatus = el('span', { className: 'notes-status', text: '' });

  let resources = [...(item.resources || [])];
  let notesSaveTimer = null;
  // Issue #329 — guards a still-in-flight link check from writing into
  // detached DOM once the panel has been closed mid-fetch.
  let panelClosed = false;

  // Issue #180 — lightweight time tracking. `timeSpentSeconds` is the
  // persisted cumulative total (patched via the same `onSave` → updateItem()
  // path every other field uses); `runningSince` is local-only UI state (a
  // running timer never syncs across devices/tabs, only the stopped result
  // does — see the issue's own scoping). Pausing/stopping folds the current
  // session into `timeSpentSeconds` exactly once and persists immediately,
  // rather than waiting for the notes autosave debounce.
  let timeSpentSeconds = Number.isFinite(item.timeSpentSeconds) ? item.timeSpentSeconds : 0;
  let runningSince = null;
  let timerTickTimer = null;

  const timerToggleBtn = el('button', {
    type: 'button',
    className: 'btn btn-ghost btn-icon timer-toggle-btn',
    'aria-label': 'Start timer',
    title: 'Start timer'
  }, [createIcon('play', { size: 'xs' })]);
  const timerDisplay = el('span', { className: 'timer-display', text: formatTimeSpent(timeSpentSeconds) });
  const timerResetBtn = el('button', {
    type: 'button',
    className: 'btn btn-ghost btn-icon timer-reset-btn',
    'aria-label': 'Reset time tracked',
    title: 'Reset time tracked',
    onClick: async () => {
      if (await confirmDialog({
        title: 'Reset time tracked?',
        message: 'This clears the time tracked for this topic — this cannot be undone.',
        confirmText: 'Reset',
        danger: true
      })) {
        resetTimer();
      }
    }
  }, [createIcon('reset', { size: 'xs' })]);

  function renderTimerDisplay() {
    const total = runningSince !== null ? timeSpentSeconds + computeElapsedSeconds(runningSince) : timeSpentSeconds;
    timerDisplay.textContent = formatTimeSpent(total);
  }

  function stopTimer() {
    if (runningSince === null) return;
    timeSpentSeconds += computeElapsedSeconds(runningSince);
    runningSince = null;
    clearInterval(timerTickTimer);
    timerTickTimer = null;
    renderTimerDisplay();
    onSave?.({ timeSpentSeconds });
  }

  function resetTimer() {
    if (runningSince !== null) {
      runningSince = null;
      clearInterval(timerTickTimer);
      timerTickTimer = null;
      timerToggleBtn.replaceChildren(createIcon('play', { size: 'xs' }));
      timerToggleBtn.setAttribute('aria-label', 'Start timer');
      timerToggleBtn.title = 'Start timer';
      timerToggleBtn.classList.remove('active');
    }
    timeSpentSeconds = 0;
    renderTimerDisplay();
    onSave?.({ timeSpentSeconds });
  }

  function toggleTimer() {
    if (runningSince !== null) {
      stopTimer();
      timerToggleBtn.replaceChildren(createIcon('play', { size: 'xs' }));
      timerToggleBtn.setAttribute('aria-label', 'Start timer');
      timerToggleBtn.title = 'Start timer';
      timerToggleBtn.classList.remove('active');
      return;
    }
    runningSince = Date.now();
    timerTickTimer = setInterval(renderTimerDisplay, TIMER_TICK_MS);
    timerToggleBtn.replaceChildren(createIcon('pause', { size: 'xs' }));
    timerToggleBtn.setAttribute('aria-label', 'Pause timer');
    timerToggleBtn.title = 'Pause timer';
    timerToggleBtn.classList.add('active');
  }

  timerToggleBtn.addEventListener('click', toggleTimer);

  function updateNotesCounter() {
    const len = notesTextarea.value.length;
    notesCounter.textContent = len > NOTES_MAX_LENGTH * 0.8 ? `${len} / ${NOTES_MAX_LENGTH}` : '';
  }

  function showNotesSaved() {
    notesStatus.replaceChildren(createIcon('check', { size: 'xs' }), ' Autosaved');
    notesStatus.className = 'notes-status show';
    setTimeout(() => notesStatus.classList.remove('show'), NOTES_SAVED_INDICATOR_MS);
  }

  function showNotesError() {
    notesStatus.textContent = 'Failed to save — check connection';
    notesStatus.className = 'notes-status show error';
  }

  function scheduleNotesAutosave() {
    clearTimeout(notesSaveTimer);
    notesStatus.classList.remove('show', 'error');
    notesSaveTimer = setTimeout(() => {
      try {
        onSave?.({ notes: notesTextarea.value });
        showNotesSaved();
      } catch {
        showNotesError();
      }
    }, NOTES_AUTOSAVE_DEBOUNCE_MS);
  }

  notesTextarea.addEventListener('input', () => {
    updateNotesCounter();
    scheduleNotesAutosave();
  });
  updateNotesCounter();

  function renderResources() {
    resourceList.replaceChildren();
    if (!resources.length) {
      resourceList.append(el('p', { className: 'resource-list-empty' }, [
        el('span', { className: 'resource-list-empty-dot', 'aria-hidden': 'true' }),
        el('span', { text: 'No resources yet. Add links below.' })
      ]));
      return;
    }
    resources.forEach((resource, index) => {
      const linkType = detectLinkType(resource.url);
      const meta = LINK_TYPE_META[linkType];
      const urlWarning = el('p', { className: 'field-error resource-url-warning', text: '' });

      const resourceLabel = resource.label?.trim() || `Resource ${index + 1}`;

      const urlInput = el('input', {
        className: 'field-input compact',
        value: resource.url,
        'aria-label': `${resourceLabel} URL`,
        onInput: e => { resources[index] = { ...resources[index], url: e.target.value }; },
        // Issue #22/#12B Phase 4 — an edited existing resource URL was never
        // re-validated, only a newly-added one. Re-validate on blur so a
        // javascript:/data: URI typed into an existing row is caught before
        // Save, not just at add-time.
        onBlur: () => {
          const value = resources[index].url.trim();
          urlWarning.textContent = value && !isValidUrl(value) ? 'Enter a valid http or https URL.' : '';
        }
      });

      const checkStatus = el('p', { className: 'small muted resource-check-status', text: '' });
      const checkBtn = el('button', {
        type: 'button',
        className: 'btn btn-ghost btn-sm',
        text: 'Check link',
        title: 'Best-effort only — most sites don\'t let a browser see their real response, so "could not verify" is a common, expected result.',
        onClick: () => handleCheckLink(resource.url, checkBtn, checkStatus)
      });

      const row = el('div', { className: 'resource-card' }, [
        el('div', { className: 'resource-card-header' }, [
          el('span', { className: `link-badge ${meta.badgeClass}` }, [
            el('span', { className: 'link-badge-icon', 'aria-hidden': 'true' }, [createDecorativeIcon(meta.icon, { size: 'xs' })]),
            meta.label
          ])
        ]),
        el('div', { className: 'resource-meta' }, [
          el('input', {
            className: 'field-input compact resource-label-input',
            value: resource.label,
            'aria-label': `Resource ${index + 1} label`,
            onInput: e => { resources[index] = { ...resources[index], label: e.target.value }; }
          }),
          urlInput,
          urlWarning
        ]),
        el('div', { className: 'resource-actions' }, [
          el('a', { className: 'btn btn-ghost btn-sm', href: isValidUrl(resource.url) ? resource.url : '#', target: '_blank', rel: 'noopener noreferrer', text: 'Open' }),
          checkBtn,
          el('button', {
            type: 'button',
            className: 'btn btn-danger btn-sm',
            text: 'Remove',
            onClick: () => { resources.splice(index, 1); renderResources(); }
          })
        ]),
        checkStatus
      ]);
      resourceList.append(row);
    });
  }

  // Issue #329 — never automatic, only ever run from this button's own click
  // handler, so opening a topic's edit panel never fires an unexpected
  // outbound network call on its own.
  async function handleCheckLink(url, btn, statusEl) {
    if (!isValidUrl(url)) {
      statusEl.textContent = 'Enter a valid http or https URL before checking.';
      statusEl.className = 'small muted resource-check-status error';
      return;
    }
    btn.disabled = true;
    statusEl.textContent = 'Checking…';
    statusEl.className = 'small muted resource-check-status';
    const status = await checkResourceLink(url);
    if (panelClosed) return;
    btn.disabled = false;
    statusEl.replaceChildren(
      createIcon(status === LINK_CHECK_STATUS.REACHABLE ? 'check' : 'warning', { size: 'xs' }),
      ` ${LINK_CHECK_MESSAGES[status]}`
    );
    statusEl.className = `small muted resource-check-status ${status}`;
  }

  function close() {
    panelClosed = true;
    // A running timer must never keep ticking against an unmounted panel —
    // fold its elapsed session into the total and persist, same reasoning
    // as the notes-autosave flush just below.
    if (runningSince !== null) stopTimer();
    // Flush a pending notes autosave immediately rather than letting the
    // debounce timer close over an unmounted panel — an edit made just
    // before closing must never be silently dropped.
    if (notesSaveTimer) {
      clearTimeout(notesSaveTimer);
      notesSaveTimer = null;
      if (notesTextarea.value !== (item.notes || '')) onSave?.({ notes: notesTextarea.value });
    }
    overlay.classList.remove('show');
    panel.classList.remove('show');
    prioritySelect._cleanup?.();
    prerequisiteSelect._cleanup?.();
    setTimeout(() => overlay.remove(), 240);
    onClose?.();
  }

  function addResource() {
    formError.textContent = '';
    const label = labelInput.value.trim();
    const url = urlInput.value.trim();
    if (!label || !url) {
      formError.textContent = 'Enter both label and URL.';
      return;
    }
    if (!isValidUrl(url)) {
      formError.textContent = 'Enter a valid http or https URL.';
      return;
    }
    if (label.length > MAX_RESOURCE_LABEL_LENGTH) {
      formError.textContent = `Resource label must be ${MAX_RESOURCE_LABEL_LENGTH} characters or fewer.`;
      return;
    }
    if (url.length > MAX_RESOURCE_URL_LENGTH) {
      formError.textContent = `Resource URL must be ${MAX_RESOURCE_URL_LENGTH} characters or fewer.`;
      return;
    }
    resources.push({ label, url });
    labelInput.value = '';
    urlInput.value = '';
    renderResources();
  }

  panel.append(
    el('div', { className: 'panel-header' }, [
      el('div', {}, [
        el('p', { className: 'panel-kicker', text: `${item.phase} · ${item.section}` }),
        el('h2', { className: 'panel-title', text: 'Edit topic' })
      ]),
      el('button', { type: 'button', className: 'btn btn-ghost btn-icon', 'aria-label': 'Close', onClick: close }, [createIcon('close', { size: 'sm' })])
    ]),
    el('div', { className: 'panel-body' }, [
      el('label', { className: 'field' }, [
        el('span', { className: 'field-label', text: 'Title' }),
        titleInput
      ]),
      el('label', { className: 'field' }, [
        el('span', { className: 'field-label', text: 'Priority' }),
        prioritySelect
      ]),
      el('label', { className: 'field' }, [
        el('span', { className: 'field-label', text: 'Blocked by' }),
        prerequisiteSelect
      ]),
      el('label', { className: 'field' }, [
        el('span', { className: 'field-label', text: 'Tags' }),
        tagsInput,
        tagsHint
      ]),
      el('div', { className: 'field' }, [
        el('span', { className: 'field-label' }, [
          el('span', { text: 'Time tracked' }),
          createFeatureBadge('time-tracking')
        ].filter(Boolean)),
        el('div', { className: 'timer-row' }, [timerToggleBtn, timerDisplay, timerResetBtn])
      ]),
      el('div', { className: 'field' }, [
        el('div', { className: 'field-label-row' }, [
          el('span', { className: 'field-label', text: 'Notes' }),
          notesCounter,
          notesStatus
        ]),
        notesTextarea
      ]),
      el('div', { className: 'field' }, [
        el('span', { className: 'field-label', text: 'Resources' }),
        resourceList,
        el('div', { className: 'resource-add' }, [
          labelInput,
          urlInput,
          el('button', { type: 'button', className: 'btn btn-secondary btn-sm', text: 'Add resource', onClick: addResource })
        ]),
        formError
      ])
    ]),
    el('div', { className: 'panel-footer' }, [
      el('button', {
        type: 'button',
        className: 'btn btn-danger',
        text: 'Delete topic',
        onClick: async () => {
          if (await confirmDialog({
            title: `Delete "${item.title}"?`,
            message: 'This removes the topic and its resources from your roadmap — this cannot be undone.',
            confirmText: 'Delete',
            danger: true
          })) {
            onDelete?.();
            close();
          }
        }
      }),
      el('div', { className: 'panel-footer-right' }, [
        el('button', { type: 'button', className: 'btn btn-ghost', text: 'Cancel', onClick: close }),
        el('button', {
          type: 'button',
          className: 'btn btn-primary',
          text: 'Save changes',
          onClick: () => {
            const title = titleInput.value.trim();
            if (!title) {
              formError.textContent = 'Title cannot be empty.';
              return;
            }
            if (title.length > MAX_TITLE_LENGTH) {
              formError.textContent = `Title must be ${MAX_TITLE_LENGTH} characters or fewer.`;
              return;
            }
            const cleanResources = resources
              .map(r => ({ label: r.label.trim(), url: r.url.trim() }))
              .filter(r => r.label && r.url);
            const badUrl = cleanResources.find(r => !isValidUrl(r.url));
            if (badUrl) {
              formError.textContent = 'One or more resource URLs must be a valid http or https URL.';
              return;
            }
            const badLength = cleanResources.find(r => r.label.length > MAX_RESOURCE_LABEL_LENGTH || r.url.length > MAX_RESOURCE_URL_LENGTH);
            if (badLength) {
              formError.textContent = `Resource labels must be ${MAX_RESOURCE_LABEL_LENGTH} characters or fewer and URLs ${MAX_RESOURCE_URL_LENGTH} or fewer.`;
              return;
            }
            const tags = tagsInput.value.split(',').map(t => t.trim()).filter(Boolean);
            if (tags.length > MAX_TAGS_PER_ITEM) {
              formError.textContent = `Enter at most ${MAX_TAGS_PER_ITEM} tags.`;
              return;
            }
            const badTag = tags.find(t => t.length > MAX_TAG_LENGTH);
            if (badTag) {
              formError.textContent = `Each tag must be ${MAX_TAG_LENGTH} characters or fewer.`;
              return;
            }
            clearTimeout(notesSaveTimer);
            notesSaveTimer = null;
            const ok = onSave?.({
              title,
              priority: prioritySelect.value,
              prerequisiteItemId: prerequisiteSelect.value || null,
              resources: cleanResources,
              notes: notesTextarea.value,
              tags
            });
            if (ok === false) {
              formError.textContent = 'That would create a circular prerequisite — pick a different topic.';
              return;
            }
            close();
          }
        })
      ])
    ])
  );

  overlay.append(panel);
  document.body.append(overlay);
  renderResources();
  requestAnimationFrame(() => {
    overlay.classList.add('show');
    panel.classList.add('show');
    (focusField === 'notes' ? notesTextarea : titleInput).focus();
  });

  const onKey = e => { if (e.key === 'Escape') close(); };
  window.addEventListener('keydown', onKey);
  return () => {
    window.removeEventListener('keydown', onKey);
    overlay.remove();
  };
}
