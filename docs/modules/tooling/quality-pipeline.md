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
  - eslint.config.js
  - .github/workflows/ci.yml
  - scripts/ai-docs/build-index.mjs
  - supabase/tests/run-plain.sh
adrs: [ADR-009, ADR-010]
last_verified_commit: SDK57-VERIFIED
---

# Pipeline de qualidade

Spec: [SPEC-010](../../../specs/SPEC-010-pipeline-de-qualidade.md).

| Comando | Gate |
|---|---|
| `npm run verify` | lint (0 avisos) + typecheck + Jest com cobertura + docs:check |
| `npm run test:db` | migrations + RLS em Postgres 15 descartável (Docker) |
| `npm run docs:index` | regenera `docs/.ai` |
| CI | verify + `npm audit` bloqueando crítica (triagem em [security-report](../../quality/security-report.md)) + RLS + gitleaks |
