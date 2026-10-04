---
id: expense.delete
type: feature
module: expense
title: Excluir gasto
summary: >
  Exclusão lógica de um gasto do ciclo ativo, com confirmação, propagada no sync.
keywords: [excluir gasto, apagar lançamento, remover]
code:
  - packages/core/src/application/cycle.use-cases.ts
  - app/src/screens/AddExpenseScreen.tsx
symbols: [deleteExpense, findEditableExpense]
business_rules: [BR-FIN-011, BR-SYNC-002]
tests: [packages/core/src/application/cycle.use-cases.test.ts]
last_verified_commit: c47cf18+T-025
---

# Excluir gasto

Spec: [SPEC-003](../../../specs/SPEC-003-exclusao-de-gasto.md). Botão "Excluir gasto" na edição →
confirmação → `deletedAt` + `dirty`. Gastos excluídos somem de todos os cálculos e listas.
