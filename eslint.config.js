import js from '@eslint/js';
import eslintConfigPrettier from 'eslint-config-prettier';
import pluginImportX from 'eslint-plugin-import-x';
import pluginUnicorn from 'eslint-plugin-unicorn';
import tseslint from 'typescript-eslint';

/** @type {import("eslint").Linter.Config[]} */
export default [
  js.configs.recommended,
  eslintConfigPrettier,
  ...tseslint.configs.recommended,
  {
    plugins: {
      'import-x': pluginImportX,
      unicorn: pluginUnicorn,
    },
    settings: {
      'import-x/resolver': {
        typescript: true,
      },
    },
    rules: {
      // Verify imports point to real files/modules
      'import-x/no-unresolved': 'error',
      // Enforce named exports
      'import-x/no-default-export': 'error',
      // Enforce import order
      'import-x/order': [
        'error',
        {
          groups: [
            'builtin',
            'external',
            'internal',
            'parent',
            'sibling',
            'index',
            'object',
            'type',
          ],
          'newlines-between': 'always',
          alphabetize: {
            order: 'asc',
            caseInsensitive: true,
          },
        },
      ],
      // Enforce kebab-case filenames
      'unicorn/filename-case': ['error', { cases: { kebabCase: true } }],
      // Enforce arrow functions over function declarations
      'func-style': ['error', 'expression'],
      // Require curly braces for all control flow statements
      curly: 'error',
      // Allow unused variables when destructuring with rest siblings
      '@typescript-eslint/no-unused-vars': [
        'error',
        { ignoreRestSiblings: true },
      ],
      // Warn on console usage
      'no-console': 'warn',
      // Enforce path aliases over relative imports
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['./*', '../*'],
              message: 'Use @/ path alias instead of relative imports.',
            },
          ],
        },
      ],
    },
  },
  // Allow default exports in config files
  {
    files: ['**/*.config.{js,ts,mjs,mts}'],
    rules: {
      'import-x/no-default-export': 'off',
    },
  },
  {
    ignores: ['dist/**'],
  },
];
