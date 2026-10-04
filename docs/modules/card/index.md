---
id: card
type: module
module: card
title: Cartões de crédito
summary: >
  Cartões (nome, fechamento, vencimento, limite, ativo), compras parceladas no crédito, faturas
  derivadas com pagamento e liberação de limite, e situação inicial (dívidas anteriores ao app).
code:
  - src/domain/financial/credit-card.ts
  - src/application/card.use-cases.ts
last_verified_commit: c47cf18+T-025r4
---

# Módulo: cartões de crédito

Decisões: [ADR-014](../../../adr/ADR-014-cartoes-de-credito.md) e [ADR-017](../../../adr/ADR-017-faturas-limite-e-situacao-inicial.md)
(fatura pelo vencimento, limite, situação inicial).

| Feature | Doc |
|---|---|
| `card.manage` | [manage.md](manage.md) |
| `card.purchase` | [purchase.md](purchase.md) |
| `card.statement` | [statement.md](statement.md) |
| `card.existing-debt` | [existing-debt.md](existing-debt.md) |
