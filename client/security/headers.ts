/**
 * Cabeçalhos de segurança do client web (client-web-plan → Segurança). Fonte única: aplicados no
 * `vite preview` e reproduzidos nos exemplos de Nginx/Caddy para a VPS (security/*.example).
 * Script só do próprio domínio (sem 'unsafe-inline'); estilos inline permitidos porque Radix e
 * sonner posicionam elementos via atributo/tag de estilo (não executam código).
 */
export function supabaseOrigins(supabaseUrl: string | undefined): string[] {
  if (!supabaseUrl) return [];

  try {
    const { host, protocol } = new URL(supabaseUrl);
    const wsProtocol = protocol === 'https:' ? 'wss:' : 'ws:';
    return [`${protocol}//${host}`, `${wsProtocol}//${host}`];
  } catch {
    return [];
  }
}

export function buildContentSecurityPolicy(supabaseUrl: string | undefined): string {
  return [
    "default-src 'self'",
    "script-src 'self'",
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data:",
    "font-src 'self'",
    ['connect-src', "'self'", ...supabaseOrigins(supabaseUrl)].join(' '),
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
  ].join('; ');
}

export function buildSecurityHeaders(supabaseUrl: string | undefined): Record<string, string> {
  return {
    'Content-Security-Policy': buildContentSecurityPolicy(supabaseUrl),
    'X-Content-Type-Options': 'nosniff',
    'X-Frame-Options': 'DENY',
    'Referrer-Policy': 'no-referrer',
    'Permissions-Policy': 'camera=(), microphone=(), geolocation=(), payment=()',
    'Cross-Origin-Opener-Policy': 'same-origin',
  };
}
