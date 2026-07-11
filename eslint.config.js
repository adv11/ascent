import js from '@eslint/js';
import globals from 'globals';

export default [
  js.configs.recommended,
  {
    files: ['src/**/*.js'],
    languageOptions: {
      // 'latest' (not a pinned year) so newer syntax — e.g. JSON import
      // attributes (`with { type: 'json' }`, issue #20) — parses without
      // bumping this again each time; ecmaVersion 2022 didn't understand it.
      ecmaVersion: 'latest',
      sourceType: 'module',
      globals: {
        ...globals.browser,
      },
    },
    rules: {
      'no-restricted-syntax': [
        'error',
        {
          selector: "AssignmentExpression[left.property.name='innerHTML']",
          message: 'Direct innerHTML assignment is banned. Use el() with text: or textContent.',
        },
        {
          selector: "Property[key.name='html'][value.type!='Identifier']",
          message: "The html: key in el() is banned. Use text: or compose with el() children.",
        },
      ],
      'no-eval': 'error',
      'no-implied-eval': 'error',
      'no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
      'no-undef': 'error',
      'no-console': ['warn', { allow: ['error', 'warn'] }],

      // Code-cleanliness gates (issue #53). SonarSource's "Does Code Cleanliness
      // Affect Coding Agents?" study found cleaner code (fewer static-analysis
      // violations, lower cognitive complexity) cut agent token cost 7-8% and
      // file revisitations ~34%. Start as `warn` — flip to `error` once Part 2's
      // targeted refactors bring the current violation count to zero (tracked in
      // the issue #53 PR description).
      'complexity': ['warn', 10],
      'max-depth': ['warn', 4],
      'max-lines-per-function': ['warn', { max: 80, skipComments: true, skipBlankLines: true }],
      'max-params': ['warn', 4],

      // `no-prototype-builtins` is a core ESLint rule (no new dependency) that
      // covers the same hazard `eslint-plugin-security`'s rule of the same name
      // does. `detect-unsafe-regex`/`detect-non-literal-regexp` were evaluated
      // but skipped: adding `eslint-plugin-security` would be this project's
      // first ESLint plugin dependency, and a repo-wide grep found no dynamic
      // `new RegExp(...)` construction or `hasOwnProperty`/`Object.prototype`
      // access anywhere in `src/` — nothing for those rules to catch here today.
      // Revisit if either pattern is introduced.
      'no-prototype-builtins': 'error',
    },
  },
];
