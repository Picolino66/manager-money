---
id: cycle.close
type: feature
module: cycle
title: Fechar ciclo
summary: >
  Fecha o ciclo ativo após o fim do período, gravando o saldo final (que gera dívida herdada quando
  negativo) e transportando ao próximo ciclo o restante de faturas pagas parcialmente.
keywords: [fechar ciclo, encerrar mês, saldo final, restante da fatura, dívida de fatura, transporte]
code:
  - packages/core/src/application/cycle.use-cases.ts
  - packages/core/src/application/selectors.ts
  - packages/core/src/domain/financial/financial.calculations.ts
  - app/src/screens/DashboardScreen.tsx
symbols: [closeCycle, canCloseActiveCycle, canCloseCycle, describeCloseCycleBlock, selectStatementsToCarry]
business_rules: [BR-FIN-006, BR-FIN-017, BR-FIN-034]
adrs: [ADR-018]
tests: [packages/core/src/application/cycle.use-cases.test.ts, packages/core/src/application/card-rules.test.ts]
last_verified_commit: 7903717+T-042h
---

# Fechar ciclo

Specs: [SPEC-002](../../../specs/SPEC-002-ciclo-de-vida.md), [SPEC-019](../../../specs/SPEC-019-pagamento-parcial-total-da-fatura-e-invariantes.md).

- Permitido só quando hoje > `endDate` (BR-FIN-017); antes disso o botão fica desabilitado com a
  explicação e o caso de uso também rejeita.
- **Restante de fatura parcial (BR-FIN-034, ADR-018):** antes de fechar, `selectStatementsToCarry` lista, por
  fatura que pesou no ciclo (vence nele ou veio transportada do anterior) **e tem algum pagamento** (`paidAmount > 0`;
  encargos sozinhos não bastam), o valor `min(max(0, restante − reservedLater), reservado no ciclo + transportado +
  encargos do ciclo)`, em que `reservedLater` são as parcelas da mesma fatura que ainda vão pesar em ciclos seguintes
  (serão reservadas lá). Fatura **sem pagamento não é transportada** (o principal já pesou no ciclo; ela segue vencida e com limite comprometido).
- Saldo final = saldo inicial − gastos **+ restante transportado** (o dinheiro reservado que não saiu volta ao
  resultado); negativo vira dívida do próximo ciclo (BR-FIN-006). O ciclo fechado grava `carriedStatements:
  [{ cardId, statementKey, amount }]` (só quando houver), imutável depois.
- O próximo ciclo (`openCycle`) nasce com `carriedStatementDebt` = soma de `carriedStatements` do último fechado,
  reservado no saldo até a fatura ser quitada ([open.md](open.md)). `receiveIncomeEarly` aplica o mesmo transporte
  ([receive-early.md](receive-early.md)).
- **Limitação conhecida (ADR-018):** lançamento feito offline com `cycleId` de um ciclo que outro aparelho já fechou
  não reabre o transporte (`carriedStatements` é imutável).
