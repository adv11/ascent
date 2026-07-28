import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../src/services/shareStore.js', () => ({
  publishRoadmapShare: vi.fn(),
  revokeRoadmapShare: vi.fn(),
  listMyShares: vi.fn(async () => [])
}));

function fakeStore() {
  return {
    getSnapshot: () => ({ activeTemplateId: 'java-backend', customRoadmaps: [] }),
    isCustomRoadmapId: () => false
  };
}

beforeEach(() => {
  vi.resetModules();
  document.body.innerHTML = '';
});

describe('openShareRoadmapModal', () => {
  it('renders an explicit close button that calls close() on click', async () => {
    const { openShareRoadmapModal } = await import('../../src/ui/components/shareRoadmapModal.js');
    openShareRoadmapModal({ user: { uid: 'u1' }, store: fakeStore() });

    const closeBtn = document.querySelector('.share-roadmap-modal .modal-close');
    expect(closeBtn).not.toBeNull();
    expect(closeBtn.getAttribute('aria-label')).toBe('Close');

    expect(document.querySelector('.modal-overlay')).not.toBeNull();
    closeBtn.click();
    expect(document.querySelector('.modal-overlay')).toBeNull();
  });

  it('close() returned from openShareRoadmapModal also removes the modal', async () => {
    const { openShareRoadmapModal } = await import('../../src/ui/components/shareRoadmapModal.js');
    const { close } = openShareRoadmapModal({ user: { uid: 'u1' }, store: fakeStore() });
    expect(document.querySelector('.modal-overlay')).not.toBeNull();
    close();
    expect(document.querySelector('.modal-overlay')).toBeNull();
  });
});
