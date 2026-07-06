import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../src/ui/router.js', () => ({ navigate: vi.fn() }));

async function setup({ onboardingDone = false, initFromTemplate = vi.fn().mockResolvedValue(undefined) } = {}) {
  const { navigate } = await import('../../src/ui/router.js');
  const { renderOnboarding } = await import('../../src/ui/pages/onboarding.js');
  const app = document.createElement('div');
  document.body.appendChild(app);
  const store = {
    getSnapshot: vi.fn(() => ({ onboardingDone })),
    initFromTemplate
  };
  const user = { uid: 'uid-1', isAnonymous: false };
  const cleanup = renderOnboarding(app, { user, store });
  return { app, navigate, store, cleanup };
}

beforeEach(() => {
  vi.resetModules();
  vi.clearAllMocks();
  document.body.innerHTML = '';
});

describe('onboarding page — gating', () => {
  it('redirects to /signin when there is no signed-in user', async () => {
    const { navigate } = await import('../../src/ui/router.js');
    const { renderOnboarding } = await import('../../src/ui/pages/onboarding.js');
    const app = document.createElement('div');
    renderOnboarding(app, { user: null, store: { getSnapshot: () => ({ onboardingDone: false }) } });
    expect(navigate).toHaveBeenCalledWith('/signin', true);
    expect(app.children.length).toBe(0);
  });

  it('redirects straight to /app when onboarding is already done (returning user)', async () => {
    const { app, navigate } = await setup({ onboardingDone: true });
    expect(navigate).toHaveBeenCalledWith('/app', true);
    expect(app.querySelector('.template-grid')).toBeNull();
  });
});

describe('onboarding page — template picker', () => {
  it('renders exactly one card per registered template', async () => {
    const { TEMPLATES } = await import('../../src/data/templates/index.js');
    const { app } = await setup();
    const cards = app.querySelectorAll('.template-card');
    expect(cards.length).toBe(TEMPLATES.length);
  });

  it('has no back/cancel control — onboarding is a one-way gate', async () => {
    const { app } = await setup();
    const buttons = [...app.querySelectorAll('button')].filter(b => !b.classList.contains('theme-toggle'));
    expect(buttons.every(b => !/\bback\b|\bcancel\b/i.test(b.textContent))).toBe(true);
  });

  it('clicking a card picks that template and navigates to /app', async () => {
    const initFromTemplate = vi.fn().mockResolvedValue(undefined);
    const { app, navigate } = await setup({ initFromTemplate });
    const blankCard = [...app.querySelectorAll('.template-card')].find(b => b.textContent.includes('Start blank'));
    blankCard.click();
    await vi.waitFor(() => expect(initFromTemplate).toHaveBeenCalledWith('blank'));
    await vi.waitFor(() => expect(navigate).toHaveBeenCalledWith('/app', true));
  });

  it('disables every card while a pick is in flight, to prevent a double-submit', async () => {
    let resolvePick;
    const initFromTemplate = vi.fn(() => new Promise(resolve => { resolvePick = resolve; }));
    const { app } = await setup({ initFromTemplate });
    const cards = [...app.querySelectorAll('.template-card')];

    cards[0].click();

    expect(cards[1].disabled).toBe(true);
    resolvePick();
  });
});
