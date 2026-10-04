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
  - src/components/CardLimitNotice.tsx
  - src/application/cycle.use-cases.ts
  - src/utils/date.ts
symbols: [addExpense, updateExpense, assertDateWithinCycle, parseBRDateInput]
tests: [src/application/cycle.use-cases.test.ts]
business_rules: [BR-FIN-001, BR-FIN-011, BR-FIN-012, BR-FIN-025, BR-FIN-026]
last_verified_commit: c47cf18+T-025r2
---

# Registrar e editar gasto

- Valor em centavos > 0 (BR-FIN-001); data `DD/MM/AAAA` dentro do ciclo ativo (BR-FIN-011); categoria vazia
  vira "Outros" (BR-FIN-012).
- **Ordem do formulário (novo gasto):** Valor → **Forma de pagamento** (À vista | Cartão de crédito) → no crédito:
  Cartão (só **ativos**, `selectActiveCreditCards`) → Parcelas → caixa de limite (`CardLimitNotice`, "Limite
  disponível do cartão", deixando claro que não é dinheiro para gastar) → fatura e ciclo da 1ª parcela →
  Categoria → Descrição → Data.
- **Descrição:** obrigatória no crédito; à vista é opcional e, vazia, grava o **nome da categoria**.
- **À vista:** cria gasto do dia. **Crédito:** vira compra parcelada ([card.purchase](../card/purchase.md)), não cria
  gasto do dia e pesa na fatura do ciclo do vencimento (BR-FIN-025).
- **Estouro de limite (BR-FIN-026):** aviso na caixa e Alert "Passa do limite do cartão … Continuar mesmo assim?"
  (`confirmCardLimit`); Continuar registra, Cancelar volta — **nunca bloqueia**. O mesmo aviso existe no
  pagamento de fixa no crédito (`PayFixedExpenseModal`).
- Modo edição: rota `AddExpense` com `expenseId`; se o gasto não existir, mostra estado vazio.
