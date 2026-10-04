---
id: tooling.quality-pipeline
type: feature
module: tooling
title: Pipeline de qualidade
summary: >
  Scripts npm e workflow de CI que aplicam os gates de lint, typecheck, testes com cobertura ≥ 80%,
  knowledge layer, RLS e varredura de segredos.
keywords: [ci, lint, jest, cobertura, github actions, verify]
code:
  - package.json
  - app/package.json
  - app/eslint.config.js
  - packages/core/package.json
  - client/package.json
  - .github/workflows/ci.yml
  - scripts/ai-docs/build-index.mjs
  - supabase/tests/run-plain.sh
adrs: [ADR-009, ADR-010, ADR-022]
last_verified_commit: 3b9bf25+T-040
---

# Pipeline de qualidade

Spec: [SPEC-010](../../../specs/SPEC-010-pipeline-de-qualidade.md).

npm workspaces (ADR-022): `npm ci` roda **na raiz** (lockfile único) e instala `packages/core`,
`app/` e `client/`. Cada projeto tem seus scripts (`verify`); a raiz guarda os comandos transversais
(knowledge layer, banco) e atalhos `verify:core`, `verify:app`, `verify:client`.

| Onde | Comando | Gate |
|---|---|---|
| `packages/core/` | `npm run verify` | lint (0 avisos, regra de núcleo puro) + typecheck + Vitest com cobertura ≥ 80% |
| `app/` | `npm run verify` | lint (0 avisos) + typecheck + Jest com cobertura |
| `client/` | `npm run verify` / `npm run build` | lint (0 avisos, camadas, sem HTML dinâmico) + typecheck + Vitest com cobertura ≥ 80% em store/infrastructure/lib; build exige `VITE_SUPABASE_*` |
| `client/` | `npm run test:e2e` | Playwright **local** (build + preview com CSP); fluxo autenticado só com `E2E_EMAIL`/`E2E_PASSWORD` de usuário de teste |
| raiz | `npm run docs:check` | knowledge layer (gerador em modo verificação + validador) |
| raiz | `npm run docs:index` | regenera `docs/.ai` |
| raiz | `npm run test:db` | migrations + RLS em Postgres 15 descartável (Docker) |
| CI | — | job `core` (verify) + job `client` (lint, typecheck, test:coverage, build com `VITE_*` fictícios, `npm audit -w client`) + job `app` (verify + `npm audit -w app` bloqueando crítica, triagem em [security-report](../../quality/security-report.md)) + job `docs` + job `database` (RLS) + gitleaks |
