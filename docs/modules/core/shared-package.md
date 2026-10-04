---
id: core.shared-package
type: feature
module: core
title: Pacote @manager-money/core e npm workspaces
summary: >
  Extração de domain, application, utils, contrato remoto e texto legal do app para packages/core,
  consumido como fonte TypeScript por subcaminho (Metro no app, Vite no web), com testes em Vitest.
keywords: [workspaces, núcleo, pacote, compartilhado, monorepo, vitest]
code:
  - packages/core/package.json
  - packages/core/vitest.config.ts
  - packages/core/src/contract/dirty.ts
  - packages/core/src/contract/errors.ts
  - packages/core/src/application/category-analysis.ts
  - package.json
symbols: [collectDirty, acknowledge, markAllClean, mapSupabaseError, selectCategorizedItems, filterCategorizedItems, summarizeByCategory]
adrs: [ADR-022, ADR-020, ADR-001]
tests: [packages/core/src/contract/dirty.test.ts, packages/core/src/application/category-analysis.test.ts]
last_verified_commit: 3b9bf25+T-040
---

# Pacote @manager-money/core

Spec: [SPEC-022](../../../specs/SPEC-022-client-web-mvp.md) · task [T-033](../../../tasks/done/T-033.md).

- **Conteúdo:** `domain/financial`, `application` (casos de uso, seletores, `category-analysis`),
  `utils/{date,currency}`, `contract/{types,mappers,dirty,errors}`, `legal/privacy-policy`.
- **Importação:** por subcaminho, sem build: `@manager-money/core/application/selectors`
  (`exports: { "./*": "./src/*.ts" }`). Metro (app), Jest do app, Vite e Vitest do web transformam o TS.
- **Fica no app:** motor de sync (`sync-engine`, `memory-remote`, `supabase-remote`), schema e
  migrações do documento local, logger, store e telas.
- **Registros alterados:** casos de uso marcam `dirty` (`touch`); `collectDirty` devolve as linhas por
  tabela (ciclos fechados antes do ativo). O app usa no outbox; o web, na gravação imediata.
  `markAllClean` zera as marcações após o web ler o servidor.
- **Análise por categoria:** `selectCategorizedItems`/`filterCategorizedItems`/`summarizeByCategory`
  saíram da tela de Categorias do app para o núcleo (sem mudança de regra), garantindo os mesmos totais no web.
- **Workspaces:** raiz com `packages/*`, `app`, `client`; `npm ci` na raiz (lockfile único).
- **Gates:** `npm run verify -w @manager-money/core` (lint de núcleo puro, typecheck, Vitest ≥ 80%).
