import { el } from '../dom.js';
import { navigate } from '../router.js';
import { createThemeToggle } from '../components/themeToggle.js';
import { createBrandMark } from '../components/brand.js';
import { createAvatar } from '../components/avatar.js';
import { createDropdown } from '../components/dropdown.js';
import { openDeleteAccountModal } from '../components/deleteAccountModal.js';
import { openMyReports } from '../components/myReports.js';
import { openShareRoadmapModal } from '../components/shareRoadmapModal.js';
import { openBuildYourOwnGuide } from '../components/buildYourOwnGuide.js';
import { openCreateRoadmapModal } from '../components/importRoadmapModal.js';
import { createDailyTodoPanel } from '../components/dailyTodoPanel.js';
import { confirmDialog } from '../components/confirmDialog.js';
import { confirmAndSignOut } from '../utils/signOut.js';
import { exportBackupJson, exportBackupCsv, exportTodosIcs, importBackupFromFile } from '../utils/backupActions.js';
import { triggerRoadmapPrint } from '../utils/printRoadmap.js';
import { showToast } from '../components/toast.js';
import { TEMPLATES } from '../../data/templates/index.js';
import { MAX_FAVORITE_ROADMAPS } from '../../core/roadmap/limits.js';
import { pickCustomRoadmapIcon } from '../utils/customRoadmapIcon.js';
import { createIcon } from '../components/icons.js';
import { createDecorativeIcon } from '../components/decorativeIcon.js';

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
function buildPickingOverlay(label = 'Opening…') {
  return el('div', { className: 'template-card-picking-overlay' }, [
    el('span', { className: 'btn-spinner' }),
    ` ${label}`
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
  let startedTemplateIds = [...snapshot.startedTemplateIds];
  let hiddenTemplateIds = [...snapshot.hiddenTemplateIds];
  let customRoadmaps = [...snapshot.customRoadmaps];
  let favoriteRoadmapIds = [...snapshot.favoriteRoadmapIds];

  let picking = false;
  const cardEls = [];
  // Overflow-menu dropdowns (issue #206 §4.1) are portaled to document.body
  // while open (see dropdown.js's own comment on why) — renderVisibleGrid()
  // tears down and rebuilds every card, so each dropdown's own document
  // click-listener must be explicitly cleaned up first or it leaks one per
  // re-render. Same "collect + cleanup before rebuild" pattern cardEls uses,
  // just for a different lifecycle concern.
  let dropdownEls = [];
  let createCardEl = null;
  // Assigned below, once the button itself is built — declared up here so
  // setBusy() (called from deep inside pickTemplate/pickCustomRoadmap/
  // handleCreate, all defined before the button exists in the function body)
  // can close over it. See the real, reproduced bug this guards against on
  // signOutBtn's own definition below.
  let signOutBtn = null;

  function setBusy(busy) {
    cardEls.forEach(card => {
      card.classList.toggle('is-disabled', busy);
      card.setAttribute('aria-disabled', String(busy));
      card.querySelectorAll('button').forEach(btn => { btn.disabled = busy; });
    });
    if (signOutBtn) signOutBtn.disabled = busy;
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

  // Favoriting (issue #177) — up to MAX_FAVORITE_ROADMAPS roadmaps (built-in
  // or custom, no distinction) can be starred; starred cards sort before
  // every other card. Toggling re-renders the whole visible grid rather than
  // patching in place, since a toggle can also move the card's position.
  async function handleToggleFavorite(roadmapId, name) {
    const wasFavorite = favoriteRoadmapIds.includes(roadmapId);
    const result = await store.toggleFavoriteRoadmap(roadmapId);
    if (!result.ok) {
      showToast(`You can only favorite up to ${MAX_FAVORITE_ROADMAPS} roadmaps. Unfavorite one first.`, 'info');
      return;
    }
    favoriteRoadmapIds = wasFavorite
      ? favoriteRoadmapIds.filter(id => id !== roadmapId)
      : [...favoriteRoadmapIds, roadmapId];
    showToast(wasFavorite ? `Removed "${name}" from favorites.` : `Added "${name}" to favorites.`, 'success');
    renderVisibleGrid();
  }

  // Issue #206 §4.1 — a card with 2+ icon-button corner actions (favorite +
  // hide, or favorite + delete) collapses them behind one ⋯ overflow trigger
  // instead of stacking separate corner buttons; the primary "pick this
  // roadmap" action stays the card's own main click target
  // (`.template-card-pick`), untouched by this. "Create your own roadmap"
  // has only one secondary action (the info button) and is deliberately left
  // alone — the spec only calls for collapsing when there are two or more.
  // `createDropdown()` portals its menu to `document.body` on open, so the
  // trigger button itself never needs `data-action`/`stopPropagation()` — a
  // portaled menu can't be an accidental nested-click target of the card's
  // own onClick fallback the way an in-card button would be.
  function buildCardOverflowMenu(name, actions) {
    const trigger = el('button', {
      type: 'button',
      className: 'template-card-overflow-btn',
      'aria-label': `More actions for ${name}`,
      title: 'More actions'
    }, [createIcon('overflow', { size: 'xs' })]);
    const dropdown = createDropdown(trigger, actions, { align: 'end' });
    dropdown.classList.add('template-card-overflow');
    dropdownEls.push(dropdown);
    return dropdown;
  }

  function buildFavoriteMenuAction(roadmapId, name) {
    const isFavorite = favoriteRoadmapIds.includes(roadmapId);
    return {
      text: isFavorite ? 'Unfavorite' : 'Favorite',
      onClick: () => handleToggleFavorite(roadmapId, name)
    };
  }

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
    // The modal itself closes the instant "Import roadmap" is clicked, but
    // store.createCustomRoadmap() still has real Firebase work left to do
    // (see roadmapStore.js's switchRoadmap) — without this, the create
    // card's own dim-and-disable was the only feedback, which read as
    // unresponsive lag rather than "importing," the same bug the pick/open
    // picking-overlay above already fixed for switching roadmaps.
    createCardEl?.classList.add('picking');
    try {
      const { droppedResourceCount, ...roadmap } = result;
      await store.createCustomRoadmap(roadmap);
      navigate('/app', true);
      showToast(
        droppedResourceCount > 0
          ? `Roadmap imported — ${droppedResourceCount} resource link${droppedResourceCount === 1 ? '' : 's'} skipped (invalid URL).`
          : 'Roadmap imported.',
        droppedResourceCount > 0 ? 'info' : 'success'
      );
    } catch (error) {
      console.error('Failed to create custom roadmap', error);
      picking = false;
      setBusy(false);
      createCardEl?.classList.remove('picking');
      // Issue #324 — a capped/rate-limited creation is a real, expected limit
      // the user needs to actually notice and act on (delete something,
      // wait a moment), not a transient failure — a toast alone is easy to
      // miss and disappears before it's read in full. Every other failure
      // (network error, etc.) keeps the existing toast.
      if (error.code === 'capped' || error.code === 'rate_limited') {
        confirmDialog({
          title: error.code === 'capped' ? 'Custom roadmap limit reached' : 'Please wait a moment',
          message: error.message,
          confirmText: 'Got it',
          cancelText: null
        });
        return;
      }
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
    // onClick/e.target === cardEl fallback: same dead-padding-zone fix as
    // buildCard()/buildCustomCard() — see buildCard()'s comment for the story.
    const cardEl = el('div', {
      className: 'template-card template-card-create',
      onClick: e => { if (e.target === cardEl) handleCreate(); }
    }, [
      pickBtn,
      el('button', {
        type: 'button',
        className: 'template-card-info-corner',
        'data-action': 'info',
        'aria-label': 'How do I build my own roadmap?',
        title: 'How do I build my own roadmap?',
        onClick: () => openBuildYourOwnGuide({ onOpenImport: handleCreate })
      }, [createIcon('info', { size: 'xs' })]),
      buildPickingOverlay('Importing…')
    ]);
    cardEls.push(cardEl);
    createCardEl = cardEl;
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
      el('span', { className: 'template-card-icon', 'aria-hidden': 'true' }, [createDecorativeIcon(pickCustomRoadmapIcon(roadmap.id), { size: 'lg' })]),
      el('span', { className: 'template-card-name', text: roadmap.title }),
      el('span', { className: 'template-card-desc', text: roadmap.description || 'Your own roadmap.' }),
      footerEl
    ]);
    // Issue #6 Phase 9 — see buildCard()'s identical comment: plain wrapper,
    // role="button" moved onto the nested .template-card-pick button so the
    // delete button is a sibling, not nested inside another button. The
    // `onClick`/`e.target === cardEl` fallback below is the same real,
    // reproducible dead-padding-zone fix buildCard() needed — see that
    // comment for the full story.
    const cardEl = el('div', {
      className: `template-card${isCurrent ? ' template-card-current' : ''}${isStarted && !isCurrent ? ' template-card-started' : ''}`,
      onClick: e => { if (e.target === cardEl) pickCustomRoadmap(roadmap, cardEl); }
    }, [
      pickBtn,
      buildCardOverflowMenu(roadmap.title, [
        buildFavoriteMenuAction(roadmap.id, roadmap.title),
        { text: 'Delete', danger: true, onClick: () => deleteCustomCard(roadmap, cardEl) }
      ]),
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
      el('span', { className: 'template-card-icon', 'aria-hidden': 'true' }, [createDecorativeIcon(template.icon, { size: 'lg' })]),
      el('span', { className: 'template-card-name', text: template.name }),
      el('span', { className: 'template-card-desc', text: template.description }),
      footerEl
    ]);
    // Issue #6 Phase 9 — the card is a plain wrapper; role="button" moved off
    // it onto the real nested .template-card-pick button so the overflow
    // menu trigger (issue #206 §4.1, a second, independently-focusable
    // control collapsing favorite/hide behind one ⋯ button) is a sibling,
    // not nested inside another button — see the .template-card-pick CSS
    // comment, which already documented (but never implemented) that the
    // outer card "can still have a plain (non-ARIA) onClick for mouse
    // convenience." Without it, `.template-card`'s own 24px/20px padding
    // around `.template-card-pick` is real, unhandled dead space — a click
    // landing there (not uncommon: found via a genuinely reproducible E2E
    // flake where Playwright, unable to scroll a card fully into view on a
    // short/narrow viewport, clicked the center of whatever portion *was*
    // visible, which sometimes fell in this padding rather than on the
    // button) silently does nothing, no error, exactly the symptom
    // investigated. `e.target === cardEl` only fires this fallback for a
    // click that lands directly on the div itself (the dead zone) — a click
    // on any real child (the button, the overflow trigger, the picking
    // overlay) already has its own handler and must not also re-trigger this
    // one via bubbling.
    const cardEl = el('div', {
      className: `template-card${isCurrent ? ' template-card-current' : ''}${isStarted && !isCurrent ? ' template-card-started' : ''}`,
      onClick: e => { if (e.target === cardEl) pickTemplate(template, cardEl); }
    }, [
      pickBtn,
      buildCardOverflowMenu(template.name, [
        buildFavoriteMenuAction(template.id, template.name),
        { text: 'Hide', onClick: () => hideTemplate(template, cardEl) }
      ]),
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
      el('span', { className: 'template-card-icon', 'aria-hidden': 'true' }, [createDecorativeIcon(template.icon, { size: 'lg' })]),
      el('span', { className: 'template-card-name', text: template.name }),
      el('span', { className: 'template-card-desc', text: template.description }),
      el('button', {
        type: 'button',
        className: 'btn btn-secondary btn-sm',
        text: 'Restore',
        onClick: async () => {
          await store.unhideTemplate(template.id);
          hiddenTemplateIds = hiddenTemplateIds.filter(id => id !== template.id);
          renderVisibleGrid();
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

  // "Create your own roadmap" is always first (it's an action, not a pickable
  // roadmap, so it never participates in favorite sorting). Every pickable
  // card (custom + visible built-in) is then sorted favorites-first, stable
  // otherwise — Array#sort is a stable sort in every engine this app targets.
  function renderVisibleGrid() {
    cardEls.length = 0;
    dropdownEls.forEach(dropdown => dropdown._cleanup?.());
    dropdownEls = [];
    visibleGrid.replaceChildren();
    visibleGrid.appendChild(buildCreateCard());
    const pickable = [
      ...customRoadmaps.map(roadmap => ({ id: roadmap.id, build: () => buildCustomCard(roadmap) })),
      ...TEMPLATES
        .filter(t => !hiddenTemplateIds.includes(t.id) || startedTemplateIds.includes(t.id))
        .map(template => ({ id: template.id, build: () => buildCard(template) }))
    ];
    pickable
      .sort((a, b) => Number(favoriteRoadmapIds.includes(b.id)) - Number(favoriteRoadmapIds.includes(a.id)))
      .forEach(entry => visibleGrid.appendChild(entry.build()));
  }

  renderVisibleGrid();
  renderHiddenToggle();

  const themeToggleBtn = createThemeToggle();
  // This page had no sign-out affordance anywhere — a real, reported gap
  // (the app-shell sidebar with its own sign-out button only renders on
  // dashboard.js, and this "all roadmaps" picker doesn't use that shell).
  // Reuses the same confirmAndSignOut() the sidebar calls, so behavior
  // (always confirms first, message tailored to guest/dirty state) matches
  // exactly regardless of where a user signs out from.
  //
  // A real, reproduced data-loss bug: unlike the card buttons, this one was
  // never included in setBusy()'s disable pass — so a user could click
  // "Sign out" while store.switchRoadmap()/createCustomRoadmap() was still
  // in flight (e.g. mid AI-import). confirmAndSignOut() reads
  // store.getSnapshot().dirty to decide whether to flush before signing
  // out, but switchRoadmap() doesn't set dirty=true until its own internal
  // Promise.all resolves and it calls queueSave() — while the switch is
  // still pending, dirty still reflects whatever it was *before* the switch
  // started (often false), so the flush-before-signOut fix never triggers,
  // authApi.signOut() invalidates the auth token mid-flight, and the new
  // roadmap's items/phases are never written to Firebase at all (its
  // meta/customRoadmaps entry still gets created, since that part of the
  // switch already completed — so the roadmap "exists" but loads empty on
  // next sign-in). Wiring this into setBusy() closes the only realistic way
  // a user reaches that race through the UI.
  signOutBtn = el('button', {
    type: 'button',
    className: 'btn btn-ghost btn-icon',
    'aria-label': 'Sign out',
    onClick: () => confirmAndSignOut(user, store, dailyTodoStore)
  }, [createIcon('signOut', { size: 'sm' })]);

  // This page had no account/profile affordance at all — a real, reported gap
  // (a first-time or returning visitor landing here has no way to tell they're
  // signed in, as who, or reach Settings/backup/delete-account without first
  // navigating to the dashboard). `dashboard.js`/`settings.js`/`progress.js`
  // all get this "for free" via `sidebar.js`'s `buildAccountMenu()`, but this
  // page deliberately has no app-shell sidebar at all (see the "Daily Todos
  // store" placement note in `.claude/rules/roadmap-store.md` for why) — so
  // the same item list is rebuilt here as a standalone top-right avatar +
  // dropdown instead, `align: 'end'` (not the sidebar's `'start'`, since this
  // trigger sits in the top-right corner, not a bottom-left footer). Every
  // item mirrors `buildAccountMenu()`'s own list/gating exactly, so a user
  // gets identical account actions regardless of which page they're on.
  const userLabel = user.isAnonymous ? 'Guest session' : (user.displayName || user.email || 'Signed in');
  const importInput = el('input', {
    type: 'file',
    accept: '.json,application/json',
    hidden: true,
    onChange: () => {
      const file = importInput.files?.[0];
      importInput.value = '';
      if (file) importBackupFromFile(store, file);
    }
  });
  const accountTrigger = el('button', {
    type: 'button',
    className: 'btn btn-ghost btn-icon onboarding-account-trigger',
    'aria-label': `Account menu — ${userLabel}`
  }, [createAvatar(user, 'sm')]);
  const accountDropdownItems = [
    { text: 'Settings', onClick: () => navigate('/settings') },
    { text: 'My reports', onClick: () => openMyReports({ user }) },
    { text: 'Share this roadmap…', onClick: () => openShareRoadmapModal({ user, store }) },
    { text: 'Download backup (JSON)', onClick: () => exportBackupJson(store) },
    { text: 'Export CSV', onClick: () => exportBackupCsv(store) },
    { text: 'Import backup…', onClick: () => importInput.click() },
    { text: 'Print roadmap…', onClick: () => triggerRoadmapPrint(store) }
  ];
  if (dailyTodoStore) {
    accountDropdownItems.push({ text: 'Export to calendar (.ics)', onClick: () => exportTodosIcs(dailyTodoStore) });
  }
  if (!user.isAnonymous) {
    accountDropdownItems.push({ text: 'Delete account', danger: true, onClick: () => openDeleteAccountModal() });
  }
  const accountDropdown = createDropdown(accountTrigger, accountDropdownItems, { align: 'end' });
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
        el('div', { className: 'onboarding-top-actions' }, [themeToggleBtn, accountDropdown, importInput, signOutBtn])
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

  // Issue #153 root cause #4 — every other data-driven page (dashboard.js,
  // progress.js) subscribes to live store updates; this page used to read
  // store.getSnapshot() exactly once and build static DOM from it, so a
  // background change that settles after the initial render (a slow
  // createCustomRoadmap()/switchRoadmap() call finishing after the page
  // already painted, or a meta re-fetch) never showed up until the user
  // force-navigated away and back. Only re-renders the card grid — not the
  // whole page — and skips entirely while a pick/create/delete is in flight
  // (`picking`) so a live update never yanks a card out from under an
  // in-progress click.
  const unsubStore = store.subscribe(nextSnapshot => {
    if (picking) return;
    const nextStarted = [...nextSnapshot.startedTemplateIds];
    const nextHidden = [...nextSnapshot.hiddenTemplateIds];
    const nextCustom = [...nextSnapshot.customRoadmaps];
    const nextFavorite = [...nextSnapshot.favoriteRoadmapIds];
    const changed = JSON.stringify(nextStarted) !== JSON.stringify(startedTemplateIds)
      || JSON.stringify(nextHidden) !== JSON.stringify(hiddenTemplateIds)
      || JSON.stringify(nextCustom) !== JSON.stringify(customRoadmaps)
      || JSON.stringify(nextFavorite) !== JSON.stringify(favoriteRoadmapIds);
    if (!changed) return;
    startedTemplateIds = nextStarted;
    hiddenTemplateIds = nextHidden;
    customRoadmaps = nextCustom;
    favoriteRoadmapIds = nextFavorite;
    renderVisibleGrid();
    renderHiddenToggle();
  });

  return () => {
    themeToggleBtn._cleanup?.();
    dailyTodoPanel?._cleanup?.();
    accountDropdown._cleanup?.();
    dropdownEls.forEach(dropdown => dropdown._cleanup?.());
    unsubStore();
  };
}
