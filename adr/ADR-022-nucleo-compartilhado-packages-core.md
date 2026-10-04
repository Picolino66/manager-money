# ADR-022 — Núcleo compartilhado em `packages/core` com npm workspaces

- **Status:** ACCEPTED · **Fase:** F2 (evolução) · **Data:** 2026-10-04
- **Depende de:** [ADR-019](ADR-019-estrutura-do-repositorio-app-client-supabase.md) (atualiza: workspaces
  passam a existir), [ADR-020](ADR-020-client-web-stack-e-integracao.md), [ADR-001](ADR-001-padrao-arquitetural.md),
  [ADR-004](ADR-004-sincronizacao.md), [ADR-010](ADR-010-testes-e-qualidade.md).
- **Spec:** [SPEC-022](../specs/SPEC-022-client-web-mvp.md) · task [T-033](../tasks/done/T-033.md).

## Contexto

O client web precisa das mesmas regras do app (ADR-020). Elas moram em `app/src/domain`,
`app/src/application`, `app/src/utils` e no contrato remoto (`infrastructure/sync/types.ts` e
`mappers.ts`). Ao mapear as dependências reais apareceram quatro pontos que o plano não previa:

1. `mappers.ts` importava `legacyIncomeSources` de `storage/migrations.ts` (que fica no app).
2. `collectDirty` (linhas pendentes por tabela, `closed` antes de `active`) é pura, mas morava em
   `sync-engine.ts`. O web precisa exatamente dela para gravar só o que o caso de uso alterou.
3. `mapSupabaseError` (classificação de `23505`/`42501`/rede) morava em `supabase-remote.ts`.
4. O texto da política de privacidade (`app/src/legal/privacy-policy.ts`) é usado pelos dois clientes.

## Opções consideradas

| Opção | Prós | Contras |
|---|---|---|
| **`packages/core` como pacote TS (sem build) + npm workspaces** | Fonte única; Metro (SDK 52+) e Vite consomem TS direto; lockfile único | `npm ci` passa para a raiz; Jest do app precisa transformar o pacote |
| Pacote com build (`tsc` → `dist/`) | Consumidores sem transformação | Passo de build a mais em dev e CI; mapas de fonte |
| Alias `../app/src` no client | Nada a mover | Acopla o web a caminhos internos do app (rejeitado na ADR-020) |
| Reexportar do app (shims) | Menos arquivos tocados no app | Duas portas para o mesmo código; confusão sobre a fonte |

## Decisão

- Raiz com `"workspaces": ["packages/*", "app", "client"]` e um único `package-lock.json`.
- `packages/core` (`@manager-money/core`, privado, TS fonte exportado por subcaminho `./*` → `./src/*.ts`) contém:
  `domain/financial/*`, `application/*`, `utils/{date,currency}.ts`, `contract/{types,mappers}.ts`,
  `contract/dirty.ts` (`collectDirty`, `acknowledge`, `markAllClean`), `contract/errors.ts` (`mapSupabaseError`, estrutural,
  sem importar o Supabase), `legal/privacy-policy.ts` e `legacyIncomeSources` (em `contract/mappers.ts`; `migrations.ts` do app
  importa de lá). Importação por subcaminho: `@manager-money/core/application/selectors`.
- Fica no app: `sync-engine.ts` (importa `collectDirty`/`acknowledge` do core), `memory-remote.ts`,
  `supabase-remote.ts`, `storage/{schema,migrations,local-store}.ts`, logger, store, telas.
- Testes do core movidos com o código e executados com **Vitest** (TS nativo, sem Babel; os testes
  não usam mocks do Jest). Cobertura do core ≥ 80% (mesmo critério da ADR-010).
- A regra de camadas do lint (sem React, React Native, AsyncStorage ou Supabase) vale para todo o core.
- O app não muda de comportamento: só os imports trocam de caminho.

## Consequências

- CI: `npm ci` na raiz; jobs usam `npm run <script> -w app|client|@manager-money/core`.
- EAS instala a partir da raiz do workspace (suportado pelo EAS); validar com um build preview manual.
- Versões de React iguais em app e client (19.2.x) para não duplicar o React instalado em comum.
- Mudanças em regra financeira passam a disparar os testes do core e dos dois clientes.
