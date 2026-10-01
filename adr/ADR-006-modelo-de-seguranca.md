# ADR-006 — Modelo de segurança e threat model

- **Status:** ACCEPTED · **Fase:** F2 · **Data:** 2026-10-01

## Ativos

1. Dados financeiros pessoais (renda, gastos, descrições), classificados como pessoais pela LGPD
2. Sessão do usuário (access e refresh token)
3. Chave `anon` do Supabase, que é pública por design e só tem valor com RLS correta

## Threat model (STRIDE resumido)

| Ameaça | Vetor | Mitigação |
|---|---|---|
| **S**poofing | Token roubado | Sessão criptografada (AES-256) com chave no SecureStore (Keychain/Keystore); refresh token com rotação e detecção de reuso (padrão Supabase) |
| **T**ampering | Cliente modificado grava dados de outro usuário | **RLS** em todas as tabelas (`user_id = auth.uid()`); `user_id` com default `auth.uid()` e checagem em `WITH CHECK` |
| **R**epudiation | — | Baixa relevância (single-user); `server_updated_at` registra alterações |
| **I**nformation disclosure | Vazamento via logs ou crash reports | Sentry com `beforeSend` que remove `extra`, breadcrumbs de console e de rede; nenhum valor ou descrição em logs (BR-ACC-006); `sendDefaultPii: false` |
| **I**nformation disclosure | Backup do aparelho | Documento local fica no sandbox do app. Aceito: mesmo nível de apps financeiros pessoais sem dados bancários |
| **D**enial of service | Abuso do envio de OTP | Rate limit nativo do Supabase Auth + CAPTCHA opcional (v1.1) |
| **E**levation of privilege | Função `SECURITY DEFINER` mal escrita | `delete_my_account()` usa só `auth.uid()`, com `search_path` fixo e `EXECUTE` revogado de `anon` |

## Decisões

- **Segredos:** só `EXPO_PUBLIC_SUPABASE_URL`, `EXPO_PUBLIC_SUPABASE_ANON_KEY` e
  `EXPO_PUBLIC_SENTRY_DSN` vão no app, todos públicos por design. A `service_role` **nunca** entra
  no repositório nem no app. Arquivos `.env*` ficam no `.gitignore`; valores de build ficam em
  variáveis de ambiente do EAS.
- **Transporte:** apenas HTTPS (padrão Supabase).
- **Menor privilégio:** a role `anon` não tem acesso a nenhuma tabela; `authenticated` só acessa via
  RLS.
- **LGPD:** política de privacidade publicada (`docs/legal/politica-de-privacidade.md`); exclusão de
  conta no app; exportação de dados; dados na região sa-east-1.
- **Shift-left:** `npm audit` na CI, varredura de segredos (gitleaks) e testes de RLS em SQL.

## Relações

ADR-004, ADR-005, ADR-007, BR-ACC-003..006, RNF-04, RNF-05
