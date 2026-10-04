import { existsSync } from 'node:fs';

import { defineConfig, devices } from '@playwright/test';

/**
 * E2E local (não roda no CI): build + `vite preview`, o mesmo servidor com os cabeçalhos de
 * segurança. Fluxos autenticados usam E2E_EMAIL/E2E_PASSWORD de um usuário de TESTE dedicado no
 * mesmo projeto Supabase (nunca a conta pessoal); sem eles, só os testes públicos rodam.
 */
const hasEnvFile = existsSync('.env');
const fallbackEnv: Record<string, string> = hasEnvFile
  ? {}
  : { VITE_SUPABASE_URL: 'https://e2e-sem-supabase.invalid', VITE_SUPABASE_ANON_KEY: 'e2e' };

export default defineConfig({
  testDir: 'tests/e2e',
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: 'list',
  use: {
    baseURL: 'http://localhost:4173',
    locale: 'pt-BR',
    trace: 'retain-on-failure',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: {
    command: 'npm run build && npm run preview',
    url: 'http://localhost:4173/login',
    reuseExistingServer: false,
    timeout: 120_000,
    env: fallbackEnv,
  },
});
