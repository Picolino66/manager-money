---
id: cycle.receive-early
type: feature
module: cycle
title: Recebimento antecipado ("Já recebi")
summary: >
  Quando a renda cai antes do dia de pagamento, fecha o ciclo ativo na véspera e abre um novo a
  partir de hoje, movendo os gastos do novo período.
keywords: [já recebi, antecipado, salário adiantado]
code:
  - packages/core/src/application/cycle.use-cases.ts
  - packages/core/src/domain/financial/financial.calculations.ts
  - app/src/screens/DashboardScreen.tsx
symbols: [receiveIncomeEarly, canReceiveIncomeEarlyNow, canReceiveIncomeEarlyForCycle]
business_rules: [BR-FIN-003, BR-FIN-016, BR-FIN-034]
tests: [packages/core/src/application/cycle.use-cases.test.ts, packages/core/src/application/card-rules.test.ts]
last_verified_commit: 7903717+T-042j
---

# Recebimento antecipado

- Botão visível só quando BR-FIN-016 é satisfeita: hoje < payday, ciclo ativo termina antes do
  pagamento deste mês e começou antes de hoje — impede o duplo acionamento (DEF-001).
- O ciclo fechado tem `endDate` = véspera; gastos com data ≥ hoje migram para o novo ciclo.
- Restante de faturas parciais (BR-FIN-034): como em [close.md](close.md), `selectStatementsToCarry` soma o
  restante ao `finalBalance` do ciclo fechado (`carriedStatements`) e o novo ciclo nasce com `carriedStatementDebt`.
