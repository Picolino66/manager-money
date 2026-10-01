---
spec: SPEC-009
features: [application.use-cases]
---
# SPEC-009 — Camada de aplicação (casos de uso puros)

## Objetivo
Tirar as regras da store Zustand e torná-las funções puras testáveis sobre `LocalStateV2` (ADR-001, ADR-008).

## Docs relacionados
[overview](../docs/architecture/overview.md) · [ADR-001](../adr/ADR-001-padrao-arquitetural.md)

## Requisitos relacionados
RNF-09 · BR-FIN-* (todas as regras com efeito de escrita)

## Regras
- Assinatura: `useCase(state, input, ctx) → state`, com `ctx = { now: Date; newId: (prefix) => string }`.
- Erros de regra lançam `DomainError` com mensagem pt-BR exibível.
- Toda escrita marca o registro com `updatedAt = ctx.now`, `dirty = true`.
- Seletores (`selectConfig`, `selectActiveMonth`, `selectClosedMonths`) montam os tipos de domínio ignorando registros excluídos.
- A store só faz: aplicar o caso de uso → persistir → atualizar o estado → agendar o sync.

## Comportamento
Sem mudança visível (refatoração), exceto as correções das SPEC-002 e SPEC-003.

## Fluxos
Todos os fluxos de escrita.

## Critérios de aceite
- [ ] `src/application` não importa React, React Native, AsyncStorage nem Supabase (regra de lint).
- [ ] Cobertura ≥ 90% em `src/application`.

## Tasks derivadas
T-002
