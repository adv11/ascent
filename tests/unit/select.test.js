import { describe, it, expect, beforeEach } from 'vitest';
import { createSelect } from '../../src/ui/components/select.js';

const OPTIONS = [
  { value: 'a', label: 'Alpha' },
  { value: 'b', label: 'Bravo' },
  { value: 'c', label: 'Charlie' }
];

function mount(...args) {
  const node = createSelect(...args);
  document.body.append(node);
  return node;
}

function trigger(node) {
  return node.querySelector('.custom-select-trigger');
}

// issue #136 Phase 3 follow-up — .custom-select-listbox is a body-level
// portal (select.js), only attached to the DOM while open, specifically so
// its `position: fixed` coordinates never get hijacked by a transformed
// ancestor (e.g. itemPanel.js's slide-in `.item-panel.show`). Options are
// only queryable via `document` once the select has been opened — matching
// how a real user would only ever see them that way too.
function options() {
  return [...document.querySelectorAll('.custom-select-option')];
}

function fire(el, key) {
  el.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true }));
}

beforeEach(() => {
  document.body.innerHTML = '';
});

describe('createSelect — rendering and value contract', () => {
  it('is closed by default and opens to reveal one .custom-select-option per option', () => {
    const select = mount(OPTIONS);
    expect(select.classList.contains('open')).toBe(false);
    expect(document.querySelectorAll('.custom-select-option')).toHaveLength(0);
    trigger(select).click();
    expect(options()).toHaveLength(3);
  });

  it('defaults to the first option when no value is given', () => {
    const select = mount(OPTIONS);
    expect(select.value).toBe('a');
    expect(trigger(select).textContent).toContain('Alpha');
  });

  it('honors an initial value', () => {
    const select = mount(OPTIONS, { value: 'b' });
    expect(select.value).toBe('b');
    expect(trigger(select).textContent).toContain('Bravo');
  });

  it('setting .value updates the displayed label and does NOT dispatch change (matches native <select>)', () => {
    const select = mount(OPTIONS, { value: 'a' });
    let changeCount = 0;
    select.addEventListener('change', () => { changeCount++; });
    select.value = 'c';
    expect(select.value).toBe('c');
    expect(trigger(select).textContent).toContain('Charlie');
    expect(changeCount).toBe(0);
  });

  it('clicking an option updates value, dispatches change, and closes', () => {
    const select = mount(OPTIONS, { value: 'a' });
    let received = null;
    select.addEventListener('change', () => { received = select.value; });
    trigger(select).click();
    expect(select.classList.contains('open')).toBe(true);
    options()[2].click();
    expect(received).toBe('c');
    expect(select.value).toBe('c');
    expect(select.classList.contains('open')).toBe(false);
  });

  it('clicking the already-selected option does not dispatch change', () => {
    const select = mount(OPTIONS, { value: 'a' });
    let changeCount = 0;
    select.addEventListener('change', () => { changeCount++; });
    trigger(select).click();
    options()[0].click();
    expect(changeCount).toBe(0);
  });
});

describe('createSelect — keyboard operability', () => {
  it('ArrowDown on the closed trigger opens the listbox and focuses the selected option', () => {
    const select = mount(OPTIONS, { value: 'b' });
    fire(trigger(select), 'ArrowDown');
    expect(select.classList.contains('open')).toBe(true);
    expect(document.activeElement.textContent).toBe('Bravo');
  });

  it('Enter/Space on the closed trigger opens the listbox', () => {
    const select = mount(OPTIONS);
    fire(trigger(select), 'Enter');
    expect(select.classList.contains('open')).toBe(true);
  });

  it('ArrowDown/ArrowUp inside the open listbox cycle focus, wrapping at both ends', () => {
    const select = mount(OPTIONS, { value: 'a' });
    fire(trigger(select), 'ArrowDown');
    const listbox = document.querySelector('.custom-select-listbox');
    expect(document.activeElement.textContent).toBe('Alpha');
    fire(listbox, 'ArrowDown');
    expect(document.activeElement.textContent).toBe('Bravo');
    fire(listbox, 'ArrowUp');
    expect(document.activeElement.textContent).toBe('Alpha');
    fire(listbox, 'ArrowUp');
    expect(document.activeElement.textContent).toBe('Charlie');
  });

  it('Home/End jump to the first/last option', () => {
    const select = mount(OPTIONS, { value: 'b' });
    fire(trigger(select), 'ArrowDown');
    const listbox = document.querySelector('.custom-select-listbox');
    fire(listbox, 'End');
    expect(document.activeElement.textContent).toBe('Charlie');
    fire(listbox, 'Home');
    expect(document.activeElement.textContent).toBe('Alpha');
  });

  it('Enter on a focused option selects it, dispatches change, and returns focus to the trigger', () => {
    const select = mount(OPTIONS, { value: 'a' });
    let received = null;
    select.addEventListener('change', () => { received = select.value; });
    fire(trigger(select), 'ArrowDown');
    const listbox = document.querySelector('.custom-select-listbox');
    fire(listbox, 'ArrowDown');
    fire(listbox, 'Enter');
    expect(received).toBe('b');
    expect(select.classList.contains('open')).toBe(false);
    expect(document.activeElement).toBe(trigger(select));
  });

  it('Escape closes the listbox without changing the value and returns focus to the trigger', () => {
    const select = mount(OPTIONS, { value: 'a' });
    let changeCount = 0;
    select.addEventListener('change', () => { changeCount++; });
    fire(trigger(select), 'ArrowDown');
    const listbox = document.querySelector('.custom-select-listbox');
    fire(listbox, 'ArrowDown');
    fire(listbox, 'Escape');
    expect(select.classList.contains('open')).toBe(false);
    expect(select.value).toBe('a');
    expect(changeCount).toBe(0);
    expect(document.activeElement).toBe(trigger(select));
  });

  it('type-ahead on the closed trigger jumps directly to the first matching option', () => {
    const select = mount(OPTIONS, { value: 'a' });
    let received = null;
    select.addEventListener('change', () => { received = select.value; });
    fire(trigger(select), 'c');
    expect(received).toBe('c');
    expect(select.value).toBe('c');
  });

  it('type-ahead inside the open listbox moves focus without selecting', () => {
    const select = mount(OPTIONS, { value: 'a' });
    fire(trigger(select), 'ArrowDown');
    const listbox = document.querySelector('.custom-select-listbox');
    fire(listbox, 'b');
    expect(document.activeElement.textContent).toBe('Bravo');
    expect(select.value).toBe('a');
  });
});

describe('createSelect — label association and ARIA', () => {
  it('the trigger carries combobox/listbox ARIA wiring', () => {
    const select = mount(OPTIONS);
    const btn = trigger(select);
    expect(btn.getAttribute('role')).toBe('combobox');
    expect(btn.getAttribute('aria-haspopup')).toBe('listbox');
    expect(btn.getAttribute('aria-expanded')).toBe('false');
    fire(btn, 'ArrowDown');
    expect(btn.getAttribute('aria-expanded')).toBe('true');
  });

  it('an explicit ariaLabel is applied to the trigger button', () => {
    const select = mount(OPTIONS, { ariaLabel: 'Priority' });
    expect(trigger(select).getAttribute('aria-label')).toBe('Priority');
  });

  it('a native <label> wrapping the trigger associates it by the implicit label rule (the trigger is a real <button>)', () => {
    const select = mount(OPTIONS, { ariaLabel: 'Priority' });
    const label = document.createElement('label');
    label.textContent = 'Priority';
    label.append(select);
    document.body.append(label);
    // jsdom resolves HTMLLabelElement.control for any labelable element
    // (button included) wrapped inside it, the same implicit-association
    // rule a native <select> relied on.
    expect(label.control).toBe(trigger(select));
  });

  it('only the selected option has aria-selected="true"', () => {
    const select = mount(OPTIONS, { value: 'b' });
    trigger(select).click();
    expect(options().map(o => o.getAttribute('aria-selected'))).toEqual(['false', 'true', 'false']);
  });
});

describe('createSelect — outside click and cleanup', () => {
  it('clicking outside the select closes it', () => {
    const select = mount(OPTIONS);
    trigger(select).click();
    expect(select.classList.contains('open')).toBe(true);
    document.body.click();
    expect(select.classList.contains('open')).toBe(false);
  });

  it('clicking inside the (body-level) listbox itself, not on an option, does not close it', () => {
    const select = mount(OPTIONS);
    trigger(select).click();
    document.querySelector('.custom-select-listbox').click();
    expect(select.classList.contains('open')).toBe(true);
  });

  it('_cleanup removes the document click listener and detaches the listbox', () => {
    const select = mount(OPTIONS);
    trigger(select).click();
    select._cleanup();
    expect(document.querySelector('.custom-select-listbox')).toBeNull();
  });

  it('.disabled proxies to the trigger button', () => {
    const select = mount(OPTIONS);
    select.disabled = true;
    expect(trigger(select).disabled).toBe(true);
  });
});
