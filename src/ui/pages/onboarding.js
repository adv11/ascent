import { el } from '../dom.js';
import { navigate } from '../router.js';
import { createThemeToggle } from '../components/themeToggle.js';
import { createBrandMark } from '../components/brand.js';
import { TEMPLATES } from '../../data/templates/index.js';

// Shown once, right after a brand-new sign-up (Issue #51). A user who has already
// picked a template can also reach this page later via the dashboard's "Switch
// template" link to start over with a different one — picking a card in that case
// replaces the current roadmap, so it's gated behind a confirm().
export function renderOnboarding(app, { user, store }) {
  if (!user) {
    navigate('/signin', true);
    return;
  }

  const isSwitchingTemplate = store.getSnapshot().onboardingDone;

  let picking = false;
  const cardButtons = [];

  function setBusy(busy) {
    cardButtons.forEach(btn => { btn.disabled = busy; });
  }

  async function pickTemplate(template, button) {
    if (picking) return;
    if (isSwitchingTemplate && !confirm(
      `Switch to "${template.name}"? This replaces your current roadmap and progress — this cannot be undone.`
    )) return;

    picking = true;
    setBusy(true);
    button.classList.add('picking');
    try {
      await store.initFromTemplate(template.id);
      navigate('/app', true);
    } catch (error) {
      console.error('Failed to start from template', error);
      picking = false;
      setBusy(false);
      button.classList.remove('picking');
    }
  }

  const cards = TEMPLATES.map(template => {
    const countEl = el('span', { className: 'template-card-count', text: 'Loading topics…' });
    const button = el('button', {
      type: 'button',
      className: 'template-card',
      onClick: e => pickTemplate(template, e.currentTarget)
    }, [
      el('span', { className: 'template-card-icon', 'aria-hidden': 'true', text: template.icon }),
      el('span', { className: 'template-card-name', text: template.name }),
      el('span', { className: 'template-card-desc', text: template.description }),
      countEl
    ]);
    cardButtons.push(button);

    template.buildItems().then(items => {
      const count = Object.keys(items).length;
      countEl.textContent = count ? `${count} topics` : 'Starts empty';
    }).catch(() => {
      countEl.textContent = '';
    });

    return el('div', { role: 'listitem' }, [button]);
  });

  const themeToggleBtn = createThemeToggle();
  const backBtn = isSwitchingTemplate
    ? el('button', {
      type: 'button',
      className: 'btn btn-ghost btn-sm onboarding-back',
      text: '← Back to my roadmap',
      onClick: () => navigate('/app', true)
    })
    : null;

  const node = el('div', { className: 'onboarding-page fade-in' }, [
    el('div', { className: 'auth-page-bg' }),
    el('div', { className: 'onboarding-inner' }, [
      el('div', { className: 'auth-top-row' }, [
        el('div', { className: 'brand' }, createBrandMark()),
        themeToggleBtn
      ]),
      backBtn,
      el('header', { className: 'onboarding-head' }, [
        el('h1', { className: 'auth-title', text: isSwitchingTemplate ? 'Switch your starter roadmap' : 'Pick a starting roadmap' }),
        el('p', {
          className: 'auth-subtitle',
          text: isSwitchingTemplate
            ? 'Picking a template below replaces your current roadmap and progress.'
            : 'Choose a template to get started. You can add, edit, or remove topics anytime after.'
        })
      ]),
      el('div', { className: 'template-grid', role: 'list' }, cards)
    ].filter(Boolean))
  ]);

  app.replaceChildren(node);
  cardButtons[0]?.focus();

  return () => {
    themeToggleBtn._cleanup?.();
  };
}
