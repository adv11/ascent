import { el } from '../dom.js';

// Generic floating menu wrapping a trigger element — used by the topbar's
// user menu today, and meant to be reusable for any future "click to reveal
// a small list of actions" spot. Keyboard-navigable (Up/Down cycles items,
// Escape closes and returns focus to the trigger, click/focus outside closes)
// per issue #6 Phase 3's dropdown spec, built early in Phase 2 since the
// topbar user menu needs it now.
//
// items: [{ text, onClick, danger }]
// Returns the wrapping node; caller must call node._cleanup() on teardown.
export function createDropdown(trigger, items, { align = 'end' } = {}) {
  const menu = el('div', {
    className: `dropdown-menu dropdown-${align}`,
    role: 'menu'
  });
  const itemEls = items.map(item => {
    const btn = el('button', {
      type: 'button',
      role: 'menuitem',
      className: `dropdown-item${item.danger ? ' dropdown-item-danger' : ''}`,
      text: item.text,
      onClick: () => {
        close();
        item.onClick?.();
      }
    });
    menu.append(btn);
    return btn;
  });

  const wrap = el('div', { className: 'dropdown' }, [trigger, menu]);
  let open = false;

  function setOpen(next) {
    open = next;
    wrap.classList.toggle('open', open);
    trigger.setAttribute('aria-expanded', String(open));
    if (open) itemEls[0]?.focus();
  }

  function close() {
    if (!open) return;
    setOpen(false);
    trigger.focus();
  }

  function toggle() {
    setOpen(!open);
  }

  function onDocClick(e) {
    if (!wrap.contains(e.target)) close();
  }

  function onKeydown(e) {
    if (!open) return;
    const idx = itemEls.indexOf(document.activeElement);
    if (e.key === 'Escape') {
      e.preventDefault();
      close();
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      itemEls[(idx + 1 + itemEls.length) % itemEls.length]?.focus();
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      itemEls[(idx - 1 + itemEls.length) % itemEls.length]?.focus();
    }
  }

  trigger.setAttribute('aria-haspopup', 'true');
  trigger.setAttribute('aria-expanded', 'false');
  trigger.addEventListener('click', toggle);
  document.addEventListener('click', onDocClick);
  wrap.addEventListener('keydown', onKeydown);

  wrap._cleanup = () => {
    document.removeEventListener('click', onDocClick);
  };

  return wrap;
}
