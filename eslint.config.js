// https://docs.expo.dev/guides/using-eslint/
const { defineConfig } = require('eslint/config');
const expoConfig = require('eslint-config-expo/flat');
const prettierConfig = require('eslint-config-prettier');

const forbiddenInCore = [
  { name: 'react', message: 'domain/application devem ser puros (ADR-001).' },
  { name: 'react-native', message: 'domain/application devem ser puros (ADR-001).' },
  { name: '@react-native-async-storage/async-storage', message: 'Persistência pertence a infrastructure (ADR-001).' },
  { name: '@supabase/supabase-js', message: 'Supabase pertence a infrastructure (ADR-001).' },
];

module.exports = defineConfig([
  expoConfig,
  prettierConfig,
  {
    ignores: ['dist/*', 'coverage/*', '.expo/*', 'scripts/ai-docs/*', 'supabase/*'],
  },
  {
    files: ['src/domain/**/*.ts', 'src/application/**/*.ts'],
    rules: {
      'no-restricted-imports': ['error', { paths: forbiddenInCore, patterns: ['**/infrastructure/**', '**/store/**', '**/screens/**'] }],
    },
  },
]);
