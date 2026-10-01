---
id: cycle.history
type: feature
module: cycle
title: Histórico diário e ciclos anteriores
summary: >
  Lista de gastos do ciclo ativo agrupados por dia, com o saldo de cada dia, e lista de ciclos
  fechados com o resultado final.
keywords: [histórico, dias, ciclos anteriores, resultado]
code:
  - src/screens/DailyHistoryScreen.tsx
  - src/screens/PreviousMonthsScreen.tsx
  - src/domain/financial/financial.calculations.ts
symbols: [calculateDayBalance, calculateFinalBalance]
business_rules: [BR-FIN-006, BR-FIN-008]
last_verified_commit: 52be7e8
---

# Histórico

- **Histórico (aba):** dias em ordem decrescente; cada dia mostra o total e se expande para listar
  os gastos (toque → editar) e o saldo do dia calculado com o limite daquele dia.
- **Ciclos (aba):** ciclos fechados por data de fim decrescente, com resultado (sinalizado), saldo
  inicial e quantidade de gastos.
