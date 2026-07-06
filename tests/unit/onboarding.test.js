import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../src/ui/router.js', () => ({ navigate: vi.fn() }));

async function setup({
  onboardingDone = false,
  hiddenTemplateIds = [],
  activeTemplateId,
  startedTemplateIds = [],
  switchRoadmap = vi.fn().mockResolvedValue(undefined),
  hideTemplate = vi.fn().mockResolvedValue(undefined),
  unhideTemplate = vi.fn().mockResolvedValue(undefined)
} = {}) {
  const { navigate } = await import('../../src/ui/router.js');
  const { renderOnboarding } = await import('../../src/ui/pages/onboarding.js');
  const app = document.createElement('div');
  document.body.appendChild(app);
  const store = {
    getSnapshot: vi.fn(() => ({ onboardingDone, hiddenTemplateIds, activeTemplateId, startedTemplateIds })),
    switchRoadmap,
    hideTemplate,
    unhideTemplate
  };
  const user = { uid: 'uid-1', isAnonymous: false };
  const cleanup = renderOnboarding(app, { user, store });
  return { app, navigate, store, cleanup };
}

// The confirmDialog() modal renders into document.body (a sibling of `app`,
// same as the native confirm() it replaced), so tests reach it via document,
// not app.
function getConfirmDialog() {
  return document.querySelector('.modal-overlay');
}

function clickDialogAction(action) {
  document.querySelector(`.modal-overlay [data-action="${action}"]`)?.click();
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
    renderOnboarding(app, { user: null, store: { getSnapshot: () => ({ onboardingDone: false, hiddenTemplateIds: [], startedTemplateIds: [] }) } });
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
    const switchRoadmap = vi.fn().mockResolvedValue(undefined);
    const { app, navigate } = await setup({ switchRoadmap });
    const blankCard = [...app.querySelectorAll('.template-card')].find(b => b.textContent.includes('Start blank'));
    blankCard.click();
    await vi.waitFor(() => expect(switchRoadmap).toHaveBeenCalledWith('blank'));
    await vi.waitFor(() => expect(navigate).toHaveBeenCalledWith('/app', true));
    expect(getConfirmDialog()).toBeNull();
  });

  it('disables every card while a pick is in flight, to prevent a double-submit', async () => {
    let resolvePick;
    const switchRoadmap = vi.fn(() => new Promise(resolve => { resolvePick = resolve; }));
    const { app } = await setup({ switchRoadmap });
    const cards = [...app.querySelectorAll('.template-card')];

    cards[0].click();

    expect(cards[1].classList.contains('is-disabled')).toBe(true);
    resolvePick();
  });

  it('every non-blank card has a hide (×) button, and the blank card has an info button instead', async () => {
    const { app } = await setup();
    const cards = [...app.querySelectorAll('.template-card')];
    const blankCard = cards.find(c => c.textContent.includes('Start blank'));
    const javaCard = cards.find(c => c.textContent.includes('Java Backend Engineer'));

    expect(blankCard.querySelector('.template-card-hide')).toBeNull();
    expect(blankCard.querySelector('.template-card-info')).not.toBeNull();
    expect(javaCard.querySelector('.template-card-hide')).not.toBeNull();
    expect(javaCard.querySelector('.template-card-info')).toBeNull();
  });

  it('clicking the hide button asks for confirmation, then hides the card without picking it', async () => {
    const hideTemplate = vi.fn().mockResolvedValue(undefined);
    const switchRoadmap = vi.fn().mockResolvedValue(undefined);
    const { app, navigate } = await setup({ hideTemplate, switchRoadmap });

    const javaCard = [...app.querySelectorAll('.template-card')].find(c => c.textContent.includes('Java Backend Engineer'));
    javaCard.querySelector('.template-card-hide').click();

    expect(getConfirmDialog()).toBeTruthy();
    clickDialogAction('confirm');

    await vi.waitFor(() => expect(hideTemplate).toHaveBeenCalledWith('java-backend'));
    expect(switchRoadmap).not.toHaveBeenCalled();
    expect(navigate).not.toHaveBeenCalled();
    expect(app.querySelector('.template-card-name')?.textContent).not.toBe(undefined);
    expect([...app.querySelectorAll('.template-card-name')].some(n => n.textContent === 'Java Backend Engineer')).toBe(false);
  });

  it('does not hide when the confirmation is dismissed', async () => {
    const hideTemplate = vi.fn().mockResolvedValue(undefined);
    const { app } = await setup({ hideTemplate });

    const javaCard = [...app.querySelectorAll('.template-card')].find(c => c.textContent.includes('Java Backend Engineer'));
    javaCard.querySelector('.template-card-hide').click();

    clickDialogAction('cancel');
    await vi.waitFor(() => expect(getConfirmDialog()).toBeNull());

    expect(hideTemplate).not.toHaveBeenCalled();
    expect([...app.querySelectorAll('.template-card-name')].some(n => n.textContent === 'Java Backend Engineer')).toBe(true);
  });

  it('shows a "Show hidden templates" toggle and restores a hidden template on demand', async () => {
    const unhideTemplate = vi.fn().mockResolvedValue(undefined);
    const { app } = await setup({ hiddenTemplateIds: ['java-backend'], unhideTemplate });

    expect([...app.querySelectorAll('.template-card-name')].some(n => n.textContent === 'Java Backend Engineer')).toBe(false);
    const toggle = app.querySelector('.hidden-templates-toggle');
    expect(toggle.textContent).toContain('1 template hidden');

    toggle.click();
    const restoreBtn = [...app.querySelectorAll('.template-card-hidden')]
      .find(c => c.textContent.includes('Java Backend Engineer'))
      ?.querySelector('button');
    expect(restoreBtn).toBeTruthy();

    restoreBtn.click();
    await vi.waitFor(() => expect(unhideTemplate).toHaveBeenCalledWith('java-backend'));
    // Back in the main (non-hidden) grid, and the "hidden" section is now empty.
    await vi.waitFor(() => {
      const mainGridNames = [...app.querySelectorAll('.template-grid:not(.hidden-grid) .template-card-name')];
      expect(mainGridNames.some(n => n.textContent === 'Java Backend Engineer')).toBe(true);
    });
    expect(app.querySelector('.hidden-templates-toggle')).toBeNull();
  });
});

describe('onboarding page — switch-template mode (onboardingDone === true)', () => {
  it('does NOT redirect away, and shows a "Back to my roadmap" link', async () => {
    const { app, navigate } = await setup({ onboardingDone: true, activeTemplateId: 'java-backend' });
    expect(navigate).not.toHaveBeenCalled();
    const backBtn = [...app.querySelectorAll('button')].find(b => /back to my roadmap/i.test(b.textContent));
    expect(backBtn).toBeTruthy();
    backBtn.click();
    expect(navigate).toHaveBeenCalledWith('/app', true);
  });

  it('switches to a different template immediately — no confirmation dialog, since nothing is ever destroyed (issue #58)', async () => {
    const switchRoadmap = vi.fn().mockResolvedValue(undefined);
    const { app, navigate } = await setup({ onboardingDone: true, activeTemplateId: 'java-backend', switchRoadmap });

    const dataScienceCard = [...app.querySelectorAll('.template-card')].find(c => c.textContent.includes('Data Scientist'));
    dataScienceCard.click();

    expect(getConfirmDialog()).toBeNull();
    await vi.waitFor(() => expect(switchRoadmap).toHaveBeenCalledWith('data-science'));
    await vi.waitFor(() => expect(navigate).toHaveBeenCalledWith('/app', true));
  });

  it('marks the active template as "Current" and re-picking it returns to the dashboard without re-seeding or asking for confirmation', async () => {
    const switchRoadmap = vi.fn().mockResolvedValue(undefined);
    const { app, navigate } = await setup({ onboardingDone: true, activeTemplateId: 'java-backend', switchRoadmap });

    const javaCard = [...app.querySelectorAll('.template-card')].find(c => c.textContent.includes('Java Backend Engineer'));
    expect(javaCard.querySelector('.template-card-current-badge')?.textContent).toBe('Current');

    javaCard.click();

    expect(getConfirmDialog()).toBeNull();
    expect(switchRoadmap).not.toHaveBeenCalled();
    await vi.waitFor(() => expect(navigate).toHaveBeenCalledWith('/app', true));
  });

  it('badges a started-but-not-active template "In progress"', async () => {
    const { app } = await setup({ onboardingDone: true, activeTemplateId: 'java-backend', startedTemplateIds: ['java-backend', 'frontend'] });

    const frontendCard = [...app.querySelectorAll('.template-card')].find(c => c.textContent.includes('Frontend Developer'));
    expect(frontendCard.querySelector('.template-card-started-badge')?.textContent).toBe('In progress');
    expect(frontendCard.querySelector('.template-card-current-badge')).toBeNull();

    const untouchedCard = [...app.querySelectorAll('.template-card')].find(c => c.textContent.includes('Data Scientist'));
    expect(untouchedCard.querySelector('.template-card-started-badge')).toBeNull();
    expect(untouchedCard.querySelector('.template-card-current-badge')).toBeNull();
  });

  it('a started+hidden template stays visible in the main grid, badged "In progress", instead of moving to the hidden section', async () => {
    const { app } = await setup({
      onboardingDone: true,
      activeTemplateId: 'java-backend',
      startedTemplateIds: ['java-backend', 'frontend'],
      hiddenTemplateIds: ['frontend']
    });

    const mainGridCards = [...app.querySelectorAll('.template-grid:not(.hidden-grid) .template-card')];
    const frontendCard = mainGridCards.find(c => c.textContent.includes('Frontend Developer'));
    expect(frontendCard).toBeTruthy();
    expect(frontendCard.querySelector('.template-card-started-badge')?.textContent).toBe('In progress');

    // Not listed under "hidden templates to restore" — it's already visible.
    expect(app.querySelector('.hidden-templates-toggle')).toBeNull();
  });

  it('the subtitle no longer claims switching replaces or overwrites progress', async () => {
    const { app } = await setup({ onboardingDone: true, activeTemplateId: 'java-backend' });
    const subtitle = app.querySelector('.auth-subtitle');
    expect(subtitle.textContent.toLowerCase()).not.toContain('replaces');
    expect(subtitle.textContent.toLowerCase()).not.toContain('cannot be undone');
  });
});
