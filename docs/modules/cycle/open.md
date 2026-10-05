---
id: cycle.open
type: feature
module: cycle
title: Abrir ciclo
summary: >
  Abre o ciclo do período atual com prévia de saldo, dias e limite; avança parcelas, herda dívida
  do último ciclo fechado e reserva o restante de faturas parciais transportado, sem sobrepor períodos.
keywords: [abrir ciclo, iniciar ciclo, novo mês]
code:
  - packages/core/src/application/cycle.use-cases.ts
  - app/src/screens/StartMonthScreen.tsx
symbols: [openCycle, calculateNextCycleStartDate, advanceInstallments, startPendingInstallments]
business_rules: [BR-FIN-004, BR-FIN-005, BR-FIN-006, BR-FIN-010, BR-FIN-013, BR-FIN-017, BR-FIN-025, BR-FIN-034]
tests: [packages/core/src/application/cycle.use-cases.test.ts, packages/core/src/application/financial-vision.test.ts, packages/core/src/application/card-rules.test.ts]
last_verified_commit: 7903717+T-042c
---

# Abrir ciclo

Spec: [SPEC-002](../../../specs/SPEC-002-ciclo-de-vida.md).

- Exige configuração e ausência de ciclo ativo (BR-FIN-013).
- Início = início padrão (payday); se ≤ fim do último ciclo fechado, passa ao dia seguinte (DEF-006).
- Parcelas iniciadas avançam −1; parcelamentos novos passam a contar neste ciclo (BR-FIN-010); parcelamentos inativos ficam pausados.
- Saldo inicial = renda (fontes ativas) − fixas ativas (todas pendentes, logo reservadas) − meta − dívida herdada − parcelas de cartão do
  ciclo, isto é, das faturas que vencem nele − **restante de faturas parciais transportado** (`carriedStatementDebt` =
  soma de `carriedStatements` do último ciclo fechado; BR-FIN-034) (BR-FIN-004/005/006/025). A reserva é calculada com as parcelas **já avançadas** (`createCycle` usa o estado pós-avanço); a parcela já
  mostrada na projeção não conta duas vezes.
- **Prévia** (`StartMonthScreen`): simula `openCycleAndLaunch` sobre uma **cópia** do documento, sem gravar, e mostra saldo,
  período, dias, limite inicial, ajustes (`selectCycleAdjustments`) e fixas pendentes que ficarão reservadas.
- Erros aparecem em Alert (DEF-007).

- **Fixas recorrentes no cartão (BR-FIN-035, SPEC-024):** o app abre o ciclo por `openCycleAndLaunch` (`payment.use-cases`; `openCycle` puro não cobra), que chama `launchRecurringFixedExpenses` e cobra as viradas de fatura que já caem no novo ciclo (ex.: fatura que vira no dia de início do ciclo) e o saldo inicial é recalculado (a fixa sai da reserva). As demais viradas do ciclo são cobradas quando chegam ([fixed-expense](../payment/fixed-expense.md)).
