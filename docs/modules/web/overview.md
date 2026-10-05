---
id: web.overview
type: feature
module: web
title: Visão geral do ciclo ativo (web)
summary: >
  KPIs do ciclo ativo (ainda pode gastar hoje, disponível no ciclo, disponível no crédito, gasto no saldo, gasto no crédito da fatura vigente), gráfico de
  gasto diário vs. limite, compromissos reservados e limite dos cartões, todos calculados pelo núcleo.
keywords: [dashboard, visão geral, limite diário, compromissos, kpi]
code:
  - client/src/features/overview/OverviewPage.tsx
  - client/src/lib/overview.ts
  - client/src/lib/chart.ts
symbols: [buildOverview, OverviewPage, moneyTicks]
business_rules: [BR-FIN-004, BR-FIN-005, BR-FIN-026]
adrs: [ADR-017, ADR-020]
tests: [client/src/lib/view-models.test.ts, client/src/lib/chart.test.ts]
last_verified_commit: 7903717+T-042e
---

# Visão geral (CLIENT-010)

- Números de `buildDashboardSummary`, `selectUpcomingCommitments` e `selectCardLimitUsage` (os mesmos do
  Hoje do app); teste de paridade com fixture.
- "Disponível no ciclo" já desconta fixas pendentes, faturas e a meta (ADR-017); por isso não existe uma
  métrica extra de "livre após compromissos" — a lista de compromissos mostra o que está reservado.
- Gráfico: barras = gasto do dia (`calculateTodaySpent`), linha = limite previsto do dia
  (`calculateDailyLimitForDate`), do início do ciclo até hoje; tabela equivalente em "Ver dados em tabela".
- Somente leitura no P0 (pagar fixa, renda avulsa, fechar ciclo e "Já recebi" são P1).
