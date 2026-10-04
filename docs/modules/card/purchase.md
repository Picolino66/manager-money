---
id: card.purchase
type: feature
module: card
title: Compra parcelada no crédito
summary: >
  Em Registrar gasto, a forma de pagamento "Cartão de crédito" cria uma compra parcelada que entra
  na fatura do próximo fechamento e pesa no ciclo do vencimento dessa fatura, reduzindo o saldo
  inicial do ciclo e comprometendo o limite do cartão.
keywords: [crédito, parcelas, juros, fatura, fechamento, vencimento, saldo, limite]
code:
  - app/src/screens/AddExpenseScreen.tsx
  - app/src/components/CardLimitNotice.tsx
  - packages/core/src/application/card.use-cases.ts
  - packages/core/src/domain/financial/credit-card.ts
  - packages/core/src/application/cycle.use-cases.ts
symbols: [addCardPurchase, buildCardPurchase, calculateFirstCycleKey, statementKeyForDate, statementDueDate, statementCycleKey, splitInstallments, listInstallments, calculateCardChargesForCycle, recalculateActiveCycleBalance]
adrs: [ADR-014, ADR-017]
tests: [packages/core/src/domain/financial/credit-card.test.ts, packages/core/src/application/card.use-cases.test.ts, packages/core/src/application/financial-vision.test.ts, app/src/screens/screens.test.tsx]
business_rules: [BR-FIN-005, BR-FIN-019, BR-FIN-020, BR-FIN-025, BR-FIN-026, BR-FIN-030]
last_verified_commit: bfe9de6+T-028
---

# Compra parcelada no crédito

Specs: [SPEC-013](../../../specs/SPEC-013-cartoes-de-credito.md), [SPEC-016](../../../specs/SPEC-016-faturas-e-limite-do-cartao.md).

- **Formulário:** "Forma de pagamento" = **À vista** ou **Cartão de crédito**; no crédito pede cartão (só
  **ativos**) e parcelas (1–48) e rotula o valor como "Valor total (com juros)". Mostra "Nx de R$ …", a fatura
  e o vencimento da 1ª parcela. Compra acima do "Limite disponível do cartão" mostra o aviso (`CardLimitNotice`) e pede confirmação
  (`confirmCardLimit`: alerta "Passa do limite do cartão" com quanto excede, `calculateLimitExcess`, e os botões
  "Cancelar" / **"Registrar mesmo assim"**) — **avisa e permite**, nunca bloqueia.
- **Fatura (BR-FIN-025):** primeiro fechamento em ou depois da data (no dia do fechamento = mesma fatura);
  chave `yyyy-MM` do mês de fechamento (`statementKeyForDate`). Vencimento = próximo `dueDay` depois do
  fechamento (`statementDueDate`: mesmo mês se `dueDay > closingDay`; senão, mês seguinte).
- **Ciclo:** a fatura pesa no **ciclo que contém o vencimento** (`statementCycleKey`), nunca antes do ciclo
  ativo (`calculateFirstCycleKey` recebe o cartão). As chaves `firstStatementKey` e `firstCycleKey` são
  gravadas na compra; a parcela *n* fica em `chave + (n − 1)` meses (`listInstallments`), atravessando anos.
- **Validações (`buildCardPurchase`):** configuração e ciclo ativo; cartão vivo e ativo; descrição; valor > 0;
  data **dentro do ciclo ativo** (compras anteriores entram pela [situação inicial](existing-debt.md));
  compra retroativa em fatura **fechada com lançamento** (pagamento, mesmo parcial, ou encargo) é recusada; se o fechamento foi aumentado depois do lançamento
  e a fatura paga ainda está "aberta" pelo dia novo, a compra vai para a fatura seguinte (BR-FIN-028). Compras feitas no app não têm `origin` (só a situação inicial grava
  `origin = 'existing'`).
- **Saldo:** `initialAvailableAmount` do ciclo = base − dívida − parcelas do ciclo − encargos de faturas lançados no
  ciclo − restante de faturas parciais transportado (BR-FIN-005/034).
  É recalculado ao registrar/editar/excluir compra, ao salvar a configuração e ao abrir cada ciclo.
- **Limite:** a compra compromete o valor total na hora (todas as parcelas); cada pagamento de fatura libera só o
  que amortizou (BR-FIN-026). Acima do disponível: alerta forte + confirmação (`calculateLimitExcess`).
- A compra não vira gasto diário (BR-FIN-030): é um compromisso do ciclo do vencimento. Não aparece na lista
  de gastos; aparece em Cartões, nas faturas e nos próximos compromissos do Hoje.
- **Limitação conhecida:** num ciclo antecipado ("Já recebi"), fatura com vencimento entre o início antecipado e o
  dia de pagamento natural é mapeada pela chave mensal do ciclo; as parcelas seguintes podem pesar um ciclo à
  frente (ver ADR-017, trade-offs).
- Compras anteriores à ADR-017 mantêm o `firstCycleKey` antigo (ciclo do fechamento); a migração v6 → v7 só
  deriva a `firstStatementKey`.
