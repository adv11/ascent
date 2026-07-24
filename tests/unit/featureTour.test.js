import { describe, it, expect, vi, beforeEach } from 'vitest';
import { startTour } from '../../src/ui/components/featureTour.js';

function buildSteps(n = 3) {
  const targets = [];
  for (let i = 0; i < n; i += 1) {
    const target = document.createElement('button');
    target.textContent = `Target ${i}`;
    target.scrollIntoView = vi.fn();
    document.body.appendChild(target);
    targets.push(target);
  }
  return targets.map((target, i) => ({
    target: () => target,
    title: `Step ${i + 1}`,
    body: `Body ${i + 1}`
  }));
}

function mockMatchMedia(matches) {
  window.matchMedia = vi.fn().mockImplementation(query => ({
    matches,
    media: query,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn()
  }));
}

beforeEach(() => {
  document.body.innerHTML = '';
  mockMatchMedia(false);
});

describe('featureTour', () => {
  it('shows a welcome card first, before any spotlight step', () => {
    startTour(buildSteps(), { onEnd: vi.fn() });
    expect(document.querySelector('.tour-welcome-card')).not.toBeNull();
    expect(document.querySelector('.tour-popover')).toBeNull();
  });

  it('"Get started" transitions into step 1 of N', () => {
    startTour(buildSteps(3), { onEnd: vi.fn() });
    document.querySelector('.tour-welcome-card [data-action="start"]').click();

    expect(document.querySelector('.tour-welcome-card')).toBeNull();
    const popover = document.querySelector('.tour-popover');
    expect(popover).not.toBeNull();
    expect(popover.querySelector('.tour-popover-progress').textContent).toBe('Step 1 of 3');
    expect(popover.querySelector('[data-action="back"]')).toBeNull();
  });

  it('Skip at the welcome screen ends the tour immediately, calling onEnd', () => {
    const onEnd = vi.fn();
    startTour(buildSteps(), { onEnd });
    document.querySelector('.tour-welcome-card [data-action="skip"]').click();

    expect(onEnd).toHaveBeenCalledTimes(1);
    expect(document.querySelector('.tour-welcome-card')).toBeNull();
    expect(document.querySelector('.tour-ring')).toBeNull();
  });

  it('Next/Back move between steps, and Skip mid-tour ends it', () => {
    const onEnd = vi.fn();
    startTour(buildSteps(3), { onEnd });
    document.querySelector('.tour-welcome-card [data-action="start"]').click();

    document.querySelector('.tour-popover [data-action="next"]').click();
    expect(document.querySelector('.tour-popover-progress').textContent).toBe('Step 2 of 3');

    document.querySelector('.tour-popover [data-action="back"]').click();
    expect(document.querySelector('.tour-popover-progress').textContent).toBe('Step 1 of 3');

    document.querySelector('.tour-popover [data-action="skip"]').click();
    expect(onEnd).toHaveBeenCalledTimes(1);
    expect(document.querySelector('.tour-popover')).toBeNull();
    expect(document.querySelector('.tour-scrim')).toBeNull();
  });

  it('the last step\'s button reads "Done" and finishing calls onEnd exactly once', () => {
    const onEnd = vi.fn();
    startTour(buildSteps(2), { onEnd });
    document.querySelector('.tour-welcome-card [data-action="start"]').click();
    document.querySelector('.tour-popover [data-action="next"]').click();

    const finishBtn = document.querySelector('.tour-popover [data-action="finish"]');
    expect(finishBtn.textContent).toBe('Done');
    finishBtn.click();

    expect(onEnd).toHaveBeenCalledTimes(1);
    expect(document.querySelector('.tour-popover')).toBeNull();
  });

  it('Escape at any step ends the tour the same as Skip', () => {
    const onEnd = vi.fn();
    startTour(buildSteps(), { onEnd });
    document.querySelector('.tour-welcome-card [data-action="start"]').click();

    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));

    expect(onEnd).toHaveBeenCalledTimes(1);
    expect(document.querySelector('.tour-popover')).toBeNull();
  });

  it('ends gracefully (calling onEnd) if a step target disappears from the DOM', () => {
    const onEnd = vi.fn();
    const steps = buildSteps(2);
    steps[1] = { ...steps[1], target: () => null };
    startTour(steps, { onEnd });
    document.querySelector('.tour-welcome-card [data-action="start"]').click();

    document.querySelector('.tour-popover [data-action="next"]').click();

    expect(onEnd).toHaveBeenCalledTimes(1);
    expect(document.querySelector('.tour-popover')).toBeNull();
  });

  it('the returned cleanup function tears the tour down early (e.g. navigating away mid-tour)', () => {
    const onEnd = vi.fn();
    const stop = startTour(buildSteps(), { onEnd });
    stop();

    expect(onEnd).toHaveBeenCalledTimes(1);
    expect(document.querySelector('.tour-welcome-card')).toBeNull();
  });

  it('the resource badge / row click-guard convention is unaffected — the tour never wires its own click handlers onto step targets', () => {
    const steps = buildSteps(1);
    const targetClick = vi.fn();
    steps[0].target().addEventListener('click', targetClick);
    startTour(steps, { onEnd: vi.fn() });
    document.querySelector('.tour-welcome-card [data-action="start"]').click();

    steps[0].target().click();
    expect(targetClick).toHaveBeenCalledTimes(1);
  });

  describe('requiresMobileSidebar (issue #349)', () => {
    it('opens the sidebar drawer before showing a step flagged requiresMobileSidebar, at mobile viewport widths', () => {
      mockMatchMedia(true);
      const onOpenSidebar = vi.fn();
      const onCloseSidebar = vi.fn();
      const steps = buildSteps(1);
      steps[0].requiresMobileSidebar = true;
      startTour(steps, { onEnd: vi.fn(), onOpenSidebar, onCloseSidebar });
      document.querySelector('.tour-welcome-card [data-action="start"]').click();

      expect(onOpenSidebar).toHaveBeenCalledTimes(1);
      expect(onCloseSidebar).not.toHaveBeenCalled();
    });

    it('does not open the sidebar drawer for a flagged step at non-mobile viewport widths', () => {
      mockMatchMedia(false);
      const onOpenSidebar = vi.fn();
      const steps = buildSteps(1);
      steps[0].requiresMobileSidebar = true;
      startTour(steps, { onEnd: vi.fn(), onOpenSidebar });
      document.querySelector('.tour-welcome-card [data-action="start"]').click();

      expect(onOpenSidebar).not.toHaveBeenCalled();
    });

    it('closes the sidebar drawer when moving from a flagged step to one that is not flagged', () => {
      mockMatchMedia(true);
      const onOpenSidebar = vi.fn();
      const onCloseSidebar = vi.fn();
      const steps = buildSteps(2);
      steps[0].requiresMobileSidebar = true;
      startTour(steps, { onEnd: vi.fn(), onOpenSidebar, onCloseSidebar });
      document.querySelector('.tour-welcome-card [data-action="start"]').click();
      expect(onOpenSidebar).toHaveBeenCalledTimes(1);

      document.querySelector('.tour-popover [data-action="next"]').click();
      expect(onCloseSidebar).toHaveBeenCalledTimes(1);
    });

    it('closes the sidebar drawer on tour end if it was left open mid-sidebar-step', () => {
      mockMatchMedia(true);
      const onOpenSidebar = vi.fn();
      const onCloseSidebar = vi.fn();
      const steps = buildSteps(1);
      steps[0].requiresMobileSidebar = true;
      startTour(steps, { onEnd: vi.fn(), onOpenSidebar, onCloseSidebar });
      document.querySelector('.tour-welcome-card [data-action="start"]').click();

      document.querySelector('.tour-popover [data-action="skip"]').click();
      expect(onCloseSidebar).toHaveBeenCalledTimes(1);
    });
  });
});
