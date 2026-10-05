---
id: category.analysis
type: feature
module: category
title: Análise por categoria (Relatórios › Categorias)
summary: >
  Totais por categoria na base "Ciclo" (o que pesou no ciclo do salário, com as parcelas das faturas que vencem nele)
  ou "Período livre" (pela data), com filtros de categoria e tipo, gráfico de barras e lista de itens; criar categoria
  fica em Ajustes › Categorias.
keywords: [análise, gráfico, período, filtro, relatório, cartão, fixas pagas, ciclo, categorias]
code:
  - app/src/screens/reports/CategoriesReport.tsx
  - app/src/screens/ManageCategoriesScreen.tsx
  - packages/core/src/application/category-analysis.ts
symbols: [selectCategorizedItems, selectCycleCategorizedItems, filterCategorizedItems, filterCategorizedItemsByType, summarizeByCategory, CategoriesReport, ManageCategoriesScreen]
business_rules: [BR-FIN-012, BR-FIN-030, BR-FIN-039]
adrs: [ADR-022, ADR-024]
last_verified_commit: 7b1b7b1+T-043
---

# Análise por categoria

Fica na aba **Relatórios**, seção Categorias (ADR-024). Criar categoria saiu daqui para **Ajustes › Categorias**
(`ManageCategoriesScreen`: nome diferente de "Outros" e não repetido, `addCategory`).

- **Base** (padrão: ciclo atual):
  - **Ciclo** (`selectCycleCategorizedItems`, BR-FIN-039): gastos do ciclo, fixas pagas à vista nele e as **parcelas
    das faturas que vencem nele** (`n/N` no nome; fixa paga no crédito entra pela parcela, como fixa). Soma o mesmo que
    gastos + faturas do ciclo; juros e multas de fatura ficam de fora (sem categoria).
  - **Período livre** (início e fim, DD/MM/AAAA): todo item entra pela **data**:
    - **Gasto:** gasto à vista, pela data do gasto;
    - **Cartão:** compra no crédito pela data da compra, com o **valor total** (`Nx` no nome);
    - **Fixo / Parcelado:** **pagamentos efetivos** de despesas fixas, pela data do pagamento, com `valor + juros`;
      pago no crédito aparece como "(no crédito)".
- Categoria ("Todas" ou uma); tipos (Gasto, Cartão, Parcelado, Fixo) — **padrão: Gasto e Cartão ligados**.
- Sem dupla contagem (BR-FIN-030): a compra no cartão criada pelo pagamento de uma fixa não aparece de novo como "Cartão".
- Gráfico: barras proporcionais à maior categoria.

A montagem, o filtro e os totais moram no núcleo (`packages/core/src/application/category-analysis.ts`,
ADR-022), usados pelo app e pelo client web ([web.analysis](../web/analysis.md)).
