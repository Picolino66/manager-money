import { createClient, SupabaseClient } from '@supabase/supabase-js';

import { readPublicEnv } from '../env';

let client: SupabaseClient | null = null;

/**
 * Cliente único do Supabase. A sessão fica no localStorage padrão do supabase-js (decisão da
 * ADR-020; risco de XSS mitigado por CSP). Só anon key + JWT do usuário; a RLS é a proteção real.
 */
export function getSupabaseClient(): SupabaseClient | null {
  if (client) return client;

  const env = readPublicEnv();
  if (!env) return null;

  client = createClient(env.supabaseUrl, env.supabaseAnonKey, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: false,
      storageKey: 'manager-money-web-auth',
    },
  });

  return client;
}
