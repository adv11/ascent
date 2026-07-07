import { el, debounce } from '../dom.js';
import { buildImportPrompt } from '../../data/importPrompt.js';
import { validateImportText } from '../../core/roadmap/importValidator.js';
import { adaptImportToRoadmap } from '../../core/roadmap/schemaAdapter.js';

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

// "Import roadmap" (issue #4) — two tabs: "Generate with AI" (a versioned,
// copyable prompt with an editable topic line) and "Paste & Import" (paste
// AI output, validate on input, import once valid). Resolves
// `{ title, phases, items } | null` (null on cancel/Escape/outside-click) —
// the caller feeds the resolved value straight into
// `store.createCustomRoadmap({ title, phases, items })`.
export function openImportRoadmapModal() {
  return new Promise(resolve => {
    function close(result) {
      window.removeEventListener('keydown', onKey);
      overlay.remove();
      resolve(result);
    }

    const onKey = e => { if (e.key === 'Escape') close(null); };

    // --- Tab 1: Generate with AI ---
    const topicInput = el('textarea', {
      className: 'field-input',
      rows: '2',
      placeholder: 'e.g. Kubernetes for backend engineers'
    });
    const promptBlock = el('pre', { className: 'import-prompt-block' });
    const copyBtn = el('button', { type: 'button', className: 'btn btn-secondary btn-sm', text: 'Copy prompt' });

    function refreshPrompt() {
      promptBlock.textContent = buildImportPrompt(topicInput.value);
    }
    refreshPrompt();
    topicInput.addEventListener('input', debounce(refreshPrompt, 150));

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

    const generatePanel = el('div', { className: 'import-tab-panel' }, [
      el('label', { className: 'field' }, [
        el('span', { className: 'field-label', text: 'What should this roadmap cover?' }),
        topicInput
      ]),
      promptBlock,
      copyBtn
    ]);

    // --- Tab 2: Paste & Import ---
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

    const pastePanel = el('div', { className: 'import-tab-panel', style: 'display:none' }, [
      el('label', { className: 'field' }, [
        el('span', { className: 'field-label', text: 'Paste AI output' }),
        pasteArea
      ]),
      errorList,
      successMsg,
      importBtn
    ]);

    // --- Tabs ---
    const generateTabBtn = el('button', { type: 'button', className: 'import-tab-btn active', 'data-tab': 'generate', text: 'Generate with AI' });
    const pasteTabBtn = el('button', { type: 'button', className: 'import-tab-btn', 'data-tab': 'paste', text: 'Paste & Import' });

    function selectTab(tab) {
      const isGenerate = tab === 'generate';
      generateTabBtn.classList.toggle('active', isGenerate);
      pasteTabBtn.classList.toggle('active', !isGenerate);
      generatePanel.style.display = isGenerate ? '' : 'none';
      pastePanel.style.display = isGenerate ? 'none' : '';
    }
    generateTabBtn.addEventListener('click', () => selectTab('generate'));
    pasteTabBtn.addEventListener('click', () => selectTab('paste'));

    const overlay = el('div', {
      className: 'modal-overlay',
      role: 'dialog',
      'aria-modal': 'true',
      'aria-label': 'Import roadmap',
      onClick: e => { if (e.target === overlay) close(null); }
    }, [
      el('div', { className: 'modal-card import-modal-card' }, [
        el('h2', { className: 'modal-title', text: 'Import roadmap' }),
        el('div', { className: 'import-tabs', role: 'tablist' }, [generateTabBtn, pasteTabBtn]),
        generatePanel,
        pastePanel,
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
