---
id: cycle.close
type: feature
module: cycle
title: Fechar ciclo
summary: >
  Fecha o ciclo ativo após o fim do período, gravando o saldo final que gera dívida herdada
  quando negativo.
keywords: [fechar ciclo, encerrar mês, saldo final]
code:
  - src/application/cycle.use-cases.ts
  - src/domain/financial/financial.calculations.ts
  - src/screens/DashboardScreen.tsx
symbols: [closeCycle, canCloseActiveCycle, canCloseCycle, describeCloseCycleBlock]
business_rules: [BR-FIN-006, BR-FIN-017]
tests: [src/application/cycle.use-cases.test.ts]
last_verified_commit: F5-PENDING
---

# Fechar ciclo

- Permitido só quando hoje > `endDate` (BR-FIN-017); antes disso o botão fica desabilitado com a
  explicação e o caso de uso também rejeita.
- Saldo final = saldo inicial − gastos; negativo vira dívida do próximo ciclo (BR-FIN-006).
