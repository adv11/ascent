import { describe, it, expect } from 'vitest';
import { createTabs } from '../../src/ui/components/tabs.js';

function panel(text) {
  const p = document.createElement('div');
  p.textContent = text;
  return p;
}

function makeTabs(initialId) {
  return createTabs({
    items: [
      { id: 'one', label: 'One', panel: panel('Panel one') },
      { id: 'two', label: 'Two', panel: panel('Panel two') },
      { id: 'three', label: 'Three', panel: panel('Panel three') }
    ],
    initialId
  });
}

describe('createTabs', () => {
  it('renders one tab button and one tab-panel per item, first item active by default', () => {
    const wrap = makeTabs();
    const tabs = wrap.querySelectorAll('[role="tab"]');
    const panels = wrap.querySelectorAll('.tab-panel');
    expect(tabs).toHaveLength(3);
    expect(panels).toHaveLength(3);
    expect(tabs[0].getAttribute('aria-selected')).toBe('true');
    expect(panels[0].classList.contains('active')).toBe(true);
    expect(panels[1].classList.contains('active')).toBe(false);
  });

  it('respects an explicit initialId', () => {
    const wrap = makeTabs('two');
    const panels = wrap.querySelectorAll('.tab-panel');
    expect(panels[1].classList.contains('active')).toBe(true);
    expect(panels[0].classList.contains('active')).toBe(false);
  });

  it('clicking a tab activates its panel and updates aria-selected/tabindex', () => {
    const wrap = makeTabs();
    const tabs = wrap.querySelectorAll('[role="tab"]');
    tabs[2].click();

    expect(tabs[2].getAttribute('aria-selected')).toBe('true');
    expect(tabs[0].getAttribute('aria-selected')).toBe('false');
    expect(tabs[2].tabIndex).toBe(0);
    expect(tabs[0].tabIndex).toBe(-1);
    expect(wrap.querySelectorAll('.tab-panel')[2].classList.contains('active')).toBe(true);
  });

  it('ArrowRight/ArrowLeft cycle the active tab, wrapping at the ends', () => {
    const wrap = makeTabs();
    const tablist = wrap.querySelector('[role="tablist"]');
    const tabs = () => wrap.querySelectorAll('[role="tab"]');

    tablist.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }));
    expect(tabs()[1].getAttribute('aria-selected')).toBe('true');

    tablist.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowLeft', bubbles: true }));
    expect(tabs()[0].getAttribute('aria-selected')).toBe('true');

    tablist.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowLeft', bubbles: true }));
    expect(tabs()[2].getAttribute('aria-selected')).toBe('true');
  });

  it('Home/End jump to the first/last tab', () => {
    const wrap = makeTabs('two');
    const tablist = wrap.querySelector('[role="tablist"]');
    const tabs = () => wrap.querySelectorAll('[role="tab"]');

    tablist.dispatchEvent(new KeyboardEvent('keydown', { key: 'End', bubbles: true }));
    expect(tabs()[2].getAttribute('aria-selected')).toBe('true');

    tablist.dispatchEvent(new KeyboardEvent('keydown', { key: 'Home', bubbles: true }));
    expect(tabs()[0].getAttribute('aria-selected')).toBe('true');
  });

  it('each tab/panel pair is cross-referenced via aria-controls/aria-labelledby', () => {
    const wrap = makeTabs();
    const tab = wrap.querySelector('[role="tab"]');
    const panelEl = wrap.querySelector('.tab-panel');
    expect(tab.getAttribute('aria-controls')).toBe(panelEl.id);
    expect(panelEl.getAttribute('aria-labelledby')).toBe(tab.id);
  });
});
