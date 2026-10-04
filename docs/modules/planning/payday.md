---
id: planning.payday
type: feature
module: planning
title: Dia de pagamento configurável
summary: >
  Dia do mês (1–28) em que cada fonte de renda cai (o ciclo usa o da maior); define início, fim e janela de recebimento antecipado
  de cada ciclo.
keywords: [dia do pagamento, payday, salário, início do ciclo]
code:
  - packages/core/src/domain/financial/financial.calculations.ts
  - app/src/screens/ConfigScreen.tsx
symbols: [calculatePrimaryPayday, calculateCycleEndDate, calculateDefaultCycleStartDate, canReceiveIncomeEarly]
business_rules: [BR-FIN-002, BR-FIN-024]
tests: [packages/core/src/domain/financial/financial.calculations.test.ts]
last_verified_commit: c47cf18+T-025
---

# Dia de pagamento configurável

Spec: [SPEC-001](../../../specs/SPEC-001-dia-de-pagamento.md).

- Dia do pagamento (1 a 28) **por fonte de renda** na Configuração ([SPEC-015](../../../specs/SPEC-015-dia-de-pagamento-por-fonte.md)); o ciclo usa o da fonte **ativa** de maior valor (BR-FIN-024); padrão 7 (dados migrados).
- Início padrão: dia `payday` do mês corrente se hoje ≥ payday; senão, do mês anterior.
- Fim: véspera do `payday` do mês seguinte ao início (vale para início normal e antecipado).
- Mudar o payday não altera o ciclo ativo; vale para o próximo.
