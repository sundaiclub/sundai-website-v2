import { FlatCompat } from '@eslint/eslintrc';
import { fileURLToPath } from 'node:url';

const compat = new FlatCompat({
  baseDirectory: fileURLToPath(new URL('.', import.meta.url)),
});

export default [
  {
    ignores: [
      '**/node_modules/**',
      'dist/**',
      'build/**',
      'coverage/**',
      '.next/**',
      'worktrees/**',
      '**/*.min.js',
    ],
  },
  ...compat.extends('next/core-web-vitals'),
];
