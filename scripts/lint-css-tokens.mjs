#!/usr/bin/env node
// CSS custom-property enforcement — no lint-plugin dependency, matching
// lint-theme.mjs/lint-icons.mjs's existing precedent: a small, focused static
// scan run alongside `npm run lint` in CI.
//
// Fails if src/styles/app.css uses `var(--token)` with **no fallback** for a
// token that is never defined anywhere in the file.
//
// This is not a style rule — it catches a silent, genuinely invisible class of
// bug. An undefined custom property with no fallback makes the whole
// declaration "invalid at computed-value time": the property silently falls
// back to its inherited/initial value, with no console warning, no CSS parse
// error, and nothing failing in CI. `border: 1px solid var(--gone)` renders as
// *no border at all*; `background: var(--gone)` renders fully transparent.
//
// Four such call sites shipped and survived two whole design-system
// rewrites before this script existed: `--surface-glass` and `--border-glass`
// (x3) were deleted along with the rest of the v1 glass token set in #302
// (v2 "Modernist" retired glass wholesale), but their call sites were never
// repointed — so the onboarding cards' ⋯/ℹ buttons, the Daily Todo row's ⋮
// button, and the "Opening…" picking overlay all rendered with no border /
// no scrim from #302 until the audit that added this check. A separate pair
// (`--space-5`/`--space-10`, issue #506) hit the identical failure mode on
// the developer-profile page and was found only by a live getComputedStyle()
// check during browser review. That is the whole point of this script: this
// bug is invisible to every other gate in the repo.
//
// `var(--token, fallback)` is deliberately allowed even when `--token` is
// undefined — an explicit fallback is a valid, intentional pattern (e.g.
// `--confetti-x`, set inline from JS at runtime, and therefore correctly
// absent from the stylesheet).
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const CSS_FILE = join(ROOT, 'src/styles/app.css');

export function findUndefinedTokens(css) {
  // Blank out comments while preserving line numbers, so a token named only
  // inside a "this used to be var(--x)" explanatory comment — of which this
  // file has several, deliberately — is never reported as a real usage.
  const stripped = css.replace(/\/\*[\s\S]*?\*\//g, m => m.replace(/[^\n]/g, ' '));

  const defined = new Set();
  for (const m of stripped.matchAll(/(--[A-Za-z0-9_-]+)\s*:/g)) defined.add(m[1]);

  const violations = [];
  stripped.split('\n').forEach((line, i) => {
    // Only `var(--x)` with no comma before the closing paren — i.e. no fallback.
    for (const m of line.matchAll(/var\(\s*(--[A-Za-z0-9_-]+)\s*\)/g)) {
      if (!defined.has(m[1])) {
        violations.push({ token: m[1], line: i + 1, text: line.trim() });
      }
    }
  });
  return violations;
}

function main() {
  const css = readFileSync(CSS_FILE, 'utf8');
  const violations = findUndefinedTokens(css);

  if (violations.length) {
    console.error(
      `lint-css-tokens: ${violations.length} undefined custom ` +
      `${violations.length === 1 ? 'property is' : 'properties are'} used with no fallback\n`
    );
    violations.forEach(v => {
      console.error(`  src/styles/app.css:${v.line}  ${v.token}\n    ${v.text}`);
    });
    console.error(
      '\nAn undefined var() with no fallback makes the entire declaration invalid at ' +
      'computed-value time — the property silently reverts to its inherited/initial value ' +
      '(no border, transparent background) with no browser warning. Either define the token ' +
      'in both themes, repoint it at the current token that replaced it (see ' +
      '.claude/rules/design-system.md §2 for the canonical set), or give it an explicit ' +
      'fallback if it is genuinely set from JS at runtime.'
    );
    process.exitCode = 1;
    return;
  }

  console.log('lint-css-tokens: OK');
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}
