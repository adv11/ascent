import { describe, it, expect } from 'vitest';
import { buildImportPrompt, buildImportFixPrompt, IMPORT_PROMPT_VERSION } from '../../src/data/importPrompt.js';

describe('buildImportPrompt', () => {
  it('renders the schema contract and a placeholder topic line when nothing is provided', () => {
    const prompt = buildImportPrompt();
    expect(prompt).toContain(`version ${IMPORT_PROMPT_VERSION}`);
    expect(prompt).toContain('Generate a roadmap for: [describe what this roadmap should cover]');
  });

  it('renders the typed topic', () => {
    const prompt = buildImportPrompt('Kubernetes for backend engineers');
    expect(prompt).toContain('Generate a roadmap for: Kubernetes for backend engineers');
  });

  it('omits every customization line when options is undefined or empty', () => {
    expect(buildImportPrompt('Rust')).not.toContain('Experience level:');
    const prompt = buildImportPrompt('Rust', {});
    expect(prompt).not.toContain('Experience level:');
    expect(prompt).not.toContain('Target timeframe:');
    expect(prompt).not.toContain('Goal / context:');
    expect(prompt).not.toContain('Already know:');
  });

  it('renders experience level alone', () => {
    const prompt = buildImportPrompt('Rust', { experienceLevel: 'Beginner' });
    expect(prompt).toContain('Experience level: Beginner');
    expect(prompt).not.toContain('Target timeframe:');
  });

  it('renders timeframe alone', () => {
    const prompt = buildImportPrompt('Rust', { timeframe: '3 months' });
    expect(prompt).toContain('Target timeframe: 3 months');
  });

  it('renders goal alone', () => {
    const prompt = buildImportPrompt('Rust', { goal: 'Interview prep' });
    expect(prompt).toContain('Goal / context: Interview prep');
  });

  it('renders "already know" alone, trimmed, and omits it when blank/whitespace-only', () => {
    const prompt = buildImportPrompt('Rust', { alreadyKnow: '  already comfortable with Docker  ' });
    expect(prompt).toContain('Already know: already comfortable with Docker');

    const blank = buildImportPrompt('Rust', { alreadyKnow: '   ' });
    expect(blank).not.toContain('Already know:');
  });

  it('renders all four fields together, each on its own line, in a stable order', () => {
    const prompt = buildImportPrompt('Rust', {
      experienceLevel: 'Advanced',
      timeframe: '1 year',
      goal: 'Academic or exam prep',
      alreadyKnow: 'basic syntax'
    });
    const lines = prompt.trim().split('\n').slice(-4);
    expect(lines).toEqual([
      'Experience level: Advanced',
      'Target timeframe: 1 year',
      'Goal / context: Academic or exam prep',
      'Already know: basic syntax'
    ]);
  });

  it('does not change IMPORT_PROMPT_VERSION or the JSON schema contract', () => {
    expect(IMPORT_PROMPT_VERSION).toBe(1);
    const prompt = buildImportPrompt('Rust', { experienceLevel: 'Beginner' });
    expect(prompt).toContain('"schemaVersion": 1');
    expect(prompt).toContain('Do not add any fields beyond those listed above.');
  });

  it('renders weekly time commitment alone', () => {
    const prompt = buildImportPrompt('Rust', { weeklyTime: '2–5 hrs/week' });
    expect(prompt).toContain('Weekly time commitment: 2–5 hrs/week');
  });

  it('renders preferred resource types as a joined list, omits when empty', () => {
    const prompt = buildImportPrompt('Rust', { resourceTypes: ['YouTube videos', 'Official docs'] });
    expect(prompt).toContain('Preferred resource types: YouTube videos, Official docs');

    expect(buildImportPrompt('Rust', { resourceTypes: [] })).not.toContain('Preferred resource types:');
    expect(buildImportPrompt('Rust', {})).not.toContain('Preferred resource types:');
  });

  it('always documents the resources-carrying object item shape and its rules, regardless of options', () => {
    const prompt = buildImportPrompt('Rust');
    expect(prompt).toContain('"resources"');
    expect(prompt).toContain('up to 5 per item');
    expect(prompt).toContain('never invent a URL');
  });

  // Issue #100 follow-up — real-world use found the AI omitting resources
  // from nearly every roadmap once the prompt only weakly suggested them
  // ("only include if confident"); the wording was strengthened to actively
  // encourage resources for most items instead of reading as an easy-to-skip
  // edge case, while still forbidding invented URLs.
  it('actively encourages including resources for most items, not just permits them', () => {
    const prompt = buildImportPrompt('Rust');
    expect(prompt).toContain('Use the object form with "resources" for MOST items');
    expect(prompt).toContain('this is expected and encouraged');
  });

  it('renders all six fields together, each on its own line, in a stable order', () => {
    const prompt = buildImportPrompt('Rust', {
      experienceLevel: 'Advanced',
      timeframe: '1 year',
      goal: 'Academic or exam prep',
      weeklyTime: '10+ hrs/week',
      resourceTypes: ['Online courses'],
      alreadyKnow: 'basic syntax'
    });
    const lines = prompt.trim().split('\n').slice(-6);
    expect(lines).toEqual([
      'Experience level: Advanced',
      'Target timeframe: 1 year',
      'Goal / context: Academic or exam prep',
      'Weekly time commitment: 10+ hrs/week',
      'Preferred resource types: Online courses',
      'Already know: basic syntax'
    ]);
  });
});

describe('buildImportFixPrompt', () => {
  it('handles an empty errors array without throwing, and still restates the contract', () => {
    const prompt = buildImportFixPrompt([]);
    expect(prompt).toContain(`schema version ${IMPORT_PROMPT_VERSION}`);
    expect(prompt).toContain('resend the complete corrected JSON');
  });

  it('lists a single error verbatim', () => {
    const prompt = buildImportFixPrompt(['title is required']);
    expect(prompt).toContain('- title is required');
  });

  it('lists multiple errors verbatim, one per line', () => {
    const errors = ['title is required', 'phases[0].title is required', 'item at phases[0].sections[0].items[0] is invalid'];
    const prompt = buildImportFixPrompt(errors);
    errors.forEach(message => expect(prompt).toContain(`- ${message}`));
  });

  it('always instructs the AI to resend the complete JSON, not a diff/patch', () => {
    const prompt = buildImportFixPrompt(['title is required']);
    expect(prompt.toLowerCase()).toContain('complete corrected json');
    expect(prompt).toContain('no markdown fences');
  });

  it('always includes the schema-version reminder regardless of error count', () => {
    expect(buildImportFixPrompt(['a'])).toContain(`schema version ${IMPORT_PROMPT_VERSION}`);
    expect(buildImportFixPrompt(['a', 'b', 'c'])).toContain(`schema version ${IMPORT_PROMPT_VERSION}`);
  });
});
