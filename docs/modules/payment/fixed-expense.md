---
id: payment.fixed-expense
type: feature
module: payment
title: Pagar despesas fixas do ciclo
summary: >
  O Hoje lista as despesas fixas do ciclo como pendentes ou pagas; Pagar abre a escolha de Pix,
  dinheiro, débito ou crédito (cartão, parcelas e juros) e desconta o saldo do ciclo.
keywords: [pagar, despesa fixa, pix, dinheiro, débito, crédito, juros, pendente, desfazer]
code:
  - src/components/FixedExpensesCard.tsx
  - src/components/PayFixedExpenseModal.tsx
  - src/screens/DashboardScreen.tsx
  - src/application/payment.use-cases.ts
  - src/domain/financial/payments.ts
  - src/domain/financial/financial.calculations.ts
  - src/application/selectors.ts
symbols: [payFixedExpense, undoFixedPayment, calculatePaidFixedAmount, calculateInitialAvailableAmount, selectCycleAdjustments]
adrs: [ADR-015, ADR-014]
tests: [src/application/payment.use-cases.test.ts, src/screens/screens.test.tsx, src/infrastructure/sync/sync-engine.test.ts]
business_rules: [BR-FIN-004, BR-FIN-005, BR-FIN-021, BR-FIN-022]
last_verified_commit: a16e575+T-020
---

# Pagar despesas fixas do ciclo

Spec: [SPEC-014](../../../specs/SPEC-014-pagamento-de-fixas-e-renda-avulsa.md).

- **Lista:** "Despesas fixas do ciclo" no Hoje, sempre visível. Cada linha: nome (e parcela `n/N` dos
  parcelamentos), categoria, valor, **Pendente** ou **Pago · forma**, e **Pagar**/**Desfazer**.
  Resumo "Pagas … · Pendentes …". Pendente **não desconta** o saldo (BR-FIN-004).
- **Pagar (à vista):** Pix, Dinheiro ou Débito desconta o valor da renda do ciclo agora
  (`paidFixedExpenses` em `calculateInitialAvailableAmount`).
- **Pagar (crédito):** escolhe cartão, parcelas e juros (R$). Cria compra no cartão de `valor +
  juros` (BR-FIN-019/020); só as parcelas descontam, no ciclo do fechamento da fatura. A prévia
  mostra "Total … em Nx de … · 1ª parcela entra neste ciclo / no próximo". Sem cartão: atalho
  para cadastrar.
- Um pagamento vigente por despesa e ciclo; a data do pagamento é hoje, limitada ao período do ciclo.
- **Desfazer** (ciclo ativo): remove o pagamento e, no crédito, a compra no cartão.
- No ciclo seguinte as fixas voltam a Pendente; pagamentos de ciclos fechados ficam no histórico.
- O pagamento guarda foto do nome e da categoria, então editar a despesa não muda o histórico.
