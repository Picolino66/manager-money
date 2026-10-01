---
id: account.auth
type: feature
module: account
title: Entrar e sair (OTP por e-mail)
summary: >
  Login sem senha com código de 6 dígitos enviado por e-mail via Supabase Auth; sessão criptografada
  no aparelho; sair mantendo ou apagando os dados locais.
keywords: [login, entrar, código, otp, e-mail, sair, sessão]
code:
  - src/store/session.store.ts
  - src/screens/AccountScreen.tsx
  - src/infrastructure/supabase/session-storage.ts
  - src/infrastructure/supabase/client.ts
symbols: [sendCode, verifyCode, signOut, friendlyAuthError, encryptedSessionStorage]
business_rules: [BR-ACC-001]
adrs: [ADR-005, ADR-006]
tests: [src/store/session.store.test.ts, src/infrastructure/supabase/session-storage.test.ts]
last_verified_commit: 359de21
---

# Entrar e sair

Spec: [SPEC-005](../../../specs/SPEC-005-conta.md).

- Sem `EXPO_PUBLIC_SUPABASE_URL`/`ANON_KEY` → status `disabled` ("Modo local").
- Sessão: valor AES-256-CTR no AsyncStorage, chave aleatória de 32 bytes no SecureStore.
- Refresh automático só em primeiro plano (AppState); reconexão e retorno ao app disparam sync.
- Sair: escolha entre manter (desvincula; tudo fica pendente para futuro login) ou apagar.
