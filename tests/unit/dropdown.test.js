import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createDropdown } from '../../src/ui/components/dropdown.js';

function trigger() {
  const btn = document.createElement('button');
  btn.textContent = 'Menu';
  return btn;
}

beforeEach(() => {
  document.body.innerHTML = '';
});

// `.dropdown-menu` is portaled to a direct `document.body` child on open
// and removed on close (issue #121 follow-up — see the comment above
// `wrap`'s declaration in dropdown.js) so it can never be visually
// misplaced or paint behind/above unrelated content depending on an
// ancestor's stacking context, mirroring select.js's identical fix for its
// listbox. Its `.dropdown-item`s are therefore only present in the document
// while open, not always-in-DOM-but-hidden — query `document`, not `wrap`,
// and only after opening (same convention as select.test.js's
// `.custom-select-option` queries).
describe('createDropdown', () => {
  it('renders no .dropdown-item anywhere in the document while closed, then one per item once opened', () => {
    const t = trigger();
    const wrap = createDropdown(t, [{ text: 'One', onClick: () => {} }, { text: 'Two', onClick: () => {} }]);
    document.body.append(wrap);
    expect(wrap.classList.contains('open')).toBe(false);
    expect(document.querySelectorAll('.dropdown-item')).toHaveLength(0);

    t.click();
    expect(document.querySelectorAll('.dropdown-item')).toHaveLength(2);
  });

  it('opens on trigger click, sets aria-expanded, and appends the menu to document.body', () => {
    const t = trigger();
    const wrap = createDropdown(t, [{ text: 'One', onClick: () => {} }]);
    document.body.append(wrap);

    t.click();
    expect(wrap.classList.contains('open')).toBe(true);
    expect(t.getAttribute('aria-expanded')).toBe('true');
    const menu = document.querySelector('.dropdown-menu');
    expect(menu).not.toBeNull();
    expect(menu.parentElement).toBe(document.body);
    expect(wrap.contains(menu)).toBe(false);
  });

  it('closes and calls the item handler when a dropdown item is clicked', () => {
    const onClick = vi.fn();
    const t = trigger();
    const wrap = createDropdown(t, [{ text: 'Delete', onClick, danger: true }]);
    document.body.append(wrap);

    t.click();
    document.querySelector('.dropdown-item').click();

    expect(onClick).toHaveBeenCalledTimes(1);
    expect(wrap.classList.contains('open')).toBe(false);
    expect(document.querySelector('.dropdown-menu')).toBeNull();
  });

  it('applies the dropdown-item-danger class only for danger items', () => {
    const t = trigger();
    const wrap = createDropdown(t, [
      { text: 'Safe', onClick: () => {} },
      { text: 'Danger', onClick: () => {}, danger: true }
    ]);
    document.body.append(wrap);
    t.click();
    const items = document.querySelectorAll('.dropdown-item');
    expect(items[0].classList.contains('dropdown-item-danger')).toBe(false);
    expect(items[1].classList.contains('dropdown-item-danger')).toBe(true);
  });

  it('closes on outside click', () => {
    const t = trigger();
    const wrap = createDropdown(t, [{ text: 'One', onClick: () => {} }]);
    document.body.append(wrap);

    t.click();
    expect(wrap.classList.contains('open')).toBe(true);

    document.body.click();
    expect(wrap.classList.contains('open')).toBe(false);
  });

  it('does not close on a click inside the (portaled) menu itself', () => {
    const t = trigger();
    const wrap = createDropdown(t, [{ text: 'One', onClick: () => {} }]);
    document.body.append(wrap);

    t.click();
    document.querySelector('.dropdown-menu').dispatchEvent(new MouseEvent('click', { bubbles: true }));
    expect(wrap.classList.contains('open')).toBe(true);
  });

  it('closes on Escape pressed while the trigger or a menu item is focused', () => {
    const t = trigger();
    const wrap = createDropdown(t, [{ text: 'One', onClick: () => {} }]);
    document.body.append(wrap);

    t.click();
    document.querySelector('.dropdown-item').dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    expect(wrap.classList.contains('open')).toBe(false);
  });

  it('_cleanup removes the document-level click listener and any still-open portaled menu', () => {
    const removeSpy = vi.spyOn(document, 'removeEventListener');
    const t = trigger();
    const wrap = createDropdown(t, [{ text: 'One', onClick: () => {} }]);
    document.body.append(wrap);
    t.click();
    expect(document.querySelector('.dropdown-menu')).not.toBeNull();

    wrap._cleanup();
    expect(removeSpy).toHaveBeenCalledWith('click', expect.any(Function));
    expect(document.querySelector('.dropdown-menu')).toBeNull();
    removeSpy.mockRestore();
  });
});
