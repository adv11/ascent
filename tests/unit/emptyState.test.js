import { describe, it, expect, vi } from 'vitest';
import { createEmptyState } from '../../src/ui/components/emptyState.js';

describe('createEmptyState', () => {
  it('renders icon, title, and message', () => {
    const node = createEmptyState({ icon: 'search', title: 'No results', message: 'Try a different search.' });
    expect(node.querySelector('.empty-icon svg')).not.toBeNull();
    expect(node.querySelector('.empty-title').textContent).toBe('No results');
    expect(node.querySelector('.empty-message').textContent).toBe('Try a different search.');
  });

  it('omits the message element when none is given', () => {
    const node = createEmptyState({ title: 'Nothing here' });
    expect(node.querySelector('.empty-message')).toBeNull();
  });

  it('renders an action button only when both actionText and onAction are given', () => {
    const onAction = vi.fn();
    const withAction = createEmptyState({ title: 'No filters', actionText: 'Clear filters', onAction });
    const btn = withAction.querySelector('button');
    expect(btn.textContent).toBe('Clear filters');
    btn.click();
    expect(onAction).toHaveBeenCalledTimes(1);

    const withoutAction = createEmptyState({ title: 'No filters', actionText: 'Clear filters' });
    expect(withoutAction.querySelector('button')).toBeNull();
  });

  it('defaults to the search icon', () => {
    const node = createEmptyState({ title: 'Nothing found' });
    expect(node.querySelector('.empty-icon svg')).not.toBeNull();
  });
});
