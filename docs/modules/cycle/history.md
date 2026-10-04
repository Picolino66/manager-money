---
id: cycle.history
type: feature
module: cycle
title: Histórico diário e ciclos anteriores
summary: >
  Lista de gastos do ciclo ativo agrupados por dia, com o saldo de cada dia, e lista de ciclos
  fechados com o resultado final.
keywords: [histórico, dias, ciclos anteriores, resultado]
code:
  - app/src/screens/DailyHistoryScreen.tsx
  - app/src/screens/PreviousMonthsScreen.tsx
  - packages/core/src/application/selectors.ts
  - packages/core/src/domain/financial/financial.calculations.ts
symbols: [calculateDayBalance, calculateFinalBalance, selectCycleSpending, selectCycleSpendingRange]
business_rules: [BR-FIN-006, BR-FIN-008]
last_verified_commit: a1af85a+ciclos-filtro
---

# Histórico

- **Histórico (aba):** dias em ordem decrescente; cada dia mostra o total e se expande para listar
  os gastos (toque → editar) e o saldo do dia calculado com o limite daquele dia.
- **Ciclos (aba):** no topo, o filtro de **Mês** e **Ano** (padrão: ciclo atual). O mês é o do início do
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
    (sinalizado), saldo inicial e quantidade de gastos.
