import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';

const cssPath = path.resolve(process.cwd(), 'src/styles/app.css');
const css = readFileSync(cssPath, 'utf8');

// Content surfaces are flat and solid; blur/glow are reserved for things that
// genuinely float above the page (issue #483). Every selector below is an
// overlay this rule deliberately still allows to carry backdrop-filter.
const OVERLAY_SELECTOR_PATTERN =
  /(^|[\s,.])(modal-card|dropdown-menu|dropdown-scrim|custom-select-scrim|floating-scrim|command-palette-card|item-panel|tooltip-bubble|toast|daily-todo-panel|tour-popover|settings-section|settings-guest-card|landing-mock-card|feature-card|step-card|feedback-type-card|template-card-picking-overlay|app-sidebar-backdrop|panel-overlay|landing-nav)([\s,.:{[]|$)/;

function stripComments(input) {
  return input.replace(/\/\*[\s\S]*?\*\//g, '');
}

// Flattens the stylesheet into (selector, declarationBlock) pairs, one level
// deep — sufficient for finding every `backdrop-filter:` declaration and the
// selector it belongs to, including inside @media/@supports blocks.
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

describe('flat content surfaces (issue #483)', () => {
  const rules = extractRules(stripComments(css));

  it('no non-overlay rule declares backdrop-filter', () => {
    const violations = [];
    for (const { selector, body } of rules) {
      if (OVERLAY_SELECTOR_PATTERN.test(selector)) continue;
      if (/backdrop-filter\s*:/.test(body)) {
        violations.push(selector);
      }
    }
    expect(violations).toEqual([]);
  });
});
