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
business_rules: [BR-FIN-004, BR-FIN-005, BR-FIN-006, BR-FIN-010, BR-FIN-013, BR-FIN-017, BR-FIN-025]
tests: [src/application/cycle.use-cases.test.ts, src/application/financial-vision.test.ts]
last_verified_commit: c47cf18+T-025r2
---

# Abrir ciclo

Spec: [SPEC-002](../../../specs/SPEC-002-ciclo-de-vida.md).

- Exige configuração e ausência de ciclo ativo (BR-FIN-013).
- Início = início padrão (payday); se ≤ fim do último ciclo fechado, passa ao dia seguinte (DEF-006).
- Parcelas iniciadas avançam −1; parcelamentos novos passam a contar neste ciclo (BR-FIN-010); parcelamentos inativos ficam pausados.
- Saldo inicial = renda (fontes ativas) − fixas ativas (todas pendentes, logo reservadas) − meta − dívida herdada − parcelas de cartão do
  ciclo, isto é, das faturas que vencem nele (BR-FIN-004/005/006/025). A reserva é calculada com as parcelas **já avançadas** (`createCycle` usa o estado pós-avanço); a parcela já
  mostrada na projeção não conta duas vezes.
- **Prévia** (`StartMonthScreen`): simula `openCycle` sobre uma **cópia** do documento, sem gravar, e mostra saldo,
  período, dias, limite inicial, ajustes (`selectCycleAdjustments`) e fixas pendentes que ficarão reservadas.
- Erros aparecem em Alert (DEF-007).
