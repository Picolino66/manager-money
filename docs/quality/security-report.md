---
id: quality.security-report
type: module
module: quality
title: Relatório de segurança (F6)
summary: >
  Resultado do security-testing-engine: auditoria de dependências com triagem, testes de RLS,
  varredura de segredos, verificação do threat model e achados de revisão de código.
code:
  - supabase/migrations/20261001000000_init.sql
  - src/infrastructure/supabase/session-storage.ts
  - src/infrastructure/export/share-json.ts
adrs: [ADR-006]
last_verified_commit: a88175c
---

# Relatório de segurança — F6

Data: 2026-10-01 · Escopo: app (bundle Android) + schema Supabase + CI.

## 1. Dependências (SCA)

| Momento | Crítica | Alta | Moderada | Baixa |
|---|---|---|---|---|
| Antes (`359de21`) | 1 | 7 | 13 | 1 |
| Depois de `npm audit fix` (sem `--force`, só lockfile) | **0** | 2 | 10 | 0 |

**Triagem das restantes** (todas exigem `--force` = troca de major do Expo SDK):

| Pacote | Caminho | Executa onde | Risco no app publicado | Decisão |
|---|---|---|---|---|
| `image-size` (alta) | expo → @expo/metro → metro | Metro (build/dev server) | Nenhum: não entra no bundle Hermes | Aceito até o SDK 55 |
| `postcss` (alta) | expo → @expo/metro-config | Metro (CSS web) | Nenhum | Aceito até o SDK 55 |
| `uuid` via `xcode` (moderada) | @expo/config-plugins | Prebuild iOS | Nenhum | Aceito até o SDK 55 |
| `@expo/*`, `expo`, `expo-asset`, `expo-constants` (moderada) | Propagação das acima | Build | Nenhum | Aceito até o SDK 55 |

A CI bloqueia vulnerabilidade **crítica** (`npm audit --omit=dev --audit-level=critical`).
**Gatilho de revisão:** upgrade para o Expo SDK 55 (`maintenance-engine`).

### Reavaliação após o upgrade para o Expo SDK 57 (ADR-012, 2026-10-03)

| Item | Resultado |
|---|---|
| `image-size`, `postcss` (altas acima) | **Resolvidas** pelo SDK 57 |
| Críticas | **0** |
| `braces` ≤ 3.0.3 (alta, DoS por expansão) | Via Metro e Jest (`micromatch`). **Sem versão corrigida publicada.** Tooling local; não entra no bundle |
| `node-forge` ≤ 1.4.0 (alta, verificação de assinatura RSA) | Via `@expo/code-signing-certificates` (CLI, assinatura de EAS Update, que não usamos). **Sem versão corrigida publicada** |
| `uuid` < 11.1.1 (moderada) | Via `xcode` (prebuild iOS). Falha em v3/v5/v6 com `buf`; o `xcode` usa só v4, então **não é explorável** |

O total do `npm audit` (24 altas e 9 moderadas) é quase todo propagação dessas três causas. A CI
continua bloqueando só vulnerabilidade crítica. **Gatilho:** quando `braces` ou `node-forge`
publicarem correção, rodar `npm audit fix` (`maintenance-engine`).

## 2. Isolamento de dados (DAST de banco)

`npm run test:db`: 12/12 asserções em Postgres 15 (isolamento A×B em leitura e escrita,
`anon` sem acesso, DELETE físico negado, índice de ciclo ativo, constraints de valor,
`delete_my_account` em cascata e negado para `anon`).

## 3. Segredos

Varredura por padrões (JWT, `service_role`, chaves privadas, AWS, atribuições de senha) nos arquivos
versionados: **0 achados**. `.env*` está no `.gitignore` (exceto `.env.example`, vazio). Na CI: gitleaks.

## 4. Verificação do threat model (ADR-006)

| Ameaça | Controle | Evidência |
|---|---|---|
| Token roubado do armazenamento | Sessão AES-256-CTR, chave no SecureStore | `session-storage.test.ts`: o texto do token não aparece no AsyncStorage |
| Escrita em nome de outro usuário | RLS `WITH CHECK` | RLS 12/12 |
| Vazamento em logs | Lista permitida no logger | `logger.test.ts` |
| Dados exportados residuais | Arquivo apagado após o compartilhamento | `share-json.test.ts` (corrigido na F6) |
| Força bruta de senha (ADR-011) | Mínimo de 8 caracteres + rate limit do Supabase Auth | `session.store.test.ts` + runbook §2 |

## 5. Achados de revisão de código

| # | Achado | Severidade | Status |
|---|---|---|---|
| S1 | JSON exportado permanecia no cache após o compartilhamento | Baixa | **Corrigido** |
| S2 | Campos de formulário sem rótulo acessível (descoberto pelos testes de UI) | Baixa (a11y) | **Corrigido** |
| S3 | AES-CTR sem MAC: um atacante com acesso de escrita ao armazenamento do app poderia corromper a sessão | Baixa | Aceito: o resultado é sessão inválida (novo login), nunca acesso indevido |
| S4 | SMTP padrão do Supabase tem limite baixo de e-mails por hora | Média (disponibilidade) | **Resolvido pela ADR-011**: o login não envia e-mail |
| S5 | E-mail não verificado no cadastro (confirmação desligada) | Baixa | Aceito na ADR-011: a conta só contém dados de quem a criou |
| S6 | Sem recuperação de senha | Média (usabilidade) | Aceito até haver SMTP; dados locais e exportação continuam disponíveis |

**Veredito:** nenhuma vulnerabilidade crítica ou alta sem mitigação no app publicado.
