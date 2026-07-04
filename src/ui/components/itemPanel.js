import { el, isValidUrl } from '../dom.js';

export function openItemPanel({ item, onSave, onDelete, onClose }) {
  const overlay = el('div', { className: 'panel-overlay', onClick: e => { if (e.target === overlay) close(); } });
  const panel = el('aside', { className: 'item-panel', role: 'dialog', 'aria-modal': 'true', 'aria-label': 'Edit topic' });

  const titleInput = el('input', { className: 'field-input', value: item.title, placeholder: 'Topic title' });
  const prioritySelect = el('select', { className: 'field-input' });
  ['P0', 'P1', 'P2', 'P3'].forEach(p => {
    const opt = el('option', { value: p, text: p });
    if (item.priority === p) opt.selected = true;
    prioritySelect.append(opt);
  });
  const resourceList = el('div', { className: 'resource-list' });
  const labelInput = el('input', { className: 'field-input', placeholder: 'Resource label (e.g. YouTube tutorial)' });
  const urlInput = el('input', { className: 'field-input', placeholder: 'https://...', type: 'url' });
  const formError = el('p', { className: 'form-error', text: '' });

  let resources = [...(item.resources || [])];

  function renderResources() {
    resourceList.replaceChildren();
    if (!resources.length) {
      resourceList.append(el('p', { className: 'muted small', text: 'No resources yet. Add links below.' }));
      return;
    }
    resources.forEach((resource, index) => {
      const row = el('div', { className: 'resource-row' }, [
        el('div', { className: 'resource-meta' }, [
          el('input', {
            className: 'field-input compact',
            value: resource.label,
            onInput: e => { resources[index] = { ...resources[index], label: e.target.value }; }
          }),
          el('input', {
            className: 'field-input compact',
            value: resource.url,
            onInput: e => { resources[index] = { ...resources[index], url: e.target.value }; }
          })
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
    overlay.classList.remove('show');
    panel.classList.remove('show');
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
      el('button', { type: 'button', className: 'btn btn-ghost btn-icon', 'aria-label': 'Close', text: '×', onClick: close })
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
        onClick: () => {
          if (confirm(`Delete "${item.title}"?`)) {
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
            const cleanResources = resources
              .map(r => ({ label: r.label.trim(), url: r.url.trim() }))
              .filter(r => r.label && r.url);
            const badUrl = cleanResources.find(r => !isValidUrl(r.url));
            if (badUrl) {
              formError.textContent = 'One or more resource URLs must be a valid http or https URL.';
              return;
            }
            onSave?.({ title, priority: prioritySelect.value, resources: cleanResources });
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
    titleInput.focus();
  });

  const onKey = e => { if (e.key === 'Escape') close(); };
  window.addEventListener('keydown', onKey);
  return () => {
    window.removeEventListener('keydown', onKey);
    overlay.remove();
  };
}
