import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  STALE,
  freshStateForNewUid,
  readOnboardingLocalFallback,
  resolveMetaExtras,
  resolveOnboardingState,
  migrateLegacyBlankTemplateIfNeeded,
  determineOnboardingAndActiveRoadmap
} from '../../src/services/roadmapStore.js';
import { KEYS } from '../../src/services/localStorageKeys.js';

vi.mock('../../src/services/storage/adapterFactory.js', () => ({
  getStorageAdapter: vi.fn(() => ({}))
}));

// Issue #129 — unit coverage for the setUser()/switchRoadmap() onboarding-
// detection phases extracted out of roadmapStore.js's setUser (previously
// complexity 56, uncallable in isolation). Each helper here is exercised
// directly per the documented account shapes rather than only indirectly
// through setUser(), which tests/integration/roadmapStore.test.js already
// covers unchanged.

function makeAdapter(overrides = {}) {
  return {
    getLegacyRoadmap: vi.fn(() => Promise.resolve(null)),
    getRoadmap: vi.fn(() => Promise.resolve(null)),
    saveRoadmap: vi.fn(() => Promise.resolve()),
    saveMeta: vi.fn(() => Promise.resolve()),
    now: vi.fn(() => 123),
    ...overrides
  };
}

const notStale = () => false;

beforeEach(() => {
  localStorage.clear();
});

describe('freshStateForNewUid', () => {
  it('returns a fully-reset, seed-based state with no stale references to a prior user', () => {
    const fresh = freshStateForNewUid();
    expect(fresh.activeTemplateId).toBe('java-backend');
    expect(fresh.onboardingDone).toBeNull();
    expect(fresh.startedTemplateIds).toEqual([]);
    expect(fresh.customRoadmaps).toEqual([]);
    expect(fresh.hiddenTemplateIds).toEqual([]);
    expect(fresh.roadmapCache).toEqual({});
    expect(fresh.pendingCustomSeeds).toEqual({});
    expect(fresh.dirty).toBe(false);
    expect(fresh.recentFlushedStrs).toEqual([]);
    expect(Object.keys(fresh.items).length).toBeGreaterThan(0);
  });
});

describe('readOnboardingLocalFallback', () => {
  it('reads every local signal setUser needs before the remote meta fetch', () => {
    localStorage.setItem(KEYS.ROADMAPS, JSON.stringify({ 'java-backend': { items: { a: {} } }, 'frontend': { items: {} } }));
    localStorage.setItem(KEYS.ONBOARDING_DONE, 'true');
    localStorage.setItem(KEYS.TEMPLATE_ID, 'frontend');

    const fallback = readOnboardingLocalFallback();
    expect(fallback.localOnboardingDone).toBe(true);
    expect(fallback.localActiveTemplateId).toBe('frontend');
    expect(fallback.localStartedTemplateIds.sort()).toEqual(['frontend', 'java-backend']);
  });

  it('defaults to a not-onboarded, no-templates-started shape when nothing is local', () => {
    const fallback = readOnboardingLocalFallback();
    expect(fallback.localOnboardingDone).toBe(false);
    expect(fallback.localActiveTemplateId).toBeNull();
    expect(fallback.localStartedTemplateIds).toEqual([]);
  });
});

describe('resolveMetaExtras', () => {
  it('prefers remote hiddenTemplateIds/customRoadmaps when present', () => {
    const extras = resolveMetaExtras({ hiddenTemplateIds: ['piano'], customRoadmaps: [{ id: 'croadmap-1' }] });
    expect(extras.hiddenTemplateIds).toEqual(['piano']);
    expect(extras.customRoadmaps).toEqual([{ id: 'croadmap-1' }]);
  });

  it('falls back to local storage when remote meta has neither field', () => {
    localStorage.setItem(KEYS.HIDDEN_TEMPLATES, JSON.stringify(['marketing']));
    localStorage.setItem(KEYS.CUSTOM_ROADMAPS, JSON.stringify([{ id: 'croadmap-2' }]));
    const extras = resolveMetaExtras(null);
    expect(extras.hiddenTemplateIds).toEqual(['marketing']);
    expect(extras.customRoadmaps).toEqual([{ id: 'croadmap-2' }]);
  });
});

describe('resolveOnboardingState', () => {
  it('post-#58 account: trusts remoteMeta.startedTemplateIds with no legacy check', async () => {
    const adapter = makeAdapter();
    const result = await resolveOnboardingState({
      uid: 'u1',
      adapter,
      remoteMeta: { startedTemplateIds: ['java-backend', 'frontend'], activeTemplateId: 'frontend' },
      localFallback: readOnboardingLocalFallback(),
      isStale: notStale
    });
    expect(result).toEqual({
      onboardingDone: true,
      activeTemplateId: 'frontend',
      startedTemplateIds: ['java-backend', 'frontend'],
      migratedLegacyItems: null
    });
    expect(adapter.getLegacyRoadmap).not.toHaveBeenCalled();
  });

  it('pre-#58-legacy-onboarded account: migrates the legacy roadmap forward and backfills meta', async () => {
    const adapter = makeAdapter({
      getLegacyRoadmap: vi.fn(() => Promise.resolve({ items: { a: { done: true } } }))
    });
    const result = await resolveOnboardingState({
      uid: 'u2',
      adapter,
      remoteMeta: { onboardingDone: true, templateId: 'java-backend' },
      localFallback: readOnboardingLocalFallback(),
      isStale: notStale
    });
    expect(result.onboardingDone).toBe(true);
    expect(result.activeTemplateId).toBe('java-backend');
    expect(result.startedTemplateIds).toEqual(['java-backend']);
    expect(result.migratedLegacyItems).toEqual({ a: { done: true } });
    expect(adapter.saveRoadmap).toHaveBeenCalledWith('u2', 'java-backend', expect.objectContaining({ templateId: 'java-backend' }));
    expect(adapter.saveMeta).toHaveBeenCalledWith('u2', expect.objectContaining({ onboardingDone: true }));
  });

  it('pre-#51-identity account: real progress in the local blob alone is enough to count as onboarded', async () => {
    const adapter = makeAdapter();
    localStorage.setItem(KEYS.ROADMAPS, JSON.stringify({ 'java-backend': { items: { a: { done: true } } } }));
    const result = await resolveOnboardingState({
      uid: 'u3',
      adapter,
      remoteMeta: null,
      localFallback: readOnboardingLocalFallback(),
      isStale: notStale
    });
    expect(result.onboardingDone).toBe(true);
    expect(result.activeTemplateId).toBe('java-backend');
  });

  it('brand-new account: no remote or local signal at all resolves to not onboarded', async () => {
    const adapter = makeAdapter();
    const result = await resolveOnboardingState({
      uid: 'u4',
      adapter,
      remoteMeta: null,
      localFallback: readOnboardingLocalFallback(),
      isStale: notStale
    });
    expect(result).toEqual({ onboardingDone: false, activeTemplateId: null, startedTemplateIds: [], migratedLegacyItems: null });
    expect(adapter.saveMeta).not.toHaveBeenCalled();
  });

  it('returns STALE and never touches the adapter again once a newer call has taken over', async () => {
    const adapter = makeAdapter();
    const result = await resolveOnboardingState({
      uid: 'u5',
      adapter,
      remoteMeta: null,
      localFallback: readOnboardingLocalFallback(),
      isStale: () => true
    });
    expect(result).toBe(STALE);
    expect(adapter.saveMeta).not.toHaveBeenCalled();
  });
});

describe('migrateLegacyBlankTemplateIfNeeded', () => {
  it('is a no-op when neither activeTemplateId nor startedTemplateIds reference "blank"', async () => {
    const adapter = makeAdapter();
    const result = await migrateLegacyBlankTemplateIfNeeded({
      uid: 'u1', adapter, activeTemplateId: 'java-backend', startedTemplateIds: ['java-backend'], customRoadmaps: [], isStale: notStale
    });
    expect(result).toBeNull();
    expect(adapter.getRoadmap).not.toHaveBeenCalled();
  });

  it('migrates a started "blank" template into a new custom roadmap, preserving its content', async () => {
    const adapter = makeAdapter({
      getRoadmap: vi.fn(() => Promise.resolve({ items: { x: { done: true } }, phases: ['Learn'] }))
    });
    const result = await migrateLegacyBlankTemplateIfNeeded({
      uid: 'u1', adapter, activeTemplateId: 'blank', startedTemplateIds: ['blank'], customRoadmaps: [], isStale: notStale
    });
    expect(result).not.toBeNull();
    expect(result.activeTemplateId).toBe(result.migratedId);
    expect(result.startedTemplateIds).toEqual([result.migratedId]);
    expect(result.migratedItems).toEqual({ x: { done: true } });
    expect(result.migratedPhases).toEqual(['Learn']);
    expect(result.customRoadmaps).toEqual([expect.objectContaining({ id: result.migratedId, title: 'My roadmap' })]);
    expect(adapter.saveRoadmap).toHaveBeenCalled();
    expect(adapter.saveMeta).toHaveBeenCalled();
  });

  it('returns STALE once a newer setUser() call has taken over mid-migration', async () => {
    const adapter = makeAdapter({
      getRoadmap: vi.fn(() => Promise.resolve({ items: { x: {} }, phases: ['Learn'] }))
    });
    const result = await migrateLegacyBlankTemplateIfNeeded({
      uid: 'u1', adapter, activeTemplateId: 'blank', startedTemplateIds: ['blank'], customRoadmaps: [], isStale: () => true
    });
    expect(result).toBe(STALE);
  });
});

describe('determineOnboardingAndActiveRoadmap', () => {
  it('runs the blank migration only when onboarding resolved true and "blank" is actually present', async () => {
    const adapter = makeAdapter({
      getLegacyRoadmap: vi.fn(() => Promise.resolve(null))
    });
    const result = await determineOnboardingAndActiveRoadmap({
      uid: 'u1',
      adapter,
      remoteMeta: { startedTemplateIds: ['blank'], activeTemplateId: 'blank' },
      localFallback: readOnboardingLocalFallback(),
      customRoadmaps: [],
      isStale: notStale
    });
    expect(result.onboardingDone).toBe(true);
    expect(result.blankMigration).not.toBeNull();
    expect(result.activeTemplateId).toBe(result.blankMigration.migratedId);
  });

  it('skips the blank migration entirely for a not-yet-onboarded account', async () => {
    const adapter = makeAdapter();
    const result = await determineOnboardingAndActiveRoadmap({
      uid: 'u2',
      adapter,
      remoteMeta: null,
      localFallback: readOnboardingLocalFallback(),
      customRoadmaps: [],
      isStale: notStale
    });
    expect(result.onboardingDone).toBe(false);
    expect(result.blankMigration).toBeNull();
    expect(adapter.getRoadmap).not.toHaveBeenCalled();
  });

  it('propagates STALE from the underlying onboarding-state resolution', async () => {
    const adapter = makeAdapter();
    const result = await determineOnboardingAndActiveRoadmap({
      uid: 'u3',
      adapter,
      remoteMeta: null,
      localFallback: readOnboardingLocalFallback(),
      customRoadmaps: [],
      isStale: () => true
    });
    expect(result).toBe(STALE);
  });
});
