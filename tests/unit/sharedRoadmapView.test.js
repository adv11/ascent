import { describe, it, expect, vi, beforeEach } from 'vitest';

const getSharedRoadmap = vi.fn();
vi.mock('../../src/services/shareStore.js', () => ({ getSharedRoadmap }));

const { renderSharedRoadmapView } = await import('../../src/ui/pages/sharedRoadmapView.js');

function setup(hash) {
  window.location.hash = hash;
  const app = document.createElement('div');
  document.body.appendChild(app);
  return app;
}

function flush() {
  return new Promise(resolve => setTimeout(resolve, 0));
}

beforeEach(() => {
  document.body.innerHTML = '';
  getSharedRoadmap.mockReset();
});

describe('renderSharedRoadmapView', () => {
  it('renders a read-only snapshot with no interactive checkboxes/edit affordances', async () => {
    getSharedRoadmap.mockResolvedValue({
      title: 'My Roadmap',
      templateId: 'java-backend',
      phases: [{ title: 'Core', sections: [{ title: 'Framework' }] }],
      items: {
        'item-1': { title: 'Spring Boot basics', phase: 'Core', section: 'Framework', priority: 'P1', done: true, resources: [] },
        'item-2': { title: 'Another topic', phase: 'Core', section: 'Framework', priority: 'P2', done: false, resources: [] }
      }
    });

    const app = setup('#/shared?id=abc123');
    renderSharedRoadmapView(app);
    await flush();

    expect(app.querySelector('.shared-view')).not.toBeNull();
    expect(app.textContent).toContain('My Roadmap');
    expect(app.textContent).toContain('Spring Boot basics');
    expect(app.querySelectorAll('input[type="checkbox"]').length).toBe(0);
    // The one interactive control this page has is the theme toggle
    // (issue #502's own testing requirement — "the theme toggle works for
    // an unauthenticated visitor") — no other button/edit affordance.
    const buttons = [...app.querySelectorAll('button')];
    expect(buttons.length).toBe(1);
    expect(buttons[0].className).toContain('theme-toggle');
    expect(getSharedRoadmap).toHaveBeenCalledWith('abc123');
  });

  it('renders a resource-count badge per topic instead of the full link list', async () => {
    getSharedRoadmap.mockResolvedValue({
      title: 'My Roadmap',
      templateId: 'java-backend',
      phases: [{ title: 'Core', sections: [{ title: 'Framework' }] }],
      items: {
        'item-1': {
          title: 'Spring Boot basics', phase: 'Core', section: 'Framework', priority: 'P1', done: false,
          resources: [{ label: 'Docs', url: 'https://example.com' }, { label: 'More', url: 'https://example.org' }]
        }
      }
    });

    const app = setup('#/shared?id=abc123');
    renderSharedRoadmapView(app);
    await flush();

    const badge = app.querySelector('.shared-item-resource-count');
    expect(badge).not.toBeNull();
    expect(badge.textContent).toContain('2');
    expect(app.querySelector('a[href="https://example.com"]')).toBeNull();
  });

  it('shows a clear "revoked" state when the shareId does not resolve', async () => {
    getSharedRoadmap.mockResolvedValue(null);

    const app = setup('#/shared?id=missing');
    renderSharedRoadmapView(app);
    await flush();

    expect(app.querySelector('.shared-view-state')).not.toBeNull();
    expect(app.textContent).toContain('revoked');
  });

  it('shows the revoked state when no shareId is present in the route', async () => {
    const app = setup('#/shared');
    renderSharedRoadmapView(app);
    await flush();

    expect(app.querySelector('.shared-view-state')).not.toBeNull();
    expect(getSharedRoadmap).not.toHaveBeenCalled();
  });

  it('shows two ways onward from the revoked state', async () => {
    getSharedRoadmap.mockResolvedValue(null);

    const app = setup('#/shared?id=missing');
    renderSharedRoadmapView(app);
    await flush();

    const actions = app.querySelectorAll('.shared-view-state-actions a');
    expect(actions.length).toBe(2);
  });

  it('shows a skeleton loading state before the snapshot resolves', () => {
    getSharedRoadmap.mockReturnValue(new Promise(() => {})); // never resolves

    const app = setup('#/shared?id=abc123');
    renderSharedRoadmapView(app);

    expect(app.querySelector('.shared-view-loading-state')).not.toBeNull();
    expect(app.querySelector('.shared-view')).toBeNull();
  });

  it('computes a per-phase completion percentage', async () => {
    getSharedRoadmap.mockResolvedValue({
      title: 'My Roadmap',
      templateId: 'java-backend',
      phases: [{ title: 'Core', sections: [{ title: 'Framework' }] }],
      items: {
        'item-1': { title: 'A', phase: 'Core', section: 'Framework', priority: 'P1', done: true, resources: [] },
        'item-2': { title: 'B', phase: 'Core', section: 'Framework', priority: 'P1', done: false, resources: [] }
      }
    });

    const app = setup('#/shared?id=abc123');
    renderSharedRoadmapView(app);
    await flush();

    expect(app.querySelector('.shared-phase-card-percent').textContent).toBe('50%');
  });

  it('cleans up the theme toggle subscription on unmount', async () => {
    getSharedRoadmap.mockResolvedValue({
      title: 'My Roadmap', templateId: 'java-backend', phases: [], items: {}
    });

    const app = setup('#/shared?id=abc123');
    const cleanup = renderSharedRoadmapView(app);
    await flush();

    expect(() => cleanup()).not.toThrow();
  });
});
