import { describe, it, expect, beforeEach } from 'vitest';
import { attachTooltip } from '../../src/ui/components/tooltip.js';

beforeEach(() => {
  document.body.innerHTML = '';
});

describe('attachTooltip', () => {
  it('adds .tooltip-trigger to the trigger element and builds a role=tooltip bubble with the given text, not yet in the DOM', () => {
    const trigger = document.createElement('button');
    document.body.append(trigger);

    const bubble = attachTooltip(trigger, 'Show password');

    expect(trigger.classList.contains('tooltip-trigger')).toBe(true);
    expect(bubble.getAttribute('role')).toBe('tooltip');
    expect(bubble.textContent).toBe('Show password');
    // Portaled on show, not appended eagerly (issue #180 follow-up) — a
    // trigger sitting inside a scrolling/overflow ancestor (e.g.
    // heatmap.js's .heatmap-scroll) would otherwise clip a bubble
    // positioned as its DOM child.
    expect(document.body.contains(bubble)).toBe(false);
  });

  it('portals the bubble to document.body (not the trigger) on mouseenter, and removes it on mouseleave', () => {
    const trigger = document.createElement('button');
    document.body.append(trigger);
    const bubble = attachTooltip(trigger, 'Info');

    trigger.dispatchEvent(new Event('mouseenter'));
    expect(document.body.contains(bubble)).toBe(true);
    expect(trigger.contains(bubble)).toBe(false);

    trigger.dispatchEvent(new Event('mouseleave'));
    expect(document.body.contains(bubble)).toBe(false);
  });

  it('flips below when there is not enough room above (mouseenter recalculates position)', () => {
    const trigger = document.createElement('button');
    document.body.append(trigger);
    const bubble = attachTooltip(trigger, 'Info');

    // jsdom returns a zero-rect by default (top: 0) — not enough room above
    // for any nonzero bubble height, so it must flip below.
    trigger.dispatchEvent(new Event('mouseenter'));
    expect(bubble.classList.contains('tooltip-below')).toBe(true);
  });

  it('flips below when placing the bubble above would overlap a visible `.section-label` (issue #12B follow-up)', () => {
    // Regression for a real bug: the first checklist row's resource-count
    // tooltip rendered with its top sliced off, no matter how high its
    // z-index was set (confirmed live up to z-index: 99999 — this is not a
    // z-index/paint-order bug). Root cause: `.section-label` is `position:
    // sticky` with `.phase-card` (overflow: hidden + transform on hover) as
    // its containing block, which promotes it to a layer Chromium paints
    // ahead of ordinary content in that block regardless of z-index. The fix
    // is to never place the bubble somewhere that would overlap a currently
    // visible section label — flip below instead, verified by temporarily
    // forcing the label to `position: static` and confirming the tooltip
    // then rendered correctly (proving it wasn't a z-index issue).
    const label = document.createElement('div');
    label.className = 'section-label';
    label.getBoundingClientRect = () => ({ top: 470, bottom: 505, left: 0, right: 800, width: 800, height: 35 });
    document.body.append(label);

    const trigger = document.createElement('button');
    // Plenty of room to the viewport top (rect.top: 520 is well past a
    // ~34px bubble need), but placing the bubble 6px above the trigger
    // would land it at ~486-514 — squarely inside the section label's own
    // 470-505 box.
    trigger.getBoundingClientRect = () => ({ top: 520, bottom: 540, left: 300, right: 400, width: 100, height: 20 });
    document.body.append(trigger);

    const bubble = attachTooltip(trigger, 'Info');
    trigger.dispatchEvent(new Event('mouseenter'));
    expect(bubble.classList.contains('tooltip-below')).toBe(true);
  });

  it('stays above when there is room and no section label to collide with', () => {
    const trigger = document.createElement('button');
    trigger.getBoundingClientRect = () => ({ top: 520, bottom: 540, left: 300, right: 400, width: 100, height: 20 });
    document.body.append(trigger);

    const bubble = attachTooltip(trigger, 'Info');
    trigger.dispatchEvent(new Event('mouseenter'));
    expect(bubble.classList.contains('tooltip-below')).toBe(false);
  });
});
