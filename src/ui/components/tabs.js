import { el } from '../dom.js';

// Issue #6 Phase 3.6 — keyboard-navigable tabs (Left/Right cycle, Home/End
// jump to first/last), full ARIA tablist/tab/tabpanel roles. A reusable
// primitive for a later phase to wire up (the settings page, a future modal)
// — not retrofitted onto the existing single-flow import modal (issue #64
// deliberately collapsed that modal's own two tabs into one continuous flow;
// re-introducing tabs there would undo that fix).
//
// items: [{ id, label, panel: Node }]
// Returns the tabs container node; the panel nodes are appended after it as
// siblings, each toggled via the existing `.tab-panel`/`.tab-panel.active`
// classes.
export function createTabs({ items, initialId } = {}) {
  let activeId = initialId ?? items[0]?.id;

  const tabButtons = items.map(item => el('button', {
    type: 'button',
    role: 'tab',
    className: 'tab',
    id: `tab-${item.id}`,
    'aria-controls': `tab-panel-${item.id}`,
    'aria-selected': String(item.id === activeId),
    tabindex: item.id === activeId ? '0' : '-1',
    text: item.label,
    onClick: () => selectTab(item.id, { focus: false })
  }));

  const panels = items.map(item => {
    item.panel.classList.add('tab-panel');
    item.panel.classList.toggle('active', item.id === activeId);
    item.panel.id = `tab-panel-${item.id}`;
    item.panel.setAttribute('role', 'tabpanel');
    item.panel.setAttribute('aria-labelledby', `tab-${item.id}`);
    return item.panel;
  });

  function selectTab(id, { focus = true } = {}) {
    activeId = id;
    tabButtons.forEach((btn, i) => {
      const isActive = items[i].id === id;
      btn.setAttribute('aria-selected', String(isActive));
      btn.tabIndex = isActive ? 0 : -1;
      if (isActive && focus) btn.focus();
    });
    panels.forEach((panel, i) => panel.classList.toggle('active', items[i].id === id));
  }

  function onKeydown(e) {
    const currentIndex = items.findIndex(item => item.id === activeId);
    if (e.key === 'ArrowRight') {
      e.preventDefault();
      selectTab(items[(currentIndex + 1) % items.length].id);
    } else if (e.key === 'ArrowLeft') {
      e.preventDefault();
      selectTab(items[(currentIndex - 1 + items.length) % items.length].id);
    } else if (e.key === 'Home') {
      e.preventDefault();
      selectTab(items[0].id);
    } else if (e.key === 'End') {
      e.preventDefault();
      selectTab(items[items.length - 1].id);
    }
  }

  const tablist = el('div', { className: 'tabs', role: 'tablist', onKeydown }, tabButtons);
  const wrap = el('div', {}, [tablist, ...panels]);
  wrap._selectTab = selectTab;
  return wrap;
}
