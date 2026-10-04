---
id: web.cards
type: feature
module: web
title: Cartões de crédito, faturas e compras (web)
summary: >
  Lista e detalhe de cartões com limite comprometido, faturas (pagar total ou parcial, juros e multa,
  desfazer) e compras editáveis, usando os casos de uso e as visões do núcleo.
keywords: [cartões, fatura, limite, pagar fatura, juros, multa, compras, parcelas]
code:
  - client/src/features/cards/CardsPage.tsx
  - client/src/features/cards/CardDetailPage.tsx
  - client/src/features/cards/CardFormDialog.tsx
  - client/src/features/cards/StatementPanel.tsx
  - client/src/features/cards/StatementDialogs.tsx
  - client/src/components/LimitBar.tsx
  - packages/core/src/application/card-view.ts
  - packages/core/src/application/card-text.ts
symbols: [buildCardStatementsView, statementCycleKeys, weightByCycle, hasCardPurchases, describeStatementEntry, CardFormDialog, StatementPanel, PayStatementDialog, StatementChargesDialog, LimitBar]
business_rules: [BR-FIN-019, BR-FIN-025, BR-FIN-026, BR-FIN-028, BR-FIN-029, BR-FIN-033, BR-FIN-034]
adrs: [ADR-018, ADR-020, ADR-022]
tests: [packages/core/src/application/card-view.test.ts, client/src/features/settings.test.tsx]
last_verified_commit: 7903717+T-041
---

# Cartões (CLIENT-017)

- `/ajustes/cartoes`: cartões com "Fecha dia X · Vence dia Y", limite disponível e barra do comprometido, fatura
  atual e ações: editar, ativar/desativar e excluir (só sem compras, BR-FIN-028). O limite do cartão nunca é
  dinheiro para gastar (aviso na tela).
- `/ajustes/cartoes/:id`: limite total/comprometido/disponível; faturas atual, próxima, futuras e quitadas no
  ciclo (`buildCardStatementsView`, núcleo, igual ao app); peso por ciclo (`weightByCycle`) e em qual ciclo cada
  fatura pesa (`statementCycleKeys`).
- Fatura fechada/vencida/parcial no ciclo ativo: **Paguei a fatura** (`payStatement`: restante, parcial ou
  maior = encargos; depois do vencimento o valor é obrigatório) e **Registrar juros/multa**
  (`addStatementCharges`); cada lançamento do ciclo ativo tem **Desfazer** (`undoStatementPayment`). Sem ciclo
  ativo não há pagamento (o ciclo é aberto no app).
- Compras: lápis (`CardPurchaseFormDialog` → `updateCardPurchase`) e lixeira (`deleteCardPurchase`); compra já
  contada em ciclo fechado ou fatura paga aparece "Bloqueada" (BR-FIN-029). Compra anterior ao app só muda
  descrição e categoria.
- Fora desta entrega: situação inicial ("Compras anteriores ao app") e registrar compra nova no cartão.
- `card-view` e `card-text` moram no núcleo (antes em `app/src/screens`); app e web usam as mesmas.
