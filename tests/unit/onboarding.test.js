import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../src/ui/router.js', () => ({ navigate: vi.fn() }));
vi.mock('../../src/ui/components/importRoadmapModal.js', () => ({ openCreateRoadmapModal: vi.fn() }));
// onboarding.js now imports confirmAndSignOut (src/ui/utils/signOut.js) for
// its new sign-out button, which transitively imports the real firebase.js —
// mock it the same way dashboard.test.js/signIn.test.js already do.
vi.mock('../../src/services/firebase.js', () => ({
  authApi: { signOut: vi.fn().mockResolvedValue(undefined) }
}));

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

describe('onboarding page — sign-out button', () => {
  it('renders a sign-out button, absent before this fix', async () => {
    const { app } = await setup();
    const signOutBtn = app.querySelector('[aria-label="Sign out"]');
    expect(signOutBtn).not.toBeNull();
  });

  it('clicking sign-out asks for confirmation before actually signing out', async () => {
    const { app } = await setup();
    const { authApi } = await import('../../src/services/firebase.js');
    app.querySelector('[aria-label="Sign out"]').click();
    expect(getConfirmDialog()).not.toBeNull();
    expect(authApi.signOut).not.toHaveBeenCalled();

    clickDialogAction('confirm');
    await vi.waitFor(() => expect(authApi.signOut).toHaveBeenCalled());
  });
});

describe('onboarding page — first-time picker (onboardingDone === false)', () => {
  it('renders exactly one card per registered template, plus the single "Create your own roadmap" card', async () => {
    const { TEMPLATES } = await import('../../src/data/templates/index.js');
    const { app } = await setup();
    const cards = app.querySelectorAll('.template-card');
    expect(cards.length).toBe(TEMPLATES.length + 1);
    expect(app.querySelectorAll('.template-card-create').length).toBe(1);
  });

  it('has no back/cancel control — nothing to go back to yet', async () => {
    const { app } = await setup();
    const buttons = [...app.querySelectorAll('button')].filter(b => !b.classList.contains('theme-toggle'));
    // "back" is also legitimately used mid-sentence in the create card's own
    // description ("...paste the result back in.") — the check for a
    // navigational back/cancel control looks for that word standing alone at
    // the start of the button's own text, not anywhere in a longer sentence.
    expect(buttons.every(b => !/^(back|cancel)\b/i.test(b.textContent.trim()))).toBe(true);
  });

  it('clicking a card picks that template without confirmation and navigates to /app', async () => {
    const switchRoadmap = vi.fn().mockResolvedValue(undefined);
    const { app, navigate } = await setup({ switchRoadmap });
    const pianoCard = [...app.querySelectorAll('.template-card')].find(b => b.textContent.includes('Learning Piano'));
    pianoCard.querySelector('.template-card-pick').click();
    await vi.waitFor(() => expect(switchRoadmap).toHaveBeenCalledWith('piano'));
    await vi.waitFor(() => expect(navigate).toHaveBeenCalledWith('/app', true));
    expect(getConfirmDialog()).toBeNull();
  });

  // issue #6 Phase 5 follow-up — a user reported picking a roadmap
  // "hanging" with no feedback. Traced to (1) unprotected Firebase calls
  // that could hang forever (fixed with withTimeout.js/FirebaseAdapter.js,
  // outside this component's scope) and (2) this catch block silently
  // resetting the UI with zero user-facing message on a genuine failure —
  // indistinguishable from success without noticing the cards quietly
  // re-enabling. Matches the existing "shows an error toast ... for a
  // created roadmap" test's pattern below for the create-your-own path.
  it('shows an error toast and re-enables cards when switchRoadmap fails', async () => {
    const switchRoadmap = vi.fn().mockRejectedValue(new Error('Timed out loading roadmap from Firebase'));
    const { app, navigate } = await setup({ switchRoadmap });
    const pianoCard = [...app.querySelectorAll('.template-card')].find(b => b.textContent.includes('Learning Piano'));

    pianoCard.querySelector('.template-card-pick').click();

    await vi.waitFor(() => expect(switchRoadmap).toHaveBeenCalledWith('piano'));
    await vi.waitFor(() => expect(pianoCard.classList.contains('picking')).toBe(false));
    await vi.waitFor(() => expect(document.querySelector('.toast')?.textContent).toMatch(/could not open/i));
    expect(navigate).not.toHaveBeenCalledWith('/app', true);
  });

  it('disables every card while a pick is in flight, to prevent a double-submit', async () => {
    let resolvePick;
    const switchRoadmap = vi.fn(() => new Promise(resolve => { resolvePick = resolve; }));
    const { app } = await setup({ switchRoadmap });
    // cards[0] is "Create your own roadmap" — click the first actual
    // template card instead so switchRoadmap (not createCustomRoadmap) fires.
    const cards = [...app.querySelectorAll('.template-card')];

    cards[1].querySelector('.template-card-pick').click();

    expect(cards[0].classList.contains('is-disabled')).toBe(true);
    expect(cards[2].classList.contains('is-disabled')).toBe(true);
    resolvePick();
  });

  // Real, reported bug: picking a roadmap awaits a Firebase round-trip
  // (store.switchRoadmap()) before navigating, and the only feedback used to
  // be the clicked card's faint opacity dim (.picking) — indistinguishable
  // from unresponsive lag on anything slower than an instant local network.
  // buildPickingOverlay() (onboarding.js) covers the clicked card with a
  // spinner + "Opening…" for the duration of the wait.
  it('shows a spinner + "Opening…" overlay on the clicked card while a pick is in flight, then navigates away once it resolves', async () => {
    let resolvePick;
    const switchRoadmap = vi.fn(() => new Promise(resolve => { resolvePick = resolve; }));
    const { app, navigate } = await setup({ switchRoadmap });
    const pianoCard = [...app.querySelectorAll('.template-card')].find(c => c.textContent.includes('Learning Piano'));

    pianoCard.querySelector('.template-card-pick').click();

    const overlay = pianoCard.querySelector('.template-card-picking-overlay');
    expect(overlay).not.toBeNull();
    expect(overlay.textContent).toMatch(/opening/i);
    expect(pianoCard.classList.contains('picking')).toBe(true);

    // On success the page navigates away (no DOM left to clean up in the
    // real app) rather than clearing `.picking` — the overlay is only ever
    // explicitly removed on the failure path (see the "shows an error toast
    // and re-enables cards" test above).
    resolvePick();
    await vi.waitFor(() => expect(navigate).toHaveBeenCalledWith('/app', true));
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
    dataScienceCard.querySelector('.template-card-pick').click();

    expect(getConfirmDialog()).toBeNull();
    await vi.waitFor(() => expect(switchRoadmap).toHaveBeenCalledWith('data-science'));
    await vi.waitFor(() => expect(navigate).toHaveBeenCalledWith('/app', true));
  });

  it('marks the active template as "Current" and re-picking it returns to the dashboard without re-seeding or asking for confirmation', async () => {
    const switchRoadmap = vi.fn().mockResolvedValue(undefined);
    const { app, navigate } = await setup({ onboardingDone: true, activeTemplateId: 'java-backend', switchRoadmap });

    const javaCard = [...app.querySelectorAll('.template-card')].find(c => c.textContent.includes('Java Backend Engineer'));
    expect(javaCard.querySelector('.template-card-current-badge')?.textContent).toBe('Current');

    javaCard.querySelector('.template-card-pick').click();

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

// AI-assisted "Create your own roadmap" (issue #100 — supersedes the
// separate manual-create/import cards issue #4/#64 shipped) — one card,
// opening openCreateRoadmapModal(), and rendering/deleting the user's own
// custom roadmaps in the same grid.
describe('onboarding page — create-your-own roadmap (issue #100)', () => {
  it('renders the "Create your own roadmap" card first, before any template card', async () => {
    const { app } = await setup();
    const firstCard = app.querySelector('.template-grid .template-card');
    expect(firstCard.classList.contains('template-card-create')).toBe(true);
    expect(firstCard.textContent).toContain('Create your own roadmap');
  });

  it('clicking the create card opens the modal, creates the roadmap from the resolved data, and navigates to /app', async () => {
    const { openCreateRoadmapModal } = await import('../../src/ui/components/importRoadmapModal.js');
    const created = { title: 'My Roadmap', phases: [{ id: 'phase-1', title: 'P1', priority: 'P1', sections: [] }], items: {} };
    openCreateRoadmapModal.mockResolvedValue(created);
    const createCustomRoadmap = vi.fn().mockResolvedValue('croadmap-new');
    const { app, navigate } = await setup({ createCustomRoadmap });

    app.querySelector('.template-card-create .template-card-pick').click();

    await vi.waitFor(() => expect(createCustomRoadmap).toHaveBeenCalledWith(created));
    await vi.waitFor(() => expect(navigate).toHaveBeenCalledWith('/app', true));
  });

  it('does nothing when the create modal is cancelled', async () => {
    const { openCreateRoadmapModal } = await import('../../src/ui/components/importRoadmapModal.js');
    openCreateRoadmapModal.mockResolvedValue(null);
    const createCustomRoadmap = vi.fn().mockResolvedValue('croadmap-new');
    const { app, navigate } = await setup({ createCustomRoadmap });

    app.querySelector('.template-card-create .template-card-pick').click();

    await vi.waitFor(() => expect(openCreateRoadmapModal).toHaveBeenCalled());
    expect(createCustomRoadmap).not.toHaveBeenCalled();
    expect(navigate).not.toHaveBeenCalled();
  });

  it('shows an error toast and re-enables the card when createCustomRoadmap fails', async () => {
    const { openCreateRoadmapModal } = await import('../../src/ui/components/importRoadmapModal.js');
    openCreateRoadmapModal.mockResolvedValue({ title: 'Bad roadmap', phases: [], items: {} });
    const createCustomRoadmap = vi.fn().mockRejectedValue(new Error('network error'));
    const { app } = await setup({ createCustomRoadmap });

    app.querySelector('.template-card-create .template-card-pick').click();
    await vi.waitFor(() => expect(createCustomRoadmap).toHaveBeenCalled());
    await vi.waitFor(() => expect(app.querySelector('.template-card-create').classList.contains('is-disabled')).toBe(false));
    await vi.waitFor(() => expect(document.querySelector('.toast')?.textContent).toMatch(/could not create/i));
    expect(app.querySelector('.template-card-create').classList.contains('picking')).toBe(false);
  });

  // Regression: store.createCustomRoadmap() still has real Firebase work
  // left to do after the import modal itself already closed (see
  // roadmapStore.js's switchRoadmap) — the create card's dim-and-disable
  // alone read as unresponsive lag, the same bug the picking overlay below
  // already fixed for switching roadmaps (see the describe block above).
  it('shows the picking overlay ("Importing…") on the create card while createCustomRoadmap is in flight', async () => {
    const { openCreateRoadmapModal } = await import('../../src/ui/components/importRoadmapModal.js');
    openCreateRoadmapModal.mockResolvedValue({ title: 'My Roadmap', phases: [], items: {} });
    let resolveCreate;
    const createCustomRoadmap = vi.fn(() => new Promise(resolve => { resolveCreate = resolve; }));
    const { app, navigate } = await setup({ createCustomRoadmap });

    const createCard = app.querySelector('.template-card-create');
    createCard.querySelector('.template-card-pick').click();

    await vi.waitFor(() => expect(createCustomRoadmap).toHaveBeenCalled());
    expect(createCard.classList.contains('picking')).toBe(true);
    expect(createCard.querySelector('.template-card-picking-overlay').textContent).toMatch(/importing/i);

    resolveCreate('croadmap-new');
    await vi.waitFor(() => expect(navigate).toHaveBeenCalledWith('/app', true));
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

    card.querySelector('.template-card-pick').click();
    await vi.waitFor(() => expect(navigate).toHaveBeenCalledWith('/app', true));
    expect(switchRoadmap).not.toHaveBeenCalled();
  });
});

// "Build your own roadmap" guide moved from the now-retired "blank" template
// onto "Create your own roadmap"'s corner info button (issue #4 follow-up);
// rewritten in issue #100 to present the AI-generate flow as the only
// starting method, with manual editing framed as a fine-tune step after.
describe('onboarding page — "build your own roadmap" guide (issue #100)', () => {
  it('clicking the corner info button opens the guide without picking the card', async () => {
    const createCustomRoadmap = vi.fn().mockResolvedValue('croadmap-test');
    const { app } = await setup({ createCustomRoadmap });

    app.querySelector('.template-card-create .template-card-info-corner').click();

    const modal = document.querySelector('.build-guide-card');
    expect(modal).toBeTruthy();
    expect(modal.textContent).toContain('Build your own roadmap');
    expect(modal.textContent).toContain('AI assistant');
    expect(createCustomRoadmap).not.toHaveBeenCalled();
  });

  it('the guide\'s "Open the roadmap builder" button closes the guide and opens the create modal', async () => {
    const { openCreateRoadmapModal } = await import('../../src/ui/components/importRoadmapModal.js');
    openCreateRoadmapModal.mockResolvedValue(null);
    const { app } = await setup();

    app.querySelector('.template-card-create .template-card-info-corner').click();
    const openBuilderBtn = [...document.querySelectorAll('.build-guide-card button')].find(b => b.textContent === 'Open the roadmap builder');
    openBuilderBtn.click();

    expect(document.querySelector('.build-guide-card')).toBeNull();
    await vi.waitFor(() => expect(openCreateRoadmapModal).toHaveBeenCalled());
  });

  it('"Got it" closes the guide without picking anything', async () => {
    const { app } = await setup();
    app.querySelector('.template-card-create .template-card-info-corner').click();
    const gotItBtn = [...document.querySelectorAll('.build-guide-card button')].find(b => b.textContent === 'Got it');
    gotItBtn.click();
    expect(document.querySelector('.build-guide-card')).toBeNull();
  });
});
