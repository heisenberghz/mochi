import js from '@eslint/js';
import globals from 'globals';
import tseslint from 'typescript-eslint';

/**
 * Linting, with one rule that carries the architecture.
 *
 * `src/domain` is the pure core — the pet's mind, the focus engine, the
 * Insights maths. It stays pure by refusing imports it must never have:
 * Electron, React, and Node's I/O surface. Everything that touches a window,
 * a file or a network socket lives outside it, and the ESLint rule below is
 * what makes that a promise instead of a hope.
 */
export default tseslint.config(
  // Local agent tooling (the impeccable skill copies on disk) is vendored
  // third-party code, including a minified detector binary's helpers; it is
  // git-ignored and lint-ignored for the same reason node_modules is.
  {
    ignores: [
      'out/**',
      'node_modules/**',
      'coverage/**',
      'art-mockups/**',
      '.opencode/**',
      '.github/agents/**',
      '.github/hooks/**',
      '.github/skills/**',
    ],
  },

  // Every TS file in the product.
  { files: ['src/**/*.{ts,tsx}'] },

  js.configs.recommended,
  ...tseslint.configs.recommended,

  // The Node-side scripts are real code too; they run in plain Node.
  {
    files: ['scripts/**/*.mjs'],
    languageOptions: { globals: { ...globals.node } },
  },

  // The renderer runs in a browser context (Chromium), the rest in Node.
  {
    files: ['src/renderer/**/*.{ts,tsx}'],
    languageOptions: { globals: { ...globals.browser } },
  },
  {
    files: ['src/main/**/*.ts', 'src/preload/**/*.ts', 'src/shared/**/*.ts'],
    languageOptions: { globals: { ...globals.node } },
  },
  // Domain tests import only vitest and the domain itself — like the domain,
  // they never touch the outside world, so the purity rule applies to them too.
  {
    files: ['src/domain/**/*.ts'],
    languageOptions: { globals: { ...globals.node } },
    rules: {
      'no-restricted-imports': [
        'error',
        {
          paths: [
            {
              name: 'electron',
              message: 'the domain must not depend on Electron; inject a clock, a store or a callback instead.',
            },
            {
              name: 'react',
              message: 'the domain must not depend on React; compute views, and let the renderer render them.',
            },
            {
              name: 'react-dom',
              message: 'the domain must not depend on React; compute views, and let the renderer render them.',
            },
          ],
          patterns: [
            {
              group: ['node:*', 'electron/**'],
              message: 'the domain must not do Node I/O; inject the capability instead.',
            },
            {
              group: [
                'fs',
                'fs/promises',
                'path',
                'os',
                'child_process',
                'crypto',
                'http',
                'https',
                'net',
                'dgram',
                'stream',
                'timers',
                'url',
                'worker_threads',
              ],
              message: 'the domain must not do Node I/O; inject the capability instead.',
            },
          ],
        },
      ],
    },
  },
);
