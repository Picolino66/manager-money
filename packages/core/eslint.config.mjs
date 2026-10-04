// Núcleo puro (ADR-001/ADR-022): sem React, React Native, armazenamento ou Supabase.
import prettierConfig from 'eslint-config-prettier';
import tseslint from 'typescript-eslint';

const forbidden = [
  { name: 'react', message: 'O núcleo deve ser puro (ADR-001).' },
  { name: 'react-dom', message: 'O núcleo deve ser puro (ADR-001).' },
  { name: 'react-native', message: 'O núcleo deve ser puro (ADR-001).' },
  {
    name: '@react-native-async-storage/async-storage',
    message: 'Persistência pertence aos apps (ADR-001).',
  },
  {
    name: '@supabase/supabase-js',
    message: 'Supabase pertence à infraestrutura dos apps (ADR-001).',
  },
];

export default tseslint.config(
  { ignores: ['coverage/*', 'node_modules/*'] },
  ...tseslint.configs.recommended,
  prettierConfig,
  {
    files: ['src/**/*.ts'],
    rules: {
      // Mesma configuração do app (eslint-config-expo).
      '@typescript-eslint/no-unused-vars': [
        'error',
        { vars: 'all', args: 'none', ignoreRestSiblings: true },
      ],
      'no-restricted-imports': [
        'error',
        { paths: forbidden, patterns: ['**/infrastructure/**', '**/store/**', '**/screens/**'] },
      ],
    },
  },
);
