#!/usr/bin/env node
// Icon-system enforcement (issue #136 Phase 2 follow-up) — no lint-plugin
// dependency, matching lint-theme.mjs's existing precedent: a small, focused
// static scan run alongside `npm run lint` in CI.
//
// Fails if any raw emoji glyph appears in src/ui/**/*.js or
// src/data/**/*.js — every icon in the app must come from
// src/ui/components/icons.js (createIcon(), functional/navigational chrome)
// or src/ui/components/decorativeIcon.js (createDecorativeIcon(), Duotone
// decorative content), never a fresh Unicode/emoji glyph dropped into a
// string. This is what would have caught every glyph converted in issue
// #136 Phase 2, before it shipped, rather than after a live screenshot audit
// found it.
//
// A documented exemption list covers genuinely different content: canvas-
// rendered share-card text and social-media caption copy (shareCard.js,
// shareModal.js) are user-facing content going onto external platforms
// where emoji are normal and expected — not this app's own UI icon system.
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, dirname, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const SCAN_DIRS = [join(ROOT, 'src/ui'), join(ROOT, 'src/data')];

// Emoji/pictograph/dingbat/misc-symbol ranges — deliberately excludes
// U+2190-U+21FF (arrows), which this app uses legitimately as plain
// typographic characters in button/link text ("Back to my roadmap →"), not
// as icon-system glyphs.
const EMOJI_RE = /[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}\u{2B00}-\u{2BFF}]/gu;

// Relative to ROOT. Add a new entry here only with the same justification
// as the two below — user-facing content leaving the app's own UI (a
// downloadable image, a copy-to-clipboard social caption), never a
// shortcut around converting a real UI icon.
const EXEMPT_FILES = new Set([
  'src/ui/components/shareCard.js',
  'src/ui/components/shareModal.js',
  // Printed checklist glyphs (issue #133) — content rendered onto a printed
  // page/PDF, not this app's own on-screen UI icon system; the issue's own
  // spec calls for a plain "☐/☑" glyph here, not an interactive control.
  'src/ui/utils/printRoadmap.js'
]);

// Strips `//` line comments and `/* */` block comments so a comment
// *describing* an old glyph (e.g. "was raw '☀'/'☾' glyphs") never triggers a
// false positive — same simplified, no-real-parser approach lint-theme.mjs
// already uses for CSS comments, same accepted limitation: a `//` inside a
// string literal is (rarely, harmlessly) treated as a comment start too.
function stripJsComments(lines) {
  let inBlockComment = false;
  return lines.map(line => {
    let result = '';
    let i = 0;
    while (i < line.length) {
      if (!inBlockComment && line.slice(i, i + 2) === '/*') {
        inBlockComment = true;
        result += '  ';
        i += 2;
        continue;
      }
      if (inBlockComment) {
        if (line.slice(i, i + 2) === '*/') {
          inBlockComment = false;
          result += '  ';
          i += 2;
        } else {
          result += ' ';
          i += 1;
        }
        continue;
      }
      if (line.slice(i, i + 2) === '//') break;
      result += line[i];
      i++;
    }
    return result;
  });
}

function walk(dir, files = []) {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    const stat = statSync(full);
    if (stat.isDirectory()) walk(full, files);
    else if (entry.endsWith('.js')) files.push(full);
  }
  return files;
}

export function findEmojiViolations(filePath, content) {
  const relPath = relative(ROOT, filePath).replace(/\\/g, '/');
  if (EXEMPT_FILES.has(relPath)) return [];

  const rawLines = content.split('\n');
  const codeLines = stripJsComments(rawLines);
  const violations = [];
  codeLines.forEach((codeLine, i) => {
    const matches = codeLine.match(EMOJI_RE);
    if (matches) violations.push({ file: relPath, line: i + 1, glyphs: matches, text: rawLines[i].trim() });
  });
  return violations;
}

function main() {
  const files = SCAN_DIRS.flatMap(dir => walk(dir));
  const allViolations = files.flatMap(f => findEmojiViolations(f, readFileSync(f, 'utf8')));

  if (allViolations.length > 0) {
    console.error(`lint-icons: found ${allViolations.length} raw emoji glyph(s) outside the icon system:\n`);
    allViolations.forEach(v => {
      console.error(`  ${v.file}:${v.line} [${v.glyphs.join(' ')}]  ${v.text}`);
    });
    console.error(
      '\nUse createIcon() (src/ui/components/icons.js) for functional/navigational chrome, ' +
      'or createDecorativeIcon() (src/ui/components/decorativeIcon.js) for decorative/data-driven ' +
      'content — see .claude/rules/ui-styling.md\'s "Icon system" section. If this is genuinely ' +
      'user-facing content leaving the app (share-card image text, social-caption copy), add the ' +
      'file to EXEMPT_FILES in this script with the same justification as the existing entries.'
    );
    process.exitCode = 1;
    return;
  }

  console.log('lint-icons: OK');
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}
