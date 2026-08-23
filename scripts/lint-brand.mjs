#!/usr/bin/env node
// Brand-name enforcement (root CLAUDE.md's "Brand rules", issue #7,
// docs/adr/ADR-004-product-rename.md) — no lint-plugin dependency, matching
// lint-theme.mjs/lint-icons.mjs's existing precedent: a small, focused static
// scan run alongside `npm run lint` in CI.
//
// Fails if the literal product name appears anywhere in src/**/*.js outside
// the single module that owns it (src/core/brandName.js). Comments are
// exempt — prose explaining the rule, or referencing the product by name, is
// fine and common; only real code strings are the problem.
//
// Why this is enforced mechanically rather than by convention alone: the
// entire stated value of routing the name through one constant is that a
// rename (or a white-labeled build) is a one-file change instead of a
// repo-wide grep. That guarantee is only as strong as its weakest call site,
// and it had already quietly drifted — an audit found 16 hardcoded
// occurrences across 12 files (user-facing toasts, aria-labels, settings
// copy, the public shared-roadmap view's "Made with …" footer, the ICS
// export's PRODID, the AI import prompt), against only 3 files using the
// BRAND_NAME constant correctly. Nothing in the repo would have caught that.
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, dirname, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

import { BRAND_NAME } from '../src/core/brandName.js';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const SCAN_DIR = join(ROOT, 'src');

// The one module allowed to contain the literal — it is the definition.
const EXEMPT_FILES = new Set(['src/core/brandName.js']);

function walk(dir, out = []) {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) walk(full, out);
    else if (entry.endsWith('.js')) out.push(full);
  }
  return out;
}

// Blank out comments (block + line) while preserving line numbers, so prose
// mentioning the product name is never flagged — only executable code is.
function stripComments(src) {
  let out = src.replace(/\/\*[\s\S]*?\*\//g, m => m.replace(/[^\n]/g, ' '));
  out = out
    .split('\n')
    .map(line => {
      const i = line.indexOf('//');
      // Not a perfect parser: a `//` inside a string literal (e.g. a URL, or
      // the ICS PRODID's `-//…//…` form) would truncate the line early. That
      // only ever produces false *negatives*, never false positives, which is
      // the safe direction for a guard like this.
      return i === -1 ? line : line.slice(0, i);
    })
    .join('\n');
  return out;
}

export function findBrandLiterals(src, name = BRAND_NAME) {
  const violations = [];
  stripComments(src).split('\n').forEach((line, i) => {
    if (line.includes(name)) violations.push({ line: i + 1, text: line.trim() });
  });
  return violations;
}

function main() {
  const all = [];
  for (const file of walk(SCAN_DIR)) {
    const rel = relative(ROOT, file);
    if (EXEMPT_FILES.has(rel)) continue;
    for (const v of findBrandLiterals(readFileSync(file, 'utf8'))) {
      all.push({ file: rel, ...v });
    }
  }

  if (all.length) {
    console.error(
      `lint-brand: ${all.length} hardcoded "${BRAND_NAME}" ` +
      `${all.length === 1 ? 'literal' : 'literals'} outside src/core/brandName.js\n`
    );
    all.forEach(v => console.error(`  ${v.file}:${v.line}  ${v.text}`));
    console.error(
      `\nImport the constant instead — \`import { BRAND_NAME } from '…/core/brandName.js'\` ` +
      `(or from '…/ui/components/brand.js', which re-exports it, in UI code), and interpolate ` +
      `it into a template literal. For brand *elements* use createBrandMark()/` +
      `createBrandWordmark()/createBrandIcon() from src/ui/components/brand.js. See root ` +
      `CLAUDE.md's "Brand rules" and docs/adr/ADR-004-product-rename.md.`
    );
    process.exitCode = 1;
    return;
  }

  console.log('lint-brand: OK');
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}
