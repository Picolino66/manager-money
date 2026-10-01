---
id: expense.register
type: feature
module: expense
title: Registrar e editar gasto
summary: >
  Formulário de valor, categoria, descrição e data para criar ou editar um gasto do ciclo ativo.
keywords: [gasto, registrar, lançamento, editar, despesa]
code:
  - src/screens/AddExpenseScreen.tsx
  - src/application/cycle.use-cases.ts
  - src/utils/date.ts
symbols: [addExpense, updateExpense, assertDateWithinCycle, parseBRDateInput]
tests: [src/application/cycle.use-cases.test.ts]
business_rules: [BR-FIN-001, BR-FIN-011, BR-FIN-012]
last_verified_commit: 359de21
---

# Registrar e editar gasto

- Valor em centavos > 0 (BR-FIN-001); descrição obrigatória; data `DD/MM/AAAA` dentro do ciclo
  ativo (BR-FIN-011); categoria vazia vira "Outros" (BR-FIN-012).
- Modo edição: rota `AddExpense` com `expenseId`; se o gasto não existir, mostra estado vazio.
