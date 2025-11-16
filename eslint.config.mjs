import js from '@eslint/js';
import globals from 'globals';
import jestPlugin from 'eslint-plugin-jest';
import prettierConfig from 'eslint-config-prettier';

export default [
  // 0. Global ignores
  {
    ignores: [
      'node_modules/**',
      'dist/**',
      'coverage/**',
    ],
  },
  // 1. Global configuration for all JavaScript files
  {
    files: ['**/*.js'],
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'commonjs',
      globals: {
        ...globals.node, // Use Node.js globals
      },
    },
    rules: {
      ...js.configs.recommended.rules, // Start with ESLint's recommended rules
      'no-console': 'warn', // Warn about console.log instead of erroring
    },
  },

  // 2. Configuration specifically for Jest test files
  {
    ...jestPlugin.configs['flat/recommended'], // Use Jest's recommended flat config
    files: ['**/*.test.js'], // Apply only to test files
  },

  // 3. Prettier configuration - must be the last one
  prettierConfig,
];
