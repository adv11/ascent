import { describe, it, expect, beforeEach } from 'vitest';
import { attachTooltip } from '../../src/ui/components/tooltip.js';

beforeEach(() => {
  document.body.innerHTML = '';
});

describe('attachTooltip', () => {
  it('adds .tooltip-trigger to the trigger element and appends a role=tooltip bubble with the given text', () => {
    const trigger = document.createElement('button');
    document.body.append(trigger);

    const bubble = attachTooltip(trigger, 'Show password');

    expect(trigger.classList.contains('tooltip-trigger')).toBe(true);
    expect(bubble.getAttribute('role')).toBe('tooltip');
    expect(bubble.textContent).toBe('Show password');
    expect(trigger.contains(bubble)).toBe(true);
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
});
