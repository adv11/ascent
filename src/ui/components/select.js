import { el } from '../dom.js';
import { createIcon } from './icons.js';

// Custom-styled listbox replacing a bare `<select>` (issue #136 Phase 3) —
// a native `<select>`'s browser-default dropdown arrow/font stood out next
// to every other fully custom-styled field in the same form (found live,
// screenshotted). Reuses `dropdown.js`'s `position: fixed` +
// `getBoundingClientRect()` positioning approach (see that file's own
// comment for why `position: fixed`, not `absolute`, is required — a
// clipping ancestor like `.app-sidebar` would otherwise cut the menu off)
// rather than inventing new positioning code, per
// `.claude/rules/ui-styling.md`.
//
// API deliberately mirrors a native `<select>` so every existing call site
// only needs its `el('select', ...)` construction swapped, not its
// surrounding logic: `select.value` is a live getter/setter (setting it
// does NOT dispatch `change`, matching native `<select>.value = x`
// semantics), and `select.addEventListener('change', fn)` fires on every
// user-driven selection (click, Enter/Space on a focused option, or
// type-ahead landing on a new value) exactly like a real `<select>`.
//
// `options`: `[{ value, label }]`. `value`/`ariaLabel`/`className` are
// optional initial config; `ariaLabel` is only needed when the trigger isn't
// already wrapped in a `<label>` (see itemPanel.js's Priority field for the
// implicit-label case — a `<button>` is a labelable element, so wrapping it
// in `<label class="field">` works exactly like wrapping a native `<select>`
// did).
export function createSelect(options, { value, ariaLabel, className = '' } = {}) {
  let selected = value ?? options[0]?.value ?? '';
  let open = false;
  let typeahead = '';
  let typeaheadTimer = null;

  const valueLabel = el('span', { className: 'custom-select-value' });
  const trigger = el('button', {
    type: 'button',
    className: 'custom-select-trigger field-input',
    role: 'combobox',
    'aria-haspopup': 'listbox',
    'aria-expanded': 'false',
    'aria-label': ariaLabel || null
  }, [valueLabel, el('span', { className: 'custom-select-caret', 'aria-hidden': 'true' }, [createIcon('chevron', { size: 'xs' })])]);

  const listbox = el('ul', { className: 'custom-select-listbox', role: 'listbox', tabindex: '-1' });
  // `className` (the caller's identifying/sizing class, e.g. 'settings-select')
  // lives on this wrapper, the same node `.value`/`.disabled` are defined on
  // below — a test or call site that does
  // `document.querySelector('.settings-select').value = 'x'` needs the class
  // and the property on the same element, matching a native `<select>`'s
  // single-element contract.
  //
  // `listbox` is NOT nested inside `wrap` — it's appended straight to
  // `document.body` on open and removed on close (a portal, of sorts). A
  // `position: fixed` element positions itself relative to the nearest
  // ancestor with a `transform`/`filter`/etc., not the viewport, if one
  // exists between it and the root (`.claude/rules/ui-styling.md`'s
  // "overflow value that isn't visible..." rule) — `itemPanel.js`'s
  // `.item-panel.show { transform: translateX(0) }` slide-in is exactly such
  // an ancestor, and this component is used inside it (the Priority field).
  // Keeping the listbox as a body-level child sidesteps the whole class of
  // bug regardless of which transformed/animated container a future call
  // site nests a select inside.
  const wrap = el('div', { className: `custom-select ${className}`.trim() }, [trigger]);

  let optionEls = [];

  function labelFor(val) {
    return options.find(o => o.value === val)?.label ?? '';
  }

  function renderOptions() {
    listbox.replaceChildren();
    optionEls = options.map(opt => {
      const li = el('li', {
        role: 'option',
        className: 'custom-select-option',
        'aria-selected': String(opt.value === selected),
        tabindex: '-1',
        text: opt.label,
        onClick: () => choose(opt.value)
      });
      listbox.append(li);
      return li;
    });
  }

  function syncSelectedUi() {
    valueLabel.textContent = labelFor(selected);
    optionEls.forEach(li => {
      const isSelected = options[optionEls.indexOf(li)].value === selected;
      li.setAttribute('aria-selected', String(isSelected));
      li.classList.toggle('active', isSelected);
    });
  }

  function positionListbox() {
    const rect = trigger.getBoundingClientRect();
    listbox.style.left = `${rect.left}px`;
    listbox.style.top = `${rect.bottom + 4}px`;
    listbox.style.width = `${rect.width}px`;
  }

  function setOpen(next) {
    open = next;
    wrap.classList.toggle('open', open);
    listbox.classList.toggle('open', open);
    trigger.setAttribute('aria-expanded', String(open));
    if (open) {
      document.body.appendChild(listbox);
      positionListbox();
      const activeIdx = Math.max(0, options.findIndex(o => o.value === selected));
      optionEls[activeIdx]?.focus();
    } else if (listbox.isConnected) {
      listbox.remove();
    }
  }

  function close() {
    if (!open) return;
    setOpen(false);
    trigger.focus();
  }

  function choose(val, { silent = false } = {}) {
    const changed = val !== selected;
    selected = val;
    syncSelectedUi();
    close();
    if (changed && !silent) wrap.dispatchEvent(new Event('change'));
  }

  function moveFocus(delta) {
    const idx = optionEls.indexOf(document.activeElement);
    const next = ((idx === -1 ? 0 : idx) + delta + optionEls.length) % optionEls.length;
    optionEls[next]?.focus();
  }

  function jumpFocus(toEnd) {
    optionEls[toEnd ? optionEls.length - 1 : 0]?.focus();
  }

  function handleTypeahead(key) {
    clearTimeout(typeaheadTimer);
    typeahead += key.toLowerCase();
    typeaheadTimer = setTimeout(() => { typeahead = ''; }, 500);
    const match = options.find(o => o.label.toLowerCase().startsWith(typeahead));
    if (!match) return;
    if (open) {
      optionEls[options.indexOf(match)]?.focus();
    } else {
      choose(match.value);
    }
  }

  function onTriggerKeydown(e) {
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp' || e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      setOpen(true);
    } else if (e.key.length === 1 && /\S/.test(e.key)) {
      e.preventDefault();
      handleTypeahead(e.key);
    }
  }

  function selectFocusedOption() {
    const idx = optionEls.indexOf(document.activeElement);
    if (idx !== -1) choose(options[idx].value);
  }

  const listboxKeyHandlers = {
    Escape: () => close(),
    ArrowDown: () => moveFocus(1),
    ArrowUp: () => moveFocus(-1),
    Home: () => jumpFocus(false),
    End: () => jumpFocus(true),
    Enter: () => selectFocusedOption(),
    ' ': () => selectFocusedOption(),
    Tab: () => close()
  };

  function onListboxKeydown(e) {
    const handler = listboxKeyHandlers[e.key];
    if (handler) {
      if (e.key !== 'Tab') e.preventDefault();
      handler();
    } else if (e.key.length === 1 && /\S/.test(e.key)) {
      e.preventDefault();
      handleTypeahead(e.key);
    }
  }

  function onDocClick(e) {
    // `listbox` is a body-level portal (see the comment above `wrap`'s
    // construction) — no longer a DOM descendant of `wrap` while open, so
    // both must be checked to avoid closing on a click that lands inside
    // the listbox itself (e.g. its own padding, not an option).
    if (!wrap.contains(e.target) && !listbox.contains(e.target)) close();
  }

  renderOptions();
  syncSelectedUi();

  trigger.addEventListener('click', () => setOpen(!open));
  trigger.addEventListener('keydown', onTriggerKeydown);
  listbox.addEventListener('keydown', onListboxKeydown);
  document.addEventListener('click', onDocClick);

  Object.defineProperty(wrap, 'value', {
    get: () => selected,
    set: val => {
      selected = val;
      syncSelectedUi();
    }
  });
  Object.defineProperty(wrap, 'disabled', {
    get: () => trigger.disabled,
    set: val => { trigger.disabled = val; }
  });

  wrap._cleanup = () => {
    clearTimeout(typeaheadTimer);
    document.removeEventListener('click', onDocClick);
    listbox.remove();
  };

  return wrap;
}
