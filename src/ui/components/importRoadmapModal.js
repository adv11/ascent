import { el, debounce } from '../dom.js';
import { attachFocusTrap } from './modal.js';
import { createSelect } from './select.js';
import { buildImportPrompt, buildImportFixPrompt } from '../../data/importPrompt.js';
import { validateImportText } from '../../core/roadmap/importValidator.js';
import { adaptImportToRoadmap } from '../../core/roadmap/schemaAdapter.js';

const EXPERIENCE_LEVELS = ['Beginner', 'Intermediate', 'Advanced'];
const TIMEFRAMES = ['No deadline', '1 month', '3 months', '6 months', '1 year'];
const GOALS = ['Interview prep', 'On-the-job upskilling', 'Academic or exam prep', 'Personal project or hobby'];
const WEEKLY_TIME_OPTIONS = ['< 2 hrs/week', '2–5 hrs/week', '5–10 hrs/week', '10+ hrs/week'];
const RESOURCE_TYPES = ['YouTube videos', 'Articles & blogs', 'Official docs', 'Online courses'];

function countItems(data) {
  return data.phases.reduce((total, phase) => (
    total + phase.sections.reduce((acc, section) => acc + section.items.length, 0)
  ), 0);
}

// Falls back to a hidden-textarea + execCommand('copy') when the async
// Clipboard API isn't available (older browsers, or a non-secure context).
async function copyToClipboard(text) {
  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(text);
    return;
  }
  const textarea = document.createElement('textarea');
  textarea.value = text;
  textarea.style.position = 'fixed';
  textarea.style.opacity = '0';
  document.body.appendChild(textarea);
  textarea.select();
  document.execCommand('copy');
  textarea.remove();
}

// A row of toggle chips sharing one selection (reuses .filter-chip styling).
// `getValue`/`onChange` let the caller own the selected value instead of
// this helper tracking its own state — every field here just feeds
// `refreshPrompt()`, so there's no local state worth owning separately.
function buildChipGroup(values, getValue, onChange) {
  const buttons = values.map(value => {
    const btn = el('button', {
      type: 'button',
      className: `filter-chip ${getValue() === value ? 'active' : ''}`,
      text: value
    });
    btn.addEventListener('click', () => {
      onChange(getValue() === value ? '' : value);
      buttons.forEach(b => b.classList.toggle('active', b.textContent === getValue()));
    });
    return btn;
  });
  return el('div', { className: 'import-option-chips' }, buttons);
}

// Same chip visuals as buildChipGroup(), but any number of chips can be
// active at once — used for "Preferred resource types" (issue #100 revamp),
// where a user may want more than one kind of link.
function buildMultiChipGroup(values, getValues, onChange) {
  const buttons = values.map(value => {
    const btn = el('button', {
      type: 'button',
      className: `filter-chip ${getValues().includes(value) ? 'active' : ''}`,
      text: value
    });
    btn.addEventListener('click', () => {
      const current = getValues();
      const next = current.includes(value) ? current.filter(v => v !== value) : [...current, value];
      onChange(next);
      btn.classList.toggle('active', next.includes(value));
    });
    return btn;
  });
  return el('div', { className: 'import-option-chips' }, buttons);
}

// A small circular numbered badge + label, used as each build/paste step's
// heading (issue #100 revamp) — replaces the earlier plain "1. ..." text so
// the sequence reads as a clear set of steps rather than a wall of
// sub-headings. `.entering-delay-N` (app.css, root CLAUDE.md's "Never set an
// inline style attribute" rule) staggers each step's entrance instead of an
// inline animation-delay.
function buildStepHeading(number, text, delayIndex = 0) {
  return el('h3', { className: `import-step-heading entering entering-delay-${Math.min(delayIndex, 6)}` }, [
    el('span', { className: 'import-step-badge', text: String(number) }),
    el('span', { text })
  ]);
}

// "Create your own roadmap" (issue #100 — supersedes issues #4/#64, which
// this redesign fully replaces). Manual "start truly blank" creation was
// retired (see roadmap-store.md) — this AI-assisted flow is now the only way
// to start a custom roadmap, so it's redesigned as a two-column "build your
// prompt" / "paste the AI's answer" layout instead of one long stacked
// scroll, with a shared header/footer so Import/Cancel are always reachable
// without hunting through either column. Below the ≥1024px tier this
// collapses to the same top-to-bottom single-column flow that already
// existed (see the `.claude/rules/ui-styling.md` breakpoint scale).
// Resolves `{ title, phases, items } | null` (null on cancel/Escape/
// outside-click) — the caller feeds the resolved value straight into
// `store.createCustomRoadmap({ title, phases, items })`.
export function openCreateRoadmapModal() {
  return new Promise(resolve => {
    function close(result) {
      detachTrap();
      goalSelect._cleanup?.();
      overlay.remove();
      resolve(result);
    }

    // --- Left column: build your prompt ---
    const topicInput = el('textarea', {
      className: 'field-input',
      rows: '2',
      placeholder: 'e.g. Kubernetes for backend engineers'
    });

    let experienceLevel = '';
    let timeframe = '';
    let goal = '';
    let weeklyTime = '';
    let resourceTypes = [];
    const alreadyKnowInput = el('input', {
      className: 'field-input',
      type: 'text',
      placeholder: 'e.g. already comfortable with Docker and basic networking'
    });

    const promptBlock = el('pre', { className: 'import-prompt-block' });
    const copyBtn = el('button', { type: 'button', className: 'btn btn-secondary btn-block', text: 'Copy prompt' });
    const copyHint = el('p', { className: 'import-copy-hint', text: 'Tell us what this roadmap should cover first.' });

    function refreshCopyState() {
      const hasTopic = topicInput.value.trim().length > 0;
      copyBtn.disabled = !hasTopic;
      copyHint.hidden = hasTopic;
    }

    function refreshPrompt() {
      promptBlock.textContent = buildImportPrompt(topicInput.value, {
        experienceLevel,
        timeframe,
        goal,
        weeklyTime,
        resourceTypes,
        alreadyKnow: alreadyKnowInput.value
      });
      refreshCopyState();
    }
    const debouncedRefresh = debounce(refreshPrompt, 150);
    topicInput.addEventListener('input', debouncedRefresh);
    alreadyKnowInput.addEventListener('input', debouncedRefresh);

    const experienceChips = buildChipGroup(EXPERIENCE_LEVELS, () => experienceLevel, value => {
      experienceLevel = value;
      refreshPrompt();
    });
    const timeframeChips = buildChipGroup(TIMEFRAMES, () => timeframe, value => {
      timeframe = value;
      refreshPrompt();
    });
    const weeklyTimeChips = buildChipGroup(WEEKLY_TIME_OPTIONS, () => weeklyTime, value => {
      weeklyTime = value;
      refreshPrompt();
    });
    const resourceTypeChips = buildMultiChipGroup(RESOURCE_TYPES, () => resourceTypes, values => {
      resourceTypes = values;
      refreshPrompt();
    });
    const goalSelect = createSelect(
      [{ value: '', label: 'No preference' }, ...GOALS.map(value => ({ value, label: value }))],
      { value: '', ariaLabel: 'Goal / context' }
    );
    goalSelect.addEventListener('change', () => {
      goal = goalSelect.value;
      refreshPrompt();
    });

    refreshPrompt();

    let copyResetTimer;
    copyBtn.addEventListener('click', async () => {
      if (copyBtn.disabled) return;
      clearTimeout(copyResetTimer);
      try {
        await copyToClipboard(promptBlock.textContent);
        copyBtn.textContent = 'Copied!';
      } catch {
        copyBtn.textContent = 'Copy failed — select the text manually';
      }
      copyResetTimer = setTimeout(() => { copyBtn.textContent = 'Copy prompt'; }, 1800);
    });

    // The "Copy it" step (heading + button + hint) is a dedicated
    // .import-copy-sticky block pinned to the bottom of the scrollable build
    // column (app.css) so it's visible the moment the modal opens, without
    // scrolling past the customization filters first — the exact "under the
    // scrollable, not visible on first open" gap reported after the initial
    // two-column redesign shipped. The column keeps scrolling normally above
    // it; only this one block stays put.
    const copyStickyBlock = el('div', { className: 'import-copy-sticky' }, [
      buildStepHeading(4, 'Copy it', 3),
      copyBtn,
      copyHint,
      el('p', { className: 'import-copy-instructions', text: 'Paste this into ChatGPT, Claude, Gemini, or any AI chat assistant.' })
    ]);

    const buildScrollArea = el('div', { className: 'import-column-scroll' }, [
      buildStepHeading(1, 'What should this roadmap cover?', 0),
      el('label', { className: 'field' }, [topicInput]),
      buildStepHeading(2, 'Customize it (optional)', 1),
      el('div', { className: 'import-options' }, [
        el('label', { className: 'field' }, [
          el('span', { className: 'field-label', text: 'Experience level' }),
          el('span', { className: 'field-hint', text: 'How much do you already know about this?' }),
          experienceChips
        ]),
        el('label', { className: 'field' }, [
          el('span', { className: 'field-label', text: 'Target timeframe' }),
          el('span', { className: 'field-hint', text: 'How long do you want this roadmap to take?' }),
          timeframeChips
        ]),
        el('label', { className: 'field' }, [
          el('span', { className: 'field-label', text: 'Weekly time commitment' }),
          el('span', { className: 'field-hint', text: 'How many hours a week can you realistically give this?' }),
          weeklyTimeChips
        ]),
        el('label', { className: 'field' }, [
          el('span', { className: 'field-label', text: 'Goal / context' }),
          el('span', { className: 'field-hint', text: 'What are you using this roadmap for?' }),
          goalSelect
        ]),
        el('label', { className: 'field' }, [
          el('span', { className: 'field-label', text: 'Preferred resource types' }),
          el('span', { className: 'field-hint', text: 'What kinds of links should the AI include, if any? Pick as many as you like.' }),
          resourceTypeChips
        ]),
        el('label', { className: 'field' }, [
          el('span', { className: 'field-label', text: 'Already know' }),
          el('span', { className: 'field-hint', text: 'Anything you want the AI to skip over?' }),
          alreadyKnowInput
        ])
      ]),
      buildStepHeading(3, 'Your prompt', 2),
      promptBlock
    ]);

    const buildColumn = el('div', { className: 'import-column import-column-build' }, [
      buildScrollArea,
      copyStickyBlock
    ]);

    // --- Right column: paste the AI's answer ---
    const pasteArea = el('textarea', {
      className: 'field-input import-paste-area',
      rows: '10',
      placeholder: 'Paste the AI output here'
    });
    const summaryMsg = el('p', { className: 'form-message', text: '' });
    // Issue #121 item 1: a captured real-world ChatGPT payload confirmed the
    // corruption-marker heuristic below is catching genuine data corruption
    // (ChatGPT's web UI auto-linkifying bare URLs inside the JSON, then a
    // "select rendered text and copy" action capturing that markdown-link
    // syntax instead of the raw JSON) — not a false positive in our
    // validator. The generic per-error CORRUPTION_HINT text
    // (importValidator.js) is still shown in "technical details", but a
    // provider-specific callout surfaces the actual fix up front, since
    // resending the same way ("fix it and resend") reproduces the identical
    // corruption every time.
    // A distinct class from .form-message.error (summaryMsg's class) —
    // both a Playwright locator and this modal's own DOM structure need to
    // tell "N things need fixing" apart from this callout unambiguously
    // (a bare `.form-message.error` locator matched both, breaking
    // tests/e2e/importRoadmap.test.js in CI once this element existed).
    //
    // Issue #121 item 1's original remedy ("use ChatGPT's copy-code button,
    // not text selection") was itself proven backwards by a second live
    // report (found via a screenshot of the actual corrupted paste): clicking
    // ChatGPT's own copy button reproduced the identical corruption, while
    // manually selecting the raw text inside the code block with a mouse or
    // trackpad and copying that selection imported cleanly on the first try.
    // ChatGPT's web UI evidently still routes its copy button through the
    // same rendered/markdown path that introduces the corruption in the
    // first place — manual raw-text selection is the one method confirmed
    // reliable. Guidance flipped accordingly; do not flip it back without a
    // new confirmed report, since this has now been wrong in both directions.
    const corruptionHint = el('p', {
      className: 'import-corruption-hint',
      hidden: true,
      text: "This looks like it was copied from ChatGPT's rendered response instead of the raw text. ChatGPT's own copy button can cause this. Instead, click inside the code block, select all the text with your mouse or trackpad, and copy that selection — then paste it here again."
    });
    const technicalToggle = el('button', {
      type: 'button',
      className: 'btn btn-ghost btn-sm import-technical-toggle',
      text: 'Show technical details',
      hidden: true
    });
    const errorList = el('ul', { className: 'import-errors', hidden: true });
    const fixItBtn = el('button', {
      type: 'button',
      className: 'btn btn-secondary btn-sm',
      text: "Copy fix-it message for your AI",
      hidden: true
    });
    const importBtn = el('button', { type: 'button', className: 'btn btn-primary btn-block', text: 'Import roadmap' });
    importBtn.disabled = true;

    let lastValidData = null;
    let lastErrors = [];

    technicalToggle.addEventListener('click', () => {
      const showing = !errorList.hidden;
      errorList.hidden = showing;
      technicalToggle.textContent = showing ? 'Show technical details' : 'Hide technical details';
    });

    let fixItResetTimer;
    fixItBtn.addEventListener('click', async () => {
      clearTimeout(fixItResetTimer);
      try {
        await copyToClipboard(buildImportFixPrompt(lastErrors));
        fixItBtn.textContent = 'Copied!';
      } catch {
        fixItBtn.textContent = 'Copy failed — select the text manually';
      }
      fixItResetTimer = setTimeout(() => { fixItBtn.textContent = "Copy fix-it message for your AI"; }, 1800);
    });

    function runValidation() {
      const text = pasteArea.value.trim();
      errorList.replaceChildren();
      errorList.hidden = true;
      technicalToggle.hidden = true;
      technicalToggle.textContent = 'Show technical details';
      fixItBtn.hidden = true;
      corruptionHint.hidden = true;
      summaryMsg.textContent = '';
      summaryMsg.className = 'form-message';
      lastValidData = null;
      lastErrors = [];
      importBtn.disabled = true;
      if (!text) return;

      const result = validateImportText(text);
      if (result.valid) {
        lastValidData = result.data;
        const count = countItems(result.data);
        summaryMsg.textContent = `Looks good — ${count} topic${count === 1 ? '' : 's'} found.`;
        summaryMsg.className = 'form-message success';
        importBtn.disabled = false;
      } else {
        lastErrors = result.errors;
        summaryMsg.textContent = `${result.errors.length} thing${result.errors.length === 1 ? '' : 's'} need${result.errors.length === 1 ? 's' : ''} fixing before this can be imported.`;
        summaryMsg.className = 'form-message error';
        errorList.replaceChildren(...result.errors.map(message => el('li', { text: message })));
        technicalToggle.hidden = false;
        fixItBtn.hidden = false;
        corruptionHint.hidden = !result.errors.some(message => message.includes('looks corrupted'));
      }
    }
    pasteArea.addEventListener('input', debounce(runValidation, 300));

    importBtn.addEventListener('click', () => {
      if (!lastValidData) return;
      const { phases, items, droppedResourceCount } = adaptImportToRoadmap(lastValidData);
      close({ title: lastValidData.title, phases, items, droppedResourceCount });
    });

    const pasteColumn = el('div', { className: 'import-column import-column-paste' }, [
      buildStepHeading(5, "Paste the AI's answer", 4),
      el('label', { className: 'field' }, [pasteArea]),
      buildStepHeading(6, 'Fix any issues', 5),
      summaryMsg,
      corruptionHint,
      technicalToggle,
      errorList,
      fixItBtn
    ]);

    const grid = el('div', { className: 'import-modal-grid' }, [buildColumn, pasteColumn]);

    const footer = el('div', { className: 'import-modal-footer' }, [
      importBtn,
      el('button', {
        type: 'button',
        className: 'btn btn-secondary btn-block',
        text: 'Cancel',
        onClick: () => close(null)
      })
    ]);

    const card = el('div', { className: 'modal-card import-modal-card' }, [
      el('h2', { className: 'modal-title', text: 'Create your own roadmap' }),
      grid,
      footer
    ]);

    const overlay = el('div', {
      className: 'modal-overlay',
      role: 'dialog',
      'aria-modal': 'true',
      'aria-label': 'Create your own roadmap',
      onClick: e => { if (e.target === overlay) close(null); }
    }, [card]);

    const detachTrap = attachFocusTrap(card, { onEscape: () => close(null) });
    document.body.appendChild(overlay);
    topicInput.focus();
  });
}
