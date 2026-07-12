import { el, isValidUrl } from '../dom.js';
import { confirmDialog } from './confirmDialog.js';
import { createIcon } from './icons.js';
import { createDecorativeIcon } from './decorativeIcon.js';
import { createSelect } from './select.js';
import { MAX_TITLE_LENGTH, MAX_RESOURCE_LABEL_LENGTH, MAX_RESOURCE_URL_LENGTH } from '../../core/roadmap/limits.js';
import { detectLinkType, LINK_TYPE_META } from '../utils/linkDetector.js';

// Issue #15 — plain-string notes field, capped at 5000 chars (enforced both
// here via the textarea's native maxlength and in roadmapStore/schema docs).
const NOTES_MAX_LENGTH = 5000;
const NOTES_AUTOSAVE_DEBOUNCE_MS = 800;
const NOTES_SAVED_INDICATOR_MS = 1500;

export function openItemPanel({ item, onSave, onDelete, onClose, focusField }) {
  const overlay = el('div', { className: 'panel-overlay', onClick: e => { if (e.target === overlay) close(); } });
  const panel = el('aside', { className: 'item-panel', role: 'dialog', 'aria-modal': 'true', 'aria-label': 'Edit topic' });

  const titleInput = el('input', { className: 'field-input', value: item.title, placeholder: 'Topic title' });
  const prioritySelect = createSelect(
    ['P0', 'P1', 'P2', 'P3'].map(p => ({ value: p, label: p })),
    { value: item.priority, ariaLabel: 'Priority' }
  );
  const resourceList = el('div', { className: 'resource-list' });
  const labelInput = el('input', { className: 'field-input', placeholder: 'Resource label (e.g. YouTube tutorial)' });
  const urlInput = el('input', { className: 'field-input', placeholder: 'https://...', type: 'url' });
  const formError = el('p', { className: 'form-error', text: '' });

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
      resourceList.append(el('p', { className: 'muted small', text: 'No resources yet. Add links below.' }));
      return;
    }
    resources.forEach((resource, index) => {
      const linkType = detectLinkType(resource.url);
      const meta = LINK_TYPE_META[linkType];
      const urlWarning = el('p', { className: 'field-error resource-url-warning', text: '' });

      const urlInput = el('input', {
        className: 'field-input compact',
        value: resource.url,
        'aria-label': 'Resource URL',
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
            'aria-label': 'Resource label',
            onInput: e => { resources[index] = { ...resources[index], label: e.target.value }; }
          }),
          urlInput,
          urlWarning
        ]),
        el('div', { className: 'resource-actions' }, [
          el('a', { className: 'btn btn-ghost btn-sm', href: isValidUrl(resource.url) ? resource.url : '#', target: '_blank', rel: 'noopener noreferrer', text: 'Open' }),
          el('button', {
            type: 'button',
            className: 'btn btn-danger btn-sm',
            text: 'Remove',
            onClick: () => { resources.splice(index, 1); renderResources(); }
          })
        ])
      ]);
      resourceList.append(row);
    });
  }

  function close() {
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
            clearTimeout(notesSaveTimer);
            notesSaveTimer = null;
            onSave?.({ title, priority: prioritySelect.value, resources: cleanResources, notes: notesTextarea.value });
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
