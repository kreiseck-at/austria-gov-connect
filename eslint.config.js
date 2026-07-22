'use strict';

const tseslint = require('typescript-eslint');
const eslintConfigPrettier = require('eslint-config-prettier');

module.exports = tseslint.config(
  {
    ignores: ['**/dist/', '**/test-dist/', 'node_modules/'],
  },
  {
    files: ['**/*.ts'],
    extends: [...tseslint.configs.recommended],
    rules: {
      // Tests binden Fake-`fetch`-Implementierungen an die `typeof fetch`-Signatur;
      // nicht benötigte Parameter (z. B. `_url`) werden per Konvention mit `_`
      // markiert, statt die Signatur zu verstümmeln.
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
    },
  },
  eslintConfigPrettier,
);
