#!/usr/bin/env node
// Lightweight theme-correctness lint (issue #116) — no stylelint/build-step
// dependency, just two focused checks run alongside `npm run lint`:
//
// 1. Every literal hex (#abc / #aabbcc / #aabbccdd) or rgb()/rgba() color in
//    app.css, outside the two :root token blocks, must have a
//    `/* intentional: ... */` comment within the 15 lines immediately above
//    it (or a trailing same-line comment) — documenting *why* it's a fixed,
//    theme-agnostic color instead of a design token. This is what would have
//    caught a color that should have been themed but wasn't, without
//    banning the legitimate "always-white-text-on-a-saturated-background"
//    pattern already used throughout the app.
// 2. Every custom `<button>`-like class defined via `el('button', { className:
//    '...' })` in src/ui/**/*.js that isn't part of the `.btn` family must
//    have an explicit `color` declaration in app.css (or `color: inherit`) —
//    this is the exact bug class behind `.feedback-type-card`/
//    `.my-report-summary` (issue #9/#115) and `.notes-indicator` (issue #116).
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const APP_CSS_PATH = join(ROOT, 'src/styles/app.css');
const UI_DIRS = [join(ROOT, 'src/ui/components'), join(ROOT, 'src/ui/pages')];

const COLOR_RE = /#[0-9a-fA-F]{3,8}\b|rgba?\([^)]*\)/g;
const INTENTIONAL_RE = /\/\*\s*intentional:/i;
const LOOKBACK_LINES = 15;

export function findRootBlockRanges(lines) {
  const ranges = [];
  for (let i = 0; i < lines.length; i++) {
    if (/^:root(\[data-theme=[^\]]*\])?\s*\{/.test(lines[i])) {
      let depth = 0;
      let end = i;
      for (let j = i; j < lines.length; j++) {
        depth += (lines[j].match(/\{/g) || []).length;
        depth -= (lines[j].match(/\}/g) || []).length;
        if (depth === 0) { end = j; break; }
      }
      ranges.push([i, end]);
    }
  }
  return ranges;
}

function isInsideAnyRange(index, ranges) {
  return ranges.some(([start, end]) => index >= start && index <= end);
}

// Blanks out every /* ... */ comment span (across line breaks) while
// preserving line numbers and non-comment code on the same line, so a hex
// value mentioned in prose (e.g. "reads fine over `rgba(...)`") never gets
// mistaken for a live declaration.
function stripComments(lines) {
  let inComment = false;
  return lines.map(line => {
    let result = '';
    let i = 0;
    while (i < line.length) {
      if (!inComment && line.slice(i, i + 2) === '/*') {
        inComment = true;
        result += '  ';
        i += 2;
        continue;
      }
      if (inComment && line.slice(i, i + 2) === '*/') {
        inComment = false;
        result += '  ';
        i += 2;
        continue;
      }
      result += inComment ? ' ' : line[i];
      i++;
    }
    return result;
  });
}

export function findColorLiteralViolations(cssText) {
  const lines = cssText.split('\n');
  const codeLines = stripComments(lines);
  const rootRanges = findRootBlockRanges(lines);
  const violations = [];

  codeLines.forEach((codeLine, i) => {
    if (isInsideAnyRange(i, rootRanges)) return;
    const matches = codeLine.match(COLOR_RE);
    if (!matches) return;

    const windowStart = Math.max(0, i - LOOKBACK_LINES);
    const window = lines.slice(windowStart, i + 1).join('\n');
    if (!INTENTIONAL_RE.test(window)) {
      violations.push({ line: i + 1, text: lines[i].trim(), matches });
    }
  });

  return violations;
}

function listJsFiles(dir) {
  return readdirSync(dir)
    .filter(name => name.endsWith('.js'))
    .map(name => join(dir, name))
    .filter(path => statSync(path).isFile());
}

export function findCustomButtonClasses(jsText) {
  const classes = [];
  const re = /el\(\s*'button'\s*,\s*\{([^]*?)\n\s*\}/g;
  let match;
  while ((match = re.exec(jsText))) {
    const block = match[1];
    const classNameMatch = block.match(/className:\s*(`[^`]*`|'[^']*'|"[^"]*")/);
    if (!classNameMatch) continue;
    const raw = classNameMatch[1].slice(1, -1);
    // Take only the literal, non-interpolated tokens (skip ${...} segments)
    // so a conditional class name doesn't produce a garbled token.
    const tokens = raw.split(/\$\{[^}]*\}/).join(' ').split(/\s+/)
      .filter(token => /^[a-z][a-z0-9-]*$/i.test(token) && !token.endsWith('-'));
    // If this button already carries a `.btn*` class, its color comes from
    // that family (`.btn` sets `color` explicitly) — none of its other
    // classes need their own, so skip the whole button.
    if (tokens.some(token => token.startsWith('btn'))) continue;
    for (const token of tokens) classes.push(token);
  }
  return [...new Set(classes)];
}

function classHasExplicitColor(cssText, className) {
  // Matches `.className { ... }`, `.className:hover { ... }`, and
  // `.className,\n.other { ... }` compound-selector groups — anywhere the
  // class appears as a bare (not descendant-scoped) selector with its own
  // rule body that sets `color`.
  const re = new RegExp(`(^|[,\\s])\\.${className}(?:[:.][a-zA-Z-]+)*\\s*(,|\\{)`, 'g');
  let match;
  while ((match = re.exec(cssText))) {
    // Walk forward from this selector occurrence to the end of its rule
    // (skip past any comma-separated sibling selectors first).
    let idx = match.index + match[0].length - 1;
    while (cssText[idx] !== '{') idx++;
    let depth = 0;
    let bodyEnd = idx;
    for (let j = idx; j < cssText.length; j++) {
      if (cssText[j] === '{') depth++;
      if (cssText[j] === '}') { depth--; if (depth === 0) { bodyEnd = j; break; } }
    }
    const body = cssText.slice(idx, bodyEnd);
    if (/(^|[^-\w])color\s*:/.test(body)) return true;
  }
  return false;
}

// Classes verified (issue #116 audit) to render no text/icon content of
// their own — purely a colored background cell — so there's no `color` for
// them to ever get wrong. Add here only with the same manual verification.
const BUTTON_COLOR_ALLOWLIST = new Set([
  'heatmap-cell' // heatmap.js — a bare <button>, background-only day cell, no children at all
]);

export function findMissingButtonColors(cssText, uiDirs) {
  const violations = [];
  for (const dir of uiDirs) {
    for (const filePath of listJsFiles(dir)) {
      const jsText = readFileSync(filePath, 'utf8');
      for (const className of findCustomButtonClasses(jsText)) {
        if (BUTTON_COLOR_ALLOWLIST.has(className)) continue;
        if (!classHasExplicitColor(cssText, className)) {
          violations.push({ file: filePath, className });
        }
      }
    }
  }
  return violations;
}

function main() {
  const cssText = readFileSync(APP_CSS_PATH, 'utf8');
  const colorViolations = findColorLiteralViolations(cssText);
  const buttonViolations = findMissingButtonColors(cssText, UI_DIRS);

  let hasErrors = false;

  if (colorViolations.length) {
    hasErrors = true;
    console.error(`\napp.css: ${colorViolations.length} color literal(s) outside :root with no adjacent "/* intentional: ... */" comment:\n`);
    for (const v of colorViolations) {
      console.error(`  app.css:${v.line}  ${v.text}`);
    }
  }

  if (buttonViolations.length) {
    hasErrors = true;
    console.error(`\n${buttonViolations.length} custom button class(es) missing an explicit "color" in app.css:\n`);
    for (const v of buttonViolations) {
      console.error(`  ${v.file.replace(ROOT + '/', '')}  .${v.className}`);
    }
  }

  if (hasErrors) {
    console.error('\nSee .claude/rules/ui-styling.md for the theming conventions these checks enforce.\n');
    process.exit(1);
  }

  console.log('lint-theme: OK');
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main();
}
