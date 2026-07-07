import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../src/ui/router.js', () => ({ navigate: vi.fn() }));
vi.mock('../../src/ui/components/newRoadmapModal.js', () => ({ openNewRoadmapModal: vi.fn() }));
vi.mock('../../src/ui/components/importRoadmapModal.js', () => ({ openImportRoadmapModal: vi.fn() }));

async function setup({
  onboardingDone = false,
  hiddenTemplateIds = [],
  activeTemplateId,
  startedTemplateIds = [],
  customRoadmaps = [],
  switchRoadmap = vi.fn().mockResolvedValue(undefined),
  hideTemplate = vi.fn().mockResolvedValue(undefined),
  unhideTemplate = vi.fn().mockResolvedValue(undefined),
  createCustomRoadmap = vi.fn().mockResolvedValue('croadmap-test'),
  deleteCustomRoadmap = vi.fn().mockResolvedValue(undefined)
} = {}) {
  const { navigate } = await import('../../src/ui/router.js');
  const { renderOnboarding } = await import('../../src/ui/pages/onboarding.js');
  const app = document.createElement('div');
  document.body.appendChild(app);
  const store = {
    getSnapshot: vi.fn(() => ({ onboardingDone, hiddenTemplateIds, activeTemplateId, startedTemplateIds, customRoadmaps })),
    switchRoadmap,
    hideTemplate,
    unhideTemplate,
    createCustomRoadmap,
    deleteCustomRoadmap
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
  it('renders exactly one card per registered template, plus the "Create your own roadmap" and "Import roadmap" cards', async () => {
    const { TEMPLATES } = await import('../../src/data/templates/index.js');
    const { app } = await setup();
    const cards = app.querySelectorAll('.template-card');
    expect(cards.length).toBe(TEMPLATES.length + 2);
    expect(app.querySelectorAll('.template-card-create').length).toBe(1);
    expect(app.querySelectorAll('.template-card-import').length).toBe(1);
  });

  it('has no back/cancel control — nothing to go back to yet', async () => {
    const { app } = await setup();
    const buttons = [...app.querySelectorAll('button')].filter(b => !b.classList.contains('theme-toggle'));
    expect(buttons.every(b => !/\bback\b|\bcancel\b/i.test(b.textContent))).toBe(true);
  });

  it('clicking a card picks that template without confirmation and navigates to /app', async () => {
    const switchRoadmap = vi.fn().mockResolvedValue(undefined);
    const { app, navigate } = await setup({ switchRoadmap });
    const pianoCard = [...app.querySelectorAll('.template-card')].find(b => b.textContent.includes('Learning Piano'));
    pianoCard.click();
    await vi.waitFor(() => expect(switchRoadmap).toHaveBeenCalledWith('piano'));
    await vi.waitFor(() => expect(navigate).toHaveBeenCalledWith('/app', true));
    expect(getConfirmDialog()).toBeNull();
  });

  it('disables every card while a pick is in flight, to prevent a double-submit', async () => {
    let resolvePick;
    const switchRoadmap = vi.fn(() => new Promise(resolve => { resolvePick = resolve; }));
    const { app } = await setup({ switchRoadmap });
    // cards[0]/[1] are "Create your own roadmap"/"Import roadmap" — click the
    // first actual template card instead so switchRoadmap (not
    // createCustomRoadmap) fires.
    const cards = [...app.querySelectorAll('.template-card')];

    cards[2].click();

    expect(cards[0].classList.contains('is-disabled')).toBe(true);
    expect(cards[1].classList.contains('is-disabled')).toBe(true);
    expect(cards[3].classList.contains('is-disabled')).toBe(true);
    resolvePick();
  });

  it('every built-in template card has a hide (×) button — "blank" is retired, no more exceptions', async () => {
    const { app } = await setup();
    const { TEMPLATES } = await import('../../src/data/templates/index.js');
    TEMPLATES.forEach(template => {
      const card = [...app.querySelectorAll('.template-card')].find(c => c.textContent.includes(template.name));
      expect(card.querySelector('.template-card-hide')).not.toBeNull();
    });
  });

  it('"Create your own roadmap" has a corner info button instead of a hide button — no built-in template has one anymore', async () => {
    const { app } = await setup();
    const createCard = app.querySelector('.template-card-create');
    expect(createCard.querySelector('.template-card-info-corner')).not.toBeNull();
    expect(createCard.querySelector('.template-card-hide')).toBeNull();
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

// Manual roadmap creation (issue #4) — the "Create your own roadmap" card,
// and rendering/deleting the user's own custom roadmaps in the same grid.
describe('onboarding page — create-your-own roadmap (issue #4)', () => {
  it('renders the "Create your own roadmap" card first, before any template card', async () => {
    const { app } = await setup();
    const firstCard = app.querySelector('.template-grid .template-card');
    expect(firstCard.classList.contains('template-card-create')).toBe(true);
    expect(firstCard.textContent).toContain('Create your own roadmap');
  });

  it('clicking the create card opens the modal, creates the roadmap on submit, and navigates to /app', async () => {
    const { openNewRoadmapModal } = await import('../../src/ui/components/newRoadmapModal.js');
    openNewRoadmapModal.mockResolvedValue({ title: 'My Roadmap', description: 'Notes' });
    const createCustomRoadmap = vi.fn().mockResolvedValue('croadmap-new');
    const { app, navigate } = await setup({ createCustomRoadmap });

    app.querySelector('.template-card-create').click();

    await vi.waitFor(() => expect(createCustomRoadmap).toHaveBeenCalledWith({ title: 'My Roadmap', description: 'Notes' }));
    await vi.waitFor(() => expect(navigate).toHaveBeenCalledWith('/app', true));
  });

  it('does nothing when the create modal is cancelled', async () => {
    const { openNewRoadmapModal } = await import('../../src/ui/components/newRoadmapModal.js');
    openNewRoadmapModal.mockResolvedValue(null);
    const createCustomRoadmap = vi.fn().mockResolvedValue('croadmap-new');
    const { app, navigate } = await setup({ createCustomRoadmap });

    app.querySelector('.template-card-create').click();

    await vi.waitFor(() => expect(openNewRoadmapModal).toHaveBeenCalled());
    expect(createCustomRoadmap).not.toHaveBeenCalled();
    expect(navigate).not.toHaveBeenCalled();
  });

  it('renders a card per custom roadmap with its title/description and a delete button', async () => {
    const customRoadmaps = [{ id: 'croadmap-1', title: 'Interview prep', description: 'For my new job', createdAt: 1 }];
    const { app } = await setup({ customRoadmaps, activeTemplateId: 'java-backend', onboardingDone: true });

    const card = [...app.querySelectorAll('.template-card')].find(c => c.textContent.includes('Interview prep'));
    expect(card).toBeTruthy();
    expect(card.textContent).toContain('For my new job');
    expect(card.querySelector('[data-action="delete"]')).toBeTruthy();
  });

  it('deleting a custom roadmap asks for confirmation, then calls deleteCustomRoadmap and removes the card', async () => {
    const customRoadmaps = [{ id: 'croadmap-1', title: 'Interview prep', description: '', createdAt: 1 }];
    const deleteCustomRoadmap = vi.fn().mockResolvedValue(undefined);
    const { app } = await setup({ customRoadmaps, deleteCustomRoadmap, activeTemplateId: 'java-backend', onboardingDone: true });

    const card = [...app.querySelectorAll('.template-card')].find(c => c.textContent.includes('Interview prep'));
    card.querySelector('[data-action="delete"]').click();

    expect(getConfirmDialog()).toBeTruthy();
    clickDialogAction('confirm');

    await vi.waitFor(() => expect(deleteCustomRoadmap).toHaveBeenCalledWith('croadmap-1'));
    expect([...app.querySelectorAll('.template-card-name')].some(n => n.textContent === 'Interview prep')).toBe(false);
  });

  it('marks the active custom roadmap "Current" and picking it navigates to /app without re-creating it', async () => {
    const customRoadmaps = [{ id: 'croadmap-1', title: 'Interview prep', description: '', createdAt: 1 }];
    const switchRoadmap = vi.fn().mockResolvedValue(undefined);
    const { app, navigate } = await setup({
      customRoadmaps,
      switchRoadmap,
      onboardingDone: true,
      activeTemplateId: 'croadmap-1',
      startedTemplateIds: ['croadmap-1']
    });

    const card = [...app.querySelectorAll('.template-card')].find(c => c.textContent.includes('Interview prep'));
    expect(card.querySelector('.template-card-current-badge')).toBeTruthy();

    card.click();
    await vi.waitFor(() => expect(navigate).toHaveBeenCalledWith('/app', true));
    expect(switchRoadmap).not.toHaveBeenCalled();
  });
});

// AI-assisted import (issue #4) — the "Import roadmap" card and its wiring
// into store.createCustomRoadmap via openImportRoadmapModal().
describe('onboarding page — AI-assisted import (issue #4)', () => {
  it('renders the "Import roadmap" card second, right after "Create your own roadmap"', async () => {
    const { app } = await setup();
    const cards = [...app.querySelectorAll('.template-grid .template-card')];
    expect(cards[0].classList.contains('template-card-create')).toBe(true);
    expect(cards[1].classList.contains('template-card-import')).toBe(true);
    expect(cards[1].textContent).toContain('Import roadmap');
  });

  it('clicking the import card opens the modal, creates the roadmap from the resolved data, and navigates to /app', async () => {
    const { openImportRoadmapModal } = await import('../../src/ui/components/importRoadmapModal.js');
    const imported = { title: 'Imported Roadmap', phases: [{ id: 'phase-1', title: 'P1', priority: 'P1', sections: [] }], items: {} };
    openImportRoadmapModal.mockResolvedValue(imported);
    const createCustomRoadmap = vi.fn().mockResolvedValue('croadmap-imported');
    const { app, navigate } = await setup({ createCustomRoadmap });

    app.querySelector('.template-card-import').click();

    await vi.waitFor(() => expect(createCustomRoadmap).toHaveBeenCalledWith(imported));
    await vi.waitFor(() => expect(navigate).toHaveBeenCalledWith('/app', true));
  });

  it('does nothing when the import modal is cancelled', async () => {
    const { openImportRoadmapModal } = await import('../../src/ui/components/importRoadmapModal.js');
    openImportRoadmapModal.mockResolvedValue(null);
    const createCustomRoadmap = vi.fn().mockResolvedValue('croadmap-imported');
    const { app, navigate } = await setup({ createCustomRoadmap });

    app.querySelector('.template-card-import').click();

    await vi.waitFor(() => expect(openImportRoadmapModal).toHaveBeenCalled());
    expect(createCustomRoadmap).not.toHaveBeenCalled();
    expect(navigate).not.toHaveBeenCalled();
  });

  it('shows an error toast and re-enables cards when createCustomRoadmap fails for an imported roadmap', async () => {
    const { openImportRoadmapModal } = await import('../../src/ui/components/importRoadmapModal.js');
    openImportRoadmapModal.mockResolvedValue({ title: 'Bad Import', phases: [], items: {} });
    const createCustomRoadmap = vi.fn().mockRejectedValue(new Error('network error'));
    const { app } = await setup({ createCustomRoadmap });

    app.querySelector('.template-card-import').click();
    await vi.waitFor(() => expect(createCustomRoadmap).toHaveBeenCalled());
    await vi.waitFor(() => expect(app.querySelector('.template-card-import').classList.contains('is-disabled')).toBe(false));
    await vi.waitFor(() => expect(document.querySelector('.toast')?.textContent).toMatch(/could not import/i));
  });
});

// "Build your own roadmap" guide moved from the now-retired "blank" template
// onto "Create your own roadmap"'s corner info button (issue #4 follow-up).
describe('onboarding page — "build your own roadmap" guide (issue #4 follow-up)', () => {
  it('clicking the corner info button opens the guide without picking the card', async () => {
    const createCustomRoadmap = vi.fn().mockResolvedValue('croadmap-test');
    const { app } = await setup({ createCustomRoadmap });

    app.querySelector('.template-card-create .template-card-info-corner').click();

    const modal = document.querySelector('.build-guide-card');
    expect(modal).toBeTruthy();
    expect(modal.textContent).toContain('Build your own roadmap');
    expect(modal.textContent).toContain('Import roadmap');
    expect(createCustomRoadmap).not.toHaveBeenCalled();
  });

  it('the guide\'s "Open Import roadmap" button closes the guide and opens the import modal', async () => {
    const { openImportRoadmapModal } = await import('../../src/ui/components/importRoadmapModal.js');
    openImportRoadmapModal.mockResolvedValue(null);
    const { app } = await setup();

    app.querySelector('.template-card-create .template-card-info-corner').click();
    const openImportBtn = [...document.querySelectorAll('.build-guide-card button')].find(b => b.textContent === 'Open Import roadmap');
    openImportBtn.click();

    expect(document.querySelector('.build-guide-card')).toBeNull();
    await vi.waitFor(() => expect(openImportRoadmapModal).toHaveBeenCalled());
  });

  it('"Got it" closes the guide without picking anything', async () => {
    const { app } = await setup();
    app.querySelector('.template-card-create .template-card-info-corner').click();
    const gotItBtn = [...document.querySelectorAll('.build-guide-card button')].find(b => b.textContent === 'Got it');
    gotItBtn.click();
    expect(document.querySelector('.build-guide-card')).toBeNull();
  });
});
