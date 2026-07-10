import { describe, it, expect } from 'vitest';
import { detectLinkType, LINK_TYPE_META } from '../../src/ui/utils/linkDetector.js';

describe('detectLinkType', () => {
  it('detects a youtube watch URL', () => {
    expect(detectLinkType('https://www.youtube.com/watch?v=abc')).toBe('youtube');
  });

  it('detects a youtu.be short link', () => {
    expect(detectLinkType('https://youtu.be/abc123')).toBe('youtube');
  });

  it('detects a github URL', () => {
    expect(detectLinkType('https://github.com/adv11/SwitchPrep')).toBe('github');
  });

  it('detects a notion.so URL', () => {
    expect(detectLinkType('https://www.notion.so/My-Page-abc123')).toBe('notion');
  });

  it('detects a notion.site URL', () => {
    expect(detectLinkType('https://myworkspace.notion.site/Page')).toBe('notion');
  });

  it('detects a google doc URL', () => {
    expect(detectLinkType('https://docs.google.com/document/d/abc/edit')).toBe('google-doc');
  });

  it('detects a google drive URL', () => {
    expect(detectLinkType('https://drive.google.com/file/d/abc/view')).toBe('google-drive');
  });

  it('detects a medium URL', () => {
    expect(detectLinkType('https://medium.com/@someone/a-post-abc')).toBe('medium');
  });

  it('detects a stackoverflow URL', () => {
    expect(detectLinkType('https://stackoverflow.com/questions/123/how-do-i')).toBe('stackoverflow');
  });

  it('falls back to article for a plain http/https URL', () => {
    expect(detectLinkType('https://example.com/some-article')).toBe('article');
  });

  it('falls back to article for a non-URL string, never throwing', () => {
    expect(detectLinkType('not-a-url')).toBe('article');
  });

  it('falls back to article for a javascript: URL', () => {
    expect(detectLinkType('javascript:alert(1)')).toBe('article');
  });

  it('falls back to article for undefined input', () => {
    expect(detectLinkType(undefined)).toBe('article');
  });

  it('exports metadata for every possible detectLinkType return value', () => {
    const types = ['youtube', 'github', 'notion', 'google-doc', 'google-drive', 'medium', 'stackoverflow', 'article'];
    types.forEach(type => {
      expect(LINK_TYPE_META[type]).toBeDefined();
      expect(LINK_TYPE_META[type].label).toBeTruthy();
    });
  });
});
