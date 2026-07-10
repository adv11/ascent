import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

vi.mock('../../src/services/firebase.js', () => ({
  authApi: { deleteAccount: vi.fn() },
  authErrorMessage: e => e?.message || 'error',
}));
vi.mock('../../src/ui/router.js', () => ({ navigate: vi.fn() }));

const { animatePhaseBody } = await import('../../src/ui/pages/dashboard.js');

function buildPhaseCard(open) {
  const card = document.createElement('section');
  card.className = `phase-card ${open ? 'open' : ''}`;
  const body = document.createElement('div');
  body.className = 'phase-body';
  body.innerHTML = '<p>content</p>';
  card.appendChild(body);
  document.body.appendChild(card);
  // jsdom has no real layout engine — scrollHeight/getBoundingClientRect
  // always read 0, so stub them to something animatable per test.
  return { card, body };
}

beforeEach(() => {
  document.body.innerHTML = '';
  // `vi.spyOn(window, 'matchMedia').mockImplementation(...)` (below, the
  // reduced-motion test) spies on a property that's *already* a `vi.fn()`
  // (tests/setup.js's global default) — `vi.restoreAllMocks()` in afterEach
  // doesn't reliably restore that back to the matches:false default in this
  // vitest version, which previously leaked a stale matches:true into every
  // later test in this file. Reset explicitly instead of trusting restore
  // ordering.
  window.matchMedia = vi.fn().mockImplementation(query => ({
    matches: false,
    media: query,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn()
  }));
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('animatePhaseBody', () => {
  it('opening: adds the open class, sets display block, and animates height to the content height', async () => {
    const { card, body } = buildPhaseCard(false);
    Object.defineProperty(body, 'scrollHeight', { value: 300, configurable: true });

    animatePhaseBody(card, true);

    expect(card.classList.contains('open')).toBe(true);
    expect(body.style.display).toBe('block');
    expect(body.style.overflow).toBe('hidden');

    await Promise.resolve();
    await Promise.resolve();

    expect(body.style.height).toBe('');
    expect(body.style.overflow).toBe('');
  });

  it('closing: measures height before removing the open class, so it never reads a collapsed 0', async () => {
    const { card, body } = buildPhaseCard(true);
    vi.spyOn(body, 'getBoundingClientRect').mockReturnValue({ height: 400 });

    animatePhaseBody(card, false);

    // The class is removed synchronously, but display stays 'block' (forced
    // via inline style) for the duration of the closing animation — this is
    // the fix for the bug where CSS's `.phase-card.open .phase-body` losing
    // its match would otherwise collapse the box before the animation ran.
    expect(card.classList.contains('open')).toBe(false);
    expect(body.style.display).toBe('block');
    expect(body.style.height).toBe('400px');

    await Promise.resolve();
    await Promise.resolve();

    expect(body.style.display).toBe('none');
  });

  it('respects prefers-reduced-motion — jumps straight to the final state with no animation', () => {
    vi.spyOn(window, 'matchMedia').mockImplementation(query => ({
      matches: query === '(prefers-reduced-motion: reduce)',
      media: query,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn()
    }));
    const { card, body } = buildPhaseCard(false);
    const animateSpy = vi.spyOn(body, 'animate');

    animatePhaseBody(card, true);

    expect(card.classList.contains('open')).toBe(true);
    expect(body.style.display).toBe('block');
    expect(animateSpy).not.toHaveBeenCalled();
  });

  it('does nothing destructive when the card has no .phase-body', () => {
    const card = document.createElement('section');
    document.body.appendChild(card);
    expect(() => animatePhaseBody(card, true)).not.toThrow();
    expect(card.classList.contains('open')).toBe(true);
  });

  // Regression test for a real, reported bug: rapidly toggling a phase-head
  // (opening, then closing again before the open animation's `onfinish` had
  // fired) left the topic list visually "cut off" for a couple of seconds —
  // the first (open) animation's stale finish handler fired *after* the
  // second (close) call had already run, clobbering the close's intended
  // display:none/height:'' back to an open-but-clipped state. Fixed by
  // canceling any in-flight animation on the element before starting a new
  // one; `cancel()` never invokes `onfinish`, so the stale handler above
  // must never fire at all.
  it('canceling an in-flight animation before starting a new one prevents the stale onfinish from clobbering the new state', async () => {
    const { card, body } = buildPhaseCard(false);
    Object.defineProperty(body, 'scrollHeight', { value: 300, configurable: true });

    animatePhaseBody(card, true); // starts opening
    expect(body.getAnimations()).toHaveLength(1);

    // Close it again before the open animation's onfinish has had a chance
    // to run (no await between these two calls).
    vi.spyOn(body, 'getBoundingClientRect').mockReturnValue({ height: 150 });
    animatePhaseBody(card, false); // should cancel the open animation first

    // Only the close animation should still be pending.
    expect(body.getAnimations()).toHaveLength(1);

    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();

    // The close's own onfinish must have won — not the stale open one.
    expect(card.classList.contains('open')).toBe(false);
    expect(body.style.display).toBe('none');
  });

  // Animating `height` forces a full layout+paint every frame — expensive
  // enough on a large phase (some built-in template phases run 50-100+
  // items) that it can visually stutter for seconds on a slower device.
  // Past LARGE_PHASE_ITEM_THRESHOLD items, skip the animation entirely.
  it('skips the animation for a phase with a lot of items, jumping straight to the end state', () => {
    const { card, body } = buildPhaseCard(false);
    Object.defineProperty(body, 'scrollHeight', { value: 3000, configurable: true });
    for (let i = 0; i < 41; i++) body.appendChild(document.createElement('div')).className = 'check-item';
    const animateSpy = vi.spyOn(body, 'animate');

    animatePhaseBody(card, true);

    expect(card.classList.contains('open')).toBe(true);
    expect(body.style.display).toBe('block');
    expect(animateSpy).not.toHaveBeenCalled();
  });

  // Regression test for a real, reported bug: a `.section-label` inside
  // `.phase-body` is `position: sticky`, and `overflow: hidden` (set below
  // for the height animation's clipping) makes an element a scroll
  // container — which per spec becomes the sticky positioning context for
  // any sticky descendant. Every section label recalculated its "stuck"
  // position against the still-animating container instead of the page,
  // visibly overlapping sibling content for the animation's duration.
  // `.phase-body-animating` (app.css) drops `.section-label` to `position:
  // static` for exactly that window — this test asserts the class is
  // present for the animation's duration and gone once it settles, on both
  // the opening and closing paths.
  describe('phase-body-animating class (sticky-section-label overlap fix)', () => {
    it('is present while opening (overflow: hidden is set) and removed once the animation finishes', async () => {
      const { card, body } = buildPhaseCard(false);
      Object.defineProperty(body, 'scrollHeight', { value: 300, configurable: true });

      animatePhaseBody(card, true);

      expect(body.classList.contains('phase-body-animating')).toBe(true);
      expect(body.style.overflow).toBe('hidden');

      await Promise.resolve();
      await Promise.resolve();

      expect(body.classList.contains('phase-body-animating')).toBe(false);
    });

    it('is present while closing and removed once the animation finishes', async () => {
      const { card, body } = buildPhaseCard(true);
      vi.spyOn(body, 'getBoundingClientRect').mockReturnValue({ height: 400 });

      animatePhaseBody(card, false);

      expect(body.classList.contains('phase-body-animating')).toBe(true);
      expect(body.style.overflow).toBe('hidden');

      await Promise.resolve();
      await Promise.resolve();

      expect(body.classList.contains('phase-body-animating')).toBe(false);
    });

    it('is never added on the reduced-motion path, since there is no animating overflow:hidden window to guard against', () => {
      vi.spyOn(window, 'matchMedia').mockImplementation(query => ({
        matches: query === '(prefers-reduced-motion: reduce)',
        media: query,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn()
      }));
      const { card, body } = buildPhaseCard(false);

      animatePhaseBody(card, true);

      expect(body.classList.contains('phase-body-animating')).toBe(false);
    });
  });
});
