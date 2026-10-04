---
id: card.statement
type: feature
module: card
title: Faturas e "Paguei a fatura"
summary: >
  Faturas derivadas das compras (aberta, fechada, vencida, paga) com fechamento, vencimento e
  parcelas; "Paguei a fatura" libera o limite e, depois do vencimento, registra o valor pago com
  juros, que pesam no ciclo ativo.
keywords: [fatura, paguei a fatura, vencimento, fechamento, juros, atraso, limite, status da fatura]
code:
  - src/domain/financial/credit-card.ts
  - src/application/card.use-cases.ts
  - src/application/selectors.ts
  - src/screens/CardDetailScreen.tsx
  - src/screens/cardView.ts
  - src/components/StatementCard.tsx
  - src/components/PayStatementModal.tsx
symbols: [buildCardStatements, statementPaymentId, statementDueDate, calculateStatementInterest, payStatement, undoStatementPayment, statementPayableFrom, selectCardStatements, selectStatementPayments, selectCycleStatementInterest]
adrs: [ADR-017]
tests: [src/domain/financial/credit-card.test.ts, src/domain/financial/statement.test.ts, src/application/card.use-cases.test.ts, src/application/financial-vision.test.ts, src/screens/cards.screens.test.tsx]
business_rules: [BR-FIN-005, BR-FIN-025, BR-FIN-026, BR-FIN-030]
last_verified_commit: c47cf18+T-025r4
---

# Faturas e "Paguei a fatura"

Spec: [SPEC-016](../../../specs/SPEC-016-faturas-e-limite-do-cartao.md) · decisão: [ADR-017](../../../adr/ADR-017-faturas-limite-e-situacao-inicial.md).
UI no detalhe do cartão ([T-023](../../../tasks/done/T-023.md)): `buildCardStatementsView` (em `src/screens/cardView.ts`)
organiza **Fatura atual** — a fechada/vencida **mais antiga não paga**; se não houver, a aberta —, **Próxima
fatura**, as demais não pagas (título **"Outras faturas"** quando há fechadas/vencidas além dessas duas, cada uma
com "Paguei a fatura"; **"Faturas futuras"** quando todas estão abertas) e **Pagas neste ciclo** (com Desfazer). Cada fatura é um `StatementCard`; o botão
**Paguei a fatura** abre o `PayStatementModal`, que pede o valor pago com juros quando a fatura venceu.

## Descrição
A fatura **não é gravada**: `buildCardStatements` agrupa as parcelas em aberto (sem as quitadas antes do
cadastro) por `statementKey` (`yyyy-MM` do mês de fechamento). Só o **pagamento** é gravado
(`StatementPayment`, tabela `statement_payments`).

## Entrada
- Leitura: `selectCardStatements(state, cardId, today)`.
- Pagamento: `payStatement({ cardId, statementKey, paidAmount? })`; desfazer: `undoStatementPayment(paymentId)`.

## Saída
`CardStatement { key, closingDate, dueDate, amount, installments, status, payment }`, em ordem de fechamento.

## Regras de negócio
- **Status:** `open` até o dia do fechamento (inclusive); `closed` do dia seguinte até o vencimento
  (inclusive); `overdue` depois; `paid` com pagamento vigente (BR-FIN-025).
- **Pagar (BR-FIN-026):** exige ciclo ativo; só fatura `closed` ou `overdue` (a partir de
  `statementPayableFrom` = dia seguinte ao fechamento). `closed`: valor pago = valor da fatura. `overdue`:
  `paidAmount` obrigatório e ≥ valor; **juros** = `paidAmount − statementAmount` (`calculateStatementInterest`).
- O pagamento grava `cycleId` do ciclo ativo; os juros entram em `statementInterest` desse ciclo e reduzem o
  saldo inicial (BR-FIN-005, `selectCycleStatementInterest`).
- Pagar **libera o limite** das parcelas daquela fatura; sem pagamento a fatura continua comprometendo o
  limite, mesmo vencida.
- Um pagamento vigente por fatura, com **id determinístico** `statement-<cardId>-<yyyy-MM>` (`statementPaymentId`):
  aparelhos diferentes convergem no mesmo registro (LWW, índice único respeitado) e pagar de novo depois de
  desfazer reaproveita o registro; **desfazer** só para pagamento feito no ciclo
  ativo — o limite volta a ficar comprometido e os juros saem do saldo.
- Fatura paga bloqueia compra retroativa nela e edição/exclusão das compras que ela contém (BR-FIN-029). Se o
  fechamento foi aumentado depois do pagamento, compra nova que cairia nela vai para a fatura seguinte (BR-FIN-028).
- Faturas vencidas antes da v7 recebem, na migração, um pagamento sintético sem juros.

## Fluxo resumido
Cartões → fatura fechada/vencida → **Paguei a fatura** → (vencida: "Valor pago, com juros") → confirma →
limite liberado, saldo do ciclo recalculado (`recalculateActiveCycleBalance`).

## Possíveis erros
"Fatura não encontrada." · "Esta fatura já foi paga." · "A fatura ainda está aberta. Ela pode ser paga depois
do fechamento." · "A fatura venceu. Informe o valor pago, com juros." · "O valor pago não pode ser menor que o
valor da fatura." · "Só é possível desfazer pagamentos de fatura feitos no ciclo ativo."
