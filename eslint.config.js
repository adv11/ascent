import js from '@eslint/js';
import globals from 'globals';

export default [
  js.configs.recommended,
  {
    files: ['src/**/*.js'],
    languageOptions: {
      ecmaVersion: 2022,
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
    },
  },
];
