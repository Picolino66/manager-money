---
id: card.existing-debt
type: feature
module: card
title: Situação inicial do cartão
summary: >
  Cadastro de fatura em aberto ou parcelamento que já existia antes do app; gera a agenda das
  parcelas restantes e marca as já pagas como quitadas, sem pesar no orçamento nem no limite.
keywords: [situação inicial, compra anterior, parcelamento existente, fatura em aberto, parcelas pagas, limite já usado]
code:
  - src/application/card.use-cases.ts
  - src/domain/financial/credit-card.ts
  - src/screens/CardDebtScreen.tsx
  - src/screens/CardsScreen.tsx
symbols: [addExistingCardDebt, listOpenInstallments, calculateInstallmentForCycle, firstCountedCycleKey, updateCardPurchase]
adrs: [ADR-017]
tests: [src/application/financial-vision.test.ts, src/application/card.use-cases.test.ts, src/screens/cards.screens.test.tsx]
business_rules: [BR-FIN-027, BR-FIN-029]
last_verified_commit: c47cf18+T-025r4
---

# Situação inicial do cartão

Spec: [SPEC-017](../../../specs/SPEC-017-situacao-inicial-e-ativo-inativo.md) · decisão: [ADR-017](../../../adr/ADR-017-faturas-limite-e-situacao-inicial.md).
UI: rota `CardDebt { cardId }` — **"Compras anteriores ao app"** (`CardDebtScreen`), aberta pelo detalhe do cartão ou logo
após cadastrar um cartão ([T-023](../../../tasks/done/T-023.md)). Tipos: "Fatura em aberto" ou "Parcelamento em andamento".

## Descrição
Quem chega ao app com fatura aberta ou parcelamentos em curso registra essa dívida sem datas retroativas:
`addExistingCardDebt` cria uma `CardPurchase` com `origin = 'existing'` e `settledInstallments` = parcelas já pagas.

## Entrada
`ExistingCardDebtInput { cardId, description, category, installmentAmount, totalInstallments,
remainingInstallments, nextStatementKey }`. Fatura em aberto = `totalInstallments = remainingInstallments = 1`.

## Saída
Compra com `origin = 'existing'`, `totalAmount = installmentAmount × totalInstallments`, `settledInstallments = total − restantes`,
`firstStatementKey = nextStatementKey − quitadas`, `purchaseDate` sintética (fechamento da 1ª fatura) e
`firstCycleKey` alinhado ao ciclo do vencimento da próxima parcela (nunca antes do ciclo ativo ou do próximo
a abrir). Saldo do ciclo ativo recalculado.

## Regras de negócio
- BR-FIN-027: parcelas quitadas **não pesam** no orçamento (`calculateInstallmentForCycle`) nem no limite
  (`listOpenInstallments`); as restantes comprometem o limite e caem uma por fatura/ciclo.
- Exige configuração; aceita cartão inativo e cadastro antes do primeiro ciclo.
- `nextStatementKey`: `yyyy-MM`, fatura ainda **não vencida**, até 12 faturas à frente da atual e não paga.
- BR-FIN-029: por ser `origin = 'existing'`, só **descrição e categoria** podem mudar depois (`updateCardPurchase`),
  qualquer que seja a data; exclusão segue `canModifyCardPurchase`.

## Fluxo resumido
Cartões → cartão → Compras anteriores ao app → Fatura em aberto ou Parcelamento em andamento → valor da parcela, total, restantes,
fatura da próxima parcela → Salvar → limite comprometido e próximos ciclos atualizados.

## Possíveis erros
"Configure a base financeira antes de cadastrar compras anteriores." · "Informe o valor da parcela." · "As
parcelas restantes devem ficar entre 1 e o total de parcelas." · "Escolha a fatura da próxima parcela." · "A
próxima parcela precisa estar em uma fatura que ainda não venceu." · "A fatura MM/AAAA deste cartão já foi paga."
· "Em compras anteriores ao app, só a descrição e a categoria podem mudar."
