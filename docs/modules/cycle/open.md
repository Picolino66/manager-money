---
id: cycle.open
type: feature
module: cycle
title: Abrir ciclo
summary: >
  Abre o ciclo do período atual com prévia de saldo, dias e limite; avança parcelas e herda
  dívida do último ciclo fechado, sem sobrepor períodos.
keywords: [abrir ciclo, iniciar ciclo, novo mês]
code:
  - src/application/cycle.use-cases.ts
  - src/screens/StartMonthScreen.tsx
symbols: [openCycle, calculateNextCycleStartDate, advanceInstallments, startPendingInstallments]
business_rules: [BR-FIN-005, BR-FIN-006, BR-FIN-010, BR-FIN-013, BR-FIN-017]
tests: [src/application/cycle.use-cases.test.ts]
last_verified_commit: 359de21
---

# Abrir ciclo

Spec: [SPEC-002](../../../specs/SPEC-002-ciclo-de-vida.md).

- Exige configuração e ausência de ciclo ativo (BR-FIN-013).
- Início = início padrão (payday); se ≤ fim do último ciclo fechado, passa ao dia seguinte (DEF-006).
- Parcelas iniciadas avançam −1; parcelamentos novos passam a contar neste ciclo (BR-FIN-010).
- Saldo inicial = saldo base − dívida herdada (BR-FIN-005/006).
- Erros aparecem em Alert (DEF-007).
