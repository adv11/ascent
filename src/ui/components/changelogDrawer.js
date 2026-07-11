import { el } from '../dom.js';
import { createIcon } from './icons.js';
import { attachFocusTrap } from './modal.js';

const TYPE_LABELS = { feat: 'New', fix: 'Fix', improvement: 'Improved' };

function renderEntryItem(item) {
  return el('li', { className: 'changelog-item' }, [
    el('span', { className: `changelog-type-dot changelog-type-${item.type}`, 'aria-hidden': 'true' }),
    el('div', { className: 'changelog-item-body' }, [
      el('p', { className: 'changelog-item-title', text: item.title }),
      el('p', { className: 'changelog-item-desc', text: item.description }),
      el('span', { className: `changelog-type-label changelog-type-${item.type}`, text: TYPE_LABELS[item.type] })
    ])
  ]);
}

function renderVersionGroup(entry) {
  return el('div', { className: 'changelog-group' }, [
    el('div', { className: 'changelog-group-header' }, [
      el('h3', { className: 'changelog-group-version', text: `Version ${entry.version}` }),
      el('span', { className: 'changelog-group-date', text: entry.date })
    ]),
    el('ul', { className: 'changelog-item-list' }, entry.items.map(renderEntryItem))
  ]);
}

// Right-side slide-in drawer modeled on itemPanel.js's openItemPanel (issue
// #20) — same .panel-overlay/.item-panel shell, focus trap, Escape close.
// `entries` must already be sorted newest-first (getUnseenChangelogEntries
// filters by unread; the caller passes the *full* changelog here since the
// drawer always shows everything, not just what's unread — only the bell's
// badge is unread-scoped).
export function openChangelogDrawer({ entries, onClose }) {
  const overlay = el('div', { className: 'panel-overlay', onClick: e => { if (e.target === overlay) close(); } });
  const titleId = 'changelog-drawer-title';
  const panel = el('aside', {
    className: 'item-panel changelog-drawer',
    role: 'dialog',
    'aria-modal': 'true',
    'aria-labelledby': titleId
  });

  function close() {
    detachTrap();
    overlay.classList.remove('show');
    panel.classList.remove('show');
    setTimeout(() => overlay.remove(), 240);
    onClose?.();
  }

  panel.append(
    el('div', { className: 'panel-header' }, [
      el('div', {}, [
        el('p', { className: 'panel-kicker', text: 'Ascent' }),
        el('h2', { className: 'panel-title', id: titleId, text: "What's New" })
      ]),
      el('button', { type: 'button', className: 'btn btn-ghost btn-icon', 'aria-label': 'Close', onClick: close }, [createIcon('close', { size: 'sm' })])
    ]),
    el('div', { className: 'panel-body changelog-drawer-body' },
      entries.length
        ? entries.map(renderVersionGroup)
        : [el('p', { className: 'muted small', text: 'Nothing new yet — check back after your next update.' })]
    )
  );

  overlay.append(panel);
  document.body.append(overlay);
  const detachTrap = attachFocusTrap(panel, { onEscape: close });
  requestAnimationFrame(() => {
    overlay.classList.add('show');
    panel.classList.add('show');
    panel.querySelector('.btn-icon')?.focus();
  });

  return close;
}
