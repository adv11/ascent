import { el } from '../dom.js';
import { attachFocusTrap } from './modal.js';
import { createBrandMark } from './brand.js';

// Issue #17 — a one-time, sequential spotlight walkthrough of the dashboard.
// Every step's target is resolved live via `step.target()` (a querySelector
// call), never a cached element reference, so it survives re-renders and
// works regardless of scroll position (per the issue's own spec). Portaled
// to document.body like every other floating/positioned element in this app
// (`.claude/rules/ui-styling.md`'s "every floating/positioned element is a
// portal" convention) — the ring/popover are never DOM descendants of
// whatever they're highlighting.
const POPOVER_MARGIN = 12;
const POPOVER_GAP = 16;
const RING_PADDING = 4;

// Collision-aware placement: try below the target, then above, then right,
// then left, falling back to a viewport-clamped "below" if nothing fits
// cleanly — hand-rolled, no new dependency, matching this app's existing
// tooltip.js/dropdown.js positioning approach rather than a library.
function computePlacement(rect, popoverW, popoverH) {
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const fits = (top, left) => top >= POPOVER_MARGIN && left >= POPOVER_MARGIN &&
    top + popoverH <= vh - POPOVER_MARGIN && left + popoverW <= vw - POPOVER_MARGIN;

  const centerX = rect.left + rect.width / 2 - popoverW / 2;
  const clampedX = Math.min(Math.max(centerX, POPOVER_MARGIN), Math.max(POPOVER_MARGIN, vw - popoverW - POPOVER_MARGIN));

  const below = { top: rect.bottom + POPOVER_GAP, left: clampedX };
  if (fits(below.top, below.left)) return below;

  const above = { top: rect.top - popoverH - POPOVER_GAP, left: clampedX };
  if (fits(above.top, above.left)) return above;

  const centerY = rect.top + rect.height / 2 - popoverH / 2;
  const clampedY = Math.min(Math.max(centerY, POPOVER_MARGIN), Math.max(POPOVER_MARGIN, vh - popoverH - POPOVER_MARGIN));

  const right = { top: clampedY, left: rect.right + POPOVER_GAP };
  if (fits(right.top, right.left)) return right;

  const left = { top: clampedY, left: rect.left - popoverW - POPOVER_GAP };
  if (fits(left.top, left.left)) return left;

  // Nothing fit cleanly (a very small viewport) — clamp "below" into the
  // viewport rather than leaving it to render off-screen.
  return {
    top: Math.min(Math.max(below.top, POPOVER_MARGIN), Math.max(POPOVER_MARGIN, vh - popoverH - POPOVER_MARGIN)),
    left: below.left
  };
}

function buildWelcomeOverlay() {
  const card = el('div', {
    className: 'tour-welcome-card modal-card-enter',
    role: 'dialog',
    'aria-modal': 'true',
    'aria-label': 'Welcome tour'
  }, [
    el('div', { className: 'tour-welcome-brand' }, createBrandMark()),
    el('h2', { className: 'tour-welcome-title', text: "Let's take a quick look around." }),
    el('p', { className: 'tour-welcome-body', text: 'A few short stops, then you’re all set.' }),
    el('div', { className: 'tour-welcome-actions' }, [
      el('button', { type: 'button', className: 'btn btn-ghost', 'data-action': 'skip', text: 'Skip' }),
      el('button', { type: 'button', className: 'btn btn-primary', 'data-action': 'start', text: 'Get started →' })
    ])
  ]);
  const overlay = el('div', { className: 'tour-welcome-overlay' }, [card]);
  return { overlay, card };
}

function buildPopover(step, index, total) {
  const isFirst = index === 0;
  const isLast = index === total - 1;
  return el('div', {
    className: 'tour-popover modal-card-enter',
    role: 'dialog',
    'aria-modal': 'true',
    'aria-label': step.title
  }, [
    el('p', { className: 'tour-popover-progress', 'aria-live': 'polite', text: `Step ${index + 1} of ${total}` }),
    el('h3', { className: 'tour-popover-title', text: step.title }),
    el('p', { className: 'tour-popover-body', text: step.body }),
    el('div', { className: 'tour-popover-actions' }, [
      el('button', { type: 'button', className: 'btn btn-ghost btn-sm', 'data-action': 'skip', text: 'Skip' }),
      el('div', { className: 'tour-popover-actions-right' }, [
        isFirst ? null : el('button', { type: 'button', className: 'btn btn-secondary btn-sm', 'data-action': 'back', text: 'Back' }),
        el('button', { type: 'button', className: 'btn btn-primary btn-sm', 'data-action': isLast ? 'finish' : 'next', text: isLast ? 'Done' : 'Next' })
      ].filter(Boolean))
    ])
  ]);
}

// steps: [{ target: () => Element | null, title, body }]. Every step's copy
// is static, developer-authored text (never user- or store-derived), so
// there's no injection surface here — the no-innerHTML rule still applies to
// every node, and every node below goes through el()'s text: key.
//
// A step may set `requiresMobileSidebar: true` when its target lives inside
// the app's off-canvas mobile sidebar drawer (issue #349) — this component
// stays sidebar-agnostic and just calls the caller-supplied
// `onOpenSidebar`/`onCloseSidebar` hooks around such a step, only at
// viewport widths where the sidebar actually renders as an off-canvas
// drawer (matches the `(max-width: 639px)` boundary in app.css).
const MOBILE_SIDEBAR_QUERY = '(max-width: 639px)';

// Returns a cleanup function — call it if the host page unmounts mid-tour
// (e.g. navigating away), per the "Component subscription cleanup" rule in
// root CLAUDE.md. `onEnd` fires exactly once, whether the tour was skipped,
// closed via Escape, or completed by reaching "Done" on the last step — all
// three count as "the tour is over" from the caller's point of view.
export function startTour(steps, { onEnd, onOpenSidebar, onCloseSidebar } = {}) {
  let ended = false;
  let stepIndex = -1;
  let rafId = null;
  let stepsStarted = false;
  let detachTrap = null;
  let popoverNode = null;
  let welcomeNode = null;
  let mobileSidebarOpen = false;
  const previouslyFocused = document.activeElement;

  // Returns true if this call just opened the drawer — callers use that to
  // wait out its CSS transform transition before measuring the now-visible
  // target's rect, or the ring would be positioned mid-slide-in.
  function syncMobileSidebar(step) {
    const needsIt = !!step?.requiresMobileSidebar && window.matchMedia(MOBILE_SIDEBAR_QUERY).matches;
    if (needsIt && !mobileSidebarOpen) {
      onOpenSidebar?.();
      mobileSidebarOpen = true;
      return true;
    }
    if (!needsIt && mobileSidebarOpen) {
      onCloseSidebar?.();
      mobileSidebarOpen = false;
    }
    return false;
  }

  const scrim = el('div', { className: 'tour-scrim' });
  const ring = el('div', { className: 'tour-ring' });

  function reflow() {
    rafId = null;
    if (!stepsStarted || stepIndex < 0 || stepIndex >= steps.length || ended) return;
    const target = steps[stepIndex].target();
    if (!target) {
      end();
      return;
    }
    const rect = target.getBoundingClientRect();
    ring.style.left = `${rect.left - RING_PADDING}px`;
    ring.style.top = `${rect.top - RING_PADDING}px`;
    ring.style.width = `${rect.width + RING_PADDING * 2}px`;
    ring.style.height = `${rect.height + RING_PADDING * 2}px`;
    if (popoverNode) {
      const { top, left } = computePlacement(rect, popoverNode.offsetWidth, popoverNode.offsetHeight);
      popoverNode.style.top = `${top}px`;
      popoverNode.style.left = `${left}px`;
    }
  }

  function scheduleReflow() {
    if (rafId !== null) return;
    rafId = requestAnimationFrame(reflow);
  }

  function cleanupStepDom() {
    detachTrap?.();
    detachTrap = null;
    popoverNode?.remove();
    popoverNode = null;
  }

  function end() {
    if (ended) return;
    ended = true;
    if (rafId !== null) cancelAnimationFrame(rafId);
    window.removeEventListener('scroll', scheduleReflow, true);
    window.removeEventListener('resize', scheduleReflow);
    cleanupStepDom();
    welcomeNode?.remove();
    welcomeNode = null;
    ring.remove();
    scrim.remove();
    if (mobileSidebarOpen) {
      onCloseSidebar?.();
      mobileSidebarOpen = false;
    }
    previouslyFocused?.focus?.();
    onEnd?.();
  }

  // --duration-base in app.css — the sidebar's off-canvas transform
  // transition this waits out before measuring its now-visible target.
  const MOBILE_SIDEBAR_TRANSITION_MS = 200;

  function showStep(index) {
    cleanupStepDom();
    stepIndex = index;
    const step = steps[index];
    const justOpenedSidebar = syncMobileSidebar(step);
    const target = step.target();
    if (!target) {
      end();
      return;
    }
    target.scrollIntoView({ block: 'center' });
    popoverNode = buildPopover(step, index, steps.length);
    popoverNode.style.visibility = 'hidden';
    document.body.append(popoverNode);
    detachTrap = attachFocusTrap(popoverNode, { onEscape: end });
    popoverNode.addEventListener('click', e => {
      const action = e.target.closest('[data-action]')?.dataset.action;
      if (action === 'skip' || action === 'finish') end();
      else if (action === 'back') showStep(index - 1);
      else if (action === 'next') showStep(index + 1);
    });
    const finishShow = () => {
      if (ended || stepIndex !== index) return;
      reflow();
      popoverNode.style.visibility = '';
      popoverNode.querySelector('[data-action]')?.focus();
    };
    if (justOpenedSidebar) setTimeout(finishShow, MOBILE_SIDEBAR_TRANSITION_MS);
    else finishShow();
  }

  function beginSteps() {
    welcomeNode?.remove();
    welcomeNode = null;
    stepsStarted = true;
    document.body.append(scrim, ring);
    window.addEventListener('scroll', scheduleReflow, true);
    window.addEventListener('resize', scheduleReflow);
    showStep(0);
  }

  const { overlay: welcomeOverlay, card: welcomeCard } = buildWelcomeOverlay();
  welcomeNode = welcomeOverlay;
  document.body.append(welcomeNode);
  detachTrap = attachFocusTrap(welcomeCard, { onEscape: end });
  welcomeCard.addEventListener('click', e => {
    const action = e.target.closest('[data-action]')?.dataset.action;
    if (action === 'skip') end();
    else if (action === 'start') {
      detachTrap?.();
      detachTrap = null;
      beginSteps();
    }
  });
  welcomeCard.querySelector('[data-action="start"]')?.focus();

  return end;
}
