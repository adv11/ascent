import { el } from '../dom.js';
import { navigate } from '../router.js';
import { createThemeToggle } from '../components/themeToggle.js';
import { createBrandMark } from '../components/brand.js';
import { TEMPLATES } from '../../data/templates/index.js';

// Shown exactly once, right after a brand-new sign-up (Issue #51) — there is no
// back button by design, since picking a template is a one-way gate into /app.
export function renderOnboarding(app, { user, store }) {
  if (!user) {
    navigate('/signin', true);
    return;
  }
  if (store.getSnapshot().onboardingDone) {
    navigate('/app', true);
    return;
  }

  let picking = false;
  const cardButtons = [];

  function setBusy(busy) {
    cardButtons.forEach(btn => { btn.disabled = busy; });
  }

  async function pickTemplate(template, button) {
    if (picking) return;
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

  const node = el('div', { className: 'onboarding-page fade-in' }, [
    el('div', { className: 'auth-page-bg' }),
    el('div', { className: 'onboarding-inner' }, [
      el('div', { className: 'auth-top-row' }, [
        el('div', { className: 'brand' }, createBrandMark()),
        themeToggleBtn
      ]),
      el('header', { className: 'onboarding-head' }, [
        el('h1', { className: 'auth-title', text: 'Pick a starting roadmap' }),
        el('p', { className: 'auth-subtitle', text: 'Choose a template to get started. You can add, edit, or remove topics anytime after.' })
      ]),
      el('div', { className: 'template-grid', role: 'list' }, cards)
    ])
  ]);

  app.replaceChildren(node);
  cardButtons[0]?.focus();

  return () => {
    themeToggleBtn._cleanup?.();
  };
}
