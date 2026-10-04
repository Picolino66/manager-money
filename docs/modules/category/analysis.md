---
id: category.analysis
type: feature
module: category
title: Análise por categoria
summary: >
  Filtra gastos, compras no cartão e pagamentos de fixas e parcelamentos por período, categoria e
  tipo, e mostra o total, o gráfico de barras por categoria e a lista de itens.
keywords: [análise, gráfico, período, filtro, relatório, cartão, fixas pagas]
code:
  - app/src/screens/CategoriesScreen.tsx
  - packages/core/src/application/category-analysis.ts
symbols: [selectCategorizedItems, filterCategorizedItems, summarizeByCategory]
business_rules: [BR-FIN-012, BR-FIN-030]
last_verified_commit: 3b9bf25+T-039
---

# Análise por categoria

- Período (início e fim) com padrão no ciclo ativo; categoria ("Todas" ou uma); tipos
  (Gasto, Cartão, Parcelado, Fixo) — **padrão: Gasto e Cartão ligados**.
- Todo item entra pela **data** dentro do período:
  - **Gasto:** gasto à vista do dia a dia, pela data do gasto;
  - **Cartão:** compra no crédito pela data da compra, com o **valor total** (`Nx` no nome);
  - **Fixo / Parcelado:** **pagamentos efetivos** de despesas fixas (não a configuração), pela data do
    pagamento, com `valor + juros`; pago no crédito aparece como "(no crédito)".
- Sem dupla contagem (BR-FIN-030): a compra no cartão criada pelo pagamento de uma fixa não aparece de
  novo como "Cartão". Subtítulo: "Compras no cartão contam pela data da compra (valor total); fixas, quando pagas".
- Gráfico: barras proporcionais à maior categoria.

A montagem, o filtro e os totais moram no núcleo (`packages/core/src/application/category-analysis.ts`,
ADR-022), usados pela tela do app e pela análise do client web ([web.analysis](../web/analysis.md)).
