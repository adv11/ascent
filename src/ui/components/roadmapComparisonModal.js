import { el } from '../dom.js';
import { attachFocusTrap } from './modal.js';
import { createSelect } from './select.js';
import { showToast } from './toast.js';
import { getTemplate, buildSeedItems as buildTemplateSeedItems } from '../../data/templates/index.js';
import { compareRoadmapTopics, groupComparisonByPhase } from '../../core/roadmap/roadmapComparison.js';

const MODE_TEMPLATE = 'template';
const MODE_ROADMAP = 'roadmap';

// Display label for any started roadmap id — a built-in template's registry
// name, or a custom/imported roadmap's own stored title. Falls back to the
// raw id only if neither lookup finds anything (shouldn't happen for an id
// that's genuinely in startedTemplateIds, but never render a blank label).
function roadmapLabel(id, { customRoadmaps, isCustomRoadmapId }) {
  if (isCustomRoadmapId(id)) {
    return customRoadmaps.find(r => r.id === id)?.title || 'Untitled roadmap';
  }
  return getTemplate(id).name;
}

function statusLabel(status) {
  switch (status) {
    case 'both-done': return 'Done in both';
    case 'a-only-done': return 'Done here only';
    case 'b-only-done': return 'Done there only';
    default: return 'Not done in either';
  }
}

function renderSummaryRow(comparison, labelA, labelB) {
  const { summary } = comparison;
  return el('div', { className: 'comparison-summary' }, [
    el('div', { className: 'comparison-summary-item' }, [
      el('span', { className: 'comparison-summary-value', text: String(summary.bothDone) }),
      el('span', { className: 'comparison-summary-label', text: 'Done in both' })
    ]),
    el('div', { className: 'comparison-summary-item' }, [
      el('span', { className: 'comparison-summary-value', text: String(summary.onlyInACount) }),
      el('span', { className: 'comparison-summary-label', text: `Only in ${labelA}` })
    ]),
    el('div', { className: 'comparison-summary-item' }, [
      el('span', { className: 'comparison-summary-value', text: String(summary.onlyInBCount) }),
      el('span', { className: 'comparison-summary-label', text: `Only in ${labelB}` })
    ]),
    el('div', { className: 'comparison-summary-item' }, [
      el('span', { className: 'comparison-summary-value', text: String(summary.totalTopics) }),
      el('span', { className: 'comparison-summary-label', text: 'Total topics' })
    ])
  ]);
}

function renderMatchedRow(row) {
  return el('li', { className: 'comparison-row', dataset: { status: row.status } }, [
    el('span', { className: 'comparison-row-title', text: row.title }),
    el('span', { className: `comparison-row-status comparison-row-status-${row.status}`, text: statusLabel(row.status) })
  ]);
}

function renderOnlyRow(row, className, label) {
  return el('li', { className: `comparison-row ${className}` }, [
    el('span', { className: 'comparison-row-title', text: row.title }),
    el('span', { className: 'comparison-row-status', text: row.done ? `${label} · done` : label })
  ]);
}

function renderPhaseGroup(group) {
  const rows = [
    ...group.matched.map(renderMatchedRow),
    ...group.onlyInA.map(row => renderOnlyRow(row, 'comparison-row-added', 'Added here')),
    ...group.onlyInB.map(row => renderOnlyRow(row, 'comparison-row-removed', 'Missing here'))
  ];
  if (!rows.length) return null;
  return el('div', { className: 'comparison-phase-group' }, [
    el('h3', { className: 'comparison-phase-title', text: group.phase }),
    el('ul', { className: 'comparison-row-list' }, rows)
  ]);
}

function renderComparisonResult(comparison, labelA, labelB) {
  const groups = groupComparisonByPhase(comparison).filter(g => g.matched.length + g.onlyInA.length + g.onlyInB.length > 0);
  if (!groups.length) {
    return el('p', { className: 'comparison-empty', text: 'Neither roadmap has any topics to compare yet.' });
  }
  return el('div', { className: 'comparison-result' }, [
    renderSummaryRow(comparison, labelA, labelB),
    el('div', { className: 'comparison-phase-groups' }, groups.map(renderPhaseGroup))
  ]);
}

// "Compare roadmaps" (issue #285) — two modes, both reusing the same pure
// compareRoadmapTopics()/groupComparisonByPhase() engine:
//   (a) the active roadmap vs. its own original starter template's seed
//       content (only offered when the active roadmap is a built-in
//       template — a custom roadmap has no template to compare against)
//   (b) the active roadmap vs. any other roadmap the user has started
// Resolves nothing — this is a read-only view, no promise contract needed by
// any caller, so it's opened fire-and-forget like openShareModal().
export function openRoadmapComparisonModal({ store }) {
  const snapshot = store.getSnapshot();
  const activeId = snapshot.activeTemplateId;
  const activeIsCustom = store.isCustomRoadmapId(activeId);
  const otherIds = snapshot.startedTemplateIds.filter(id => id !== activeId);

  let mode = activeIsCustom ? MODE_ROADMAP : MODE_TEMPLATE;
  let selectedOtherId = otherIds[0] || null;

  function close() {
    detachTrap();
    otherSelect?._cleanup?.();
    overlay.remove();
  }

  const labelCtx = { customRoadmaps: snapshot.customRoadmaps, isCustomRoadmapId: store.isCustomRoadmapId };
  const activeLabel = roadmapLabel(activeId, labelCtx);
  const resultSlot = el('div', { className: 'comparison-result-slot' });

  const templateModeBtn = el('button', {
    type: 'button',
    className: `filter-chip ${mode === MODE_TEMPLATE ? 'active' : ''}`,
    dataset: { mode: MODE_TEMPLATE },
    'aria-pressed': String(mode === MODE_TEMPLATE),
    text: 'Starter template',
    onClick: () => { mode = MODE_TEMPLATE; renderAll(); }
  });
  templateModeBtn.disabled = activeIsCustom;

  const roadmapModeBtn = el('button', {
    type: 'button',
    className: `filter-chip ${mode === MODE_ROADMAP ? 'active' : ''}`,
    dataset: { mode: MODE_ROADMAP },
    'aria-pressed': String(mode === MODE_ROADMAP),
    text: 'Another roadmap',
    onClick: () => { mode = MODE_ROADMAP; renderAll(); }
  });
  roadmapModeBtn.disabled = otherIds.length === 0;

  const modeChips = el('div', { className: 'comparison-mode-toggle', role: 'group', 'aria-label': 'Compare against' }, [
    templateModeBtn,
    roadmapModeBtn
  ]);

  const otherSelect = otherIds.length
    ? createSelect(
      otherIds.map(id => ({ value: id, label: roadmapLabel(id, labelCtx) })),
      { value: selectedOtherId, ariaLabel: 'Compare against roadmap' }
    )
    : null;
  otherSelect?.addEventListener('change', () => {
    selectedOtherId = otherSelect.value;
    runComparison();
  });

  const otherSelectSlot = el('div', { className: 'comparison-other-select' }, otherSelect ? [
    el('span', { className: 'field-label', text: 'Compare against' }),
    otherSelect
  ] : []);

  async function runComparison() {
    if (mode === MODE_TEMPLATE) {
      if (activeIsCustom) return;
      resultSlot.replaceChildren(el('p', { className: 'comparison-loading', text: 'Loading…' }));
      const templateItems = await buildTemplateSeedItems(activeId);
      const comparison = compareRoadmapTopics(snapshot.items, templateItems);
      const templateName = getTemplate(activeId).name;
      resultSlot.replaceChildren(renderComparisonResult(comparison, activeLabel, `${templateName} template`));
      return;
    }
    if (!selectedOtherId) {
      resultSlot.replaceChildren(el('p', { className: 'comparison-empty', text: 'Start a second roadmap to compare against it.' }));
      return;
    }
    resultSlot.replaceChildren(el('p', { className: 'comparison-loading', text: 'Loading…' }));
    try {
      const { items: otherItems } = await store.getRoadmapSnapshotForComparison(selectedOtherId);
      const comparison = compareRoadmapTopics(snapshot.items, otherItems);
      resultSlot.replaceChildren(renderComparisonResult(comparison, activeLabel, roadmapLabel(selectedOtherId, labelCtx)));
    } catch (error) {
      console.error('Failed to load the other roadmap for comparison', error);
      showToast('Could not load that roadmap. Check your connection and try again.', 'error');
      resultSlot.replaceChildren(el('p', { className: 'comparison-empty', text: 'Could not load that roadmap.' }));
    }
  }

  function renderAll() {
    modeChips.querySelectorAll('.filter-chip').forEach(btn => {
      const active = btn.dataset.mode === mode;
      btn.classList.toggle('active', active);
      btn.setAttribute('aria-pressed', String(active));
    });
    otherSelectSlot.hidden = mode !== MODE_ROADMAP;
    runComparison();
  }

  const card = el('div', { className: 'modal-card comparison-modal-card' }, [
    el('h2', { className: 'modal-title', text: 'Compare roadmaps' }),
    el('p', { className: 'comparison-modal-subtitle', text: `Comparing "${activeLabel}" against:` }),
    modeChips,
    otherSelectSlot,
    resultSlot,
    el('button', { type: 'button', className: 'btn btn-secondary btn-block', text: 'Close', onClick: close })
  ]);

  const overlay = el('div', {
    className: 'modal-overlay',
    role: 'dialog',
    'aria-modal': 'true',
    'aria-label': 'Compare roadmaps',
    onClick: e => { if (e.target === overlay) close(); }
  }, [card]);

  const detachTrap = attachFocusTrap(card, { onEscape: close });
  document.body.appendChild(overlay);
  otherSelectSlot.hidden = mode !== MODE_ROADMAP;
  card.querySelector('button:not([disabled])')?.focus();
  runComparison();

  return { close, node: overlay };
}
