---
id: application.use-cases
type: feature
module: application
title: Casos de uso e seletores
summary: >
  Funções (estado, entrada, contexto) → estado para toda escrita; seletores que montam config,
  ciclo ativo e ciclos fechados ignorando registros excluídos.
keywords: [caso de uso, store, zustand, seletor, DomainError]
code:
  - src/application/cycle.use-cases.ts
  - src/application/selectors.ts
  - src/application/state.ts
  - src/store/financial.store.ts
symbols: [recalculateActiveCycleBalance, saveConfig, addCategory, addExpense, updateExpense, selectActiveMonth, selectClosedMonths, selectCycleAdjustments, touch, commit]
adrs: [ADR-001, ADR-008]
tests: [src/application/cycle.use-cases.test.ts, src/store/financial.store.test.ts]
last_verified_commit: c47cf18+T-025
---

# Casos de uso

Spec: [SPEC-009](../../../specs/SPEC-009-camada-de-aplicacao.md).

- Pagamentos e rendas avulsas: [payment.fixed-expense](../payment/fixed-expense.md); cartões: [card.purchase](../card/purchase.md),
  [card.statement](../card/statement.md), [card.existing-debt](../card/existing-debt.md); compromissos e projeção: [cycle.dashboard](../cycle/dashboard.md).
- `recalculateActiveCycleBalance` refaz o saldo inicial do ciclo ativo com `selectCycleAdjustments` (parcelas, rendas avulsas,
  fixas pagas à vista, fixas pendentes reservadas e juros de faturas) depois de toda escrita que mexe no orçamento,
  ao carregar o app (`loadAppData`, grava se mudou) e ao fim de cada sync (o saldo do ciclo ativo é derivado).
- Contexto injetável `{ now, newId }` → testes determinísticos.
- Toda escrita usa `touch` (`updatedAt` + `dirty`); remoções são lógicas.
- A store aplica o caso de uso numa **fila serializada** (`commit`): calcula sobre o documento mais
  recente, grava, publica e agenda sync — escritas concorrentes não se perdem.
- Lint impede `react`, `react-native`, AsyncStorage e Supabase em domain/application.
