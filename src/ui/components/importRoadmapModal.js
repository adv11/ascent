import { el, debounce } from '../dom.js';
import { buildImportPrompt } from '../../data/importPrompt.js';
import { validateImportText } from '../../core/roadmap/importValidator.js';
import { adaptImportToRoadmap } from '../../core/roadmap/schemaAdapter.js';

const EXPERIENCE_LEVELS = ['Beginner', 'Intermediate', 'Advanced'];
const TIMEFRAMES = ['No deadline', '1 month', '3 months', '6 months', '1 year'];
const GOALS = ['Interview prep', 'On-the-job upskilling', 'Academic or exam prep', 'Personal project or hobby'];

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

// "Import roadmap" (issue #4). Issue #64 collapsed the original two-tab
// "Generate with AI" / "Paste & Import" layout into one continuous,
// top-to-bottom flow (topic → optional customization inputs → generated
// prompt → copy button → paste box → validation feedback → import button) —
// every real use of this feature does both halves in the same sitting, so
// hiding the paste box behind a second tab was friction, not clarity. Part 2
// added the customization inputs themselves: experience level, target
// timeframe, goal/context, and an optional "already know" freeform note, all
// optional and all feeding buildImportPrompt()'s `options` param — never the
// JSON schema contract, so this needed no IMPORT_PROMPT_VERSION bump.
// Resolves `{ title, phases, items } | null` (null on cancel/Escape/
// outside-click) — the caller feeds the resolved value straight into
// `store.createCustomRoadmap({ title, phases, items })`.
export function openImportRoadmapModal() {
  return new Promise(resolve => {
    function close(result) {
      window.removeEventListener('keydown', onKey);
      overlay.remove();
      resolve(result);
    }

    const onKey = e => { if (e.key === 'Escape') close(null); };

    // --- Topic + customization inputs ---
    const topicInput = el('textarea', {
      className: 'field-input',
      rows: '2',
      placeholder: 'e.g. Kubernetes for backend engineers'
    });

    let experienceLevel = '';
    let timeframe = '';
    let goal = '';
    const alreadyKnowInput = el('input', {
      className: 'field-input',
      type: 'text',
      placeholder: 'e.g. already comfortable with Docker and basic networking'
    });

    const promptBlock = el('pre', { className: 'import-prompt-block' });
    const copyBtn = el('button', { type: 'button', className: 'btn btn-secondary btn-sm', text: 'Copy prompt' });

    function refreshPrompt() {
      promptBlock.textContent = buildImportPrompt(topicInput.value, {
        experienceLevel,
        timeframe,
        goal,
        alreadyKnow: alreadyKnowInput.value
      });
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
    const goalSelect = el('select', { className: 'field-input' }, [
      el('option', { value: '', text: 'No preference' }),
      ...GOALS.map(value => el('option', { value, text: value }))
    ]);
    goalSelect.addEventListener('change', () => {
      goal = goalSelect.value;
      refreshPrompt();
    });

    refreshPrompt();

    let copyResetTimer;
    copyBtn.addEventListener('click', async () => {
      clearTimeout(copyResetTimer);
      try {
        await copyToClipboard(promptBlock.textContent);
        copyBtn.textContent = 'Copied!';
      } catch {
        copyBtn.textContent = 'Copy failed — select the text manually';
      }
      copyResetTimer = setTimeout(() => { copyBtn.textContent = 'Copy prompt'; }, 1800);
    });

    const generateSection = el('div', { className: 'import-tab-panel' }, [
      el('label', { className: 'field' }, [
        el('span', { className: 'field-label', text: 'What should this roadmap cover?' }),
        topicInput
      ]),
      el('div', { className: 'import-options' }, [
        el('label', { className: 'field' }, [
          el('span', { className: 'field-label', text: 'Experience level (optional)' }),
          experienceChips
        ]),
        el('label', { className: 'field' }, [
          el('span', { className: 'field-label', text: 'Target timeframe (optional)' }),
          timeframeChips
        ]),
        el('label', { className: 'field' }, [
          el('span', { className: 'field-label', text: 'Goal / context (optional)' }),
          goalSelect
        ]),
        el('label', { className: 'field' }, [
          el('span', { className: 'field-label', text: 'Already know (optional)' }),
          alreadyKnowInput
        ])
      ]),
      promptBlock,
      copyBtn
    ]);

    // --- Paste & import ---
    const pasteArea = el('textarea', {
      className: 'field-input import-paste-area',
      rows: '10',
      placeholder: 'Paste the AI output here'
    });
    const errorList = el('ul', { className: 'import-errors' });
    const successMsg = el('p', { className: 'form-message success', text: '' });
    const importBtn = el('button', { type: 'button', className: 'btn btn-primary btn-block', text: 'Import roadmap' });
    importBtn.disabled = true;

    let lastValidData = null;

    function runValidation() {
      const text = pasteArea.value.trim();
      errorList.replaceChildren();
      successMsg.textContent = '';
      lastValidData = null;
      importBtn.disabled = true;
      if (!text) return;

      const result = validateImportText(text);
      if (result.valid) {
        lastValidData = result.data;
        successMsg.textContent = `✓ Looks good — ${countItems(result.data)} topic${countItems(result.data) === 1 ? '' : 's'} found.`;
        importBtn.disabled = false;
      } else {
        errorList.replaceChildren(...result.errors.map(message => el('li', { text: message })));
      }
    }
    pasteArea.addEventListener('input', debounce(runValidation, 300));

    importBtn.addEventListener('click', () => {
      if (!lastValidData) return;
      const { phases, items } = adaptImportToRoadmap(lastValidData);
      close({ title: lastValidData.title, phases, items });
    });

    const pasteSection = el('div', { className: 'import-tab-panel' }, [
      el('label', { className: 'field' }, [
        el('span', { className: 'field-label', text: 'Paste AI output' }),
        pasteArea
      ]),
      errorList,
      successMsg,
      importBtn
    ]);

    const overlay = el('div', {
      className: 'modal-overlay',
      role: 'dialog',
      'aria-modal': 'true',
      'aria-label': 'Import roadmap',
      onClick: e => { if (e.target === overlay) close(null); }
    }, [
      el('div', { className: 'modal-card import-modal-card' }, [
        el('h2', { className: 'modal-title', text: 'Import roadmap' }),
        generateSection,
        pasteSection,
        el('button', {
          type: 'button',
          className: 'btn btn-secondary btn-block',
          text: 'Cancel',
          onClick: () => close(null)
        })
      ])
    ]);

    window.addEventListener('keydown', onKey);
    document.body.appendChild(overlay);
    topicInput.focus();
  });
}
