---
id: web.cycles
type: feature
module: web
title: Relatórios › Ciclos e detalhe do ciclo (web)
summary: >
  Aba Ciclos dos Relatórios: comparação entre ciclos do salário (gasto no saldo, faturas do ciclo e resultado),
  lista de ciclos fechados com filtro por ano e detalhe com saldo dia a dia, fixas, rendas e faturas que vencem nele.
keywords: [ciclos, relatórios, resultado, detalhe, comparação, faturas do ciclo]
code:
  - client/src/features/cycles/CyclesPage.tsx
  - client/src/features/cycles/CycleDetailPage.tsx
  - client/src/lib/cycles.ts
symbols: [buildClosedCycles, buildCycleDetail, CyclesPage, CycleDetailPage]
business_rules: [BR-FIN-005, BR-FIN-006, BR-FIN-008, BR-FIN-025, BR-FIN-039]
adrs: [ADR-020, ADR-024]
tests: [client/src/lib/view-models.test.ts, client/src/features/features.test.tsx]
last_verified_commit: 7b1b7b1+T-043
---

# Relatórios › Ciclos (CLIENT-013)

Rotas `/relatorios/ciclos` e `/relatorios/ciclos/:id` (as antigas `/ciclos…` redirecionam; ADR-024).

- Lista: `selectClosedMonths`; resultado = `finalBalance` gravado no fechamento (badge Sobrou/Negativo/Zerado);
  colunas Saldo inicial, **Gasto no saldo**, **Faturas do ciclo** (`selectCycleSpending(...).cardTotal`: as faturas que
  venceram no ciclo, BR-FIN-025/039) e Resultado.
- **Comparação entre ciclos:** barras de gasto no saldo e faturas do ciclo, linha de resultado (mesmos valores da tabela).
- Detalhe (inclusive o ativo): métricas, **saldo dia a dia** do ciclo inteiro (`selectBalanceDailySeries` via
  `buildCycleDetail`, mesmo gráfico da visão geral), fixas pagas, rendas avulsas e faturas do ciclo (cada uma leva ao
  Histórico filtrado por cartão e fatura). Os lançamentos ficam no Histórico (`/historico?ciclo=<id>`). Somente leitura.
