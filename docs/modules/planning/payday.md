---
id: planning.payday
type: feature
module: planning
title: Dia de pagamento configurável
summary: >
  Dia do mês (1–28) em que a renda cai; define início, fim e janela de recebimento antecipado
  de cada ciclo.
keywords: [dia do pagamento, payday, salário, início do ciclo]
code:
  - src/domain/financial/financial.calculations.ts
  - src/screens/ConfigScreen.tsx
symbols: [calculateCycleEndDate, calculateDefaultCycleStartDate, canReceiveIncomeEarly]
business_rules: [BR-FIN-002]
tests: [src/domain/financial/financial.calculations.test.ts]
last_verified_commit: 359de21
---

# Dia de pagamento configurável

Spec: [SPEC-001](../../../specs/SPEC-001-dia-de-pagamento.md).

- Campo "Dia do pagamento (1 a 28)" na Configuração; padrão 7 (dados migrados do MVP).
- Início padrão: dia `payday` do mês corrente se hoje ≥ payday; senão, do mês anterior.
- Fim: véspera do `payday` do mês seguinte ao início (vale para início normal e antecipado).
- Mudar o payday não altera o ciclo ativo; vale para o próximo.
