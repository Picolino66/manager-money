# ADR-010 — Testes, cobertura e quality gates

- **Status:** ACCEPTED · **Fase:** F4 · **Data:** 2026-10-01

## Contexto
Hoje existe um único arquivo de asserts executado com `tsx`, sem medição de cobertura (DEF-008). O sync e as correções de ciclo são de alto risco.

## Opções consideradas
| Opção | Prós | Contras |
|---|---|---|
| Manter tsx + asserts | Rápido | Sem cobertura nem mocks |
| Vitest | Rápido | Integração com RN/Expo menos madura |
| **Jest + jest-expo + Testing Library RN** | Padrão do ecossistema Expo; mocks nativos prontos | Mais lento |

## Decisão
- **Pirâmide:** unitários (domain, application, mappers, sync com `MemoryRemote`, storage com mock do AsyncStorage) → componentes (telas críticas com Testing Library) → SQL (RLS em Postgres descartável) → QA manual (campanha em F6).
- **Cobertura:** limite global de **80% de linhas** sobre `src/domain`, `src/application`, `src/infrastructure`, `src/utils` e `src/store`. As telas são medidas, mas não entram no limite.
- **Gates F5:** lint sem erros, typecheck, testes, cobertura, `docs:check`, `test:db`.
- **E2E automatizado (Maestro/Detox)** fica fora da v1.0. Os fluxos críticos são cobertos por testes de componente + campanha manual em F6.

## Trade-offs
Sem E2E em aparelho real automatizado; o risco é mitigado pela campanha manual antes da publicação.

## Consequências
`engineering.test_coverage_threshold = 80`.

## Relações
SPEC-010, T-001, T-014, RNF-09
