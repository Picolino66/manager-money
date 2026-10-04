/** Variáveis públicas do client (ADR-020). Ausentes = tela de configuração, nunca um app quebrado. */
export type PublicEnv = { supabaseUrl: string; supabaseAnonKey: string };

export function readPublicEnv(
  source: Record<string, string | undefined> = import.meta.env,
): PublicEnv | null {
  const supabaseUrl = source.VITE_SUPABASE_URL?.trim();
  const supabaseAnonKey = source.VITE_SUPABASE_ANON_KEY?.trim();

  return supabaseUrl && supabaseAnonKey ? { supabaseUrl, supabaseAnonKey } : null;
}
