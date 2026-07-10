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
});
