import { el } from '../dom.js';

// Generic floating menu wrapping a trigger element — used by the topbar's
// user menu today, and meant to be reusable for any future "click to reveal
// a small list of actions" spot. Keyboard-navigable (Up/Down cycles items,
// Escape closes and returns focus to the trigger, click/focus outside closes)
// per issue #6 Phase 3's dropdown spec, built early in Phase 2 since the
// topbar user menu needs it now.
//
// items: [{ text, onClick, danger, icon?, badge? }] — `icon` is a createIcon()
// node (issue #507's account-menu design puts a glyph on every row), `badge`
// an already-built node (e.g. featureBadge.js's "New" pill) shown flush right.
// header: optional { title, subtitle } rendered above the item list (the
// design's email + "Signed in · synced" identity block) — purely
// presentational, never itself a menu item.
// Returns the wrapping node; caller must call node._cleanup() on teardown.
export function createDropdown(trigger, items, { align = 'end', header = null } = {}) {
  const menu = el('div', {
    className: `dropdown-menu dropdown-${align}`,
    role: 'menu'
  });
  if (header) {
    menu.append(el('div', { className: 'dropdown-header' }, [
      el('span', { className: 'dropdown-header-title', text: header.title }),
      header.subtitle ? el('span', { className: 'dropdown-header-subtitle', text: header.subtitle }) : null
    ].filter(Boolean)));
  }
  const itemEls = items.map(item => {
    const btn = el('button', {
      type: 'button',
      role: 'menuitem',
      className: `dropdown-item${item.danger ? ' dropdown-item-danger' : ''}`,
      onClick: () => {
        close();
        item.onClick?.();
      }
    }, [
      item.icon ? el('span', { className: 'dropdown-item-icon', 'aria-hidden': 'true' }, [item.icon]) : null,
      el('span', { className: 'dropdown-item-text', text: item.text }),
      item.badge ? el('span', { className: 'dropdown-item-badge' }, [item.badge]) : null
    ].filter(Boolean));
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
  // Dim backdrop shown behind the portaled menu while open — see
  // `.floating-scrim`'s comment in app.css (select.js's listbox has the
  // identical treatment for the same reported bug: a floating menu with no
  // "this is an overlay, not part of the page" visual cue reads as broken
  // layout when it covers content beneath it). Never gets its own click
  // handler — `onDocClick` below already treats a click outside `wrap`/`menu`
  // as "close", and the scrim is neither.
  const scrim = el('div', { className: 'floating-scrim dropdown-scrim' });
  let open = false;

  // `position: fixed` never moves on scroll — a `top`/`bottom` computed while
  // the trigger sits right at (or past) a viewport edge can permanently place
  // the menu off-screen with no scroll able to recover it, exactly the "stuck
  // below the fold" failure a trigger near the bottom edge hits when
  // `align: 'end'` opens the menu downward. Flip to the opposite side whenever
  // the menu's own measured height wouldn't fit in the space `positionMenu()`
  // originally picked — same "try the natural side, fall back if it doesn't
  // fit" idea `featureTour.js`'s `computePlacement()` uses for its popover,
  // just for the one axis this component actually needs (vertical, since
  // `align` already fixes which horizontal edge this menu hugs).
  function positionMenu() {
    const rect = trigger.getBoundingClientRect();
    const menuHeight = menu.offsetHeight;
    const fitsBelow = rect.bottom + 6 + menuHeight <= window.innerHeight;
    const fitsAbove = rect.top - 6 - menuHeight >= 0;
    const openUpward = !fitsBelow && (fitsAbove || rect.top > window.innerHeight - rect.bottom);
    if (align === 'start') {
      menu.style.left = `${rect.left}px`;
      menu.style.right = '';
    } else {
      menu.style.right = `${window.innerWidth - rect.right}px`;
      menu.style.left = '';
    }
    if (openUpward) {
      menu.style.bottom = `${window.innerHeight - rect.top + 6}px`;
      menu.style.top = '';
    } else {
      menu.style.top = `${rect.bottom + 6}px`;
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

  // Issue #486 follow-up — a real, reproduced bug, not just a test artifact:
  // clicking the trigger itself can be what *starts* the scroll (the browser
  // bringing an off-screen/partially-visible trigger into view before the
  // click lands — the exact case a long checklist row's overflow trigger
  // hits whenever it isn't already fully in the viewport), and because that
  // scroll is smooth (see the block comment above), it's still animating,
  // multiple frames past `openTriggerRect`'s snapshot, at the moment `open()`
  // runs. `onWindowScrollOrResize` then reads its own just-opened baseline
  // against a trigger that's still mid-flight from the very click that opened
  // it, sees well past `TRIGGER_MOVE_THRESHOLD_PX` of "movement" a few frames
  // later, and closes the menu it just opened — every single time the trigger
  // wasn't already fully in view before the click. `OPEN_SETTLE_MS` gives the
  // in-flight scroll-into-view a short window to finish: any movement inside
  // it re-baselines `openTriggerRect` to the trigger's current position
  // instead of closing, so once the settle window ends, "moved" once again
  // means a real, deliberate scroll by the user — never a false close from
  // the open action's own scroll still catching up.
  const OPEN_SETTLE_MS = 500;
  let openedAt = 0;

  function onWindowScrollOrResize() {
    if (!openTriggerRect) return;
    const rect = trigger.getBoundingClientRect();
    const moved = Math.abs(rect.top - openTriggerRect.top) > TRIGGER_MOVE_THRESHOLD_PX
      || Math.abs(rect.left - openTriggerRect.left) > TRIGGER_MOVE_THRESHOLD_PX;
    if (!moved) return;
    if (Date.now() - openedAt < OPEN_SETTLE_MS) {
      openTriggerRect = rect;
      positionMenu();
      return;
    }
    close();
  }

  function setOpen(next) {
    open = next;
    wrap.classList.toggle('open', open);
    menu.classList.toggle('open', open);
    trigger.setAttribute('aria-expanded', String(open));
    if (open) {
      document.body.appendChild(scrim);
      document.body.appendChild(menu);
      positionMenu();
      openTriggerRect = trigger.getBoundingClientRect();
      openedAt = Date.now();
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
      scrim.remove();
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
    if (scrim.isConnected) scrim.remove();
  };

  return wrap;
}
