import { el } from '../dom.js';
import { navigate } from '../router.js';
import { createThemeToggle } from '../components/themeToggle.js';
import { createBrandMark } from '../components/brand.js';
import { openBuildYourOwnGuide } from '../components/buildYourOwnGuide.js';
import { openCreateRoadmapModal } from '../components/importRoadmapModal.js';
import { createDailyTodoPanel } from '../components/dailyTodoPanel.js';
import { confirmDialog } from '../components/confirmDialog.js';
import { confirmAndSignOut } from '../utils/signOut.js';
import { showToast } from '../components/toast.js';
import { TEMPLATES } from '../../data/templates/index.js';
import { pickCustomRoadmapIcon } from '../utils/customRoadmapIcon.js';
import { createIcon } from '../components/icons.js';

// Picking a roadmap (built-in template or custom) awaits a real
// `store.switchRoadmap()` — a Firebase round-trip for anything not already
// cached this session — before navigating to `/app`. A real, reported bug:
// the only feedback used to be `.template-card.picking`'s faint opacity dim,
// which read as unresponsive lag rather than "loading" on anything slower
// than an instant local network. This overlay (spinner + "Opening…", shown
// via `.template-card.picking .template-card-picking-overlay` in app.css)
// gives immediate, unambiguous feedback the instant the card is clicked, for
// however long the round-trip actually takes. Shared by buildCard() and
// buildCustomCard() — both set the same `.picking` class on click.
function buildPickingOverlay() {
  return el('div', { className: 'template-card-picking-overlay' }, [
    el('span', { className: 'btn-spinner' }),
    ' Opening…'
  ]);
}

// Shown once, right after a brand-new sign-up (Issue #51). A user who has already
// picked a template can also reach this page later via the dashboard's "Switch
// template" link to start (or switch back to) a different one — since issue #58,
// every template a user starts keeps its own persisted progress, so picking any
// card here is always non-destructive: an already-started template loads its own
// saved progress instantly, and a not-yet-started one seeds fresh without touching
// any other template's data. Every built-in template can also be hidden from
// the picker — a per-user preference (see roadmapStore.hideTemplate) that never
// affects other users, the template itself, or an already-started roadmap's data.
export function renderOnboarding(app, { user, store, dailyTodoStore }) {
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
      showToast('Could not open that roadmap. Check your connection and try again.', 'error');
    }
  }

  const visibleGrid = el('div', { className: 'template-grid', role: 'list' });
  const hiddenSection = el('div', { className: 'hidden-templates-section' });

  // "Create your own roadmap" (issue #100 — supersedes the separate manual
  // "Create"/"Import" cards issues #4/#64 shipped) — always the first card,
  // since it's an action rather than a roadmap to pick. Opens the two-column
  // AI-creation modal; openCreateRoadmapModal() resolves already-validated,
  // already-adapted { title, phases, items }, handed straight to
  // createCustomRoadmap the same way every custom roadmap gets created.
  async function handleCreate() {
    if (picking) return;
    const result = await openCreateRoadmapModal();
    if (!result) return;
    picking = true;
    setBusy(true);
    try {
      await store.createCustomRoadmap(result);
      navigate('/app', true);
      showToast('Roadmap imported.', 'success');
    } catch (error) {
      console.error('Failed to create custom roadmap', error);
      picking = false;
      setBusy(false);
      showToast('Could not create your roadmap. Try again.', 'error');
    }
  }

  // Issue #6 Phase 9 — the card is now a plain (non-interactive) wrapper div;
  // the "pick" action lives on the real nested <button class="template-card-pick">
  // instead of the wrapper carrying role="button" around another focusable
  // button (the corner info button) — see the CSS comment on
  // .template-card-pick for why. `cardEl` still gets pushed to cardEls (used
  // by the "picking" state class toggles elsewhere) since that's the outer
  // visual card, not the inner button.
  function buildCreateCard() {
    const pickBtn = el('button', {
      type: 'button',
      className: 'template-card-pick',
      onClick: handleCreate
    }, [
      el('span', { className: 'template-card-icon' }, [createIcon('plus', { size: 'lg' })]),
      el('span', { className: 'template-card-ai-badge', text: 'AI-powered' }),
      el('span', { className: 'template-card-name', text: 'Create your own roadmap' }),
      el('span', { className: 'template-card-desc', text: 'Answer a few questions, generate it with an AI assistant, and paste the result back in.' })
    ]);
    const cardEl = el('div', { className: 'template-card template-card-create' }, [
      pickBtn,
      el('button', {
        type: 'button',
        className: 'template-card-info-corner',
        'data-action': 'info',
        'aria-label': 'How do I build my own roadmap?',
        title: 'How do I build my own roadmap?',
        onClick: () => openBuildYourOwnGuide({ onOpenImport: handleCreate })
      }, [createIcon('info', { size: 'xs' })])
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
      showToast('Could not open that roadmap. Check your connection and try again.', 'error');
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
    showToast(`Deleted "${roadmap.title}".`, 'success');
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

    const pickBtn = el('button', {
      type: 'button',
      className: 'template-card-pick',
      'aria-current': isCurrent ? 'true' : null,
      onClick: () => pickCustomRoadmap(roadmap, cardEl)
    }, [
      el('span', { className: 'template-card-icon', 'aria-hidden': 'true', text: pickCustomRoadmapIcon(roadmap.id) }),
      el('span', { className: 'template-card-name', text: roadmap.title }),
      el('span', { className: 'template-card-desc', text: roadmap.description || 'Your own roadmap.' }),
      footerEl
    ]);
    // Issue #6 Phase 9 — see buildCard()'s identical comment: plain wrapper,
    // role="button" moved onto the nested .template-card-pick button so the
    // delete button is a sibling, not nested inside another button.
    const cardEl = el('div', {
      className: `template-card${isCurrent ? ' template-card-current' : ''}${isStarted && !isCurrent ? ' template-card-started' : ''}`
    }, [
      pickBtn,
      el('button', {
        type: 'button',
        className: 'template-card-delete',
        'data-action': 'delete',
        'aria-label': `Delete ${roadmap.title}`,
        title: `Delete ${roadmap.title}`,
        onClick: () => deleteCustomCard(roadmap, cardEl)
      }, [createIcon('trash', { size: 'xs' })]),
      buildPickingOverlay()
    ]);

    cardEls.push(cardEl);
    return el('div', { role: 'listitem' }, [cardEl]);
  }

  function buildCard(template) {
    const isCurrent = template.id === activeTemplateId;
    const isStarted = startedTemplateIds.includes(template.id);
    const countEl = el('span', { className: 'template-card-count', text: 'Loading topics…' });
    const badgeEl = isCurrent
      ? el('span', { className: 'template-card-current-badge', text: 'Current' })
      : isStarted
        ? el('span', { className: 'template-card-started-badge', text: 'In progress' })
        : null;
    const footerEl = el('div', { className: 'template-card-footer' }, [countEl, badgeEl]);

    const pickBtn = el('button', {
      type: 'button',
      className: 'template-card-pick',
      'aria-current': isCurrent ? 'true' : null,
      onClick: () => pickTemplate(template, cardEl)
    }, [
      el('span', { className: 'template-card-icon', 'aria-hidden': 'true', text: template.icon }),
      el('span', { className: 'template-card-name', text: template.name }),
      el('span', { className: 'template-card-desc', text: template.description }),
      footerEl
    ]);
    // Issue #6 Phase 9 — the card is a plain wrapper; role="button" moved off
    // it onto the real nested .template-card-pick button so the hide button
    // (a second, independently-focusable control) is a sibling, not nested
    // inside another button — see the .template-card-pick CSS comment.
    const cardEl = el('div', {
      className: `template-card${isCurrent ? ' template-card-current' : ''}${isStarted && !isCurrent ? ' template-card-started' : ''}`
    }, [
      pickBtn,
      el('button', {
        type: 'button',
        className: 'template-card-hide',
        'data-action': 'hide',
        'aria-label': `Hide ${template.name}`,
        title: `Hide ${template.name}`,
        onClick: () => hideTemplate(template, cardEl)
      }, [createIcon('close', { size: 'xs' })]),
      buildPickingOverlay()
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
    .filter(t => !hiddenTemplateIds.includes(t.id) || startedTemplateIds.includes(t.id))
    .forEach(template => visibleGrid.appendChild(buildCard(template)));
  renderHiddenToggle();

  const themeToggleBtn = createThemeToggle();
  // This page had no sign-out affordance anywhere — a real, reported gap
  // (the app-shell sidebar with its own sign-out button only renders on
  // dashboard.js, and this "all roadmaps" picker doesn't use that shell).
  // Reuses the same confirmAndSignOut() the sidebar calls, so behavior
  // (always confirms first, message tailored to guest/dirty state) matches
  // exactly regardless of where a user signs out from.
  const signOutBtn = el('button', {
    type: 'button',
    className: 'btn btn-ghost btn-icon',
    'aria-label': 'Sign out',
    onClick: () => confirmAndSignOut(user, store)
  }, [createIcon('signOut', { size: 'sm' })]);
  // Rendered on this page (not the roadmap dashboard) precisely because it's
  // independent of any single roadmap — this is the "all roadmaps" screen,
  // so Daily Todos lives here instead of looking like it belongs to whichever
  // roadmap happens to be active (issue #56 follow-up). `store` (roadmap) is
  // also passed through so a todo linked to a roadmap topic (added via a
  // button on that topic's row in dashboard.js) can resolve the linked
  // roadmap's display name and mark that topic done/not-done on completion.
  const dailyTodoPanel = dailyTodoStore ? createDailyTodoPanel(dailyTodoStore, store) : null;
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
        el('div', { className: 'onboarding-top-actions' }, [themeToggleBtn, signOutBtn])
      ]),
      backBtn,
      el('header', { className: 'onboarding-head' }, [
        el('h1', { className: 'auth-title', text: isSwitchingTemplate ? 'Switch your starter roadmap' : 'Pick a starting roadmap' }),
        el('p', {
          className: 'auth-subtitle',
          text: isSwitchingTemplate
            ? "Switch between your roadmaps anytime — each one keeps its own progress, and starting or switching never overwrites another."
            : 'Choose a template to get started. You can add, edit, or remove topics anytime, and start more templates later without losing progress.'
        })
      ]),
      dailyTodoPanel,
      visibleGrid,
      hiddenSection
    ].filter(Boolean))
  ]);

  app.replaceChildren(node);
  cardEls[0]?.focus();

  return () => {
    themeToggleBtn._cleanup?.();
    dailyTodoPanel?._cleanup?.();
  };
}
