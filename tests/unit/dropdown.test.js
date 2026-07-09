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

describe('createDropdown', () => {
  it('renders one .dropdown-item per item, closed by default', () => {
    const wrap = createDropdown(trigger(), [{ text: 'One', onClick: () => {} }, { text: 'Two', onClick: () => {} }]);
    document.body.append(wrap);
    expect(wrap.classList.contains('open')).toBe(false);
    expect(wrap.querySelectorAll('.dropdown-item')).toHaveLength(2);
  });

  it('opens on trigger click and sets aria-expanded', () => {
    const t = trigger();
    const wrap = createDropdown(t, [{ text: 'One', onClick: () => {} }]);
    document.body.append(wrap);

    t.click();
    expect(wrap.classList.contains('open')).toBe(true);
    expect(t.getAttribute('aria-expanded')).toBe('true');
  });

  it('closes and calls the item handler when a dropdown item is clicked', () => {
    const onClick = vi.fn();
    const t = trigger();
    const wrap = createDropdown(t, [{ text: 'Delete', onClick, danger: true }]);
    document.body.append(wrap);

    t.click();
    wrap.querySelector('.dropdown-item').click();

    expect(onClick).toHaveBeenCalledTimes(1);
    expect(wrap.classList.contains('open')).toBe(false);
  });

  it('applies the dropdown-item-danger class only for danger items', () => {
    const t = trigger();
    const wrap = createDropdown(t, [
      { text: 'Safe', onClick: () => {} },
      { text: 'Danger', onClick: () => {}, danger: true }
    ]);
    document.body.append(wrap);
    const items = wrap.querySelectorAll('.dropdown-item');
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

  it('closes on Escape', () => {
    const t = trigger();
    const wrap = createDropdown(t, [{ text: 'One', onClick: () => {} }]);
    document.body.append(wrap);

    t.click();
    wrap.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    expect(wrap.classList.contains('open')).toBe(false);
  });

  it('_cleanup removes the document-level click listener', () => {
    const removeSpy = vi.spyOn(document, 'removeEventListener');
    const wrap = createDropdown(trigger(), [{ text: 'One', onClick: () => {} }]);
    wrap._cleanup();
    expect(removeSpy).toHaveBeenCalledWith('click', expect.any(Function));
    removeSpy.mockRestore();
  });
});
