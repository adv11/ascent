import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../src/services/firebase.js', () => ({
  authApi: {
    deleteAccount: vi.fn(),
  },
  authErrorMessage: e => e?.message || 'error',
  database: {},
  firebaseClock: vi.fn(),
}));
// dashboard.js pulls in sidebar.js -> myReports.js (issue #9), which imports
// feedbackStore.js, which imports the Firebase Realtime Database SDK
// directly — same CDN-URL stub tests/unit/storage/adapterFactory.test.js
// established.
vi.mock('https://www.gstatic.com/firebasejs/10.12.5/firebase-database.js', () => ({
  ref: vi.fn(), push: vi.fn(), update: vi.fn(), onValue: vi.fn(), off: vi.fn(),
}));

vi.mock('../../src/ui/router.js', () => ({ navigate: vi.fn() }));

beforeEach(() => {
  vi.resetModules();
  document.body.innerHTML = '';
});

// renderFilterChips/renderPhaseCard were extracted to module scope out of
// renderDashboard's closures (issue #53) specifically so they're
// independently testable — see the extraction comments in
// src/ui/pages/dashboard.js. showDeleteModal was extracted the same way, but
// has since moved out to its own component — see deleteAccountModal.test.js.
describe('renderFilterChips (issue #53)', () => {
  async function build(items, activeFilter, onFilterChange) {
    const { renderFilterChips } = await import('../../src/ui/pages/dashboard.js');
    return renderFilterChips(items, activeFilter, onFilterChange);
  }

  const items = [
    { priority: 'P0', done: true },
    { priority: 'P0', done: false },
    { priority: 'P1', done: false },
  ];

  it('renders one chip per priority plus "All", "Resources", and "Review due", with correct done/total counts', async () => {
    const chips = await build(items, 'ALL', () => {});
    expect(chips).toHaveLength(7);
    const p0 = chips.find(c => c.dataset.p === 'P0');
    expect(p0.querySelector('.chip-count').textContent).toBe('1/2');
    const all = chips.find(c => c.dataset.p === 'ALL');
    expect(all.querySelector('.chip-count').textContent).toBe('1/3');
    const resources = chips.find(c => c.dataset.p === 'RESOURCES');
    expect(resources).toBeTruthy();
    expect(resources.textContent).toContain('Resources');
    const review = chips.find(c => c.dataset.p === 'REVIEW');
    expect(review).toBeTruthy();
    expect(review.textContent).toContain('Review due');
  });

  it('marks the active filter chip', async () => {
    const chips = await build(items, 'P0', () => {});
    const p0 = chips.find(c => c.dataset.p === 'P0');
    expect(p0.classList.contains('active')).toBe(true);
    expect(p0.getAttribute('aria-pressed')).toBe('true');
  });

  it('calls onFilterChange with the clicked priority', async () => {
    const onFilterChange = vi.fn();
    const chips = await build(items, 'ALL', onFilterChange);
    chips.find(c => c.dataset.p === 'P1').click();
    expect(onFilterChange).toHaveBeenCalledWith('P1');
  });

  // Issue #6 Phase 4.3 — inline clear ✕ on the active non-ALL chip.
  it('shows a clear ✕ only on the active non-ALL chip', async () => {
    const chips = await build(items, 'P0', () => {});
    const p0 = chips.find(c => c.dataset.p === 'P0');
    const all = chips.find(c => c.dataset.p === 'ALL');
    const p1 = chips.find(c => c.dataset.p === 'P1');
    expect(p0.querySelector('.filter-chip-clear')).not.toBeNull();
    expect(all.querySelector('.filter-chip-clear')).toBeNull();
    expect(p1.querySelector('.filter-chip-clear')).toBeNull();
  });

  it('clicking the clear ✕ calls onFilterChange with ALL', async () => {
    const onFilterChange = vi.fn();
    const chips = await build(items, 'P0', onFilterChange);
    const p0 = chips.find(c => c.dataset.p === 'P0');
    p0.querySelector('.filter-chip-clear').click();
    expect(onFilterChange).toHaveBeenCalledWith('ALL');
  });
});

// Issue #100 follow-up — a fifth filter chip, "Resources", matching topics
// that carry at least one resource link (real feedback: no way to see every
// resource in the roadmap "in one go" without opening each topic's edit
// panel individually).
describe('renderFilterChips — "Resources" filter (issue #100 follow-up)', () => {
  async function build(items, activeFilter, onFilterChange) {
    const { renderFilterChips } = await import('../../src/ui/pages/dashboard.js');
    return renderFilterChips(items, activeFilter, onFilterChange);
  }

  const resourceItems = [
    { priority: 'P0', done: true, resources: [{ label: 'Docs', url: 'https://example.com' }] },
    { priority: 'P0', done: false, resources: [] },
    { priority: 'P1', done: false, resources: [{ label: 'Video', url: 'https://example.com/v' }] }
  ];

  it('counts only items that carry at least one resource', async () => {
    const chips = await build(resourceItems, 'ALL', () => {});
    const resourcesChip = chips.find(c => c.dataset.p === 'RESOURCES');
    expect(resourcesChip.querySelector('.chip-count').textContent).toBe('1/2');
  });

  it('is unaffected by items whose resources array is empty', async () => {
    const chips = await build([{ priority: 'P2', done: false, resources: [] }], 'ALL', () => {});
    const resourcesChip = chips.find(c => c.dataset.p === 'RESOURCES');
    expect(resourcesChip.querySelector('.chip-count').textContent).toBe('0/0');
  });

  it('is unaffected by items with no resources field at all', async () => {
    const chips = await build([{ priority: 'P2', done: false }], 'ALL', () => {});
    const resourcesChip = chips.find(c => c.dataset.p === 'RESOURCES');
    expect(resourcesChip.querySelector('.chip-count').textContent).toBe('0/0');
  });

  it('marks the Resources chip active and calls onFilterChange with RESOURCES when clicked', async () => {
    const onFilterChange = vi.fn();
    const chips = await build(resourceItems, 'ALL', onFilterChange);
    const resourcesChip = chips.find(c => c.dataset.p === 'RESOURCES');
    resourcesChip.click();
    expect(onFilterChange).toHaveBeenCalledWith('RESOURCES');

    const activeChips = await build(resourceItems, 'RESOURCES', () => {});
    const activeResourcesChip = activeChips.find(c => c.dataset.p === 'RESOURCES');
    expect(activeResourcesChip.classList.contains('active')).toBe(true);
    expect(activeResourcesChip.getAttribute('aria-pressed')).toBe('true');
  });
});

describe('formatLastSynced (issue #6 Phase 4.4)', () => {
  async function format(ms) {
    const { formatLastSynced } = await import('../../src/ui/pages/dashboard.js');
    return formatLastSynced(ms);
  }

  it('returns a "not synced" message when never synced', async () => {
    expect(await format(null)).toBe('Not synced yet');
  });

  it('reads "just now" under a minute', async () => {
    expect(await format(5_000)).toBe('Last synced just now');
  });

  it('reads minutes ago under an hour', async () => {
    expect(await format(125_000)).toBe('Last synced 2m ago');
  });

  it('reads hours ago under a day', async () => {
    expect(await format(7_200_000)).toBe('Last synced 2h ago');
  });

  it('falls back to a date beyond a day', async () => {
    expect(await format(90_000_000)).toMatch(/^Last synced \S/);
  });
});

describe('renderPhaseCard (issue #53)', () => {
  async function build(phase, pi, overrides = {}) {
    const { renderPhaseCard } = await import('../../src/ui/pages/dashboard.js');
    return renderPhaseCard(phase, pi, {
      openPhases: new Set(),
      filteredIds: new Set(phase.sections.flatMap(s => s.items.map(i => i.id))),
      isCustomRoadmap: false,
      onToggle: () => {},
      onAddSection: () => {},
      renderItemRow: item => document.createElement('div').appendChild(document.createTextNode(item.id)).parentElement,
      renderAddRow: () => document.createElement('div'),
      renderPhaseManageRow: () => document.createElement('div'),
      renderSectionManageRow: () => document.createElement('div'),
      renderInlineCreate: () => document.createElement('div'),
      ...overrides
    });
  }

  const phase = {
    title: 'Phase One',
    priority: 'P1',
    sections: [{ title: 'Section A', items: [{ id: 'a', done: true }, { id: 'b', done: false }] }]
  };

  it('renders a phase-card section with the phase title and progress', async () => {
    const card = await build(phase, 0);
    expect(card).not.toBeNull();
    expect(card.tagName).toBe('SECTION');
    expect(card.querySelector('.phase-name').textContent).toBe('Phase One');
    expect(card.querySelector('.phase-progress').textContent).toBe('1/2');
  });

  // Issue #6 Phase 4.2 — priority left-border accent + progress ring.
  it('sets the priority data attribute and renders a progress ring in the head', async () => {
    const card = await build(phase, 0);
    expect(card.dataset.priority).toBe('P1');
    expect(card.querySelector('.phase-head .progress-ring')).not.toBeNull();
  });

  it('marks the card open when its index is in openPhases', async () => {
    const card = await build(phase, 2, { openPhases: new Set([2]) });
    expect(card.classList.contains('open')).toBe(true);
  });

  it('calls onToggle with the phase index when the head is clicked', async () => {
    const onToggle = vi.fn();
    const card = await build(phase, 3, { onToggle });
    card.querySelector('.phase-head').click();
    expect(onToggle).toHaveBeenCalledWith(3);
  });

  it('returns null when every section is hidden by the current filter', async () => {
    const card = await build(phase, 0, { filteredIds: new Set() });
    expect(card).toBeNull();
  });

  it('still renders a phase with zero sections (e.g. a freshly added custom phase)', async () => {
    const emptyPhase = { title: 'New Phase', priority: 'P2', sections: [] };
    const card = await build(emptyPhase, 0, { filteredIds: new Set() });
    expect(card).not.toBeNull();
  });

  // Issue #433 — a section's items are wrapped in a `.section-rows` container
  // with a top/bottom `.row-spacer` (buildSectionRows(), see that function's
  // own comment in dashboard.js) instead of being rendered as bare siblings,
  // so dashboard.js's scroll-driven row virtualization can prune far-off-screen
  // rows without disturbing a section's flowed height. This only checks the
  // static structure a fresh render produces — jsdom has no real layout, so
  // syncSectionRowsWindow()'s scroll-driven pruning itself (which depends on
  // getBoundingClientRect()) isn't exercised here; that's covered by the E2E
  // suite and the manual scripted repro described in the PR.
  it('wraps a section\'s rows in a .section-rows container with top/bottom spacers', async () => {
    const card = await build(phase, 0, { openPhases: new Set([0]) });
    const wrapper = card.querySelector('.section-rows');
    expect(wrapper).not.toBeNull();
    expect(wrapper.firstElementChild.className).toBe('row-spacer');
    expect(wrapper.lastElementChild.className).toBe('row-spacer');
    // Both items from the fixture phase should still be rendered as real DOM
    // nodes between the two spacers on a fresh render (pruning only ever runs
    // later, off a scroll/resize event — never on initial mount).
    expect(wrapper.textContent).toContain('a');
    expect(wrapper.textContent).toContain('b');
  });
});

// Issue #450 — real, reported bug: fast-scrolling a roadmap page on a phone viewport
// showed content blanking out for a moment before reappearing. Root cause: #444's
// mobile checklist-row layout (`.check-item { flex-wrap: wrap }`) made real mobile rows
// taller than the fixed ROW_HEIGHT_ESTIMATE (67px, measured on desktop's single-line
// rows), but every unmeasured row's spacer/scroll-index math used that constant
// unconditionally — the spacers stayed undersized until enough rows were individually
// measured, and the correction was a sudden, visible layout jump. jsdom has no real
// layout (getBoundingClientRect() always returns 0), so this exercises the pure
// running-average math directly (estimateRowHeight()/recordMeasuredHeight()/
// sumRowHeights(), exported from dashboard.js for exactly this reason) rather than
// through real DOM measurement — the scroll-driven wiring itself is covered by the E2E
// suite and the manual scripted repro described in the PR, same precedent as #433's own
// comment on the describe block above.
describe('row-height virtualization estimate (issue #450)', () => {
  async function buildWrapper(itemCount) {
    const { buildSectionRows } = await import('../../src/ui/pages/dashboard.js');
    const items = Array.from({ length: itemCount }, (_, i) => ({ id: `item-${i}` }));
    return buildSectionRows(items, item => document.createElement('div'));
  }

  it('falls back to the 67px cold-start constant when nothing has been measured yet', async () => {
    const { estimateRowHeight } = await import('../../src/ui/pages/dashboard.js');
    const wrapper = await buildWrapper(3);
    expect(estimateRowHeight(wrapper)).toBe(67);
  });

  it('uses the running average of real measured heights once at least one row has been measured', async () => {
    const { estimateRowHeight, recordMeasuredHeight } = await import('../../src/ui/pages/dashboard.js');
    const wrapper = await buildWrapper(3);
    // Mobile's wrapped multi-line rows measure taller than the 67px desktop estimate —
    // this is what the estimate must adapt to instead of staying pinned to 67.
    recordMeasuredHeight(wrapper, 0, 120);
    recordMeasuredHeight(wrapper, 1, 140);
    expect(estimateRowHeight(wrapper)).toBe(130);
  });

  it('re-measuring the same row updates the average without double-counting it', async () => {
    const { estimateRowHeight, recordMeasuredHeight } = await import('../../src/ui/pages/dashboard.js');
    const wrapper = await buildWrapper(3);
    recordMeasuredHeight(wrapper, 0, 100);
    recordMeasuredHeight(wrapper, 0, 200); // same index, re-measured (e.g. re-pruned later)
    expect(estimateRowHeight(wrapper)).toBe(200);
  });

  it('ignores a zero-height measurement (jsdom/pre-layout) rather than polluting the average', async () => {
    const { estimateRowHeight, recordMeasuredHeight } = await import('../../src/ui/pages/dashboard.js');
    const wrapper = await buildWrapper(3);
    recordMeasuredHeight(wrapper, 0, 0);
    expect(estimateRowHeight(wrapper)).toBe(67);
  });

  it('sumRowHeights uses the caller-provided fallback for any still-unmeasured index', async () => {
    const { sumRowHeights } = await import('../../src/ui/pages/dashboard.js');
    // index 0 measured; 1 and 2 still unmeasured — real _rowHeights arrays are seeded
    // with 0 ("unknown"), not the ROW_HEIGHT_ESTIMATE constant, specifically so a
    // falsy/unmeasured entry always falls through to the caller-supplied fallback
    // instead of silently trusting a stale placeholder (see buildSectionRows()'s own
    // comment on why a truthy seed value would make this fallback unreachable).
    const heights = [100, 0, 0];
    expect(sumRowHeights(heights, 0, 3, 130)).toBe(100 + 130 + 130);
  });

  it('syncSectionRowsWindow sizes spacers using the adaptive estimate, not the fixed 67px constant', async () => {
    const { buildSectionRows, syncSectionRowsWindow, recordMeasuredHeight } = await import('../../src/ui/pages/dashboard.js');
    const items = Array.from({ length: 10 }, (_, i) => ({ id: `item-${i}` }));
    const wrapper = buildSectionRows(items, () => document.createElement('div'));
    // Simulate every row having already been measured as mobile-tall (120px) by
    // seeding the running average before the window narrows — mirrors what
    // measureMountedRows()/pruneMountedRows* do against real DOM in production.
    for (let i = 0; i < items.length; i++) recordMeasuredHeight(wrapper, i, 120);
    syncSectionRowsWindow(wrapper, 4, 6);
    // Rows [0,4) and [6,10) are now off-window — their spacers must reflect the real
    // 120px measured height, not the stale 67px desktop constant.
    expect(wrapper._topSpacer.style.height).toBe(`${4 * 120}px`);
    expect(wrapper._bottomSpacer.style.height).toBe(`${4 * 120}px`);
  });
});

// issue #465 follow-up — real, live-reproduced bug (Retina Mac, real fast
// scroll, not the scripted repro's synthetic pacing): a fast scroll can jump
// the desired mount window past the currently-mounted range with zero
// overlap. pruneMountedRowsFromTop()/pruneMountedRowsFromBottom() never
// resync each other's pointer once that happens, so mountRowsAtBottom() goes
// on to mount rows starting from a stale, too-low _mountEnd — re-inserting
// real rows that fall *before* the new _mountStart and are already summed
// into the top spacer's height, double-counting them and corrupting the
// section's layout (large blank gaps with isolated floating rows). These
// tests fail against the pre-fix code (verified by reverting the
// non-overlap guard in syncSectionRowsWindow() locally and re-running) and
// pass against the fix.
describe('syncSectionRowsWindow — non-overlapping window jump (issue #465 follow-up)', () => {
  function buildWrapperWithTaggedRows(itemCount) {
    let renderCount = 0;
    const items = Array.from({ length: itemCount }, (_, i) => ({ id: `item-${i}` }));
    const wrapper = buildSectionRowsRef(items, item => {
      renderCount++;
      const el = document.createElement('div');
      el.dataset.itemId = item.id;
      return el;
    });
    return { wrapper, getRenderCount: () => renderCount };
  }
  let buildSectionRowsRef;

  beforeEach(async () => {
    ({ buildSectionRows: buildSectionRowsRef } = await import('../../src/ui/pages/dashboard.js'));
  });

  function mountedRowIds(wrapper) {
    return Array.from(wrapper.querySelectorAll('[data-item-id]')).map(el => el.dataset.itemId);
  }

  it('a forward jump past the old mounted range leaves no stale rows behind and mounts exactly the new range', async () => {
    const { syncSectionRowsWindow } = await import('../../src/ui/pages/dashboard.js');
    const { wrapper } = buildWrapperWithTaggedRows(30);

    syncSectionRowsWindow(wrapper, 0, 10); // initial window: rows 0-9 mounted
    expect(mountedRowIds(wrapper)).toEqual(Array.from({ length: 10 }, (_, i) => `item-${i}`));

    // A fast scroll skips the buffer zone entirely — the next desired window
    // (20-24) has no overlap at all with the old one (0-9).
    syncSectionRowsWindow(wrapper, 20, 25);

    expect(mountedRowIds(wrapper)).toEqual(['item-20', 'item-21', 'item-22', 'item-23', 'item-24']);
    expect(wrapper._mountStart).toBe(20);
    expect(wrapper._mountEnd).toBe(25);
    // Every real DOM row must be accounted for exactly once — no leftover
    // node from the old [0,10) window still sitting in the wrapper.
    expect(wrapper.querySelectorAll('[data-item-id]').length).toBe(5);
  });

  it('a backward jump past the old mounted range leaves no stale rows behind and mounts exactly the new range', async () => {
    const { syncSectionRowsWindow } = await import('../../src/ui/pages/dashboard.js');
    const { wrapper } = buildWrapperWithTaggedRows(30);

    syncSectionRowsWindow(wrapper, 20, 25); // initial window: rows 20-24 mounted
    syncSectionRowsWindow(wrapper, 0, 5); // fast scroll back up, no overlap with 20-24

    expect(mountedRowIds(wrapper)).toEqual(['item-0', 'item-1', 'item-2', 'item-3', 'item-4']);
    expect(wrapper._mountStart).toBe(0);
    expect(wrapper._mountEnd).toBe(5);
    expect(wrapper.querySelectorAll('[data-item-id]').length).toBe(5);
  });

  it('spacer heights never double-count a row that is also still a real mounted node after a non-overlapping jump', async () => {
    const { syncSectionRowsWindow, recordMeasuredHeight } = await import('../../src/ui/pages/dashboard.js');
    const { wrapper } = buildWrapperWithTaggedRows(30);
    for (let i = 0; i < 30; i++) recordMeasuredHeight(wrapper, i, 67);

    syncSectionRowsWindow(wrapper, 0, 10);
    syncSectionRowsWindow(wrapper, 20, 25);

    // Top spacer covers items [0,20) = 20 rows; bottom spacer covers [25,30) = 5 rows.
    // Before the fix, the top spacer's sum included rows that were *also* still
    // real mounted DOM nodes, inflating the section's total height.
    expect(wrapper._topSpacer.style.height).toBe(`${20 * 67}px`);
    expect(wrapper._bottomSpacer.style.height).toBe(`${5 * 67}px`);
    const totalRealRowHeight = wrapper.querySelectorAll('[data-item-id]').length * 67;
    const spacerTotal = 20 * 67 + 5 * 67;
    expect(spacerTotal + totalRealRowHeight).toBe(30 * 67); // no double-counted row anywhere
  });
});

// issue #470 — pruneMountedRowsFromTop()/pruneMountedRowsFromBottom() (not
// exported; syncSectionRowsWindow()'s own internal helpers) used to read a
// row's real height (getBoundingClientRect(), which forces the browser to
// flush layout) and remove that same row in the same loop iteration, one row
// at a time — a fast scroll that prunes many rows in a single virtualize
// pass turned into that many forced synchronous layout recalculations
// back-to-back on the main thread (classic layout thrashing), which can both
// re-lengthen the fast-scroll blank-paint window and delay an unrelated
// freshly-opened modal/dropdown's first paint if one opens while that
// backlog is still draining. Driven through syncSectionRowsWindow() (the
// only way to reach these helpers) with real getBoundingClientRect()/remove()
// calls spied on (not mocked away — jsdom's real zero-height rect and real
// DOM removal both still run) purely to capture call *order*. Fails against
// the pre-fix interleaved version (verified by reverting the batching in
// src/ui/pages/dashboard.js locally and re-running — every 'read'/'write'
// pair alternates instead of all reads preceding all writes) and passes
// against the fix.
describe('pruneMountedRowsFromTop/Bottom batch layout reads before DOM writes (issue #470)', () => {
  it('reads every pruned row\'s height before removing any of them, not interleaved', async () => {
    const { buildSectionRows, syncSectionRowsWindow } = await import('../../src/ui/pages/dashboard.js');
    const items = Array.from({ length: 20 }, (_, i) => ({ id: `item-${i}` }));
    const wrapper = buildSectionRows(items, () => document.createElement('div'));
    syncSectionRowsWindow(wrapper, 0, 20); // mount every row first

    const callOrder = [];
    const originalRect = Element.prototype.getBoundingClientRect;
    const originalRemove = Element.prototype.remove;
    vi.spyOn(Element.prototype, 'getBoundingClientRect').mockImplementation(function mockedRect(...args) {
      callOrder.push('read');
      return originalRect.apply(this, args);
    });
    vi.spyOn(Element.prototype, 'remove').mockImplementation(function mockedRemove(...args) {
      callOrder.push('write');
      return originalRemove.apply(this, args);
    });

    // Only the window's start moves (0 -> 5); the end is unchanged, so this
    // exercises pruneMountedRowsFromTop() in isolation (5 rows pruned) with
    // no bottom-pruning noise mixed into the same call-order trace.
    syncSectionRowsWindow(wrapper, 5, 20);

    expect(callOrder).toEqual(['read', 'read', 'read', 'read', 'read', 'write', 'write', 'write', 'write', 'write']);
  });
});
