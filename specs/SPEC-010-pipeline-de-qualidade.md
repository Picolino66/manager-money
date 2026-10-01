---
spec: SPEC-010
features: [tooling.quality-pipeline]
---
# SPEC-010 — Pipeline de qualidade

## Objetivo
Gates automáticos de lint, tipos, testes, cobertura, segurança e knowledge layer (DEF-008).

## Docs relacionados
[ADR-010](../adr/ADR-010-testes-e-qualidade.md)

## Requisitos relacionados
RNF-09 · DEF-008

## Regras
- Scripts: `lint`, `typecheck`, `test`, `test:coverage`, `test:db`, `docs:index`, `docs:check`, `verify` (todos em sequência).
- Jest (`jest-expo`) com limite de cobertura global de 80% (linhas) em domain, application, infrastructure e utils.
- Na CI (GitHub Actions), em PR e push para `main`/`master`: verify + `npm audit --omit=dev --audit-level=high` + gitleaks + testes SQL de RLS.

## Comportamento
—

## Fluxos
—

## Critérios de aceite
- [ ] `npm run verify` passa localmente.
- [ ] O workflow valida a sintaxe com `actionlint` (se disponível) ou com revisão.

## Tasks derivadas
T-001, T-014
