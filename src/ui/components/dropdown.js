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

  // Positioned once, at open time, from the trigger's `getBoundingClientRect()`
  // — but `position: fixed` doesn't track page scroll like normal-flow
  // content does. Without this, scrolling the page while the menu is open
  // left it visually stuck at its original screen coordinates while the
  // trigger scrolled out from under it (the identical bug `select.js`'s
  // listbox had, same fix applied here — see that file's own comment for the
  // full writeup, including why "close on any scroll event" was tried first
  // and rejected: this app's global `html { scroll-behavior: smooth }`
  // turns an unrelated modal-open focus elsewhere on the page into a real,
  // multi-hundred-millisecond stream of genuine `scroll` events, which an
  // any-scroll-closes listener misreads as the user scrolling this menu
  // away). `TRIGGER_MOVE_THRESHOLD_PX` closes only once the trigger has
  // actually moved a meaningful amount, absorbing that unrelated jitter
  // while still closing promptly on a real, deliberate page scroll.
  const TRIGGER_MOVE_THRESHOLD_PX = 4;
  let openTriggerRect = null;

  function onWindowScrollOrResize() {
    if (!openTriggerRect) return;
    const rect = trigger.getBoundingClientRect();
    const moved = Math.abs(rect.top - openTriggerRect.top) > TRIGGER_MOVE_THRESHOLD_PX
      || Math.abs(rect.left - openTriggerRect.left) > TRIGGER_MOVE_THRESHOLD_PX;
    if (moved) close();
  }

  function setOpen(next) {
    open = next;
    wrap.classList.toggle('open', open);
    menu.classList.toggle('open', open);
    trigger.setAttribute('aria-expanded', String(open));
    if (open) {
      document.body.appendChild(menu);
      positionMenu();
      openTriggerRect = trigger.getBoundingClientRect();
      // `{ preventScroll: true }` — without it, focusing an item the browser
      // considers off-screen kicks off its own smooth-scroll, on top of
      // whatever else is already happening on the page. Doesn't fully solve
      // the problem on its own (see the block comment above), but still
      // worth keeping so this component never *adds* to the noise.
      itemEls[0]?.focus({ preventScroll: true });
      document.addEventListener('scroll', onWindowScrollOrResize, true);
      window.addEventListener('resize', onWindowScrollOrResize);
    } else if (menu.isConnected) {
      openTriggerRect = null;
      menu.remove();
      document.removeEventListener('scroll', onWindowScrollOrResize, true);
      window.removeEventListener('resize', onWindowScrollOrResize);
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

  // `preventScroll` on both arrow-key focus moves below, same reason as
  // `setOpen()`'s own — either can move focus to an item the browser
  // considers off-screen while the scroll-close listener is active.
  function onKeydown(e) {
    if (!open) return;
    const idx = itemEls.indexOf(document.activeElement);
    if (e.key === 'Escape') {
      e.preventDefault();
      close();
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      itemEls[(idx + 1 + itemEls.length) % itemEls.length]?.focus({ preventScroll: true });
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      itemEls[(idx - 1 + itemEls.length) % itemEls.length]?.focus({ preventScroll: true });
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
    document.removeEventListener('scroll', onWindowScrollOrResize, true);
    window.removeEventListener('resize', onWindowScrollOrResize);
    if (menu.isConnected) menu.remove();
  };

  return wrap;
}
