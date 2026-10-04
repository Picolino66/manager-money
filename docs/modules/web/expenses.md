---
id: web.expenses
type: feature
module: web
title: Tabela de gastos (web)
summary: >
  Gastos à vista de todos os ciclos com busca, filtros por ciclo, categoria e período, ordenação e
  paginação; registrar, editar e excluir só no ciclo ativo, pelos casos de uso do núcleo.
keywords: [gastos, tabela, filtro, busca, editar, excluir, registrar]
code:
  - client/src/features/expenses/ExpensesPage.tsx
  - client/src/features/expenses/ExpenseFormDialog.tsx
  - client/src/lib/expenses.ts
  - client/src/components/ui/money-input.tsx
symbols: [buildExpenseRows, filterExpenseRows, ExpenseFormDialog, MoneyInput]
business_rules: [BR-FIN-001, BR-FIN-013]
adrs: [ADR-020]
tests: [client/src/lib/view-models.test.ts, client/src/features/features.test.tsx]
last_verified_commit: 3b9bf25+T-040
---

# Gastos (CLIENT-011/012)

- Linhas: gastos vivos de ciclos vivos; `editable` só no ciclo ativo (fechado mostra "Ciclo fechado").
- Busca sem acento em descrição e categoria; filtros em chips; TanStack Table ordena (data, descrição,
  categoria, valor) e pagina (20 por página); total do filtro em centavos.
- Registrar/editar: `addExpense`/`updateExpense` (data dentro do ciclo, valor > 0 em centavos — máscara
  igual à do app). Excluir: confirmação + `deleteExpense` (exclusão lógica, chega ao mobile no pull).
- Falha ao gravar: diálogo continua aberto com a mensagem; a tabela não muda.
- Compras no cartão ficam para o P1 (cartões e faturas).
