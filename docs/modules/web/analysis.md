---
id: web.analysis
type: feature
module: web
title: Relatórios › Categorias (web)
summary: >
  Aba Categorias dos Relatórios: totais por categoria na base "Ciclo" (o que pesou no ciclo do salário, com as parcelas
  das faturas que vencem nele) ou "Período livre" (pela data), filtros de categoria e tipos, gráfico e tabela.
keywords: [análise, categorias, período, gráfico, relatório, ciclo, fatura]
code:
  - client/src/features/analysis/AnalysisPage.tsx
  - packages/core/src/application/category-analysis.ts
symbols: [selectCategorizedItems, selectCycleCategorizedItems, filterCategorizedItems, filterCategorizedItemsByType, summarizeByCategory, sumCategorizedItems]
business_rules: [BR-FIN-001, BR-FIN-039]
adrs: [ADR-020, ADR-022, ADR-024]
tests: [packages/core/src/application/category-analysis.test.ts, packages/core/src/application/credit-report.test.ts, client/src/lib/view-models.test.ts, client/src/features/features.test.tsx]
last_verified_commit: 7b1b7b1+T-043
---

# Relatórios › Categorias (CLIENT-014)

Rota `/relatorios/categorias` (`/analise` redireciona; ADR-024).

- **Base** (padrão: ciclo atual):
  - **Ciclo** (`selectCycleCategorizedItems`, BR-FIN-039): gastos do ciclo, fixas pagas à vista nele e as **parcelas das
    faturas que vencem nele** (fixa paga no crédito entra pela parcela, como fixa). Soma o mesmo que gastos + faturas do
    ciclo (`selectCycleSpending`); juros e multas de fatura não têm categoria e ficam de fora.
  - **Período livre** (De/Até com máscara): `selectCategorizedItems` — compra no cartão pelo total na data da compra; fixa
    paga no crédito conta uma vez (como fixa, valor + juros).
- Tipos Gasto e Cartão ligados por padrão; filtro de categoria.
- Gráfico de barras horizontais (eixo em reais inteiros) + tabela com total e %. A lista de lançamentos fica no
  Histórico: "Ver lançamentos no Histórico" leva com ciclo (ou De/Até) e categoria já filtrados.
