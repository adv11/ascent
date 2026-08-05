import { describe, it, expect } from 'vitest';
import { priorityLabel, PRIORITY_LABELS } from '../../src/ui/utils/priorityLabels.js';

describe('priorityLabel (issue #485)', () => {
  it('maps every stored priority code to a plain-language label', () => {
    expect(priorityLabel('P0')).toBe('Must do');
    expect(priorityLabel('P1')).toBe('Should do');
    expect(priorityLabel('P2')).toBe('Later');
    expect(priorityLabel('P3')).toBe('Later');
  });

  it('falls back to the raw code for an unrecognized value', () => {
    expect(priorityLabel('ALL')).toBe('ALL');
  });

  it('never renders a bare P0-P3 code as one of its own label values', () => {
    Object.values(PRIORITY_LABELS).forEach(label => {
      expect(label).not.toMatch(/^P[0-3]$/);
    });
  });
});
