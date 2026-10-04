---
id: account.auth
type: feature
module: account
title: Entrar e sair (e-mail e senha)
summary: >
  Login e cadastro com e-mail e senha (mínimo 8) via Supabase Auth, sem envio de e-mail; sessão
  criptografada no aparelho; sair mantendo ou apagando os dados locais.
keywords: [login, entrar, criar conta, senha, e-mail, sair, sessão]
code:
  - src/store/session.store.ts
  - src/screens/AccountScreen.tsx
  - src/infrastructure/supabase/session-storage.ts
  - src/infrastructure/supabase/client.ts
symbols: [signIn, signUp, signOut, friendlyAuthError, assertCredentials, encryptedSessionStorage]
business_rules: [BR-ACC-001]
adrs: [ADR-011, ADR-006]
tests: [src/store/session.store.test.ts, src/infrastructure/supabase/session-storage.test.ts]
last_verified_commit: bfe9de6+T-028r2
---

# Entrar e sair

Spec: [SPEC-005](../../../specs/SPEC-005-conta.md) · decisão: [ADR-011](../../../adr/ADR-011-autenticacao-email-senha.md).

- Sem `EXPO_PUBLIC_SUPABASE_URL`/`ANON_KEY` → status `disabled` ("Modo local").
- **Entrar** (`signInWithPassword`) ou **Criar conta** (`signUp`). O app valida o e-mail e o mínimo de
  8 caracteres antes de chamar o servidor. Nenhum e-mail é enviado: "Confirm email" fica desligado
  no Supabase.
- Mensagens: "E-mail ou senha incorretos." · "Já existe uma conta com este e-mail. Use Entrar." ·
  "Confirme o cadastro pelo e-mail recebido e depois entre." (se o projeto voltar a exigir confirmação).
- Sem recuperação de senha até haver SMTP (ADR-011).
- Sessão: valor AES-256-CTR no AsyncStorage, chave aleatória de 32 bytes no SecureStore.
- Refresh automático só em primeiro plano (AppState); reconexão e retorno ao app disparam sync.
- Sair: escolha entre manter (desvincula; tudo fica pendente para futuro login) ou apagar.
