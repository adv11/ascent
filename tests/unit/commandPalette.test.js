import { describe, it, expect, vi, beforeEach } from 'vitest';
import { fuzzyMatch, openCommandPalette, bindCommandPaletteShortcut } from '../../src/ui/components/commandPalette.js';

beforeEach(() => {
  document.body.innerHTML = '';
});

describe('fuzzyMatch', () => {
  it('matches when the query is empty', () => {
    expect(fuzzyMatch('', 'anything').matched).toBe(true);
  });

  it('matches a subsequence in order, case-insensitively', () => {
    expect(fuzzyMatch('oop', 'OOP Fundamentals').matched).toBe(true);
    expect(fuzzyMatch('ofn', 'OOP Fundamentals').matched).toBe(true);
  });

  it('does not match out-of-order or missing characters', () => {
    expect(fuzzyMatch('pof', 'OOP Fundamentals').matched).toBe(false);
    expect(fuzzyMatch('xyz', 'OOP Fundamentals').matched).toBe(false);
  });

  it('scores a tighter match higher than a spread-out one', () => {
    const tight = fuzzyMatch('core', 'Core Java');
    const spread = fuzzyMatch('core', 'C is o.k. for e-mail'); // c...o...r...e spread far apart
    expect(tight.matched).toBe(true);
    expect(spread.matched).toBe(true);
    expect(tight.score).toBeGreaterThan(spread.score);
  });
});

function makeItems() {
  return [
    { id: 'a', title: 'OOP', subtitle: 'Core Java', onSelect: vi.fn() },
    { id: 'b', title: 'Generics', subtitle: 'Core Java', onSelect: vi.fn() },
    { id: 'c', title: 'System Design', subtitle: 'Advanced', onSelect: vi.fn() }
  ];
}

describe('openCommandPalette', () => {
  it('renders one .command-palette-item per item and focuses the search input', () => {
    const items = makeItems();
    openCommandPalette(items);

    expect(document.querySelectorAll('.command-palette-item')).toHaveLength(3);
    expect(document.activeElement.className).toBe('command-palette-input');
  });

  it('filters the list as you type, keeping only fuzzy matches', () => {
    const items = makeItems();
    openCommandPalette(items);
    const input = document.querySelector('.command-palette-input');

    input.value = 'sys';
    input.dispatchEvent(new Event('input'));

    const titles = [...document.querySelectorAll('.command-palette-item-title')].map(el => el.textContent);
    expect(titles).toEqual(['System Design']);
  });

  it('Enter selects the active item, calls its onSelect, and closes the palette', () => {
    const items = makeItems();
    openCommandPalette(items);
    const input = document.querySelector('.command-palette-input');

    input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter' }));

    expect(items[0].onSelect).toHaveBeenCalledTimes(1);
    expect(document.querySelector('.modal-overlay')).toBeNull();
  });

  it('ArrowDown/ArrowUp move the active selection', () => {
    const items = makeItems();
    openCommandPalette(items);
    const input = document.querySelector('.command-palette-input');

    input.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown' }));
    input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter' }));

    expect(items[1].onSelect).toHaveBeenCalledTimes(1);
    expect(items[0].onSelect).not.toHaveBeenCalled();
  });

  it('clicking an item selects it', () => {
    const items = makeItems();
    openCommandPalette(items);

    document.querySelectorAll('.command-palette-item')[2].click();

    expect(items[2].onSelect).toHaveBeenCalledTimes(1);
  });
});

describe('openCommandPalette — crossRoadmapSearch (issue #283)', () => {
  it('does not call search() below minQueryLength, and renders no Topics group', async () => {
    const search = vi.fn().mockResolvedValue([]);
    openCommandPalette(makeItems(), { crossRoadmapSearch: { minQueryLength: 2, search } });
    const input = document.querySelector('.command-palette-input');

    input.value = 'a';
    input.dispatchEvent(new Event('input'));
    await Promise.resolve();

    expect(search).not.toHaveBeenCalled();
    expect(document.querySelectorAll('.command-palette-group-label')).toHaveLength(0);
  });

  it('renders topic results in a labeled group once the query reaches minQueryLength', async () => {
    const onSelect = vi.fn();
    const search = vi.fn().mockResolvedValue([
      { id: 'topic-1', title: 'Spring Boot Basics', subtitle: 'Java Backend Engineer · Core Java', onSelect }
    ]);
    openCommandPalette([], { crossRoadmapSearch: { minQueryLength: 2, search } });
    const input = document.querySelector('.command-palette-input');

    input.value = 'spring';
    input.dispatchEvent(new Event('input'));
    await Promise.resolve();
    await Promise.resolve();

    expect(search).toHaveBeenCalledWith('spring');
    const labels = [...document.querySelectorAll('.command-palette-group-label')].map(el => el.textContent);
    expect(labels).toContain('Topics');
    const titles = [...document.querySelectorAll('.command-palette-item-title')].map(el => el.textContent);
    expect(titles).toEqual(['Spring Boot Basics']);
  });

  it('selecting a topic result calls its own onSelect and closes the palette', async () => {
    const onSelect = vi.fn();
    const search = vi.fn().mockResolvedValue([
      { id: 'topic-1', title: 'Spring Boot Basics', subtitle: 'Java Backend Engineer · Core Java', onSelect }
    ]);
    openCommandPalette([], { crossRoadmapSearch: { minQueryLength: 2, search } });
    const input = document.querySelector('.command-palette-input');

    input.value = 'spring';
    input.dispatchEvent(new Event('input'));
    await Promise.resolve();
    await Promise.resolve();

    document.querySelector('.command-palette-item').click();

    expect(onSelect).toHaveBeenCalledTimes(1);
    expect(document.querySelector('.modal-overlay')).toBeNull();
  });

  it('an older, slower search() resolving after a newer keystroke is ignored', async () => {
    let resolveFirst;
    const firstPromise = new Promise(resolve => { resolveFirst = resolve; });
    const search = vi.fn()
      .mockReturnValueOnce(firstPromise)
      .mockResolvedValueOnce([{ id: 'topic-2', title: 'Second Query Result', subtitle: '', onSelect: vi.fn() }]);
    openCommandPalette([], { crossRoadmapSearch: { minQueryLength: 2, search } });
    const input = document.querySelector('.command-palette-input');

    input.value = 'first';
    input.dispatchEvent(new Event('input'));
    input.value = 'second';
    input.dispatchEvent(new Event('input'));
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();

    // The stale first call resolves last — it must not clobber the newer result.
    resolveFirst([{ id: 'topic-1', title: 'Stale First Query Result', subtitle: '', onSelect: vi.fn() }]);
    await Promise.resolve();
    await Promise.resolve();

    const titles = [...document.querySelectorAll('.command-palette-item-title')].map(el => el.textContent);
    expect(titles).toEqual(['Second Query Result']);
  });
});

describe('bindCommandPaletteShortcut', () => {
  it('calls onOpen for Cmd+K / Ctrl+K and not for a plain "k"', () => {
    const onOpen = vi.fn();
    const unbind = bindCommandPaletteShortcut(onOpen);

    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'k', metaKey: true }));
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'k', ctrlKey: true }));
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'k' }));

    expect(onOpen).toHaveBeenCalledTimes(2);
    unbind();
  });

  it('unbind stops future calls', () => {
    const onOpen = vi.fn();
    const unbind = bindCommandPaletteShortcut(onOpen);
    unbind();

    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'k', metaKey: true }));
    expect(onOpen).not.toHaveBeenCalled();
  });
});
