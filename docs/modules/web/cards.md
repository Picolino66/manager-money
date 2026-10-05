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
  - client/src/features/cards/CardDebtPage.tsx
  - packages/core/src/application/card-debt.ts
  - client/src/features/cards/StatementPanel.tsx
  - client/src/features/cards/StatementDialogs.tsx
  - client/src/components/LimitBar.tsx
  - packages/core/src/application/card-view.ts
  - packages/core/src/application/card-text.ts
symbols: [CardDebtPage, selectStatementChoices, buildCardStatementsView, statementCycleKeys, weightByCycle, hasCardPurchases, CardFormDialog, StatementPanel, PayStatementDialog]
business_rules: [BR-FIN-019, BR-FIN-025, BR-FIN-026, BR-FIN-028, BR-FIN-029, BR-FIN-033, BR-FIN-034]
adrs: [ADR-018, ADR-020, ADR-022, ADR-024]
tests: [packages/core/src/application/card-view.test.ts, packages/core/src/application/card-debt.test.ts, client/src/features/settings.test.tsx]
last_verified_commit: 7b1b7b1+T-043
---

# Cartões (CLIENT-017)

No menu principal (ADR-024; antes em Ajustes — `/ajustes/cartoes…` redireciona para `/cartoes…`).

- `/cartoes`: cartões com "Fecha dia X · Vence dia Y", limite disponível e barra do comprometido, fatura
  atual e ações: editar, ativar/desativar e excluir (só sem compras, BR-FIN-028). O limite do cartão nunca é
  dinheiro para gastar (aviso na tela).
- `/cartoes/:id`: limite total/comprometido/disponível; faturas atual, próxima, futuras e quitadas no
  ciclo (`buildCardStatementsView`, núcleo, igual ao app); peso por ciclo (`weightByCycle`) e em qual ciclo cada
  fatura pesa (`statementCycleKeys`).
- Fatura fechada/vencida/parcial no ciclo ativo: **Paguei a fatura** (`payStatement`: restante, parcial ou
  maior = encargos; depois do vencimento o valor é obrigatório) e **Registrar juros/multa**
  (`addStatementCharges`); cada lançamento do ciclo ativo tem **Desfazer** (`undoStatementPayment`). Sem ciclo
  ativo não há pagamento (o ciclo é aberto no app).
- Compras: lápis (`CardPurchaseFormDialog` → `updateCardPurchase`) e lixeira (`deleteCardPurchase`); compra já
  contada em ciclo fechado ou fatura paga aparece "Bloqueada" (BR-FIN-029). Compra anterior ao app só muda
  descrição, categoria e data (BR-FIN-036). **Compras no Histórico** (no topo do detalhe) abre o Histórico filtrado pelo
  cartão; a composição de cada fatura continua aqui, porque é aqui que ela é paga.
- **Compras anteriores ao app** (`/cartoes/:id/compras-anteriores`, `CardDebtPage` → `addExistingCardDebt`): modos "Fatura em aberto" (total que o banco mostra) e "Parcelamento em andamento" (valor, total e restantes), faturas ainda não vencidas e sem lançamento (`selectStatementChoices`), aviso de total já informado, opção "esta parcela já está no total" e prévia da agenda e do limite comprometido (`card-debt`, núcleo, igual ao app). Em "Parcelamento em andamento" há **modo lote**: "Adicionar à lista" (com Remover) e "Salvar tudo (N)" numa única gravação (`addExistingCardDebts`, tudo ou nada). Botão no detalhe do cartão e oferta ao cadastrar um cartão novo. Ver [card.existing-debt](../card/existing-debt.md).
- Fora desta entrega: registrar compra nova no cartão.
- `card-view` e `card-text` moram no núcleo (antes em `app/src/screens`); app e web usam as mesmas.
