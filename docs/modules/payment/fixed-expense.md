---
id: payment.fixed-expense
type: feature
module: payment
title: Pagar despesas fixas do ciclo
summary: >
  O Hoje lista as despesas fixas ativas do ciclo como pendentes (reservadas no saldo) ou pagas;
  Pagar à vista confirma a saída já reservada e Pagar no crédito (cartão, parcelas e juros) tira a
  reserva e leva o valor para as faturas.
keywords: [pagar, despesa fixa, à vista, pix, crédito, juros, pendente, reservada, desfazer, inativa]
code:
  - app/src/components/FixedExpensesCard.tsx
  - app/src/components/PayFixedExpenseModal.tsx
  - app/src/components/CardLimitNotice.tsx
  - app/src/screens/DashboardScreen.tsx
  - packages/core/src/application/payment.use-cases.ts
  - packages/core/src/domain/financial/payments.ts
  - packages/core/src/domain/financial/financial.calculations.ts
  - packages/core/src/application/selectors.ts
symbols: [launchRecurringCharges, selectRecurringIssues, payFixedExpense, undoFixedPayment, calculatePaidFixedAmount, calculateBaseAvailableAmount, calculateInitialAvailableAmount, selectCycleAdjustments, selectPendingFixedExpenses]
adrs: [ADR-015, ADR-014, ADR-017, ADR-023]
tests: [packages/core/src/application/payment.use-cases.test.ts, packages/core/src/application/recurring-card.test.ts, packages/core/src/application/financial-vision.test.ts, app/src/screens/screens.test.tsx, app/src/infrastructure/sync/sync-engine.test.ts]
business_rules: [BR-FIN-004, BR-FIN-005, BR-FIN-021, BR-FIN-022, BR-FIN-030, BR-FIN-035]
last_verified_commit: 7903717+T-042e
---

# Pagar despesas fixas do ciclo

Specs: [SPEC-014](../../../specs/SPEC-014-pagamento-de-fixas-e-renda-avulsa.md), [SPEC-018](../../../specs/SPEC-018-hoje-compromissos-e-projecao.md) (reserva de pendentes, ADR-017).

- **Lista:** "Despesas fixas do ciclo" no Hoje, **encolhida por padrão** (só o título, "Pagas … · Pendentes …" e a seta); ao tocar, expande. Cada linha: nome (e parcela `n/N` dos
  parcelamentos), categoria, valor, **Pendente** ou **Pago · forma**, e **Pagar**/**Desfazer**.
  Resumo "Pagas … · Pendentes …". Só fixas **ativas** e com valor no ciclo contam como pendentes (`selectPendingFixedExpenses` ignora parcelamento quitado).
- **Reserva (BR-FIN-004, ADR-017):** fixa ativa pendente **já desconta** o saldo do ciclo
  (`pendingFixedExpenses` em `calculateBaseAvailableAmount`): o limite diário nasce realista. As pendentes
  continuam listadas em "Despesas fixas do ciclo" do Hoje ([cycle.dashboard](../cycle/dashboard.md)).
- **Pagar:** duas formas, como em Registrar gasto: **À vista (Pix, dinheiro ou débito)** e **Cartão de crédito**. À vista não abre outro menu e é gravada como `cash` (`pix`/`debit` seguem válidos em dados antigos); a lista mostra "Pago · À vista".
- **Pagar (à vista):** o valor passa de "pendente" para "pago à vista" (`paidFixedExpenses`); o **saldo não
  muda**, porque já estava reservado.
- **Pagar (crédito):** escolhe cartão (ativo), parcelas e juros (R$). Cria compra no cartão de `valor +
  juros` (BR-FIN-020/025): a fixa **sai da reserva** e só as parcelas descontam, no ciclo do **vencimento** de
  cada fatura (BR-FIN-030, sem dupla contagem). Só cartões ativos; se `valor + juros` passar do limite disponível,
  mostra `CardLimitNotice` e o Alert "Continuar mesmo assim?" (avisa, não bloqueia). Sem cartão: atalho para cadastrar.
- **Recorrente no cartão (BR-FIN-035, ADR-023, [SPEC-024](../../../specs/SPEC-024-fixa-recorrente-no-cartao.md)):** a fixa permanente com
  `recurringCardId` é **cobrada sozinha a cada virada de fatura** do cartão (dia seguinte ao fechamento): compra de 1 parcela, sem
  juros, datada na virada + pagamento ligado, como o "Pagar no crédito" (`launchRecurringFixedExpenses`). O app confere ao carregar, ao
  voltar ao primeiro plano, depois de sincronizar e ao abrir o ciclo (`launchRecurringCharges`, `launchRecurring` no store). Sai da
  reserva e pesa pela fatura. Ids `auto-buy-`/`auto-pay-` + `yyyy-MM` da fatura + id da fixa. A linha mostra "Pago · Crédito ·
  lançada automaticamente". Antes da virada, ou se não foi possível (cartão inativo/excluído, fatura da data já paga) ou o usuário
  desfez, a fixa fica **pendente e reservada** com o motivo (`selectRecurringIssues`, ex.: "Será lançada na virada da fatura Nubank,
  em 06/11"). Mudança de valor/cartão vale na próxima virada.
- Um pagamento vigente por despesa e ciclo; a data do pagamento é hoje, limitada ao período do ciclo.
- **Desfazer** (ciclo ativo): remove o pagamento (a fixa volta a ficar reservada) e, no crédito, a compra no
  cartão — bloqueado se a compra já pesou em ciclo fechado ou em fatura com lançamento (BR-FIN-029).
- **Excluir a compra no cartão** gerada por essa fixa (em Cartões) exclui junto o pagamento: a fixa volta a
  Pendente e reservada (BR-FIN-030); bloqueado se o pagamento for de ciclo encerrado. Editar valor, parcelas ou
  data dessa compra é bloqueado ("Desfaça o pagamento"); descrição e categoria podem mudar.
- **Fixa inativa:** não reserva, não aparece como pendente e não pode ser paga ("Esta despesa fixa está inativa.").
- No ciclo seguinte as fixas voltam a Pendente; pagamentos de ciclos fechados ficam no histórico.
- O pagamento guarda foto do nome e da categoria, então editar a despesa não muda o histórico.
