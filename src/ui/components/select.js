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

  // The listbox is positioned once, at open time, from the trigger's
  // `getBoundingClientRect()` — but `position: fixed` doesn't track page
  // scroll the way normal-flow content does. Without this, scrolling the
  // page while the listbox is open left it visually stuck at its original
  // screen coordinates while the trigger (and everything else) scrolled out
  // from under it — a real, reported bug: an open listbox rendered as a
  // giant stuck overlay covering unrelated page content at every subsequent
  // scroll position, never closing.
  //
  // Closing on *every* `scroll` event (tried first) turned out too blunt —
  // caught by CI's real-browser E2E suite, not local unit tests (jsdom
  // doesn't dispatch real scroll events at all). Opening a modal focuses its
  // first field, and this app's global `html { scroll-behavior: smooth }`
  // (`app.css`) turns that into a real, multi-hundred-millisecond
  // smooth-scroll settle — a stream of genuine `scroll` events completely
  // unrelated to the select itself. `{ preventScroll: true }` on this
  // component's own `.focus()` calls (below) stops *this component* from
  // causing that kind of scroll, but can't stop an unrelated one already in
  // flight elsewhere on the page from being misread as "the user scrolled,
  // close the dropdown." The fix: check whether the trigger has actually
  // moved meaningfully since open, not just whether a scroll event fired.
  // `TRIGGER_MOVE_THRESHOLD_PX` absorbs sub-pixel/smooth-scroll jitter while
  // still closing promptly on a real, deliberate scroll (which moves the
  // trigger by far more than a few pixels within one frame). `e.target ===
  // listbox` is still excluded separately: `.custom-select-listbox` itself
  // is `overflow-y: auto` for a long option list, and scrolling *through its
  // own options* should never close it regardless of trigger movement.
  const TRIGGER_MOVE_THRESHOLD_PX = 4;
  let openTriggerRect = null;

  function onWindowScrollOrResize(e) {
    if (e?.target === listbox || !openTriggerRect) return;
    const rect = trigger.getBoundingClientRect();
    const moved = Math.abs(rect.top - openTriggerRect.top) > TRIGGER_MOVE_THRESHOLD_PX
      || Math.abs(rect.left - openTriggerRect.left) > TRIGGER_MOVE_THRESHOLD_PX;
    if (moved) close();
  }

  function setOpen(next) {
    open = next;
    wrap.classList.toggle('open', open);
    listbox.classList.toggle('open', open);
    trigger.setAttribute('aria-expanded', String(open));
    if (open) {
      document.body.appendChild(listbox);
      positionListbox();
      openTriggerRect = trigger.getBoundingClientRect();
      const activeIdx = Math.max(0, options.findIndex(o => o.value === selected));
      // `{ preventScroll: true }` — without it, focusing an option the
      // browser considers off-screen kicks off its own smooth-scroll, on top
      // of whatever else is already happening on the page. Doesn't fully
      // solve the problem on its own (see the block comment above), but
      // still worth keeping so this component never *adds* to the noise.
      optionEls[activeIdx]?.focus({ preventScroll: true });
      document.addEventListener('scroll', onWindowScrollOrResize, true);
      window.addEventListener('resize', onWindowScrollOrResize);
    } else if (listbox.isConnected) {
      openTriggerRect = null;
      listbox.remove();
      document.removeEventListener('scroll', onWindowScrollOrResize, true);
      window.removeEventListener('resize', onWindowScrollOrResize);
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

  // Every keyboard-driven `.focus()` call below also needs `preventScroll`
  // for the same reason `setOpen()`'s does — any of these can move focus to
  // an option the browser considers off-screen while the scroll-close
  // listener is active, and an un-prevented auto-scroll would close the
  // listbox out from under the very keystroke that moved focus.
  function moveFocus(delta) {
    const idx = optionEls.indexOf(document.activeElement);
    const next = ((idx === -1 ? 0 : idx) + delta + optionEls.length) % optionEls.length;
    optionEls[next]?.focus({ preventScroll: true });
  }

  function jumpFocus(toEnd) {
    optionEls[toEnd ? optionEls.length - 1 : 0]?.focus({ preventScroll: true });
  }

  function handleTypeahead(key) {
    clearTimeout(typeaheadTimer);
    typeahead += key.toLowerCase();
    typeaheadTimer = setTimeout(() => { typeahead = ''; }, 500);
    const match = options.find(o => o.label.toLowerCase().startsWith(typeahead));
    if (!match) return;
    if (open) {
      optionEls[options.indexOf(match)]?.focus({ preventScroll: true });
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
    document.removeEventListener('scroll', onWindowScrollOrResize, true);
    window.removeEventListener('resize', onWindowScrollOrResize);
    listbox.remove();
  };

  return wrap;
}
