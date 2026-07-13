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
    expect(app.querySelectorAll('button').length).toBe(0);
    expect(getSharedRoadmap).toHaveBeenCalledWith('abc123');
  });

  it('renders resource links, guarded by isValidUrl', async () => {
    getSharedRoadmap.mockResolvedValue({
      title: 'My Roadmap',
      templateId: 'java-backend',
      phases: [{ title: 'Core', sections: [{ title: 'Framework' }] }],
      items: {
        'item-1': {
          title: 'Spring Boot basics', phase: 'Core', section: 'Framework', priority: 'P1', done: false,
          resources: [{ label: 'Docs', url: 'https://example.com' }]
        }
      }
    });

    const app = setup('#/shared?id=abc123');
    renderSharedRoadmapView(app);
    await flush();

    const link = app.querySelector('.shared-resource-link');
    expect(link).not.toBeNull();
    expect(link.getAttribute('href')).toBe('https://example.com');
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
});
