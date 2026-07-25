import { describe, it, expect } from 'vitest';
import { buildRoadmapMarkdown } from '../../src/core/roadmap/markdownExport.js';

function snapshot(overrides = {}) {
  return {
    phases: [{ title: 'Core', sections: [{ title: 'Framework' }] }],
    items: [
      {
        id: 'item-1', title: 'Spring Boot basics', phase: 'Core', section: 'Framework',
        priority: 'P1', done: true, resources: [{ label: 'Docs', url: 'https://example.com' }],
        notes: 'Read chapter 2'
      }
    ],
    ...overrides
  };
}

describe('buildRoadmapMarkdown', () => {
  it('renders an empty roadmap with a title and a placeholder line', () => {
    const md = buildRoadmapMarkdown({ phases: [], items: [] }, 'My Roadmap');
    expect(md).toBe('# My Roadmap\n\n_No topics yet._');
  });

  it('renders phases/sections as headings and topics as a checklist', () => {
    const md = buildRoadmapMarkdown(snapshot(), 'My Roadmap');
    expect(md).toContain('# My Roadmap');
    expect(md).toContain('## Core');
    expect(md).toContain('### Framework');
    expect(md).toContain('- [x] Spring Boot basics (P1)');
  });

  it('renders resources as links and notes as an indented blockquote', () => {
    const md = buildRoadmapMarkdown(snapshot(), 'My Roadmap');
    expect(md).toContain('  - [Docs](https://example.com)');
    expect(md).toContain('  > Read chapter 2');
  });

  it('omits notes when includeNotes is false', () => {
    const md = buildRoadmapMarkdown(snapshot(), 'My Roadmap', { includeNotes: false });
    expect(md).not.toContain('Read chapter 2');
  });

  it('shows an unchecked box for a not-done item', () => {
    const md = buildRoadmapMarkdown(snapshot({ items: [{ ...snapshot().items[0], done: false }] }), 'My Roadmap');
    expect(md).toContain('- [ ] Spring Boot basics (P1)');
  });

  it('escapes Markdown special characters in titles', () => {
    const md = buildRoadmapMarkdown(
      snapshot({ items: [{ ...snapshot().items[0], title: '*Bold* [link] _italic_' }] }),
      'A *Title* with [brackets]'
    );
    expect(md).toContain('# A \\*Title\\* with \\[brackets\\]');
    expect(md).toContain('- [x] \\*Bold\\* \\[link\\] \\_italic\\_ (P1)');
  });

  it('falls back to first-appearance ordering for items outside the template skeleton', () => {
    const md = buildRoadmapMarkdown({
      phases: [],
      items: [
        { id: 'a', title: 'Topic A', phase: 'Custom Phase', section: 'Custom Section', priority: 'P0', done: false, resources: [], notes: '' }
      ]
    }, 'Custom Roadmap');
    expect(md).toContain('## Custom Phase');
    expect(md).toContain('### Custom Section');
    expect(md).toContain('- [ ] Topic A (P0)');
  });

  it('defaults to "Roadmap" when no title is given', () => {
    const md = buildRoadmapMarkdown({ phases: [], items: [] });
    expect(md).toContain('# Roadmap');
  });
});
