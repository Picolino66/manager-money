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
  - src/application/cycle.use-cases.ts
  - src/domain/financial/financial.calculations.ts
  - src/screens/DashboardScreen.tsx
symbols: [receiveIncomeEarly, canReceiveIncomeEarlyNow, canReceiveIncomeEarlyForCycle]
business_rules: [BR-FIN-003, BR-FIN-016]
tests: [src/application/cycle.use-cases.test.ts]
last_verified_commit: c47cf18+T-025
---

# Recebimento antecipado

- Botão visível só quando BR-FIN-016 é satisfeita: hoje < payday, ciclo ativo termina antes do
  pagamento deste mês e começou antes de hoje — impede o duplo acionamento (DEF-001).
- O ciclo fechado tem `endDate` = véspera; gastos com data ≥ hoje migram para o novo ciclo.
