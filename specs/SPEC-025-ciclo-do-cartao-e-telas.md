---
spec: SPEC-025
features: [web.overview, web.expenses, web.cycles, web.analysis, web.cards, web.shell, cycle.history, cycle.dashboard, category.analysis]
---
# SPEC-025 — Ciclo do cartão em todas as telas e uma responsabilidade por tela

## Objetivo
Basear o crédito no ciclo do cartão (fatura) em todas as telas, com a mesma conta do card "Gasto no crédito", e
reorganizar as telas para cada uma ter uma responsabilidade, sem repetir a lista de lançamentos.

## Docs relacionados
[business-rules](../docs/business/business-rules.md) (BR-FIN-025/037/038/039) · [ADR-024](../adr/ADR-024-ciclo-do-cartao-e-responsabilidade-das-telas.md) ·
[web/overview](../docs/modules/web/overview.md) · [web/expenses](../docs/modules/web/expenses.md) ·
[web/cycles](../docs/modules/web/cycles.md) · [web/analysis](../docs/modules/web/analysis.md) ·
[cycle/history](../docs/modules/cycle/history.md) · [category/analysis](../docs/modules/category/analysis.md)

## Requisitos relacionados
RF-04, RF-05, RF-06, RF-09, RF-13 · BR-FIN-004, BR-FIN-025, BR-FIN-037, BR-FIN-038, BR-FIN-039.

## Regras
- Crédito pela fatura (BR-FIN-039): o histórico põe compra, parcela e fixa paga no crédito no ciclo em que a fatura
  **vence**; o que saiu do saldo fica no ciclo em que saiu.
- Visão geral (web): dois gráficos, cada um com De/Até. Saldo: atalho por ciclo do salário. Crédito: "Vence neste ciclo"
  (padrão), "Aberta" ou "Personalizado", e cartão quando houver mais de um. Séries do crédito: compras do dia (parcela que
  entra na fatura), fatura acumulada (termina no total das faturas = card "Gasto no crédito") e disponível de crédito.
- Histórico (web e app): coluna/rótulo e filtro **Fatura**; o web aceita filtros pelo link.
- Relatórios: Ciclos (comparação, gasto no saldo, faturas do ciclo, resultado; detalhe com saldo dia a dia), Categorias
  (base Ciclo — parcelas das faturas que vencem nele — ou Período livre) e Crédito (faturas por mês, por cartão e ano).
- Navegação: Hoje/Visão geral · Histórico · Cartões · Relatórios · Ajustes (web e app); rotas antigas redirecionam.

## Critérios de aceite
- O último dia da fatura acumulada no gráfico (fatura que vence no ciclo) é igual ao card "Gasto no crédito".
- Uma compra cuja fatura vence no próximo ciclo não aparece no histórico do ciclo atual; aparece em "Nas próximas
  faturas" (app) ou com "Ciclo a abrir" (web).
- Categorias na base Ciclo somam o mesmo que gastos + faturas do ciclo (`selectCycleSpending`).
- Os links antigos (`/ciclos`, `/analise`, `/ajustes/cartoes`) continuam funcionando.
