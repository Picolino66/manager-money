---
id: card.purchase
type: feature
module: card
title: Compra parcelada no crédito
summary: >
  Em Registrar gasto, a forma de pagamento "Cartão de crédito" cria uma compra parcelada cuja 1ª
  parcela cai no ciclo do fechamento da fatura e que reduz o saldo inicial de cada ciclo.
keywords: [crédito, parcelas, juros, fatura, fechamento, saldo]
code:
  - src/screens/AddExpenseScreen.tsx
  - src/application/card.use-cases.ts
  - src/domain/financial/credit-card.ts
  - src/application/cycle.use-cases.ts
symbols: [addCardPurchase, calculateFirstCycleKey, calculateInvoiceClosingDate, splitInstallments, calculateCardChargesForCycle, recalculateActiveCycleBalance]
adrs: [ADR-014]
tests: [src/domain/financial/credit-card.test.ts, src/application/card.use-cases.test.ts, src/screens/screens.test.tsx]
business_rules: [BR-FIN-005, BR-FIN-019, BR-FIN-020]
last_verified_commit: 1e8ade5+T-019
---

# Compra parcelada no crédito

Spec: [SPEC-013](../../../specs/SPEC-013-cartoes-de-credito.md).

- **Formulário:** "Forma de pagamento" = À vista (Pix, dinheiro ou débito) ou Cartão de crédito;
  no crédito pede cartão e parcelas e rotula o valor como "Valor total (com juros)".
  Mostra "Nx de R$ …" e em qual ciclo cai a 1ª parcela.
- **Regra (BR-FIN-019):** fatura = primeiro fechamento em ou depois da data; 1ª parcela no ciclo
  que contém esse fechamento (limitada ao ciclo ativo); demais, um ciclo por parcela.
- **Saldo:** `initialAvailableAmount` do ciclo = base − dívida − parcelas do ciclo. É recalculado
  ao registrar/excluir compra, ao salvar a configuração e ao abrir cada ciclo (`createCycle`).
- A compra não vira gasto diário: ela é um compromisso do ciclo (como a fatura). Não aparece na
  lista de gastos; aparece em Cartões e na linha "Faturas de cartão" do Hoje e do Abrir ciclo.
- Limitação conhecida: ciclo antecipado ("Já recebi") entre o início antecipado e o dia de
  pagamento pode deslocar em 1 ciclo um fechamento que caia nessa janela (a chave do ciclo é o
  mês do início).
