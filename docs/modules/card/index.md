---
id: card
type: module
module: card
title: Cartões de crédito
summary: >
  Cartões (nome, fechamento, vencimento, limite, ativo), compras parceladas no crédito, faturas
  derivadas com vários lançamentos (pagamento total ou parcial, encargos) e liberação proporcional
  do limite, e situação inicial (total informado da fatura e parcelamentos anteriores ao app).
code:
  - src/domain/financial/credit-card.ts
  - src/application/card.use-cases.ts
last_verified_commit: bfe9de6+T-028r2
---

# Módulo: cartões de crédito

Decisões: [ADR-014](../../../adr/ADR-014-cartoes-de-credito.md), [ADR-017](../../../adr/ADR-017-faturas-limite-e-situacao-inicial.md)
(fatura pelo vencimento, limite, situação inicial) e [ADR-018](../../../adr/ADR-018-pagamento-parcial-e-total-da-fatura.md)
(pagamento parcial, encargos, total informado da fatura, restante transportado). Invariantes: INV-01..INV-10 em
[business-rules](../../business/business-rules.md).

| Feature | Doc |
|---|---|
| `card.manage` | [manage.md](manage.md) |
| `card.purchase` | [purchase.md](purchase.md) |
| `card.statement` | [statement.md](statement.md) |
| `card.existing-debt` | [existing-debt.md](existing-debt.md) |
