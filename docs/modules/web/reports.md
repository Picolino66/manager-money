---
id: web.reports
type: feature
module: web
title: Relatórios e aba Crédito (web)
summary: >
  Área Relatórios (Ciclos, Categorias, Crédito) e o relatório de crédito pelo ciclo do cartão: cada fatura com abertura,
  fechamento, vencimento, ciclo do salário em que pesa, valor, pago e situação, total por mês e filtros de cartão e ano.
keywords: [relatórios, crédito, faturas, ciclo do cartão, cartão, mês de fechamento]
code:
  - client/src/features/reports/ReportsLayout.tsx
  - client/src/features/reports/CreditReportPage.tsx
  - client/src/lib/credit-report.ts
  - client/src/lib/statement.ts
  - packages/core/src/application/credit-report.ts
symbols: [ReportsLayout, CreditReportPage, buildCreditReport, selectCreditReport, selectCreditReportYears]
business_rules: [BR-FIN-025, BR-FIN-033, BR-FIN-039]
adrs: [ADR-024]
tests: [packages/core/src/application/credit-report.test.ts, client/src/features/features.test.tsx]
last_verified_commit: 7b1b7b1+T-043
---

# Relatórios (ADR-024)

Olhar para trás. `/relatorios` abre em Ciclos; abas **Ciclos** ([cycles](cycles.md)), **Categorias**
([analysis](analysis.md)) e **Crédito**. A lista de lançamentos fica só no Histórico.

## Crédito (`/relatorios/credito`)
- `selectCreditReport` (núcleo): faturas de todos os cartões vivos (inclusive inativos com parcelas), só com parcelas em
  aberto no app (BR-FIN-027), inclusive as futuras. Cada uma: período do cartão (abertura → fechamento), vencimento,
  **ciclo em que pesa** (o que contém o vencimento; "Ciclo a abrir" se ainda não existe), valor (principal + encargos),
  pago e situação (Aberta, Fechada, Vencida, Parcial, Paga).
- Filtros: Cartão e Ano (do fechamento). Totais: faturas, juros e multas, pago, em aberto.
- Gráfico por mês de fechamento: barras empilhadas (valor + encargos) e linha do pago.
- "Lançamentos" leva ao Histórico com cartão e fatura filtrados.
