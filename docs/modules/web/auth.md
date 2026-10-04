---
id: web.auth
type: feature
module: web
title: Entrar, criar conta e sair (web)
summary: >
  Login e cadastro com e-mail e senha (mínimo 8) no mesmo projeto Supabase, sessão do supabase-js
  persistida no navegador, guarda de rota e aviso de sessão expirada.
keywords: [login, cadastro, sessão, logout, expirada, supabase auth]
code:
  - client/src/features/auth/LoginPage.tsx
  - client/src/infrastructure/auth.ts
  - client/src/store/session.store.ts
  - client/src/app/RequireAuth.tsx
symbols: [SupabaseAuthGateway, mapAuthError, useSessionStore, RequireAuth, EXPIRED_NOTICE]
business_rules: [BR-ACC-006]
adrs: [ADR-011, ADR-020, ADR-006]
tests: [client/src/infrastructure/auth.test.ts, client/src/store/session.store.test.ts, client/src/features/features.test.tsx]
last_verified_commit: 3b9bf25+T-040
---

# Autenticação (web)

- Abas **Entrar** / **Criar conta**; Zod valida e-mail e senha (≥ 8) e a confirmação no cadastro.
- Erros do Supabase viram códigos (`invalid-credentials`, `already-registered`, `weak-password`,
  `confirmation-required`, `rate-limited`, `network`) e mensagens em português; nada de e-mail/token em log.
- Sessão: `localStorage` (chave `manager-money-web-auth`), `autoRefreshToken`. Recarregar a página mantém o login.
- **Sessão expirada:** saída não pedida (evento `SIGNED_OUT`) ou refresh falho após erro `auth` → login com aviso.
- **Sair:** `signOut({ scope: 'local' })` e descarte do estado em memória (não derruba o celular).
- Guarda de rota é UX; a proteção real é a RLS.
