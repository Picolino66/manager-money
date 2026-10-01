# ADR-003 — Persistência local em documento único versionado

- **Status:** ACCEPTED · **Fase:** F2 · **Data:** 2026-10-01

## Contexto

Hoje o estado fica em 3 chaves do AsyncStorage (`@daily-budget/config`, `/months`,
`/active-month`) gravadas com `Promise.all`. Um crash entre as escritas deixa o estado
inconsistente (DEF-002). Não há versão de schema; a migração legada é feita de forma implícita
em `normalizeMonth`. O sync precisa de metadados por registro (`updatedAt`, `deletedAt`, sujo ou
limpo).

## Opções consideradas

| Opção | Prós | Contras |
|---|---|---|
| Manter 3 chaves | Nada muda | DEF-002 continua |
| `AsyncStorage.multiSet` | Menor mudança | Atomicidade não garantida em todas as plataformas |
| **Documento único versionado** (uma chave, um `setItem`) | Escrita atômica; migrações explícitas por `schemaVersion`; validação com Zod | Reescreve o documento inteiro a cada escrita |
| expo-sqlite | Transações e consultas | Exige mapeamento relacional no cliente; mais esforço |

## Decisão

Persistir todo o estado em **uma chave** `@manager-money/state` com `schemaVersion: 2`, contendo
coleções normalizadas (`settings`, `fixedExpenses`, `cycles`, `expenses`, `sync`). Na leitura,
o documento passa por `migrate()` (v1 de 3 chaves → v2) e é validado por Zod. As chaves v1 só são
removidas **depois** da gravação bem-sucedida da v2.

**Gatilho de reavaliação** (`architectural-reassessment-engine`): mais de 5.000 gastos por usuário,
ou leitura/escrita do documento acima de 150 ms no p95. Nesse caso, migrar para expo-sqlite.

## Trade-offs

- O tamanho estimado é de ~250 bytes por gasto: 3 anos de uso intenso (~4.000 gastos) dá ~1 MB.
  Isso é aceitável no AsyncStorage.

## Consequências

- `src/infrastructure/storage/` passa a ter `schema.ts` (Zod), `migrations.ts` e `local-store.ts`.
- DEF-002 é resolvido estruturalmente.

## Relações

DEF-002, RNF-03, ADR-004, ADR-008
