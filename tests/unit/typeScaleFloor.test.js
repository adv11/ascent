import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';

const cssPath = path.resolve(process.cwd(), 'src/styles/app.css');
const css = readFileSync(cssPath, 'utf8');

// Body-copy floor (issue #482 A1): nothing may render below --text-base (16px)
// except .eyebrow, kbd, and table headers (th).
const EXEMPT_SELECTOR_PATTERN = /(^|[\s,.])(eyebrow)([\s,.:{]|$)|(^|[\s,])kbd([\s,.:{]|$)|(^|[\s,])th([\s,.:{]|$)/;
const SUB_16PX_TOKENS = ['var(--text-xs)', 'var(--text-sm)'];

function stripComments(input) {
  return input.replace(/\/\*[\s\S]*?\*\//g, '');
}

// Flattens the stylesheet into (selector, declarationBlock) pairs, one level
// deep — sufficient for finding every `font-size:` declaration and the
// selector it belongs to, including inside @media blocks.
function extractRules(input) {
  const rules = [];
  const ruleRe = /([^{}]+)\{([^{}]*)\}/g;
  let match;
  while ((match = ruleRe.exec(input)) !== null) {
    const selector = match[1].trim();
    if (selector.startsWith('@')) continue;
    rules.push({ selector, body: match[2] });
  }
  return rules;
}

describe('type scale body-copy floor (issue #482)', () => {
  const rules = extractRules(stripComments(css));

  it('no rule outside .eyebrow/kbd/th sets a sub-16px font-size token', () => {
    const violations = [];
    for (const { selector, body } of rules) {
      if (EXEMPT_SELECTOR_PATTERN.test(selector)) continue;
      const fontSizeMatch = body.match(/font-size:\s*([^;]+);/);
      if (!fontSizeMatch) continue;
      const value = fontSizeMatch[1].trim();
      if (SUB_16PX_TOKENS.includes(value)) {
        violations.push(`${selector} -> ${value}`);
      }
    }
    expect(violations).toEqual([]);
  });
});
