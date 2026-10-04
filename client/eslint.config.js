import prettierConfig from 'eslint-config-prettier';
import reactHooks from 'eslint-plugin-react-hooks';
import reactRefresh from 'eslint-plugin-react-refresh';
import globals from 'globals';
import tseslint from 'typescript-eslint';

/** XSS: nenhum HTML dinâmico (client-web-plan → Segurança). */
const noDangerousHtml = {
  selector: "JSXAttribute[name.name='dangerouslySetInnerHTML']",
  message: 'Proibido: HTML dinâmico abre espaço para XSS (a sessão fica no navegador).',
};

export default tseslint.config(
  { ignores: ['dist/*', 'coverage/*', 'playwright-report/*', 'test-results/*'] },
  ...tseslint.configs.recommended,
  prettierConfig,
  {
    files: ['**/*.{ts,tsx}'],
    languageOptions: { globals: { ...globals.browser } },
    plugins: { 'react-hooks': reactHooks, 'react-refresh': reactRefresh },
    rules: {
      ...reactHooks.configs.recommended.rules,
      // Aviso do React Compiler (não usado aqui) para react-hook-form/TanStack Table.
      'react-hooks/incompatible-library': 'off',
      'react-refresh/only-export-components': ['warn', { allowConstantExport: true }],
      '@typescript-eslint/no-unused-vars': ['error', { args: 'none', ignoreRestSiblings: true }],
      'no-restricted-syntax': ['error', noDangerousHtml],
      // Nada financeiro no navegador: só a preferência de tema usa localStorage (e o supabase-js, internamente).
      'no-restricted-globals': [
        'error',
        { name: 'localStorage', message: 'Use só em infrastructure/theme-preference.ts.' },
        { name: 'sessionStorage', message: 'Nada de dados no navegador (ADR-020).' },
        { name: 'indexedDB', message: 'Nada de dados no navegador (ADR-020).' },
      ],
    },
  },
  {
    // Camadas (client-web-plan): telas não falam com o Supabase nem com a infraestrutura; regras só do núcleo.
    files: ['src/features/**', 'src/components/**', 'src/app/**', 'src/lib/**'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          paths: [
            {
              name: '@supabase/supabase-js',
              message: 'Só src/infrastructure fala com o Supabase.',
            },
          ],
          patterns: [
            {
              group: ['@/infrastructure/*', '**/infrastructure/**'],
              message: 'Use o store (caso de uso → grava).',
            },
            {
              group: ['@manager-money/core/contract/*'],
              message: 'Contrato remoto é assunto da infraestrutura.',
            },
          ],
        },
      ],
    },
  },
  {
    files: ['src/infrastructure/theme-preference.ts'],
    rules: { 'no-restricted-globals': 'off' },
  },
  {
    files: ['**/*.test.{ts,tsx}', 'src/test/**', 'tests/**'],
    rules: {
      'no-restricted-imports': 'off',
      'no-restricted-globals': 'off',
      'react-refresh/only-export-components': 'off',
    },
  },
);
