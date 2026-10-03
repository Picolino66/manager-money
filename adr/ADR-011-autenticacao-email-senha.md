# ADR-011 — Autenticação por e-mail e senha, sem envio de e-mail

- **Status:** ACCEPTED · **Fase:** F2 (evolução, modo feature-evolution) · **Data:** 2026-10-03
- **Substitui:** [ADR-005](ADR-005-autenticacao.md) (OTP por e-mail)

## Contexto

Ao configurar o projeto Supabase de produção, constatamos que:

1. Sem **SMTP próprio**, os templates de e-mail não podem ser editados. O template padrão de
   "Magic link or OTP" envia **só um link**, sem o código de 6 dígitos que o app (ADR-005) exige.
2. Sem SMTP próprio, o Supabase limita o envio a ~2 e-mails por hora no projeto, o que não serve
   para usuários reais.

O dono do produto preferiu não configurar SMTP agora.

## Opções consideradas

| Opção | Prós | Contras |
|---|---|---|
| Manter OTP + configurar SMTP (Gmail ou Resend) | Sem senha | Exige conta e configuração de SMTP; o dono optou por não fazer |
| Magic link com deep link | Sem senha | Limite de ~2 e-mails/h sem SMTP; deep link e Redirect URLs |
| **E-mail + senha, confirmação de e-mail desligada** | Nenhum e-mail enviado; sem limite; menor mudança | Sem "esqueci a senha" até haver SMTP; senha é mais superfície de ataque |
| Login com Google | Um toque | Google Cloud + exigência de "Sign in with Apple" no iOS |

## Decisão

- Login por **e-mail + senha** via `supabase.auth.signInWithPassword` e `signUp`.
- **Confirm email desligado** no Supabase: `signUp` já retorna a sessão.
- Senha com **mínimo de 8 caracteres**, exigida no app e no Supabase (Minimum password length = 8).
- Login continua **opcional** (BR-ACC-001). Sync, exportação e exclusão não mudam.
- Se o projeto voltar a exigir confirmação, o app informa "Confirme o cadastro pelo e-mail
  recebido e depois entre".

## Trade-offs

- **Sem recuperação de senha** enquanto não houver SMTP. Mitigação: os dados ficam no aparelho e
  podem ser exportados; ao configurar SMTP, adicionar "Esqueci a senha" (`resetPasswordForEmail`)
  sem mudar o restante.
- **E-mail não verificado:** alguém pode criar uma conta com um e-mail de outra pessoa. O impacto é
  baixo: a conta só contém dados de quem a criou, e o dono do e-mail não recebe nada.
- **Força bruta de senha:** mitigada pelo rate limit de Auth do Supabase e pelo mínimo de 8 caracteres.

## Consequências

- `session.store`: `signIn(email, senha)` e `signUp(email, senha)` substituem `sendCode`/`verifyCode`.
- `AccountScreen`: campos E-mail e Senha, com os botões **Entrar** e **Criar conta**.
- Runbook §2: confirmação de e-mail desligada e mínimo de 8. Templates e SMTP passam a ser opcionais.
- **Gatilho de revisão:** configurar SMTP → adicionar recuperação de senha (nova ADR, se o fluxo mudar).

## Relações

RF-13, BR-ACC-001, ADR-006, SPEC-005, T-016
