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

  // `.dropdown-menu` is `position: fixed` (see app.css comment) so it can
  // escape a clipping ancestor like `.app-sidebar` — but fixed positioning
  // ignores `.dropdown`'s own offset entirely, so the menu's screen position
  // has to be computed from the trigger's real geometry every time it opens,
  // not left to a static CSS rule.
  function positionMenu() {
    const rect = trigger.getBoundingClientRect();
    if (align === 'start') {
      menu.style.left = `${rect.left}px`;
      menu.style.bottom = `${window.innerHeight - rect.top + 6}px`;
      menu.style.top = '';
      menu.style.right = '';
    } else {
      menu.style.right = `${window.innerWidth - rect.right}px`;
      menu.style.top = `${rect.bottom + 6}px`;
      menu.style.left = '';
      menu.style.bottom = '';
    }
  }

  function setOpen(next) {
    open = next;
    if (open) positionMenu();
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
