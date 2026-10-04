import { fileURLToPath, URL } from 'node:url';

import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { loadEnv } from 'vite';
import { defineConfig } from 'vitest/config';

import { buildSecurityHeaders } from './security/headers.ts';

const REQUIRED_ENV = ['VITE_SUPABASE_URL', 'VITE_SUPABASE_ANON_KEY'] as const;

export default defineConfig(({ command, mode }) => {
  const env = loadEnv(mode, process.cwd(), 'VITE_');
  const missing = REQUIRED_ENV.filter((key) => !env[key]);

  // Build sem as variáveis públicas do Supabase geraria um app que não conecta (client-web-plan).
  if (command === 'build' && missing.length > 0) {
    throw new Error(
      `Variáveis ausentes para o build: ${missing.join(', ')} (veja client/.env.example).`,
    );
  }

  return {
    plugins: [react(), tailwindcss()],
    resolve: { alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) } },
    server: { port: 5173, strictPort: true },
    // `preview` serve o build com os mesmos cabeçalhos previstos para a VPS (CSP testável localmente).
    preview: { port: 4173, strictPort: true, headers: buildSecurityHeaders(env.VITE_SUPABASE_URL) },
    build: {
      sourcemap: false,
      rolldownOptions: {
        output: {
          // Bibliotecas em chunks próprios: mudam pouco e ficam em cache entre deploys.
          codeSplitting: {
            groups: [
              {
                name: 'react',
                test: /node_modules[\\/](react|react-dom|scheduler|react-router)[\\/]/,
              },
              { name: 'supabase', test: /node_modules[\\/]@supabase[\\/]/ },
              {
                name: 'ui',
                test: /node_modules[\\/](@radix-ui|radix-ui|sonner|lucide-react)[\\/]/,
              },
            ],
          },
        },
      },
    },
    test: {
      globals: true,
      environment: 'jsdom',
      setupFiles: ['./src/test/setup.ts'],
      include: ['src/**/*.test.{ts,tsx}', 'security/**/*.test.ts'],
      env: {
        VITE_SUPABASE_URL: 'https://projeto-teste.supabase.co',
        VITE_SUPABASE_ANON_KEY: 'anon-de-teste',
      },
      coverage: {
        provider: 'v8',
        // Mesmo critério do app: lógica (store, infraestrutura, lib) ≥ 80%; telas sem meta numérica.
        include: ['src/store/**/*.ts', 'src/infrastructure/**/*.ts', 'src/lib/**/*.ts'],
        exclude: ['**/*.test.ts', 'src/infrastructure/supabase/client.ts'],
        thresholds: { lines: 80, statements: 80, functions: 80, branches: 70 },
      },
    },
  };
});
