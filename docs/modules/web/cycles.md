---
id: web.cycles
type: feature
module: web
title: Ciclos e detalhe do ciclo (web)
summary: >
  Lista de ciclos fechados com saldo inicial, gasto e resultado, filtro por ano, e detalhe por ciclo
  com o dia a dia (total e saldo do dia), fixas pagas, rendas avulsas e faturas.
keywords: [ciclos, histórico, resultado, detalhe, dia a dia]
code:
  - client/src/features/cycles/CyclesPage.tsx
  - client/src/features/cycles/CycleDetailPage.tsx
  - client/src/lib/cycles.ts
symbols: [buildClosedCycles, buildCycleDetail]
business_rules: [BR-FIN-005, BR-FIN-006, BR-FIN-008]
adrs: [ADR-020]
tests: [client/src/lib/view-models.test.ts, client/src/features/features.test.tsx]
last_verified_commit: 3b9bf25+T-040
---

# Ciclos (CLIENT-013)

- Lista: `selectClosedMonths`; resultado = `finalBalance` gravado no fechamento; badge Sobrou/Negativo/Zerado.
- Detalhe (`/ciclos/:id`, inclusive o ativo): dias em ordem decrescente com `calculateTodaySpent` e
  `calculateDayBalance` (igual ao histórico do app), `selectCyclePayments`, `selectCycleExtraIncomes` e
  faturas/encargos de `selectCycleSpending`. Somente leitura.
