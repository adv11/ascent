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

  // `menu` is NOT nested inside `wrap` — it's appended straight to
  // `document.body` on open and removed on close (a portal, same pattern as
  // `select.js`'s listbox). `.dropdown-menu` is `position: fixed`, but a
  // `position: fixed` element positions itself — and stacks (z-index)
  // — relative to the nearest ancestor with a `transform`/`filter`/etc.
  // (or that establishes its own stacking context), not the viewport/root,
  // if one exists between it and the root
  // (`.claude/rules/ui-styling.md`'s "overflow value that isn't visible..."
  // and transformed-ancestor rules). This component was previously assumed
  // to always live in a "known-safe" chrome location (topbar/sidebar) and
  // left un-portaled — but the sidebar's own avatar menu is nested inside
  // `.app-shell-2`/animated dashboard content, which real use showed
  // intermittently renders the menu above or *below* other page content
  // depending on which sibling stacking contexts exist at open time (issue
  // #121 follow-up, reported live with a screenshot). Portaling sidesteps
  // the whole bug class regardless of which container a future trigger is
  // nested inside, exactly like `select.js`'s fix for the identical
  // underlying issue.
  const wrap = el('div', { className: 'dropdown' }, [trigger]);
  let open = false;

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
    wrap.classList.toggle('open', open);
    menu.classList.toggle('open', open);
    trigger.setAttribute('aria-expanded', String(open));
    if (open) {
      document.body.appendChild(menu);
      positionMenu();
      itemEls[0]?.focus();
    } else if (menu.isConnected) {
      menu.remove();
    }
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
    if (!wrap.contains(e.target) && !menu.contains(e.target)) close();
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
  // `menu` is portaled out of `wrap` (see the comment above `wrap`'s
  // declaration) — a single `wrap`-level keydown listener would never see
  // events from a focused item once it's a body-level sibling, not a
  // descendant, of `wrap`. Attach to both explicitly, same split
  // `select.js` uses for its trigger/listbox.
  trigger.addEventListener('keydown', onKeydown);
  menu.addEventListener('keydown', onKeydown);

  wrap._cleanup = () => {
    document.removeEventListener('click', onDocClick);
    if (menu.isConnected) menu.remove();
  };

  return wrap;
}
