---
id: payment.extra-income
type: feature
module: payment
title: Rendas avulsas do ciclo
summary: >
  Tela Rendas do ciclo: lança, lista e exclui entradas extras (nome, valor, data) que somam ao
  saldo disponível do ciclo ativo.
keywords: [renda avulsa, entrada extra, freela, 13º, receita]
code:
  - app/src/screens/IncomesScreen.tsx
  - packages/core/src/application/payment.use-cases.ts
  - packages/core/src/domain/financial/payments.ts
symbols: [addExtraIncome, deleteExtraIncome, calculateExtraIncomeTotal]
adrs: [ADR-015]
tests: [packages/core/src/application/payment.use-cases.test.ts, app/src/screens/screens.test.tsx]
business_rules: [BR-FIN-004, BR-FIN-023]
last_verified_commit: 7903717+historico-acoes
---

# Rendas avulsas do ciclo

Spec: [SPEC-014](../../../specs/SPEC-014-pagamento-de-fixas-e-renda-avulsa.md) · acesso: Hoje → **Renda**.

- Nome obrigatório, valor > 0, data `DD/MM/AAAA` dentro do ciclo ativo (padrão: hoje).
- Soma ao saldo inicial do ciclo (BR-FIN-004/023) e aparece em "Rendas avulsas" do Plano do ciclo.
- Exclusão lógica; só no ciclo ativo. Rendas de ciclos fechados não mudam o histórico nem o ciclo seguinte.
- Sem ciclo ativo: estado vazio com atalho para iniciar o ciclo.
