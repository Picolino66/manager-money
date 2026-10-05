---
id: cycle.history
type: feature
module: cycle
title: Histórico diário e Relatórios › Ciclos (app)
summary: >
  Histórico de tudo que pesa no ciclo ativo (gasto à vista, cartão pela fatura que vence nele, fixas, parcelados e fatura)
  agrupado por dia, com o saldo de cada dia e o bloco "Nas próximas faturas"; e a aba Ciclos dos Relatórios com o que pesou
  em cada ciclo e os ciclos fechados.
keywords: [histórico, dias, ciclos anteriores, resultado, fatura, relatórios]
code:
  - app/src/screens/DailyHistoryScreen.tsx
  - app/src/components/HistoryFilterModal.tsx
  - app/src/screens/reports/CyclesReport.tsx
  - app/src/screens/ReportsScreen.tsx
  - packages/core/src/application/selectors.ts
  - packages/core/src/application/paid-history.ts
  - packages/core/src/domain/financial/financial.calculations.ts
symbols: [filterPaidHistory, selectPaidHistory, listHistoryStatementKeys, sumPaidHistory, calculateDayBalance, calculateFinalBalance, selectCycleSpending, selectCycleSpendingRange]
business_rules: [BR-FIN-006, BR-FIN-008, BR-FIN-038, BR-FIN-039]
adrs: [ADR-024]
last_verified_commit: 7b1b7b1+T-043
---

# Histórico

- **Histórico (aba):** tudo que pesa no **ciclo ativo** (`selectPaidHistory`, núcleo; BR-FIN-039: o que saiu do saldo
  no ciclo em que saiu; compra, parcela e fixa paga no crédito no ciclo em que a **fatura vence**): gasto à vista,
  compra no cartão (**uma linha por parcela**, 1/3, 2/3, 3/3 — BR-FIN-038; à vista, uma linha), fixas e parcelamentos pagos e pagamentos de fatura.
  Dias em ordem decrescente; cada dia mostra o total pago (`sumPaidHistory`) e se expande para listar os
  itens com meio, tipo e categoria ("Meio · Tipo · Categoria"): Meio = Crédito ou Saldo (Pix, débito e
  dinheiro); Tipo = Gasto, Cartão, Fixo, Parcelamento, Fatura. Cada linha tem **lápis** (editar) e
  **lixeira** (excluir/desfazer) conforme `editable`/`deletable` do núcleo: gasto à vista (ciclo ativo) →
  lápis abre a tela de gasto, lixeira exclui; compra no cartão (BR-FIN-029) → lápis abre o detalhe do
  cartão, lixeira exclui; fixa/parcelado e lançamento de fatura do ciclo ativo → só lixeira, que **desfaz**
  (`undoFixedPayment`, `undoStatementPayment`). Toda remoção pede confirmação. O saldo do dia continua
  calculado só com os gastos à vista e o limite
  daquele dia (`calculateDayBalance`). Pagamento de fatura é informativo e não soma (a compra já foi
  contada, ADR-018); os encargos (juros/multa) somam. Pix, débito e dinheiro não são distinguidos: Saldo.
  Linha de crédito mostra "fatura MM/AAAA, vence dd/MM"; o dia de uma compra datada antes do ciclo (a fatura vence nele)
  não mostra "Saldo do dia". O crédito cujas faturas vencem **depois** do ciclo ativo (compras recentes e parcelas por
  vir) fica no bloco **"Nas próximas faturas"**, com a data, fora dos totais.
- **Filtros:** ícone de funil à direita do título "Histórico diário" (destacado quando há filtro ativo) abre
  o modal `HistoryFilterModal` com os mesmos filtros do client web, via `filterPaidHistory` (núcleo): busca
  sem acento em descrição e categoria, categoria, tipo e período (DD/MM/AAAA; vazio = sem limite). Não há
  filtro de ciclo (mas tem o de **Cartão**, só com cartão cadastrado, e o de **Fatura**, com as faturas presentes), pois a aba só mostra o ciclo ativo. Sem resultado: "Nada encontrado" com "Limpar filtros".
- **Relatórios › Ciclos** (aba Relatórios, seletor Ciclos | Categorias | Crédito — ADR-024): no topo, o filtro de **Mês** e **Ano** (padrão: ciclo atual). O mês é o do início do
  ciclo. O ano e o mês ficam limitados ao ciclo mais antigo registrado e ao último ciclo com parcela de
  cartão, mais 3 ciclos de margem (`selectCycleSpendingRange`).
  - Para o ciclo escolhido (`selectCycleSpending`): gastos do dia a dia, fixas pagas à vista, **faturas que
    vencem nele** com cada compra e parcela (`3/10`), juros e multas de faturas, e o total. Fixa paga no
    crédito aparece na fatura, não duplicada.
  - **Ciclo atual:** soma também as fixas pendentes (reservadas). **Ciclo futuro** (selo "Previsto"): só o
    que já está comprometido, isto é, parcelas de cartão que caíram em faturas futuras e fixas previstas
    (BR-FIN-031). **Passado sem registro ou sem dados:** "Sem dados neste ciclo".
  - Ciclos fechados não mudam (INV-09). Leitura pura: não grava nada.
  - Abaixo do filtro, a lista de **ciclos anteriores** fechados, por data de fim decrescente, com resultado
    (sinalizado), saldo inicial, **faturas do ciclo** e quantidade de gastos.
- **Relatórios › Crédito** (`CreditReport`, `selectCreditReport`): faturas por cartão e ano, com período do cartão,
  vencimento, ciclo em que pesam, valor, pago e situação, e o total por mês de fechamento (BR-FIN-039).
