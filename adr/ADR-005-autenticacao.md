# ADR-005 — Autenticação por OTP de e-mail; login opcional

- **Status:** SUPERSEDED por [ADR-011](ADR-011-autenticacao-email-senha.md) em 2026-10-03 · **Fase:** F2 · **Data:** 2026-10-01
- **Ajusta:** RF-13 (snapshot O1). Login social (Apple/Google) sai da v1.0.

## Contexto

O RF-13 previa e-mail + Apple + Google. Ainda não há conta Apple Developer nem Google Cloud
configuradas. A diretriz 4.8 da App Store exige "Sign in with Apple" **somente** se o app oferecer
login social de terceiros.

## Opções consideradas

| Opção | Prós | Contras |
|---|---|---|
| E-mail + senha | Conhecido | Recuperação de senha, força de senha e vazamento: mais superfície |
| **OTP de 6 dígitos por e-mail** (Supabase Auth) | Sem senha; sem deep link obrigatório; sem exigência de Apple Sign-in | Depende da entrega de e-mail (SMTP próprio recomendado em produção) |
| Magic link | Sem senha | Exige deep linking e universal links; fluxo pior no iOS |
| Apple + Google | 1 toque | Exige contas e configuração ainda indisponíveis |

## Decisão

- **v1.0:** OTP de e-mail via `supabase.auth.signInWithOtp` + `verifyOtp` (tipo `email`).
- **Login opcional** (BR-ACC-001): o app inteiro funciona sem conta.
- Exclusão de conta via função `delete_my_account()` (`SECURITY DEFINER`), que apaga os dados e o
  usuário de `auth.users`.
- **v1.1:** Apple e Google Sign-in, com ADR própria.

## Consequências

- RF-13 é reinterpretado como "criar conta e entrar por código enviado ao e-mail".
- Produção exige SMTP próprio no Supabase. O SMTP padrão tem limite baixo de envios por hora. Isso
  está registrado no runbook.

## Relações

RF-13, RF-16, RF-18, BR-ACC-001, BR-ACC-003, ADR-006
