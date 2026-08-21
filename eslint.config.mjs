import { defineConfig, globalIgnores } from 'eslint/config';
import nextVitals from 'eslint-config-next/core-web-vitals';

export default defineConfig([
  ...nextVitals,
  {
    rules: {
      // These React 19 compiler rules require a separate application refactor.
      'react-hooks/set-state-in-effect': 'off',
      'react-hooks/static-components': 'off',
    },
  },
  {
    files: ['tests/**/*.{js,jsx,ts,tsx}'],
    rules: {
      '@next/next/no-html-link-for-pages': 'off',
    },
  },
  globalIgnores([
    '.next/**',
    'build/**',
    'coverage/**',
    'dist/**',
    'next-env.d.ts',
    'public/**',
  ]),
]);
