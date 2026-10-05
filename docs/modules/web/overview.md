---
id: web.overview
type: feature
module: web
title: Visão geral do ciclo ativo (web)
summary: >
  KPIs do ciclo ativo na ordem: ainda pode gastar hoje, gasto no saldo, disponível no ciclo, gasto no crédito (faturas que vencem no ciclo) e disponível no crédito; dois gráficos diários
  com De/Até — saldo pelo ciclo do salário e crédito pelo ciclo do cartão (fatura) —, compromissos reservados e limite dos cartões, todos calculados pelo núcleo.
keywords: [dashboard, visão geral, limite diário, compromissos, kpi, fatura, ciclo do cartão, gráfico]
code:
  - client/src/features/overview/OverviewPage.tsx
  - client/src/features/overview/ChartCards.tsx
  - client/src/components/DailyChart.tsx
  - client/src/lib/overview.ts
  - client/src/lib/chart.ts
  - packages/core/src/application/credit-series.ts
  - packages/core/src/application/spendable-today.ts
  - packages/core/src/application/cycle-balance.ts
symbols: [selectCycleBalance, describeSpendableToday, selectCreditDailySeries, selectCreditPeriod, selectBalanceDailySeries, buildOverview, buildCreditChart, OverviewPage, DailyChart, moneyTicksBetween]
business_rules: [BR-FIN-004, BR-FIN-005, BR-FIN-026, BR-FIN-037, BR-FIN-039, BR-FIN-040, BR-FIN-041]
adrs: [ADR-017, ADR-020, ADR-024]
tests: [client/src/lib/view-models.test.ts, client/src/lib/chart.test.ts, packages/core/src/application/credit-series.test.ts, client/src/features/features.test.tsx]
last_verified_commit: 7b1b7b1+T-043c
---

# Visão geral (CLIENT-010)

Responde "como estou agora?" (ADR-024): não há lista de lançamentos aqui — ela fica no Histórico.

- Números de `buildDashboardSummary`, `selectUpcomingCommitments`, `selectCardLimitUsage` e `selectCreditSnapshot`
  (os mesmos do Hoje do app); teste de paridade com fixture.
- "Ainda pode gastar hoje": com o ciclo no negativo mostra R$ 0,00 e quanto falta cobrir até o fim do ciclo
  (`describeSpendableToday`, BR-FIN-040), igual ao Hoje do app.
- "Disponível no ciclo" mostra embaixo o **saldo em conta** (`selectCycleBalance`, BR-FIN-041): disponível + compromissos
  reservados + meta. "Gasto no saldo" segue só com os gastos do dia a dia; a dica traz as fixas pagas (já reservadas) e a meta.
- "Disponível no ciclo" já desconta fixas pendentes, faturas e a meta (ADR-017); a lista de compromissos mostra o
  que está reservado. "Limite dos cartões" leva a Cartões.
- **Dois gráficos** (`DailyChart`, cada um com "Ver dados em tabela"; dias depois de hoje ficam vazios):
  - **Saldo no ciclo** — ciclo do salário (BR-FIN-039). Período: atalho por ciclo (atual ou anteriores) ou De/Até
    livre (cada dia usa o ciclo que o contém; `selectBalanceDailySeries`). Barras empilhadas = gasto do saldo do dia e **fixas pagas** pelo saldo no dia (BR-FIN-041; já reservadas, não mudam as
    linhas); linhas =
    limite previsto (em degrau; para em zero com o ciclo no negativo, BR-FIN-040) e disponível no ciclo ao fim do dia
    (mostra o buraco real).
  - **Crédito no ciclo do cartão** — fatura (BR-FIN-039). "Fatura": **Vence neste ciclo** (padrão; as faturas que
    vencem no ciclo ativo, as mesmas do card "Gasto no crédito"), **Aberta** (recebe as compras de hoje) ou
    **Personalizado** (De/Até; em cada dia, a fatura que recebe as compras daquele dia). Com mais de um cartão, escolhe-se
    o cartão (Todos = da primeira abertura ao último fechamento). A descrição mostra o período de cada fatura
    ("Inter: 09/09 a 08/10, vence 15/10"). Séries (`selectCreditPeriod` + `selectCreditDailySeries`): barras = compras
    do dia (a parcela que entra na fatura; **compra anterior ao app entra pela data salva nela**, BR-FIN-036 — a "Fatura
    em aberto" salva sem data aparece no dia do fechamento); linhas = **fatura acumulada** (parcelas de compras datadas
    até o dia; as de antes do período já entram no 1º dia; o último dia é o total do card) e **disponível de crédito** (limite − comprometido por compras datadas até o dia, inclusive as anteriores ao app pela data salva, e pagamentos até a data; espelha a fatura acumulada e hoje é igual ao card "Disponível no crédito"; cartão sem limite fica de fora).
  - O eixo inclui valores negativos (`moneyTicksBetween`) quando o disponível estoura.
- Somente leitura no P0 (pagar fixa, renda avulsa, fechar ciclo e "Já recebi" são P1).
