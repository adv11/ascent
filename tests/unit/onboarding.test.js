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
});

describe('onboarding page — first-time picker (onboardingDone === false)', () => {
  it('renders exactly one card per registered template', async () => {
    const { TEMPLATES } = await import('../../src/data/templates/index.js');
    const { app } = await setup();
    const cards = app.querySelectorAll('.template-card');
    expect(cards.length).toBe(TEMPLATES.length);
  });

  it('has no back/cancel control — nothing to go back to yet', async () => {
    const { app } = await setup();
    const buttons = [...app.querySelectorAll('button')].filter(b => !b.classList.contains('theme-toggle'));
    expect(buttons.every(b => !/\bback\b|\bcancel\b/i.test(b.textContent))).toBe(true);
  });

  it('clicking a card picks that template without confirmation and navigates to /app', async () => {
    const initFromTemplate = vi.fn().mockResolvedValue(undefined);
    const confirmSpy = vi.spyOn(window, 'confirm');
    const { app, navigate } = await setup({ initFromTemplate });
    const blankCard = [...app.querySelectorAll('.template-card')].find(b => b.textContent.includes('Start blank'));
    blankCard.click();
    await vi.waitFor(() => expect(initFromTemplate).toHaveBeenCalledWith('blank'));
    await vi.waitFor(() => expect(navigate).toHaveBeenCalledWith('/app', true));
    expect(confirmSpy).not.toHaveBeenCalled();
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

describe('onboarding page — switch-template mode (onboardingDone === true)', () => {
  it('does NOT redirect away, and shows a "Back to my roadmap" link', async () => {
    const { app, navigate } = await setup({ onboardingDone: true });
    expect(navigate).not.toHaveBeenCalled();
    const backBtn = [...app.querySelectorAll('button')].find(b => /back to my roadmap/i.test(b.textContent));
    expect(backBtn).toBeTruthy();
    backBtn.click();
    expect(navigate).toHaveBeenCalledWith('/app', true);
  });

  it('requires confirmation before replacing the current roadmap, and does nothing if cancelled', async () => {
    const initFromTemplate = vi.fn().mockResolvedValue(undefined);
    vi.spyOn(window, 'confirm').mockReturnValue(false);
    const { app, navigate } = await setup({ onboardingDone: true, initFromTemplate });

    app.querySelector('.template-card').click();

    expect(window.confirm).toHaveBeenCalled();
    expect(initFromTemplate).not.toHaveBeenCalled();
    expect(navigate).not.toHaveBeenCalledWith('/app', true);
  });

  it('switches to the picked template once the user confirms', async () => {
    const initFromTemplate = vi.fn().mockResolvedValue(undefined);
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    const { app, navigate } = await setup({ onboardingDone: true, initFromTemplate });

    const blankCard = [...app.querySelectorAll('.template-card')].find(b => b.textContent.includes('Start blank'));
    blankCard.click();

    await vi.waitFor(() => expect(initFromTemplate).toHaveBeenCalledWith('blank'));
    await vi.waitFor(() => expect(navigate).toHaveBeenCalledWith('/app', true));
  });
});
