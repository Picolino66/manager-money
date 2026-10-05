---
id: web.expenses
type: feature
module: web
title: Histórico de pagamentos (web)
summary: >
  Tudo que foi pago em todos os ciclos (gasto à vista, cartão, fixas, parcelados e fatura) com busca,
  filtros por ciclo, categoria, tipo e período, ordenação e paginação; registrar, editar e excluir só
  gastos à vista do ciclo ativo, pelos casos de uso do núcleo.
keywords: [histórico, pagamentos, gastos, tabela, filtro, busca, editar, excluir, registrar]
code:
  - client/src/features/expenses/ExpensesPage.tsx
  - client/src/features/expenses/ExpenseFormDialog.tsx
  - client/src/features/expenses/CardPurchaseFormDialog.tsx
  - client/src/lib/expenses.ts
  - packages/core/src/application/paid-history.ts
  - client/src/components/ui/money-input.tsx
symbols: [filterPaidHistory, CardPurchaseFormDialog, buildHistoryRows, filterHistoryRows, selectPaidHistory, ExpenseFormDialog, MoneyInput]
business_rules: [BR-FIN-001, BR-FIN-013]
adrs: [ADR-020]
tests: [packages/core/src/application/paid-history.test.ts, client/src/lib/view-models.test.ts, client/src/features/features.test.tsx]
last_verified_commit: 7903717+T-042d
---

# Histórico em `/gastos` (CLIENT-011/012)

- Linhas: `selectPaidHistory` (núcleo, mesma fonte do Histórico do app): gastos à vista, compras no
  cartão (data da compra, valor total), fixas e parcelamentos pagos e pagamentos de fatura, de ciclos
  vivos. A coluna Ações mostra **lápis** (`editable`) e **lixeira** (`deletable`) conforme o núcleo; sem
  nenhum dos dois mostra "Somente leitura".
- Gasto: lápis abre o diálogo do gasto; lixeira exclui (`deleteExpense`). Compra no cartão: lápis abre
  `CardPurchaseFormDialog` (`updateCardPurchase`; compra anterior ao app muda descrição, categoria e data (BR-FIN-036)) e
  lixeira exclui (`deleteCardPurchase`, BR-FIN-029). Fixa/parcelado e lançamento de fatura do ciclo ativo:
  só lixeira, que **desfaz** (`undoFixedPayment`, `undoStatementPayment`); não há edição desses (sem caso
  de uso no núcleo). Toda remoção pede confirmação e o erro do núcleo aparece na tela.
- Coluna e filtro **Tipo** (Gasto, Cartão, Fixo, Parcelamento, Fatura) e coluna **Meio**: Crédito (compra no
  cartão e fixa paga no crédito) ou Saldo (gasto à vista, fixa paga em Pix/débito/dinheiro e fatura). O total soma só o que pesa
  (`countsInTotal`): pagamento de fatura é informativo (a compra já foi contada, ADR-018); encargos somam.
- Pix, débito e dinheiro não são distinguidos (o gasto à vista não guarda a forma): todos são Saldo.
- Filtros (`filterPaidHistory`, núcleo, os mesmos do app): busca sem acento em descrição e categoria, ciclo,
  categoria, tipo e período, em chips; TanStack Table ordena (data, descrição,
  tipo, meio, categoria, valor) e pagina (20 por página); total do filtro em centavos.
- Registrar/editar: `addExpense`/`updateExpense` (data dentro do ciclo, valor > 0 em centavos — máscara
  igual à do app). Excluir: confirmação + `deleteExpense` (exclusão lógica, chega ao mobile no pull).
- Falha ao gravar: diálogo continua aberto com a mensagem; a tabela não muda.
- Registrar compra no cartão, pagar fixa e pagar fatura ficam para o P1; aqui só se consulta.
