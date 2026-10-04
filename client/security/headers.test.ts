import { readFileSync } from 'node:fs';

import { buildContentSecurityPolicy, buildSecurityHeaders, supabaseOrigins } from './headers';

describe('cabeçalhos de segurança', () => {
  it('CSP: script só do próprio domínio e conexão só com o Supabase', () => {
    const csp = buildContentSecurityPolicy('https://abc.supabase.co');

    expect(csp).toContain("script-src 'self'");
    expect(csp).not.toMatch(/script-src[^;]*unsafe-inline/);
    expect(csp).toContain("connect-src 'self' https://abc.supabase.co wss://abc.supabase.co");
    expect(csp).toContain("frame-ancestors 'none'");
  });

  it('URL ausente ou inválida não libera nenhuma origem extra', () => {
    expect(supabaseOrigins(undefined)).toEqual([]);
    expect(supabaseOrigins('não é url')).toEqual([]);
    expect(supabaseOrigins('http://localhost:54321')).toEqual([
      'http://localhost:54321',
      'ws://localhost:54321',
    ]);
  });

  it('demais cabeçalhos', () => {
    expect(buildSecurityHeaders(undefined)).toMatchObject({
      'X-Content-Type-Options': 'nosniff',
      'X-Frame-Options': 'DENY',
      'Referrer-Policy': 'no-referrer',
    });
  });
});

describe('exemplos da VPS', () => {
  it.each(['nginx.conf.example', 'Caddyfile.example'])('%s reproduz a CSP de headers.ts', (file) => {
    const content = readFileSync(`security/${file}`, 'utf8');
    const expected = buildContentSecurityPolicy('https://seu-projeto.supabase.co');
    expect(content).toContain(expected);
    expect(content).toContain('Strict-Transport-Security');
  });
});
