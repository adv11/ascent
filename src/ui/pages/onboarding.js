import { el } from '../dom.js';
import { navigate } from '../router.js';
import { createThemeToggle } from '../components/themeToggle.js';
import { createBrandMark } from '../components/brand.js';
import { openBuildYourOwnGuide } from '../components/buildYourOwnGuide.js';
import { TEMPLATES } from '../../data/templates/index.js';

// Shown once, right after a brand-new sign-up (Issue #51). A user who has already
// picked a template can also reach this page later via the dashboard's "Switch
// template" link to start over with a different one — picking a card in that case
// replaces the current roadmap, so it's gated behind a confirm(). Every template
// except "blank" can also be hidden from the picker — a per-user preference (see
// roadmapStore.hideTemplate) that never affects other users or the template itself.
export function renderOnboarding(app, { user, store }) {
  if (!user) {
    navigate('/signin', true);
    return;
  }

  const isSwitchingTemplate = store.getSnapshot().onboardingDone;
  let hiddenTemplateIds = [...store.getSnapshot().hiddenTemplateIds];

  let picking = false;
  const cardEls = [];

  function setBusy(busy) {
    cardEls.forEach(card => {
      card.classList.toggle('is-disabled', busy);
      card.setAttribute('aria-disabled', String(busy));
      card.querySelectorAll('button').forEach(btn => { btn.disabled = busy; });
    });
  }

  async function pickTemplate(template, cardEl) {
    if (picking) return;
    if (isSwitchingTemplate && !confirm(
      `Switch to "${template.name}"? This replaces your current roadmap and progress — this cannot be undone.`
    )) return;

    picking = true;
    setBusy(true);
    cardEl.classList.add('picking');
    try {
      await store.initFromTemplate(template.id);
      navigate('/app', true);
    } catch (error) {
      console.error('Failed to start from template', error);
      picking = false;
      setBusy(false);
      cardEl.classList.remove('picking');
    }
  }

  const visibleGrid = el('div', { className: 'template-grid', role: 'list' });
  const hiddenSection = el('div', { className: 'hidden-templates-section' });

  function buildCard(template) {
    const isBlank = template.id === 'blank';
    const countEl = el('span', { className: 'template-card-count', text: 'Loading topics…' });

    const cardEl = el('div', {
      className: 'template-card',
      role: 'button',
      tabindex: '0',
      onClick: () => pickTemplate(template, cardEl),
      onKeydown: e => {
        if (e.target !== cardEl) return; // let the nested hide/info button handle its own keys
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          pickTemplate(template, cardEl);
        }
      }
    }, [
      el('span', { className: 'template-card-icon', 'aria-hidden': 'true', text: template.icon }),
      el('span', { className: 'template-card-name', text: template.name }),
      el('span', { className: 'template-card-desc', text: template.description }),
      countEl,
      isBlank
        ? el('button', {
          type: 'button',
          className: 'template-card-info',
          'data-action': 'info',
          'aria-label': 'How do I build my own roadmap?',
          text: 'ℹ How do I build my own?',
          onClick: e => { e.stopPropagation(); openBuildYourOwnGuide(); }
        })
        : el('button', {
          type: 'button',
          className: 'template-card-hide',
          'data-action': 'hide',
          'aria-label': `Hide ${template.name}`,
          title: `Hide ${template.name}`,
          text: '×',
          onClick: e => {
            e.stopPropagation();
            hideTemplate(template, cardEl);
          }
        })
    ]);

    cardEls.push(cardEl);

    template.buildItems().then(items => {
      const count = Object.keys(items).length;
      countEl.textContent = count ? `${count} topics` : 'Starts empty';
    }).catch(() => {
      countEl.textContent = '';
    });

    return el('div', { role: 'listitem' }, [cardEl]);
  }

  async function hideTemplate(template, cardEl) {
    if (!confirm(`Hide "${template.name}"? You can restore it anytime from "Show hidden templates" below.`)) return;
    await store.hideTemplate(template.id);
    hiddenTemplateIds = [...hiddenTemplateIds, template.id];
    const index = cardEls.indexOf(cardEl);
    if (index !== -1) cardEls.splice(index, 1);
    cardEl.closest('[role="listitem"]')?.remove();
    renderHiddenToggle();
  }

  function buildRestoreCard(template) {
    const cardEl = el('div', { className: 'template-card template-card-hidden' }, [
      el('span', { className: 'template-card-icon', 'aria-hidden': 'true', text: template.icon }),
      el('span', { className: 'template-card-name', text: template.name }),
      el('span', { className: 'template-card-desc', text: template.description }),
      el('button', {
        type: 'button',
        className: 'btn btn-secondary btn-sm',
        text: 'Restore',
        onClick: async () => {
          await store.unhideTemplate(template.id);
          hiddenTemplateIds = hiddenTemplateIds.filter(id => id !== template.id);
          visibleGrid.appendChild(buildCard(template));
          renderHiddenToggle();
        }
      })
    ]);
    return el('div', { role: 'listitem' }, [cardEl]);
  }

  function renderHiddenToggle() {
    const hiddenTemplates = TEMPLATES.filter(t => hiddenTemplateIds.includes(t.id));
    if (!hiddenTemplates.length) {
      hiddenSection.replaceChildren();
      return;
    }
    const toggleBtn = el('button', {
      type: 'button',
      className: 'btn btn-ghost btn-sm hidden-templates-toggle',
      text: `${hiddenTemplates.length} template${hiddenTemplates.length > 1 ? 's' : ''} hidden — Show`,
      onClick: () => {
        hiddenSection.replaceChildren(
          el('div', { className: 'template-grid hidden-grid', role: 'list' }, hiddenTemplates.map(buildRestoreCard))
        );
      }
    });
    hiddenSection.replaceChildren(toggleBtn);
  }

  TEMPLATES
    .filter(t => t.id === 'blank' || !hiddenTemplateIds.includes(t.id))
    .forEach(template => visibleGrid.appendChild(buildCard(template)));
  renderHiddenToggle();

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
      visibleGrid,
      hiddenSection
    ].filter(Boolean))
  ]);

  app.replaceChildren(node);
  cardEls[0]?.focus();

  return () => {
    themeToggleBtn._cleanup?.();
  };
}
