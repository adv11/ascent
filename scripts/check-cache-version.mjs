#!/usr/bin/env node
// Local mirror of ci.yml's "Check sw.js CACHE_VERSION bumped when src/ changed"
// step (issue #17 follow-up) — this exact CI check has silently failed several
// PRs in a row because nothing catches the missing bump before push. Run this
// before opening/pushing a PR that touches src/**, or wire it into a pre-push
// hook; see .claude/skills/open-pr/SKILL.md's pre-PR checklist.
//
// Compares against origin/main (falls back to main if origin/main isn't
// available locally) rather than a fixed base, mirroring the CI job's
// `github.event.pull_request.base.sha` comparison as closely as a local
// working tree can.

import { execSync } from 'node:child_process';

function git(cmd) {
  return execSync(`git ${cmd}`, { encoding: 'utf8' }).trim();
}

function resolveBase() {
  for (const ref of ['origin/main', 'main']) {
    try {
      return git(`merge-base HEAD ${ref}`);
    } catch {
      // try the next candidate
    }
  }
  throw new Error('Could not resolve a base ref (origin/main or main) to diff against.');
}

const base = resolveBase();
const changedFiles = git(`diff --name-only ${base} HEAD`).split('\n').filter(Boolean);
const srcChanged = changedFiles.some(f => f.startsWith('src/'));
const swVersionChanged = git(`diff ${base} HEAD -- sw.js`)
  .split('\n')
  .some(line => /^[+-]const CACHE_VERSION/.test(line));

if (srcChanged && !swVersionChanged) {
  console.error('❌ src/ files changed but sw.js\'s CACHE_VERSION wasn\'t bumped.');
  console.error('   /src/** and *.css are served with a short but real Cache-Control');
  console.error('   max-age (firebase.json, issue #185), and the service worker itself');
  console.error('   still caches those same paths cache-first — bump CACHE_VERSION in');
  console.error('   sw.js so returning visitors with a warm cache actually pick up this change.');
  process.exit(1);
}

console.log(`✅ CACHE_VERSION check passed (src_changed=${srcChanged}, sw_version_changed=${swVersionChanged})`);
