---
id: web.overview
type: feature
module: web
title: Visão geral do ciclo ativo (web)
summary: >
  KPIs do ciclo ativo na ordem: ainda pode gastar hoje, gasto no saldo, disponível no ciclo, gasto no crédito (faturas que vencem no ciclo) e disponível no crédito; dois gráficos diários
  (saldo e crédito), compromissos reservados e limite dos cartões, todos calculados pelo núcleo.
keywords: [dashboard, visão geral, limite diário, compromissos, kpi]
code:
  - client/src/features/overview/OverviewPage.tsx
  - client/src/lib/overview.ts
  - client/src/lib/chart.ts
  - packages/core/src/application/credit-series.ts
symbols: [selectCreditDailySeries, buildOverview, OverviewPage, moneyTicks, moneyTicksBetween]
business_rules: [BR-FIN-004, BR-FIN-005, BR-FIN-026]
adrs: [ADR-017, ADR-020]
tests: [client/src/lib/view-models.test.ts, client/src/lib/chart.test.ts, packages/core/src/application/credit-series.test.ts, client/src/features/features.test.tsx]
last_verified_commit: 7903717+T-042l
---

# Visão geral (CLIENT-010)

- Números de `buildDashboardSummary`, `selectUpcomingCommitments` e `selectCardLimitUsage` (os mesmos do
  Hoje do app); teste de paridade com fixture.
- "Disponível no ciclo" já desconta fixas pendentes, faturas e a meta (ADR-017); por isso não existe uma
  métrica extra de "livre após compromissos" — a lista de compromissos mostra o que está reservado.
- **Dois gráficos** (do início do ciclo até hoje, cada um com "Ver dados em tabela"):
  - **Saldo no ciclo:** barras = gasto do saldo do dia (`calculateTodaySpent`); linhas = limite previsto do dia
    (`calculateDailyLimitForDate`, em degrau) e disponível no ciclo ao fim do dia (saldo inicial − gasto acumulado).
  - **Crédito no ciclo (BR-FIN-037):** barras = gasto do crédito do dia (compras feitas no dia, pelo valor total);
    linha = disponível de crédito ao fim do dia (limite − comprometido por compras e pagamentos de fatura até a
    data; cartão sem limite fica de fora; sem nenhum limite a linha não aparece). Núcleo: `selectCreditDailySeries`.
  - O eixo inclui valores negativos (`moneyTicksBetween`) quando o disponível estoura.
- Somente leitura no P0 (pagar fixa, renda avulsa, fechar ciclo e "Já recebi" são P1).
