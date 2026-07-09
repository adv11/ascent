import { describe, it, expect } from 'vitest';
import { createSkeletonText, createSkeletonCard } from '../../src/ui/components/skeleton.js';

describe('skeleton', () => {
  it('createSkeletonText renders an aria-hidden skeleton-text placeholder', () => {
    const node = createSkeletonText();
    expect(node.className).toBe('skeleton skeleton-text');
    expect(node.getAttribute('aria-hidden')).toBe('true');
  });

  it('createSkeletonCard renders an aria-hidden skeleton-card placeholder', () => {
    const node = createSkeletonCard();
    expect(node.className).toBe('skeleton skeleton-card');
    expect(node.getAttribute('aria-hidden')).toBe('true');
  });
});
