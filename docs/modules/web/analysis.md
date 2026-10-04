---
id: web.analysis
type: feature
module: web
title: Análise por categoria e período (web)
summary: >
  Totais por categoria num período livre, com filtro de categoria e de tipos (gasto, cartão, parcelado,
  fixo), gráfico de barras e tabela equivalente, usando a mesma função do app.
keywords: [análise, categorias, período, gráfico, relatório]
code:
  - client/src/features/analysis/AnalysisPage.tsx
  - packages/core/src/application/category-analysis.ts
symbols: [selectCategorizedItems, filterCategorizedItems, summarizeByCategory, sumCategorizedItems]
business_rules: [BR-FIN-001]
adrs: [ADR-020, ADR-022]
tests: [packages/core/src/application/category-analysis.test.ts, client/src/lib/view-models.test.ts]
last_verified_commit: 3b9bf25+T-040
---

# Análise (CLIENT-014)

- Mesma regra da aba Categorias do app (RF-09), agora no núcleo: fixa paga no crédito conta uma vez
  (como fixa, valor + juros); compra no cartão pelo total na data da compra.
- Padrão igual ao app: período do ciclo ativo, tipos Gasto e Cartão ligados.
- Gráfico de barras horizontais (eixo em reais inteiros) + tabela com total e % + lista de lançamentos.
- Comparação entre ciclos e tendências ficam para P1/P2.
