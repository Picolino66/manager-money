---
id: category.analysis
type: feature
module: category
title: Análise por categoria
summary: >
  Filtra gastos, fixos e parcelamentos por período, categoria e tipo, e mostra o total, o gráfico
  de barras por categoria e a lista de itens.
keywords: [análise, gráfico, período, filtro, relatório]
code:
  - src/screens/CategoriesScreen.tsx
business_rules: [BR-FIN-012]
last_verified_commit: 52be7e8
---

# Análise por categoria

- Período (início e fim) com padrão no ciclo ativo; categoria ("Todas" ou uma); tipos
  (Gasto, Parcelado, Fixo).
- Os gastos entram pela data. Os fixos e parcelamentos ativos entram quando o período se
  sobrepõe ao ciclo ativo.
- Gráfico: barras proporcionais à maior categoria.
