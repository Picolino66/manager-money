---
id: card.statement
type: feature
module: card
title: Faturas, pagamento parcial e encargos
summary: >
  Faturas derivadas das compras (aberta, fechada, vencida, parcial, paga) com vários lançamentos:
  pagamento total ou parcial e encargos (juros/multa). Pagar não desconta de novo do orçamento, só
  libera o limite do que amortizou; encargos pesam no ciclo ativo; o restante parcial vira dívida
  do próximo ciclo.
keywords: [fatura, paguei a fatura, pagamento parcial, restante, encargos, juros, multa, vencimento, limite, status da fatura]
code:
  - src/domain/financial/credit-card.ts
  - src/application/card.use-cases.ts
  - src/application/selectors.ts
  - src/store/financial.store.ts
  - src/screens/CardDetailScreen.tsx
  - src/screens/cardView.ts
  - src/components/StatementCard.tsx
  - src/components/PayStatementModal.tsx
  - src/components/StatementChargesModal.tsx
  - src/screens/cardText.ts
symbols: [buildCardStatements, summarizeStatement, statementDueDate, payStatement, addStatementCharges, undoStatementPayment, statementPayableFrom, selectCardStatements, selectStatementPayments, selectCycleStatementInterest]
adrs: [ADR-017, ADR-018]
tests: [src/application/card-rules.test.ts, src/domain/financial/credit-card.test.ts, src/domain/financial/statement.test.ts, src/application/card.use-cases.test.ts, src/application/financial-vision.test.ts, src/screens/cards.screens.test.tsx]
business_rules: [BR-FIN-005, BR-FIN-025, BR-FIN-026, BR-FIN-030, BR-FIN-033, BR-FIN-034]
last_verified_commit: bfe9de6+T-028
---

# Faturas, pagamento parcial e encargos

Specs: [SPEC-016](../../../specs/SPEC-016-faturas-e-limite-do-cartao.md), [SPEC-019](../../../specs/SPEC-019-pagamento-parcial-total-da-fatura-e-invariantes.md) ·
decisões: [ADR-017](../../../adr/ADR-017-faturas-limite-e-situacao-inicial.md), [ADR-018](../../../adr/ADR-018-pagamento-parcial-e-total-da-fatura.md).

## Descrição
A fatura **não é gravada**: `buildCardStatements` agrupa as parcelas **efetivas** (`listEffectiveInstallments`:
sem as quitadas antes do cadastro; parcela "já incluída" no total informado com `amount = 0`, BR-FIN-032) por
`statementKey` (`yyyy-MM` do mês de fechamento). Só os **lançamentos** são gravados (`StatementPayment`, tabela
`statement_payments`): uma fatura pode ter vários.

## Localização no código
Domínio: `buildCardStatements`, `summarizeStatement` (`credit-card.ts`). Casos de uso: `payStatement`,
`addStatementCharges`, `undoStatementPayment` (`card.use-cases.ts`). Seletores: `selectCardStatements`,
`selectStatementPayments`, `selectCycleStatementInterest`. Store: `payStatement`, `addStatementCharges`,
`undoStatementPayment`. UI: detalhe do cartão (`CardDetailScreen`, `cardView`, `StatementCard`,
`PayStatementModal`, `StatementChargesModal`), entregue na [T-027](../../../tasks/done/T-027.md).

## Telas
- **`StatementCard`:** principal, encargos, pago e **Restante**, composição (com a parcela "já incluída" e o total
  informado) e status ("Parcial" para `partial`, `cardText.ts`). Área de lançamentos ("Lançamentos", cada um com
  **Desfazer** se for do ciclo ativo); fatura quitada mostra "Quitada em dd/MM"; aberta, "Fatura aberta: recebe
  compras até dd/MM".
- Fatura fechada/vencida com restante: **"Paguei a fatura"** e **"Registrar juros/multa"**; vencida mostra "Venceu em
  dd/MM…"; parcial mostra "Pagamento parcial: faltam R$ … O restante continua devido; se a fatura pesa no ciclo atual,
  o que faltar ao fechar vira dívida do próximo." Sem ciclo ativo, pede "Iniciar ciclo".
- **`PayStatementModal`:** resumo (fatura, encargos, já pago, restante); antes do vencimento, botão **"Pagar o
  restante (R$ …)"**; campo "Valor pago" com aviso de parcial (quanto continua devido) ou de excedente (vira
  juros/encargos e sai do orçamento deste ciclo); "Confirmar pagamento".
- **`StatementChargesModal`:** "Valor dos juros/multa" → `addStatementCharges`.
- **Cartões** (`CardsScreen`): "Fatura atual (status[, restante]) · vence dd/MM" com o **restante** para faturas que
  não estão abertas (aberta mostra o valor).

## Entrada
- Leitura: `selectCardStatements(state, cardId, today)`.
- Pagamento: `payStatement({ cardId, statementKey, paidAmount? })`.
- Encargos tardios: `addStatementCharges({ cardId, statementKey, amount })`.
- Desfazer: `undoStatementPayment(paymentId)`.

## Saída
`CardStatement { cardId, key, closingDate, dueDate, amount, installments, knownTotal, charges, paid, remaining,
status, payments[] }`, em ordem de fechamento. `amount` = principal efetivo; `knownTotal` = total informado na
situação inicial ou `null`; `installments[]` traz `amount` (efetivo), `nominalAmount` e `includedInBalance`.
Não existe mais `payment` (singular) nem `calculateStatementInterest`: os encargos de um lançamento são
`payment.charges`.

## Dependências
[card.purchase](purchase.md) (parcelas), [card.existing-debt](existing-debt.md) (total informado),
[cycle.close](../cycle/close.md) (transporte do restante), [cycle.dashboard](../cycle/dashboard.md) (compromissos).

## Regras de negócio
- **Totais (`summarizeStatement`):** encargos = Σ `charges`; pago = Σ `paidAmount`;
  `remaining = max(0, amount + charges − paid)`; amortizado = `min(paid, amount)`.
- **Status:** com pago > 0 → `partial` (restante > 0) ou `paid`; sem pago → `open` até o fechamento (inclusive),
  `closed` até o vencimento (inclusive), `overdue` depois (BR-FIN-025).
- **Pagar (BR-FIN-033):** exige ciclo ativo e fatura com principal > 0, já fechada (a partir de
  `statementPayableFrom` = dia seguinte ao fechamento) e não `paid`. Sem `paidAmount` quita o restante — só até o
  vencimento; depois, o valor é obrigatório. Valor < restante = **parcial**; valor > restante = a diferença é
  gravada como `charges`. Cada lançamento grava `statementAmount`, `cycleId` do ciclo ativo e `paidAt`.
- **Encargos tardios:** `addStatementCharges` grava lançamento com `paidAmount = 0` e `charges = amount` (> 0);
  aumenta o restante.
- **Orçamento:** o principal já está reservado no ciclo do vencimento — **pagar não desconta de novo**. Só os
  encargos pesam, no ciclo ativo do lançamento (`statementInterest` ← `selectCycleStatementInterest`).
- **Limite (BR-FIN-026):** cada fatura libera só o amortizado; encargos não ocupam limite.
- **Restante parcial (BR-FIN-034):** durante o ciclo aparece em "Próximos compromissos" pelo restante; ao fechar,
  vira dívida do próximo ciclo ([cycle.close](../cycle/close.md)). Fatura sem pagamento (`paidAmount > 0`) não é
  transportada; encargos sozinhos não bastam.
- **Desfazer:** só lançamento do ciclo ativo; o limite volta a ficar comprometido pelo que ele amortizou e os
  encargos saem do orçamento.
- **Bloqueios (BR-FIN-028/029):** fatura com qualquer lançamento não recebe compra retroativa e trava
  edição/exclusão das compras que a compõem. Se o fechamento foi aumentado depois do lançamento, compra nova que
  cairia nela vai para a fatura seguinte.
- **Dois aparelhos** que registram o mesmo pagamento offline geram dois lançamentos: o amortizado é limitado ao
  principal e o orçamento não muda; o usuário desfaz o duplicado (ADR-018).
- Faturas vencidas antes da v7 receberam, na migração, um pagamento sintético sem juros (id
  `statement-<cardId>-<yyyy-MM>`); na v8 ele ganhou `charges = 0`.

## Fluxo resumido
Cartões → fatura fechada/vencida → pagar (valor total, parcial ou com juros) → lançamento gravado → limite
liberado pelo amortizado, saldo do ciclo recalculado (`recalculateActiveCycleBalance`) só se houver encargos →
restante (se houver) em próximos compromissos e, no fechamento, no ciclo seguinte.

## Possíveis erros
"Fatura não encontrada." · "A fatura ainda está aberta. Ela pode ser paga depois do fechamento." · "Esta fatura
já foi paga." · "A fatura venceu. Informe o valor pago, com juros se houver." · "Informe um valor pago maior que
zero." · "Informe o valor dos juros ou da multa." · "Nenhum ciclo ativo para registrar o pagamento da fatura." · "Nenhum ciclo ativo para registrar encargos da fatura." ·
"Só é possível desfazer lançamentos de fatura feitos no ciclo ativo."
