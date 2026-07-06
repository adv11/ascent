import { PHASES } from '../../data/roadmap.js';
import { authApi, authErrorMessage } from '../../services/firebase.js';
import { el, debounce } from '../dom.js';
import { navigate } from '../router.js';
import { openItemPanel } from '../components/itemPanel.js';
import { showToast } from '../components/toast.js';
import { createThemeToggle } from '../components/themeToggle.js';
import { createVerificationBanner } from '../components/verificationBanner.js';

function groupItems(items) {
  const phases = [];
  const phaseMap = new Map();
  PHASES.forEach((phase, index) => {
    const entry = { ...phase, index, sections: phase.sections.map((section, sIndex) => ({ ...section, sIndex, items: [] })) };
    phaseMap.set(phase.title, entry);
    phases.push(entry);
  });

  items.forEach(item => {
    let phase = phaseMap.get(item.phase);
    if (!phase) {
      phase = {
        title: item.phase,
        priority: item.priority || 'P2',
        index: phases.length,
        sections: []
      };
      phaseMap.set(item.phase, phase);
      phases.push(phase);
    }
    let section = phase.sections.find(s => s.title === item.section);
    if (!section) {
      section = { title: item.section, sIndex: phase.sections.length, items: [] };
      phase.sections.push(section);
    }
    section.items.push(item);
  });
  return phases;
}

function countStats(items) {
  const total = items.length;
  const done = items.filter(i => i.done).length;
  const pct = total ? Math.round((done / total) * 100) : 0;
  return { total, done, pct };
}

function filterItems(items, { priority, query }) {
  const q = query.trim().toLowerCase();
  return items.filter(item => {
    const matchesPriority = priority === 'ALL' || item.priority === priority;
    const matchesQuery = !q || item.title.toLowerCase().includes(q) || item.phase.toLowerCase().includes(q) || item.section.toLowerCase().includes(q);
    return matchesPriority && matchesQuery;
  });
}

function priorityCounts(items, priority) {
  const list = priority === 'ALL' ? items : items.filter(i => i.priority === priority);
  return { total: list.length, done: list.filter(i => i.done).length };
}

export function renderDashboard(app, { user, store }) {
  if (!user) {
    navigate('/signin', true);
    return;
  }

  let ui = store.getUiState();
  let activeFilter = ui.filter || 'ALL';
  let searchQuery = ui.search || '';
  let openPhases = new Set(Array.isArray(ui.openPhases) ? ui.openPhases : [0]);
  let saveBadgeTimer;
  let lastStructuralVersion = null;

  const offlineBanner = el('div', { className: 'offline-banner', id: 'offlineBanner' }, [
    el('span', { className: 'sync-dot error' }),
    ' Offline — changes stay on this device until you reconnect.'
  ]);

  const doneStat = el('span', { className: 'stat-number', text: '0' });
  const totalStat = el('span', { text: '0' });
  const percentStat = el('span', { text: '0' });
  const progressFill = el('div', { className: 'progress-fill', style: 'width:0%' });
  const filterContainer = el('div', { className: 'filter-row' });
  const searchInput = el('input', { className: 'search-input', placeholder: 'Search topics, e.g. Kafka, RAG, Saga…', value: searchQuery });
  const content = el('main', { className: 'dashboard-content' });
  const saveBadge = el('div', { className: 'save-badge', id: 'saveBadge' });
  const syncPill = el('span', { className: 'sync-pill', text: 'Syncing' });

  const userLabel = user.isAnonymous ? 'Guest session' : (user.email || 'Signed in');
  const userPillClass = user.isAnonymous ? 'guest' : 'online';

  function persistUi() {
    store.setUiState({
      filter: activeFilter,
      search: searchQuery,
      openPhases: [...openPhases]
    });
  }

  function updateSaveBadge(state) {
    clearTimeout(saveBadgeTimer);
    saveBadge.className = 'save-badge';
    if (state === 'saving') {
      saveBadge.replaceChildren(el('span', { className: 'spin' }), ' Saving…');
      saveBadge.classList.add('show');
    } else if (state === 'saved' || state === 'synced') {
      saveBadge.textContent = user.isAnonymous ? 'Saved locally' : 'Saved to cloud';
      saveBadge.classList.add('show');
      saveBadgeTimer = setTimeout(() => saveBadge.classList.remove('show'), 1800);
    } else if (state === 'local') {
      saveBadge.textContent = 'Saved on this device';
      saveBadge.classList.add('show');
      saveBadgeTimer = setTimeout(() => saveBadge.classList.remove('show'), 1800);
    } else if (state === 'error') {
      saveBadge.textContent = 'Save failed — retrying…';
      saveBadge.classList.add('show', 'error');
    } else {
      saveBadge.classList.remove('show');
    }

    syncPill.textContent = user.isAnonymous ? 'Local only' : (state === 'synced' ? 'Synced' : state === 'saving' ? 'Saving…' : 'Ready');
    syncPill.className = `sync-pill ${userPillClass}${state === 'error' ? ' error' : ''}`;
  }

  function renderItemRow(item) {
  return el('div', {
    className: `check-item ${item.done ? 'done' : ''}`,
    role: 'checkbox',
    tabindex: '0',
    'aria-checked': String(item.done),
    dataset: { id: item.id },
    onClick: e => {
      if (e.target.closest('[data-action]')) return;
      const live = store.getSnapshot().allItems[item.id];
      if (live) store.updateItem(item.id, { done: !live.done });
    },
    onKeydown: e => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        const live = store.getSnapshot().allItems[item.id];
        if (live) store.updateItem(item.id, { done: !live.done });
      }
    }
  }, [
    el('div', { className: 'check-box' }, [el('span', { className: 'check-mark', text: '✓' })]),
    el('div', { className: 'check-body' }, [
      el('span', { className: 'check-title', text: item.title }),
      el('span', { className: `priority-tag ${item.priority}`, text: item.priority }),
      item.notes ? el('span', { className: 'notes-indicator', text: '≡' }) : null,
      item.resources?.length ? el('button', {
        type: 'button',
        className: 'resource-count',
        'data-action': 'resources',
        'aria-label': `View resources for ${item.title}`,
        text: `${item.resources.length} resource${item.resources.length > 1 ? 's' : ''}`,
        onClick: e => {
          e.stopPropagation();
          openItemPanel({
            item,
            onSave: patch => store.updateItem(item.id, patch),
            onDelete: () => store.removeItem(item.id)
          });
        }
      }) : null
    ].filter(Boolean)),
    el('div', { className: 'check-actions' }, [
      el('button', {
        type: 'button',
        className: 'btn btn-ghost btn-sm',
        'data-action': 'edit',
        'aria-label': `Edit ${item.title}`,
        text: 'Edit',
        onClick: e => {
          e.stopPropagation();
          openItemPanel({
            item,
            onSave: patch => store.updateItem(item.id, patch),
            onDelete: () => store.removeItem(item.id)
          });
        }
      })
    ])
  ]);
}

  function renderAddRow(phase, section) {
    const input = el('input', { className: 'field-input compact inline-add', placeholder: 'Add a custom topic…' });
    return el('div', { className: 'add-row' }, [
      input,
      el('button', {
        type: 'button',
        className: 'btn btn-secondary btn-sm',
        text: 'Add',
        onClick: () => {
          const title = input.value.trim();
          if (!title) return;
          store.addItem({ title, phase: phase.title, section: section.title, priority: phase.priority });
          input.value = '';
          showToast(`Added "${title}"`, 'success');
        }
      })
    ]);
  }

  function render(snapshot) {
    const allItems = snapshot.items;
    const filtered = filterItems(allItems, { priority: activeFilter, query: searchQuery });
    const stats = countStats(allItems);
    doneStat.textContent = String(stats.done);
    totalStat.textContent = String(stats.total);
    percentStat.textContent = String(stats.pct);
    progressFill.style.width = `${stats.pct}%`;
    updateSaveBadge(snapshot.saveState);

    filterContainer.replaceChildren(...['ALL', 'P0', 'P1', 'P2', 'P3'].map(p => {
      const { total, done } = priorityCounts(allItems, p);
      const label = p === 'ALL' ? 'All' : p;
      return el('button', {
        type: 'button',
        className: `filter-chip ${activeFilter === p ? 'active' : ''}`,
        dataset: { p },
        'aria-pressed': String(activeFilter === p),
        onClick: () => {
          activeFilter = activeFilter === p && p !== 'ALL' ? 'ALL' : p;
          persistUi();
          render(store.getSnapshot());
        }
      }, [`${label} `, el('span', { className: 'chip-count', text: `${done}/${total}` })]);
    }));

    const filteredIds = new Set(filtered.map(i => i.id));
    const phases = groupItems(allItems);
    content.replaceChildren();

    let visibleCount = 0;
    phases.forEach((phase, pi) => {
      const visibleSections = phase.sections.map(section => ({
        ...section,
        items: section.items.filter(i => filteredIds.has(i.id))
      })).filter(section => section.items.length > 0);

      if (!visibleSections.length) return;
      visibleCount += 1;

      const sectionDone = visibleSections.reduce((acc, s) => acc + s.items.filter(i => i.done).length, 0);
      const sectionTotal = visibleSections.reduce((acc, s) => acc + s.items.length, 0);
      const isOpen = openPhases.has(pi);

      const phaseEl = el('section', { className: `phase-card ${isOpen ? 'open' : ''}`, dataset: { phase: String(pi) } }, [
        el('button', {
          type: 'button',
          className: 'phase-head',
          onClick: () => {
            if (openPhases.has(pi)) openPhases.delete(pi);
            else openPhases.add(pi);
            persistUi();
            render(store.getSnapshot());
          }
        }, [
          el('span', { className: 'phase-index', text: String(pi + 1).padStart(2, '0') }),
          el('span', { className: 'phase-name', text: phase.title }),
          el('span', { className: `badge ${phase.priority}`, text: phase.priority }),
          el('span', { className: 'phase-progress', text: `${sectionDone}/${sectionTotal}` }),
          el('span', { className: 'chevron', text: '›' })
        ]),
        el('div', { className: 'phase-body' }, visibleSections.flatMap(section => [
          el('div', { className: 'section-label', text: section.title }),
          ...section.items.map(renderItemRow),
          renderAddRow(phase, section)
        ]))
      ]);
      content.append(phaseEl);
    });

    if (!visibleCount) {
      content.append(el('div', { className: 'empty-state' }, [
        el('div', { className: 'empty-icon', text: '⌕' }),
        el('p', { text: 'No matching topics. Try another filter or search term.' })
      ]));
    }

    const toggleAllBtn = app.querySelector('[data-toggle-all]');
    if (toggleAllBtn) {
      const allOpen = phases.length > 0 && phases.every((_, i) => openPhases.has(i));
      toggleAllBtn.textContent = allOpen ? 'Collapse all' : 'Expand all';
    }
  }

  // A "done" toggle only flips one item's checked state — it never changes which
  // topics are visible or how they're grouped. Patching in place (instead of
  // running render() again) avoids tearing down every phase-card, which was
  // replaying the open-phase fade-in animation and flickering the whole list.
  function patchDoneStates(snapshot) {
    const allItems = snapshot.items;
    const stats = countStats(allItems);
    doneStat.textContent = String(stats.done);
    percentStat.textContent = String(stats.pct);
    progressFill.style.width = `${stats.pct}%`;
    updateSaveBadge(snapshot.saveState);

    filterContainer.querySelectorAll('.filter-chip').forEach(chip => {
      const { total, done } = priorityCounts(allItems, chip.dataset.p);
      const countEl = chip.querySelector('.chip-count');
      if (countEl) countEl.textContent = `${done}/${total}`;
    });

    allItems.forEach(item => {
      const row = content.querySelector(`.check-item[data-id="${CSS.escape(item.id)}"]`);
      if (!row) return;
      row.classList.toggle('done', !!item.done);
      row.setAttribute('aria-checked', String(!!item.done));
    });

    const filtered = filterItems(allItems, { priority: activeFilter, query: searchQuery });
    const filteredIds = new Set(filtered.map(i => i.id));
    groupItems(allItems).forEach((phase, pi) => {
      const phaseCard = content.querySelector(`.phase-card[data-phase="${pi}"]`);
      if (!phaseCard) return;
      const progressEl = phaseCard.querySelector('.phase-progress');
      if (!progressEl) return;
      const visible = phase.sections.flatMap(s => s.items.filter(i => filteredIds.has(i.id)));
      progressEl.textContent = `${visible.filter(i => i.done).length}/${visible.length}`;
    });
  }

  function handleSnapshot(snapshot) {
    if (snapshot.structuralVersion === lastStructuralVersion) {
      patchDoneStates(snapshot);
      return;
    }
    lastStructuralVersion = snapshot.structuralVersion;
    render(snapshot);
  }

  const toggleAllBtn = el('button', {
    type: 'button',
    className: 'btn btn-ghost',
    dataset: { toggleAll: '1' },
    text: 'Expand all',
    onClick: () => {
      const phases = groupItems(store.getSnapshot().items);
      const allOpen = phases.every((_, i) => openPhases.has(i));
      openPhases = allOpen ? new Set() : new Set(phases.map((_, i) => i));
      persistUi();
      render(store.getSnapshot());
    }
  });

  searchInput.addEventListener('input', debounce(e => {
    searchQuery = e.target.value.trim().toLowerCase();
    persistUi();
    render(store.getSnapshot());
  }, 160));

  function showDeleteModal() {
    const message = el('p', { className: 'form-message', text: '' });
    const passwordInput = el('input', {
      className: 'field-input',
      type: 'password',
      placeholder: 'Your current password',
      autocomplete: 'current-password'
    });
    const confirmBtn = el('button', {
      type: 'submit',
      className: 'btn btn-danger btn-block',
      text: 'Delete my account'
    });
    const cancelBtn = el('button', {
      type: 'button',
      className: 'btn btn-secondary btn-block',
      text: 'Cancel'
    });

    function setBusy(busy) {
      confirmBtn.disabled = busy;
      cancelBtn.disabled = busy;
    }

    async function handleDelete(e) {
      e.preventDefault();
      message.textContent = '';
      message.className = 'form-message';
      const pass = passwordInput.value;
      if (!pass) {
        message.textContent = 'Enter your password to confirm.';
        message.className = 'form-message error';
        return;
      }
      setBusy(true);
      try {
        await authApi.deleteAccount(pass);
        overlay.remove();
        showToast('Account deleted.', 'success');
        navigate('/signin', true);
      } catch (err) {
        message.textContent = authErrorMessage(err);
        message.className = 'form-message error';
        setBusy(false);
      }
    }

    const form = el('form', { className: 'auth-form', onSubmit: handleDelete }, [
      el('p', { className: 'delete-modal-body', text: 'This permanently deletes your account and all roadmap data. Enter your password to confirm.' }),
      el('label', { className: 'field' }, [
        el('span', { className: 'field-label', text: 'Password' }),
        passwordInput
      ]),
      message,
      confirmBtn,
      cancelBtn
    ]);

    const overlay = el('div', { className: 'modal-overlay', role: 'dialog', 'aria-modal': 'true', 'aria-label': 'Delete account' }, [
      el('div', { className: 'modal-card' }, [
        el('h2', { className: 'modal-title', text: 'Delete account' }),
        form
      ])
    ]);

    cancelBtn.addEventListener('click', () => overlay.remove());
    overlay.addEventListener('click', e => { if (e.target === overlay) overlay.remove(); });

    document.body.appendChild(overlay);
    passwordInput.focus();
  }

  const themeToggleBtn = createThemeToggle();
  const verificationBanner = createVerificationBanner(user);

  const shell = el('div', { className: 'dashboard fade-in' }, [
    verificationBanner,
    offlineBanner,
    el('header', { className: 'dashboard-header' }, [
      el('div', { className: 'header-top' }, [
        el('div', { className: 'brand' }, [
          el('span', { className: 'brand-mark', text: '✓' }),
          el('div', {}, [
            el('div', { className: 'brand-name', text: 'SwitchPrep' }),
            el('div', { className: 'brand-tagline', text: 'Java Spring Boot switch command center' })
          ])
        ]),
        el('div', { className: 'header-actions' }, [
          themeToggleBtn,
          syncPill,
          el('span', { className: 'user-chip', text: userLabel }),
          user.isAnonymous ? el('a', { href: '#/signup', className: 'btn btn-secondary btn-sm', text: 'Create account' }) : null,
          !user.isAnonymous ? el('button', {
            type: 'button',
            className: 'btn btn-ghost btn-sm btn-danger-text',
            text: 'Delete account',
            onClick: () => showDeleteModal()
          }) : null,
          el('button', {
            type: 'button',
            className: 'btn btn-ghost btn-sm',
            text: 'Sign out',
            onClick: async () => {
              if (user.isAnonymous && store.getSnapshot().dirty) {
                if (!confirm('You have unsaved changes. Sign out anyway?\n\nGuest session data is only stored on this device and will be cleared on sign-out.')) return;
              }
              await authApi.signOut();
              navigate('/signin', true);
            }
          })
        ].filter(Boolean))
      ]),
      el('div', { className: 'hero-panel' }, [
        el('div', { className: 'hero-copy' }, [
          el('h1', { className: 'hero-title', text: 'Track the prep that gets you interview-ready.' }),
          el('p', { className: 'hero-text', text: 'Java, Spring Boot, microservices, Kafka, Redis, system design, DSA, GenAI, and agentic AI — all in one editable checklist.' })
        ]),
        el('div', { className: 'progress-card' }, [
          el('div', { className: 'progress-stat' }, [
            doneStat,
            el('span', { className: 'stat-label', text: ' of ' }),
            totalStat,
            el('span', { className: 'stat-label', text: ' done' })
          ]),
          el('div', { className: 'progress-track' }, [progressFill]),
          el('div', { className: 'progress-percent' }, [percentStat, el('span', { text: '%' })])
        ])
      ]),
      el('div', { className: 'toolbar' }, [
        el('div', { className: 'toolbar-block' }, [
          el('span', { className: 'toolbar-label', text: 'Priority' }),
          filterContainer
        ]),
        el('div', { className: 'toolbar-block toolbar-right' }, [
          searchInput,
          toggleAllBtn
        ])
      ])
    ]),
    content,
    saveBadge
  ]);

  app.replaceChildren(shell);

  const unsubStore = store.subscribe(handleSnapshot);
  lastStructuralVersion = store.getSnapshot().structuralVersion;
  render(store.getSnapshot());

  function setOnlineState() {
    offlineBanner.classList.toggle('show', !navigator.onLine);
  }
  window.addEventListener('online', setOnlineState);
  window.addEventListener('offline', setOnlineState);
  setOnlineState();

  return () => {
    themeToggleBtn._cleanup?.();
    unsubStore();
    window.removeEventListener('online', setOnlineState);
    window.removeEventListener('offline', setOnlineState);
    clearTimeout(saveBadgeTimer);
  };
}
