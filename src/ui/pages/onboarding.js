import { el } from '../dom.js';
import { navigate } from '../router.js';
import { createThemeToggle } from '../components/themeToggle.js';
import { createBrandMark } from '../components/brand.js';
import { openBuildYourOwnGuide } from '../components/buildYourOwnGuide.js';
import { openNewRoadmapModal } from '../components/newRoadmapModal.js';
import { confirmDialog } from '../components/confirmDialog.js';
import { showToast } from '../components/toast.js';
import { TEMPLATES } from '../../data/templates/index.js';

// Shown once, right after a brand-new sign-up (Issue #51). A user who has already
// picked a template can also reach this page later via the dashboard's "Switch
// template" link to start (or switch back to) a different one — since issue #58,
// every template a user starts keeps its own persisted progress, so picking any
// card here is always non-destructive: an already-started template loads its own
// saved progress instantly, and a not-yet-started one seeds fresh without touching
// any other template's data. Every template except "blank" can also be hidden from
// the picker — a per-user preference (see roadmapStore.hideTemplate) that never
// affects other users, the template itself, or an already-started roadmap's data.
export function renderOnboarding(app, { user, store }) {
  if (!user) {
    navigate('/signin', true);
    return;
  }

  const snapshot = store.getSnapshot();
  const isSwitchingTemplate = snapshot.onboardingDone;
  // Lets the picker mark the active template (see buildCard) and treat re-picking
  // it as a harmless "go back" instead of re-navigating through switchRoadmap.
  const activeTemplateId = snapshot.activeTemplateId;
  const startedTemplateIds = [...snapshot.startedTemplateIds];
  let hiddenTemplateIds = [...snapshot.hiddenTemplateIds];
  const customRoadmaps = [...snapshot.customRoadmaps];

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
    // Only treat "same id as activeTemplateId" as a no-op once onboarding is
    // actually done — activeTemplateId still holds the store's pre-setUser()
    // placeholder default ('java-backend') for a brand-new sign-in whose
    // setUser() call hasn't resolved by the time this page first rendered, so
    // comparing against it during first-time onboarding produced a false
    // "already on this roadmap" no-op that left onboardingDone stuck false —
    // navigate('/app') would just bounce straight back here.
    if (isSwitchingTemplate && template.id === activeTemplateId) {
      showToast("You're already on this roadmap.", 'info');
      navigate('/app', true);
      return;
    }

    picking = true;
    setBusy(true);
    cardEl.classList.add('picking');
    try {
      await store.switchRoadmap(template.id);
      navigate('/app', true);
    } catch (error) {
      console.error('Failed to switch roadmap', error);
      picking = false;
      setBusy(false);
      cardEl.classList.remove('picking');
    }
  }

  const visibleGrid = el('div', { className: 'template-grid', role: 'list' });
  const hiddenSection = el('div', { className: 'hidden-templates-section' });

  // "Create your own roadmap" (issue #4) — always the first card, since it's
  // an action rather than a roadmap to pick. Opens newRoadmapModal, then
  // activates the freshly created (empty) roadmap through the same
  // switchRoadmap() path a built-in template pick uses.
  async function handleCreate() {
    if (picking) return;
    const result = await openNewRoadmapModal();
    if (!result) return;
    picking = true;
    setBusy(true);
    try {
      await store.createCustomRoadmap(result);
      navigate('/app', true);
    } catch (error) {
      console.error('Failed to create custom roadmap', error);
      picking = false;
      setBusy(false);
      showToast('Could not create your roadmap. Try again.', 'error');
    }
  }

  function buildCreateCard() {
    const cardEl = el('div', {
      className: 'template-card template-card-create',
      role: 'button',
      tabindex: '0',
      onClick: handleCreate,
      onKeydown: e => {
        if (e.target !== cardEl) return;
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          handleCreate();
        }
      }
    }, [
      el('span', { className: 'template-card-icon', 'aria-hidden': 'true', text: '+' }),
      el('span', { className: 'template-card-name', text: 'Create your own roadmap' }),
      el('span', { className: 'template-card-desc', text: 'Start from scratch — add your own phases, sections, and topics.' })
    ]);
    cardEls.push(cardEl);
    return el('div', { role: 'listitem' }, [cardEl]);
  }

  async function pickCustomRoadmap(roadmap, cardEl) {
    if (picking) return;
    if (isSwitchingTemplate && roadmap.id === activeTemplateId) {
      showToast("You're already on this roadmap.", 'info');
      navigate('/app', true);
      return;
    }
    picking = true;
    setBusy(true);
    cardEl.classList.add('picking');
    try {
      await store.switchRoadmap(roadmap.id);
      navigate('/app', true);
    } catch (error) {
      console.error('Failed to switch roadmap', error);
      picking = false;
      setBusy(false);
      cardEl.classList.remove('picking');
    }
  }

  async function deleteCustomCard(roadmap, cardEl) {
    if (!await confirmDialog({
      title: `Delete "${roadmap.title}"?`,
      message: 'This permanently deletes this roadmap and all its progress. This cannot be undone.',
      confirmText: 'Delete',
      danger: true
    })) return;
    await store.deleteCustomRoadmap(roadmap.id);
    const index = cardEls.indexOf(cardEl);
    if (index !== -1) cardEls.splice(index, 1);
    cardEl.closest('[role="listitem"]')?.remove();
    showToast(`Deleted "${roadmap.title}"`, 'success');
  }

  function buildCustomCard(roadmap) {
    const isCurrent = roadmap.id === activeTemplateId;
    const isStarted = startedTemplateIds.includes(roadmap.id);
    const badgeEl = isCurrent
      ? el('span', { className: 'template-card-current-badge', text: 'Current' })
      : isStarted
        ? el('span', { className: 'template-card-started-badge', text: 'In progress' })
        : null;
    const footerEl = el('div', { className: 'template-card-footer' }, [badgeEl].filter(Boolean));

    const cardEl = el('div', {
      className: `template-card${isCurrent ? ' template-card-current' : ''}${isStarted && !isCurrent ? ' template-card-started' : ''}`,
      role: 'button',
      tabindex: '0',
      'aria-current': isCurrent ? 'true' : null,
      onClick: () => pickCustomRoadmap(roadmap, cardEl),
      onKeydown: e => {
        if (e.target !== cardEl) return;
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          pickCustomRoadmap(roadmap, cardEl);
        }
      }
    }, [
      el('span', { className: 'template-card-icon', 'aria-hidden': 'true', text: '✎' }),
      el('span', { className: 'template-card-name', text: roadmap.title }),
      el('span', { className: 'template-card-desc', text: roadmap.description || 'Your own roadmap.' }),
      footerEl,
      el('button', {
        type: 'button',
        className: 'template-card-hide',
        'data-action': 'delete',
        'aria-label': `Delete ${roadmap.title}`,
        title: `Delete ${roadmap.title}`,
        text: '×',
        onClick: e => {
          e.stopPropagation();
          deleteCustomCard(roadmap, cardEl);
        }
      })
    ]);

    cardEls.push(cardEl);
    return el('div', { role: 'listitem' }, [cardEl]);
  }

  function buildCard(template) {
    const isBlank = template.id === 'blank';
    const isCurrent = template.id === activeTemplateId;
    const isStarted = startedTemplateIds.includes(template.id);
    const countEl = el('span', { className: 'template-card-count', text: 'Loading topics…' });
    const badgeEl = isCurrent
      ? el('span', { className: 'template-card-current-badge', text: 'Current' })
      : isStarted
        ? el('span', { className: 'template-card-started-badge', text: 'In progress' })
        : null;
    const footerEl = el('div', { className: 'template-card-footer' }, [countEl, badgeEl]);

    const cardEl = el('div', {
      className: `template-card${isCurrent ? ' template-card-current' : ''}${isStarted && !isCurrent ? ' template-card-started' : ''}`,
      role: 'button',
      tabindex: '0',
      'aria-current': isCurrent ? 'true' : null,
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
      footerEl,
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
    if (!await confirmDialog({
      title: `Hide "${template.name}"?`,
      message: 'You can restore it anytime from "Show hidden templates" below.',
      confirmText: 'Hide'
    })) return;
    await store.hideTemplate(template.id);
    hiddenTemplateIds = [...hiddenTemplateIds, template.id];
    // A started template stays visible (badged "In progress") even once hidden —
    // hiding only ever filters the "start something new" grid.
    if (!startedTemplateIds.includes(template.id)) {
      const index = cardEls.indexOf(cardEl);
      if (index !== -1) cardEls.splice(index, 1);
      cardEl.closest('[role="listitem"]')?.remove();
    }
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
    // A started+hidden template is already visible in the main grid — only
    // list not-yet-started hidden templates here.
    const hiddenTemplates = TEMPLATES.filter(t => hiddenTemplateIds.includes(t.id) && !startedTemplateIds.includes(t.id));
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

  visibleGrid.appendChild(buildCreateCard());
  customRoadmaps.forEach(roadmap => visibleGrid.appendChild(buildCustomCard(roadmap)));
  TEMPLATES
    .filter(t => t.id === 'blank' || !hiddenTemplateIds.includes(t.id) || startedTemplateIds.includes(t.id))
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
        el('a', { className: 'brand', href: '#/onboarding', 'aria-label': 'Ascent — all roadmaps' }, createBrandMark()),
        themeToggleBtn
      ]),
      backBtn,
      el('header', { className: 'onboarding-head' }, [
        el('h1', { className: 'auth-title', text: isSwitchingTemplate ? 'Switch your starter roadmap' : 'Pick a starting roadmap' }),
        el('p', {
          className: 'auth-subtitle',
          text: isSwitchingTemplate
            ? "Switch between your roadmaps anytime — each one keeps its own progress, and starting or switching never overwrites another."
            : 'Choose a template to get started. You can add, edit, or remove topics anytime after, and start more templates later without losing progress.'
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
