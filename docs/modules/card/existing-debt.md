---
id: card.existing-debt
type: feature
module: card
title: Situação inicial do cartão
summary: >
  Cadastro do total da fatura em aberto (fonte de verdade da fatura) ou de parcelamento que já
  existia antes do app; a parcela atual pode estar "já incluída" no total informado, sem somar de
  novo; as parcelas já pagas não pesam no orçamento nem no limite.
keywords: [situação inicial, compra anterior, parcelamento existente, fatura em aberto, total da fatura, já incluída, parcelas pagas, limite já usado]
code:
  - packages/core/src/application/card.use-cases.ts
  - packages/core/src/domain/financial/credit-card.ts
  - packages/core/src/application/card-debt.ts
  - app/src/screens/CardDebtScreen.tsx
  - client/src/features/cards/CardDebtPage.tsx
  - app/src/screens/CardsScreen.tsx
symbols: [addExistingCardDebts, validateExistingDebtDraft, selectStatementChoices, findStatementBalance, existingDebtCycleRange, addExistingCardDebt, listOpenInstallments, listEffectiveInstallments, calculateInstallmentForCycle, firstCountedCycleKey]
adrs: [ADR-017, ADR-018]
tests: [packages/core/src/application/card-rules.test.ts, packages/core/src/application/financial-vision.test.ts, packages/core/src/application/card.use-cases.test.ts, app/src/screens/cards.screens.test.tsx, packages/core/src/application/card-debt.test.ts, client/src/features/settings.test.tsx]
business_rules: [BR-FIN-027, BR-FIN-029, BR-FIN-032]
last_verified_commit: 7903717+T-042d
---

# Situação inicial do cartão

Specs: [SPEC-017](../../../specs/SPEC-017-situacao-inicial-e-ativo-inativo.md), [SPEC-019](../../../specs/SPEC-019-pagamento-parcial-total-da-fatura-e-invariantes.md) · decisões: [ADR-017](../../../adr/ADR-017-faturas-limite-e-situacao-inicial.md), [ADR-018](../../../adr/ADR-018-pagamento-parcial-e-total-da-fatura.md).
As contas puras da tela (faturas disponíveis, total já informado, ciclos da agenda, validade das parcelas e limite comprometido) moram no núcleo (`card-debt.ts`) e valem para o app e para o web. Web: `/ajustes/cartoes/:id/compras-anteriores` (`CardDebtPage`), botão no detalhe do cartão e oferta ao cadastrar um cartão novo ([web.cards](../web/cards.md)).
**Lote (app e web):** em "Parcelamento em andamento" o formulário tem **"Adicionar à lista"** (valida e põe o item numa lista com Remover; fatura e categoria ficam para o próximo) e **"Salvar tudo (N)"**, que grava a lista de uma vez por `addExistingCardDebts` (núcleo): aplica `addExistingCardDebt` item a item no mesmo estado, tudo ou nada, e o erro cita o item ("Item 2 (B): …"). Se o formulário estiver preenchido e não adicionado, "Salvar tudo" o inclui. "Fatura em aberto" continua um por vez (um total por fatura). Validação e montagem da entrada: `validateExistingDebtDraft` e `buildExistingDebtInput`.
UI do app: rota `CardDebt { cardId }` — **"Compras anteriores ao app"** (`CardDebtScreen`), aberta pelo detalhe do cartão ou logo
após cadastrar um cartão ([T-023](../../../tasks/done/T-023.md)). Tipos: "Fatura em aberto" ou "Parcelamento em andamento".
Em "Fatura em aberto" o valor informado é o **total da fatura** (`statementBalance`); se a fatura já tem total, a tela
avisa "Já existe um total informado…". Em "Parcelamento em andamento", quando a fatura escolhida tem total informado,
aparece o interruptor **"Esta parcela já está no total da fatura informada (R$ …)"**, **ligado por padrão** (volta a
ligar ao trocar de modo); sem total, ele não aparece. A prévia mostra o limite comprometido sem a parcela incluída.
As opções de fatura são só as não vencidas (a fechada aguardando vencimento e a aberta) e **sem nenhum lançamento**
(pago ou parcial). UI da [T-027](../../../tasks/done/T-027.md).

## Descrição
Quem chega ao app com fatura aberta ou parcelamentos em curso registra essa dívida sem datas retroativas:
`addExistingCardDebt` cria uma `CardPurchase` com `origin = 'existing'` e `settledInstallments` = parcelas já pagas.

## Entrada
`ExistingCardDebtInput { cardId, description, category, installmentAmount, totalInstallments,
remainingInstallments, nextStatementKey, statementBalance?, includedInStatementBalance? }`. Total da fatura em aberto =
`statementBalance: true` com `totalInstallments = remainingInstallments = 1`.

## Saída
Compra com `origin = 'existing'`, `totalAmount = installmentAmount × totalInstallments`, `settledInstallments = total − restantes`,
`firstStatementKey = nextStatementKey − quitadas`, `purchaseDate` sintética (fechamento da 1ª fatura) e
`firstCycleKey` alinhado ao ciclo do vencimento da próxima parcela (nunca antes do ciclo ativo ou do próximo
a abrir). `statementBalance` grava `kind: 'statement-balance'`; `includedInStatementBalance` (só em parcelamento)
grava `includedInStatementBalance: true`. Saldo do ciclo ativo recalculado.

## Regras de negócio
- BR-FIN-027: parcelas quitadas **não pesam** no orçamento (`calculateInstallmentForCycle`) nem no limite
  (`listOpenInstallments`); as restantes comprometem o limite e caem uma por fatura/ciclo.
- **Total informado (BR-FIN-032):** a compra `kind: 'statement-balance'` é a fonte de verdade da fatura; um por
  cartão + fatura; precisa ser 1 de 1.
- **Parcela já incluída (BR-FIN-032):** exige o total informado daquela fatura; a parcela atual aparece na fatura
  com `nominalAmount` e `amount = 0` (`listEffectiveInstallments`) — não soma ao total, ao orçamento nem ao limite;
  as seguintes contam normalmente. A soma dos itens incluídos não pode passar do total. Excluir o total faz a
  parcela voltar a contar. Sem marcar, a parcela soma ao total (escolha explícita do usuário). Cadastrar o total
  **depois** de parcelas já marcadas como incluídas naquela fatura também é recusado se elas somarem mais que ele.
- Exige configuração; aceita cartão inativo e cadastro antes do primeiro ciclo.
- `nextStatementKey`: `yyyy-MM`, fatura ainda **não vencida**, até 12 faturas à frente da atual e sem lançamento.
- BR-036 (BR-FIN-036): o formulário (app e web, também no lote) tem **Data da compra (opcional)**, só informativa (não futura); depois, `updateCardPurchase` aceita mudar a data.
- BR-FIN-029: por ser `origin = 'existing'`, só **descrição, categoria e data** podem mudar depois (`updateCardPurchase`),
  qualquer que seja a data; exclusão segue `canModifyCardPurchase`.

## Fluxo resumido
Cartões → cartão → Compras anteriores ao app → Fatura em aberto ou Parcelamento em andamento → valor da parcela, total, restantes,
fatura da próxima parcela (e, se a fatura tem total informado, "já incluída") → Salvar → limite comprometido e
próximos ciclos atualizados.

## Possíveis erros
"Configure a base financeira antes de cadastrar compras anteriores." · "Informe o valor da parcela." · "As
parcelas restantes devem ficar entre 1 e o total de parcelas." · "Escolha a fatura da próxima parcela." · "A
próxima parcela precisa estar em uma fatura que ainda não venceu." · "A fatura MM/AAAA deste cartão já foi paga."
· "O total da fatura é um valor único." · "Já existe um total informado para a fatura MM/AAAA." · "Informe antes o
total desta fatura para incluir a parcela nele." · "As parcelas incluídas somam mais que o total informado da fatura.
Confira os valores." · "As parcelas incluídas nesta fatura somam mais que o total informado. Confira os valores." · "Em compras anteriores ao app, só a descrição e a categoria podem mudar."
