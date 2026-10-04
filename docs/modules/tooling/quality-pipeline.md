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
  - .github/workflows/ci.yml
  - scripts/ai-docs/build-index.mjs
  - supabase/tests/run-plain.sh
adrs: [ADR-009, ADR-010]
last_verified_commit: 7c4199c+T-029
---

# Pipeline de qualidade

Spec: [SPEC-010](../../../specs/SPEC-010-pipeline-de-qualidade.md).

Cada projeto tem seus próprios scripts (ADR-019): o app em `app/package.json`; os comandos
transversais (knowledge layer e banco) no `package.json` mínimo da raiz, sem dependências.

| Onde | Comando | Gate |
|---|---|---|
| `app/` | `npm run verify` | lint (0 avisos) + typecheck + Jest com cobertura |
| raiz | `npm run docs:check` | knowledge layer (gerador em modo verificação + validador) |
| raiz | `npm run docs:index` | regenera `docs/.ai` |
| raiz | `npm run test:db` | migrations + RLS em Postgres 15 descartável (Docker) |
| CI | — | job `app` (verify + `npm audit` bloqueando crítica, triagem em [security-report](../../quality/security-report.md)) + job `docs` + job `database` (RLS) + gitleaks |
