import { describe, it, expect, beforeEach } from 'vitest';
import {
  hasShownRoadmapCelebration,
  hasShownPhaseCelebration,
  markRoadmapCelebrationShown,
  markPhaseCelebrationShown
} from '../../src/services/celebrationShownStore.js';
import { celebrationShownKey } from '../../src/services/localStorageKeys.js';

const uid = 'user-1';
const templateId = 'java-backend';

beforeEach(() => {
  localStorage.clear();
});

describe('celebrationShownStore — missing/malformed localStorage', () => {
  it('hasShownRoadmapCelebration is false when no entry exists', () => {
    expect(hasShownRoadmapCelebration(uid, templateId)).toBe(false);
  });

  it('hasShownPhaseCelebration is false when no entry exists', () => {
    expect(hasShownPhaseCelebration(uid, templateId, 'Phase 1')).toBe(false);
  });

  it('both getters are false against malformed/corrupt JSON, not a thrown error', () => {
    localStorage.setItem(celebrationShownKey(uid), '{not valid json');
    expect(hasShownRoadmapCelebration(uid, templateId)).toBe(false);
    expect(hasShownPhaseCelebration(uid, templateId, 'Phase 1')).toBe(false);
  });

  it('hasShownPhaseCelebration is false when the entry exists but has no phases array', () => {
    localStorage.setItem(celebrationShownKey(uid), JSON.stringify({ [templateId]: { roadmap: true } }));
    expect(hasShownPhaseCelebration(uid, templateId, 'Phase 1')).toBe(false);
  });
});

describe('celebrationShownStore — markRoadmapCelebrationShown', () => {
  it('marks the roadmap celebration shown for the given template only', () => {
    markRoadmapCelebrationShown(uid, templateId);
    expect(hasShownRoadmapCelebration(uid, templateId)).toBe(true);
    expect(hasShownRoadmapCelebration(uid, 'other-template')).toBe(false);
  });

  it('does not clobber an existing phases entry for the same template', () => {
    markPhaseCelebrationShown(uid, templateId, 'Phase 1');
    markRoadmapCelebrationShown(uid, templateId);
    expect(hasShownRoadmapCelebration(uid, templateId)).toBe(true);
    expect(hasShownPhaseCelebration(uid, templateId, 'Phase 1')).toBe(true);
  });
});

describe('celebrationShownStore — markPhaseCelebrationShown dedup', () => {
  it('marks a phase celebration shown', () => {
    markPhaseCelebrationShown(uid, templateId, 'Phase 1');
    expect(hasShownPhaseCelebration(uid, templateId, 'Phase 1')).toBe(true);
  });

  it('calling it twice for the same phase does not duplicate the entry', () => {
    markPhaseCelebrationShown(uid, templateId, 'Phase 1');
    markPhaseCelebrationShown(uid, templateId, 'Phase 1');
    const raw = JSON.parse(localStorage.getItem(celebrationShownKey(uid)));
    expect(raw[templateId].phases).toEqual(['Phase 1']);
  });

  it('tracks multiple distinct phases for the same template', () => {
    markPhaseCelebrationShown(uid, templateId, 'Phase 1');
    markPhaseCelebrationShown(uid, templateId, 'Phase 2');
    expect(hasShownPhaseCelebration(uid, templateId, 'Phase 1')).toBe(true);
    expect(hasShownPhaseCelebration(uid, templateId, 'Phase 2')).toBe(true);
    expect(hasShownPhaseCelebration(uid, templateId, 'Phase 3')).toBe(false);
  });

  it('keeps different uids/templates independent', () => {
    markPhaseCelebrationShown(uid, templateId, 'Phase 1');
    expect(hasShownPhaseCelebration('other-user', templateId, 'Phase 1')).toBe(false);
    expect(hasShownPhaseCelebration(uid, 'other-template', 'Phase 1')).toBe(false);
  });
});
